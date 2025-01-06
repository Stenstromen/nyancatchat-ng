mod relay;
mod routes;
mod state;

use state::{MessageStore, NonceStore, UserStore};

use axum::routing::get;
use relay::i_relay_c;
use socketioxide::SocketIo;

use tokio::net::TcpListener;
use tower::ServiceBuilder;
use tower_http::cors::CorsLayer;
use tracing::info;
use tracing_subscriber::FmtSubscriber;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Get log level from environment variable, defaulting to INFO
    let log_level = std::env::var("RUST_LOG")
        .unwrap_or_else(|_| "info".to_string())
        .parse::<tracing::Level>()
        .unwrap_or(tracing::Level::INFO);

    tracing::subscriber::set_global_default(
        FmtSubscriber::builder()
            .with_max_level(log_level)
            .with_target(true)
            .with_thread_ids(true)
            .with_file(true)
            .with_line_number(true)
            .finish(),
    )?;

    let messages = MessageStore::default();
    let users = UserStore::default();
    let nonces = NonceStore::default();

    let (layer, io) = SocketIo::builder()
        .with_state(messages)
        .with_state(users)
        .with_state(nonces)
        .build_layer();

    io.ns("/", i_relay_c);

    let app = axum::Router::new()
        .route("/ready", get(|| async { "Ready" }))
        .route("/live", get(|| async { "Live" }))
        .route("/api/encrypt-key", get(routes::encrypt_room_key))
        .route("/api/decrypt-key", get(routes::decrypt_room_key))
        .with_state(io)
        .layer(
            ServiceBuilder::new()
                .layer(CorsLayer::permissive())
                .layer(layer),
        );

    info!("Starting server");

    let listener = TcpListener::bind("[::]:3001").await.unwrap();
    axum::serve(listener, app).await.unwrap();

    Ok(())
}
