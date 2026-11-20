use std::sync::Arc;
use std::time::Instant;

use axum::Json;
use axum::Router;
use axum::extract::ws::{Message, WebSocket};
use axum::extract::{Path, Query, State, WebSocketUpgrade};
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::routing::get;
use futures_util::sink::SinkExt;
use futures_util::stream::{SplitSink, StreamExt};
use serde::{Deserialize, Serialize};
use tokio::sync::broadcast::error::RecvError;

use crate::lobby::{Lobby, TableHandle};
use crate::protocol::{ClientMsg, Look, ServerMsg, TableSummary};
use crate::table::TableConfig;

#[derive(Clone)]
pub struct AppState {
    pub lobby: Arc<Lobby>,
}

pub fn router(state: AppState) -> Router {
    Router::new()
        .route("/api/tables", get(list_tables).post(create_table))
        .route("/api/tables/{code}", get(get_table))
        .route("/ws/{code}", get(ws_upgrade))
        .with_state(state)
}

type ApiError = (StatusCode, String);

async fn list_tables(State(app): State<AppState>) -> Json<Vec<TableSummary>> {
    Json(app.lobby.public_summaries())
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreateTable {
    name: String,
    small_blind: u64,
    big_blind: u64,
    buy_in: u64,
    max_seats: usize,
    #[serde(default)]
    private: bool,
}

async fn create_table(
    State(app): State<AppState>,
    Json(body): Json<CreateTable>,
) -> Result<Json<TableSummary>, ApiError> {
    let config = validate_config(body).map_err(|msg| (StatusCode::BAD_REQUEST, msg))?;
    let handle = app.lobby.create(config);
    let summary = handle.lock().summary();
    Ok(Json(summary))
}

async fn get_table(
    State(app): State<AppState>,
    Path(code): Path<String>,
) -> Result<Json<TableSummary>, ApiError> {
    let handle = app
        .lobby
        .get(&code)
        .ok_or((StatusCode::NOT_FOUND, "No table with that code".to_string()))?;
    let summary = handle.lock().summary();
    Ok(Json(summary))
}

fn validate_config(body: CreateTable) -> Result<TableConfig, String> {
    let name = body.name.trim().to_string();
    if name.is_empty() || name.chars().count() > 40 {
        return Err("Table name must be 1-40 characters".into());
    }
    if body.small_blind == 0 || body.big_blind < body.small_blind {
        return Err("Big blind must be at least the small blind, and the small blind must be positive".into());
    }
    if body.buy_in < body.big_blind * 10 {
        return Err("Buy-in must be at least 10 big blinds".into());
    }
    if body.buy_in > 100_000_000 {
        return Err("Buy-in is too large".into());
    }
    if !(2..=9).contains(&body.max_seats) {
        return Err("A table has 2 to 9 seats".into());
    }
    Ok(TableConfig {
        name,
        small_blind: body.small_blind,
        big_blind: body.big_blind,
        buy_in: body.buy_in,
        max_seats: body.max_seats,
        private: body.private,
    })
}

#[derive(Deserialize)]
struct WsQuery {
    player: String,
    #[serde(default)]
    name: String,
}

async fn ws_upgrade(
    ws: WebSocketUpgrade,
    State(app): State<AppState>,
    Path(code): Path<String>,
    Query(query): Query<WsQuery>,
) -> Response {
    let Some(table) = app.lobby.get(&code) else {
        return (StatusCode::NOT_FOUND, "No table with that code").into_response();
    };
    let player = query.player.trim().to_string();
    if player.is_empty() || player.len() > 64 {
        return (StatusCode::BAD_REQUEST, "Invalid player id").into_response();
    }
    let name = clean_name(&query.name);
    ws.on_upgrade(move |socket| run_connection(socket, table, player, name))
}

fn clean_name(raw: &str) -> String {
    let name: String = raw.trim().chars().take(20).collect();
    if name.is_empty() { "Guest".to_string() } else { name }
}

async fn run_connection(socket: WebSocket, table: Arc<TableHandle>, player: String, name: String) {
    let (mut sender, mut receiver) = socket.split();
    let mut updates = table.updates.subscribe();
    table.viewer_joined();

    if send_state(&mut sender, &table, &player).await.is_ok() {
        loop {
            tokio::select! {
                incoming = receiver.next() => match incoming {
                    Some(Ok(Message::Text(text))) => {
                        if let Err(message) = handle_client_message(&table, &player, &name, &text) {
                            let error = ServerMsg::Error { message };
                            if send_json(&mut sender, &error).await.is_err() {
                                break;
                            }
                        }
                        table.notify();
                    }
                    Some(Ok(Message::Close(_))) | None | Some(Err(_)) => break,
                    Some(Ok(_)) => {}
                },
                update = updates.recv() => match update {
                    Ok(()) | Err(RecvError::Lagged(_)) => {
                        if send_state(&mut sender, &table, &player).await.is_err() {
                            break;
                        }
                    }
                    Err(RecvError::Closed) => break,
                },
            }
        }
    }

    table.viewer_left();
}

fn handle_client_message(table: &TableHandle, player: &str, name: &str, text: &str) -> Result<(), String> {
    let msg: ClientMsg = serde_json::from_str(text).map_err(|e| format!("Invalid message: {e}"))?;
    let now = Instant::now();
    let mut t = table.lock();
    match msg {
        ClientMsg::Sit { seat, look } => {
            let look = look.filter(Look::is_valid).unwrap_or_default();
            t.sit(player, name, look, seat, now)
        }
        ClientMsg::Stand => t.stand(player, now),
        ClientMsg::AddBot => t.add_bot(now),
        ClientMsg::RemoveBots => {
            t.remove_bots(now);
            Ok(())
        }
        ClientMsg::Act { action } => t.act(player, action, now),
        ClientMsg::Chat { text } => {
            let text: String = text.trim().chars().take(300).collect();
            if text.is_empty() {
                return Err("Message is empty".into());
            }
            t.chat(name, &text);
            Ok(())
        }
    }
}

async fn send_state(
    sender: &mut SplitSink<WebSocket, Message>,
    table: &TableHandle,
    player: &str,
) -> Result<(), ()> {
    let state = {
        let t = table.lock();
        ServerMsg::State {
            state: t.view(Some(player), table.viewers(), Instant::now()),
        }
    };
    send_json(sender, &state).await
}

async fn send_json<T: Serialize>(sender: &mut SplitSink<WebSocket, Message>, value: &T) -> Result<(), ()> {
    let text = serde_json::to_string(value).map_err(|_| ())?;
    sender.send(Message::Text(text.into())).await.map_err(|_| ())
}
