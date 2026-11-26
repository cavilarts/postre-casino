use std::net::{IpAddr, SocketAddr};
use std::sync::Arc;
use std::time::{Duration, Instant};

use axum::Json;
use axum::Router;
use axum::extract::ws::{Message, WebSocket};
use axum::extract::{ConnectInfo, Path, Query, State, WebSocketUpgrade};
use axum::http::{HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::routing::get;
use futures_util::sink::SinkExt;
use futures_util::stream::{SplitSink, StreamExt};
use serde::{Deserialize, Serialize};
use tokio::sync::broadcast::error::RecvError;

use crate::lobby::{CreateError, Lobby, TableHandle, Viewer};
use crate::protocol::{ClientMsg, Look, ServerMsg, TableSummary};
use crate::table::TableConfig;

/// How often the server pings each connection.
const PING_INTERVAL: Duration = Duration::from_secs(20);
/// A connection that sends nothing (not even a pong) for this long is dropped,
/// so a dead network doesn't keep its table alive.
const CLIENT_TIMEOUT: Duration = Duration::from_secs(45);
/// A send that can't complete in this long means the peer is gone.
const SEND_TIMEOUT: Duration = Duration::from_secs(10);

#[derive(Clone)]
pub struct AppState {
    pub lobby: Arc<Lobby>,
    /// Take the client address from `X-Forwarded-For` (set when running behind
    /// a reverse proxy) instead of the TCP peer.
    pub trust_proxy: bool,
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
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    Json(body): Json<CreateTable>,
) -> Result<Json<TableSummary>, ApiError> {
    let config = validate_config(body).map_err(|msg| (StatusCode::BAD_REQUEST, msg))?;
    let client = client_ip(addr, &headers, app.trust_proxy);
    let handle = app.lobby.create(config, client).map_err(|err| match err {
        CreateError::Full => (
            StatusCode::SERVICE_UNAVAILABLE,
            "Too many tables are open right now. Try again in a few minutes.".to_string(),
        ),
        CreateError::TooManyForClient => (
            StatusCode::TOO_MANY_REQUESTS,
            "You already have several tables open. Use one of those, or wait for an unused one to close.".to_string(),
        ),
    })?;
    let summary = handle.lock().summary();
    Ok(Json(summary))
}

async fn get_table(
    State(app): State<AppState>,
    Path(code): Path<String>,
) -> Result<Json<TableSummary>, ApiError> {
    let handle = app
        .lobby
        .touch(&code)
        .ok_or((StatusCode::NOT_FOUND, "No table with that code".to_string()))?;
    let summary = handle.lock().summary();
    Ok(Json(summary))
}

/// The client's address. Behind a trusted proxy that is the last
/// `X-Forwarded-For` entry, the one the proxy itself appended; earlier entries
/// come from the client and can't be trusted.
fn client_ip(peer: SocketAddr, headers: &HeaderMap, trust_proxy: bool) -> IpAddr {
    if trust_proxy {
        let forwarded = headers
            .get_all("x-forwarded-for")
            .iter()
            .filter_map(|v| v.to_str().ok())
            .flat_map(|v| v.split(','))
            .filter_map(|ip| ip.trim().parse().ok())
            .next_back();
        if let Some(ip) = forwarded {
            return ip;
        }
    }
    peer.ip()
}

fn validate_config(body: CreateTable) -> Result<TableConfig, String> {
    let name = body.name.trim().to_string();
    if name.is_empty() || name.chars().count() > 40 {
        return Err("Table name must be 1-40 characters".into());
    }
    if body.small_blind == 0 || body.big_blind < body.small_blind {
        return Err("Big blind must be at least the small blind, and the small blind must be positive".into());
    }
    // Checked: the blinds come straight from the request, so `big_blind * 10`
    // can overflow. A big blind that large can't fit ten times in any buy-in.
    let min_buy_in = body.big_blind.checked_mul(10);
    if min_buy_in.is_none_or(|min| body.buy_in < min) {
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
    let player = query.player.trim().to_string();
    if player.is_empty() || player.len() > 64 {
        return (StatusCode::BAD_REQUEST, "Invalid player id").into_response();
    }
    let name = clean_name(&query.name);
    let Some(viewer) = app.lobby.join(&code) else {
        return (StatusCode::NOT_FOUND, "No table with that code").into_response();
    };
    ws.on_upgrade(move |socket| run_connection(socket, viewer, player, name))
}

fn clean_name(raw: &str) -> String {
    let name: String = raw.trim().chars().take(20).collect();
    if name.is_empty() { "Guest".to_string() } else { name }
}

async fn run_connection(socket: WebSocket, viewer: Viewer, player: String, name: String) {
    let table = viewer.table();
    let (mut sender, mut receiver) = socket.split();
    let mut updates = table.updates.subscribe();
    let mut ping = tokio::time::interval(PING_INTERVAL);
    ping.tick().await;
    let mut last_heard = tokio::time::Instant::now();
    viewer.mark_joined();
    table.lock().connect(&player, Instant::now());
    table.notify();

    if send_state(&mut sender, table, &player).await.is_ok() {
        loop {
            tokio::select! {
                incoming = receiver.next() => match incoming {
                    Some(Ok(message)) if !matches!(message, Message::Close(_)) => {
                        last_heard = tokio::time::Instant::now();
                        let Message::Text(text) = message else { continue };
                        if let Err(message) = handle_client_message(table, &player, &name, &text) {
                            let error = ServerMsg::Error { message };
                            if send_json(&mut sender, &error).await.is_err() {
                                break;
                            }
                        }
                        table.notify();
                    }
                    _ => break,
                },
                _ = tokio::time::sleep_until(last_heard + CLIENT_TIMEOUT) => break,
                _ = ping.tick() => {
                    if send_message(&mut sender, Message::Ping(Default::default())).await.is_err() {
                        break;
                    }
                }
                update = updates.recv() => match update {
                    Ok(()) | Err(RecvError::Lagged(_)) => {
                        if send_state(&mut sender, table, &player).await.is_err() {
                            break;
                        }
                    }
                    Err(RecvError::Closed) => break,
                },
            }
        }
    }
    table.lock().disconnect(&player, Instant::now());
    // Dropping `viewer` after this notifies the table.
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
    send_message(sender, Message::Text(text.into())).await
}

async fn send_message(sender: &mut SplitSink<WebSocket, Message>, message: Message) -> Result<(), ()> {
    match tokio::time::timeout(SEND_TIMEOUT, sender.send(message)).await {
        Ok(Ok(())) => Ok(()),
        _ => Err(()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn headers(values: &[&str]) -> HeaderMap {
        let mut map = HeaderMap::new();
        for v in values {
            map.append("x-forwarded-for", v.parse().unwrap());
        }
        map
    }

    #[test]
    fn client_ip_uses_the_peer_unless_the_proxy_is_trusted() {
        let peer: SocketAddr = "10.0.0.1:5000".parse().unwrap();
        let fwd = headers(&["1.1.1.1, 2.2.2.2"]);
        assert_eq!(client_ip(peer, &fwd, false), peer.ip());
        assert_eq!(client_ip(peer, &fwd, true), "2.2.2.2".parse::<IpAddr>().unwrap());
    }

    #[test]
    fn client_ip_takes_the_last_forwarded_entry_across_headers() {
        let peer: SocketAddr = "10.0.0.1:5000".parse().unwrap();
        let fwd = headers(&["9.9.9.9", "3.3.3.3, 2001:db8::1"]);
        assert_eq!(client_ip(peer, &fwd, true), "2001:db8::1".parse::<IpAddr>().unwrap());
        assert_eq!(client_ip(peer, &headers(&["junk"]), true), peer.ip());
        assert_eq!(client_ip(peer, &HeaderMap::new(), true), peer.ip());
    }

    fn create(small_blind: u64, big_blind: u64, buy_in: u64) -> CreateTable {
        CreateTable {
            name: "Test".into(),
            small_blind,
            big_blind,
            buy_in,
            max_seats: 6,
            private: false,
        }
    }

    #[test]
    fn validate_config_rejects_a_big_blind_that_overflows_the_buy_in_check() {
        let err = validate_config(create(1, 1_844_674_407_370_955_162, 1000)).err();
        assert_eq!(err.as_deref(), Some("Buy-in must be at least 10 big blinds"));
        assert!(validate_config(create(1, u64::MAX, 1000)).is_err());
    }

    #[test]
    fn validate_config_requires_ten_big_blinds() {
        assert!(validate_config(create(5, 10, 100)).is_ok());
        assert!(validate_config(create(5, 10, 99)).is_err());
    }
}
