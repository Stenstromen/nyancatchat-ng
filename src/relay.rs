use crate::state::{
    JoinMessage, LeaveMessage, Message, MessageIn, MessageStore, Messages, NonceStore,
    TypingSignal, User, UserStore,
};

use base64;
use socketioxide::extract::{Data, SocketRef, State};
use tracing::debug;

pub async fn i_relay_c(socket: SocketRef, nonce_store: State<NonceStore>) {
    let nonce = nonce_store.add_nonce(socket.id.to_string()).await;

    // Send nonce to client
    let nonce_b64 = base64::encode(nonce.0);
    debug!("Generated nonce for {}: {}", socket.id, nonce_b64);
    let _ = socket.emit("nonce", &nonce_b64);

    socket.on(
        "verify",
        |socket: SocketRef, Data(nonce): Data<String>, store: State<NonceStore>| async move {
            debug!("Received verification attempt from {}", socket.id);
            let nonce_bytes = base64::decode(nonce).unwrap_or_default();
            if !store
                .verify_and_remove(&socket.id.to_string(), &nonce_bytes)
                .await
            {
                debug!("❌ Nonce verification failed for {}", socket.id);
                let _ = socket.disconnect();
            } else {
                debug!("✅ Nonce verified successfully for {}", socket.id);
            }
        },
    );

    debug!("Awaiting nonce verification for {}", socket.id);

    debug!("socket connected: {}", socket.id);

    socket.on(
        "join",
        |socket: SocketRef,
         Data::<JoinMessage>(data),
         store: State<MessageStore>,
         users: State<UserStore>| async move {
            debug!("Received join: {:?}", data);
            let _ = socket.leave_all();
            let _ = socket.join(data.room.clone());

            let user = User {
                id: socket.id.to_string(),
                name: data.user.clone(),
                room: data.room.clone(),
            };

            users.insert(socket.id.to_string(), user).await;

            let messages = store.get(&data.room).await;
            let _ = socket.emit("messages", &(Messages { messages }));

            let user_name = users.get(&socket.id.to_string()).await.unwrap().name;
            let _ = socket
                .broadcast()
                .within(data.room)
                .emit("server_message", &format!("{} joined the room", user_name));
        },
    );

    socket.on(
        "leave",
        |socket: SocketRef,
         Data::<LeaveMessage>(data),
         users: State<UserStore>,
         store: State<MessageStore>| async move {
            let _ = socket.leave(data.room.clone());
            let _ = socket.leave_all();
            let user = users.get(&socket.id.to_string()).await.unwrap();
            let room = user.room.clone();
            let _ = socket
                .broadcast()
                .within(room)
                .emit("server_message", &format!("{} left the room", user.name));

            users.remove(&socket.id.to_string()).await;
            store.remove_user_messages(&user.room, &user.name).await;
            let _ = socket.leave(user.room.clone());
        },
    );

    socket.on(
        "message",
        |socket: SocketRef,
         Data::<MessageIn>(data),
         store: State<MessageStore>,
         users: State<UserStore>| async move {
            let room = users
                .get_room(&socket.id.to_string())
                .await
                .expect("Socket should be in a room");

            debug!("⭐ Message event triggered");
            debug!("Message data: {:?}", data);

            let user = users
                .get(&socket.id.to_string())
                .await
                .map(|u| u.name)
                .unwrap_or_else(|| format!("anon-{}", socket.id));

            let response = Message {
                text: data.text.clone(),
                user,
                date: chrono::Utc::now(),
            };

            store.insert(&room, response.clone()).await;

            match socket.broadcast().within(room).emit("message", &response) {
                Ok(_) => debug!("Message emitted successfully"),
                Err(e) => debug!("Failed to emit message: {}", e),
            }

            match socket.emit("message-echo", &response) {
                Ok(_) => debug!("Message echoed to sender"),
                Err(e) => debug!("Failed to echo message: {}", e),
            }
        },
    );

    socket.on(
        "typing",
        |socket: SocketRef, Data::<TypingSignal>(_data), users: State<UserStore>| async move {
            let user = users
                .get(&socket.id.to_string())
                .await
                .expect("User should exist");

            let signal = TypingSignal {
                user: user.name.clone(),
            };
            let room = user.room.clone();
            let _ = socket.broadcast().within(user.room).emit("typing", &signal);
            debug!("Typing signal from {} in room {}", user.name, room);
        },
    );

    socket.on(
        "stop_typing",
        |socket: SocketRef, Data::<TypingSignal>(_data), users: State<UserStore>| async move {
            let user = users
                .get(&socket.id.to_string())
                .await
                .expect("User should exist");

            let signal = TypingSignal {
                user: user.name.clone(),
            };
            let room = user.room.clone();
            let _ = socket
                .broadcast()
                .within(room.clone())
                .emit("stop_typing", &signal);
            debug!("Stop typing signal from {} in room {}", user.name, room);
        },
    );
}
