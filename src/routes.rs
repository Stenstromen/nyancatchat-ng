use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use axum::{extract::Query, http::StatusCode, response::Json};
use base64::{engine::general_purpose::URL_SAFE, Engine};
use rand::Rng;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::env;

fn get_server_key() -> [u8; 32] {
    let key = env::var("SERVER_KEY").expect("SERVER_KEY environment variable must be set");
    let mut array = [0u8; 32];
    array.copy_from_slice(key.as_bytes());
    array
}

#[derive(Serialize)]
pub struct EncryptResponse {
    token: String,
}

#[derive(Deserialize)]
pub struct DecryptQuery {
    token: String,
}

#[derive(Serialize)]
pub struct DecryptResponse {
    key: String,
}

pub async fn encrypt_room_key(
    Query(params): Query<HashMap<String, String>>,
) -> Result<Json<EncryptResponse>, StatusCode> {
    let room_key = params.get("key").ok_or(StatusCode::BAD_REQUEST)?;

    let nonce_bytes = rand::thread_rng().gen::<[u8; 12]>();
    let cipher = Aes256Gcm::new(&get_server_key().into());
    let nonce = Nonce::from_slice(&nonce_bytes);

    let ciphertext = cipher
        .encrypt(nonce, room_key.as_bytes())
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let mut combined = nonce.to_vec();
    combined.extend(ciphertext);

    Ok(Json(EncryptResponse {
        token: URL_SAFE.encode(combined),
    }))
}

pub async fn decrypt_room_key(
    Query(params): Query<DecryptQuery>,
) -> Result<Json<DecryptResponse>, StatusCode> {
    let combined = URL_SAFE
        .decode(&params.token)
        .map_err(|_| StatusCode::BAD_REQUEST)?;

    if combined.len() < 12 {
        return Err(StatusCode::BAD_REQUEST);
    }

    let (nonce, ciphertext) = combined.split_at(12);
    let cipher = Aes256Gcm::new(&get_server_key().into());

    let plaintext = cipher
        .decrypt(Nonce::from_slice(nonce), ciphertext)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let key = String::from_utf8(plaintext).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(DecryptResponse { key }))
}
