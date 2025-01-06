use rand::Rng;
use serde::{Deserialize, Serialize};
use std::{
    collections::{HashMap, VecDeque},
    sync::Arc,
    time::{Duration, Instant},
};
use tokio::sync::RwLock;

#[derive(Debug, Deserialize)]
pub struct JoinMessage {
    pub user: String,
    pub room: String,
}

#[derive(Debug, Deserialize)]
pub struct LeaveMessage {
    pub room: String,
}

#[derive(Debug, Deserialize)]
pub struct MessageIn {
    pub text: String,
}

#[derive(Serialize)]
pub struct Messages {
    pub messages: Vec<Message>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct TypingSignal {
    pub user: String,
}

#[derive(Serialize, Clone, Debug)]
pub struct Message {
    pub text: String,
    pub user: String,
    pub date: chrono::DateTime<chrono::Utc>,
}

pub type RoomStore = HashMap<String, VecDeque<Message>>;

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct User {
    pub id: String,
    pub name: String,
    pub room: String,
}

#[derive(Clone, Default)]
pub struct UserStore {
    pub users: Arc<RwLock<HashMap<String, User>>>,
}

impl UserStore {
    pub async fn insert(&self, id: String, user: User) {
        let mut users = self.users.write().await;
        users.insert(id, user);
    }

    pub async fn get(&self, id: &str) -> Option<User> {
        self.users.read().await.get(id).cloned()
    }

    pub async fn get_room(&self, id: &str) -> Option<String> {
        self.users
            .read()
            .await
            .get(id)
            .map(|user| user.room.clone())
    }

    pub async fn remove(&self, id: &str) {
        let mut users = self.users.write().await;
        users.remove(id);
    }
}

#[derive(Clone, Default)]
pub struct MessageStore {
    pub messages: Arc<RwLock<RoomStore>>,
}

impl MessageStore {
    pub async fn insert(&self, room: &str, message: Message) {
        let mut binding = self.messages.write().await;
        let messages = binding.entry(room.to_owned()).or_default();
        messages.push_front(message);
        messages.truncate(256);
    }

    pub async fn get(&self, room: &str) -> Vec<Message> {
        let messages = self.messages.read().await.get(room).cloned();
        messages.unwrap_or_default().into_iter().rev().collect()
    }

    pub async fn remove_user_messages(&self, room: &str, user: &str) {
        let mut messages = self.messages.write().await;
        if let Some(room_messages) = messages.get_mut(room) {
            room_messages.retain(|msg| msg.user != user);
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Nonce(pub [u8; 32]);

impl Nonce {
    pub fn new() -> Self {
        let mut bytes = [0u8; 32];
        rand::thread_rng().fill(&mut bytes);
        Self(bytes)
    }
}

#[derive(Clone, Default)]
pub struct NonceStore {
    nonces: Arc<RwLock<HashMap<String, (Nonce, Instant)>>>,
}

impl NonceStore {
    pub async fn add_nonce(&self, socket_id: String) -> Nonce {
        let nonce = Nonce::new();
        let mut nonces = self.nonces.write().await;
        nonces.insert(socket_id, (nonce.clone(), Instant::now()));
        nonce
    }

    pub async fn verify_and_remove(&self, socket_id: &str, client_nonce: &[u8]) -> bool {
        let mut nonces = self.nonces.write().await;
        if let Some((stored_nonce, timestamp)) = nonces.remove(socket_id) {
            // Verify nonce hasn't expired (5 minutes max)
            if timestamp.elapsed() <= Duration::from_secs(300) {
                return stored_nonce.0 == client_nonce;
            }
        }
        false
    }
}
