mod lobby;
mod poker;
mod protocol;
mod table;
mod web;

use std::path::PathBuf;
use std::sync::Arc;

use tower_http::services::{ServeDir, ServeFile};
use tower_http::trace::TraceLayer;
use tracing_subscriber::EnvFilter;

use crate::lobby::Lobby;
use crate::web::AppState;

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env().unwrap_or_else(|_| "poker_server=info,tower_http=info".into()),
        )
        .init();

    let static_dir = std::env::var("STATIC_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from(concat!(env!("CARGO_MANIFEST_DIR"), "/../frontend/dist")));
    let index = static_dir.join("index.html");

    let state = AppState {
        lobby: Arc::new(Lobby::default()),
    };

    let app = web::router(state)
        .fallback_service(ServeDir::new(&static_dir).fallback(ServeFile::new(index)))
        .layer(TraceLayer::new_for_http());

    let port = std::env::var("PORT").unwrap_or_else(|_| "3000".into());
    let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{port}"))
        .await
        .expect("failed to bind port");
    tracing::info!("poker server listening on http://localhost:{port}");
    axum::serve(listener, app).await.expect("server error");
}
