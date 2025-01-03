mod relay;
mod state;

use state::{MessageStore, UserStore};

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
    tracing::subscriber::set_global_default(FmtSubscriber::default())?;

    let messages = MessageStore::default();
    let users = UserStore::default();

    let (layer, io) = SocketIo::builder()
        .with_state(messages)
        .with_state(users)
        .build_layer();

    io.ns("/", i_relay_c);

    let app = axum::Router::new()
        .route("/ready", get(|| async { "Ready" }))
        .route("/live", get(|| async { "Live" }))
        .with_state(io)
        .layer(
            ServiceBuilder::new()
                .layer(CorsLayer::permissive())
                .layer(layer),
        );

    info!("Starting server");

    let listener = TcpListener::bind("0.0.0.0:3001").await.unwrap();
    axum::serve(listener, app).await.unwrap();

    Ok(())
}
