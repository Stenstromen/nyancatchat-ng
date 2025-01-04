"use client";

import { decrypt, encrypt, generateKey } from "@/utils/crypto";
import { decryptRoomKey, generateShareableLink } from "@/utils/sharing";
import { useEffect, useState, useRef } from "react";
import { Socket, io } from "socket.io-client";
import { useSearchParams } from "next/navigation";
import UsernameModal from "./UsernameModal";

interface Message {
  user: string;
  text: string;
  date: string;
}

interface TypingSignal {
  user: string;
}

export default function Chat() {
  const searchParams = useSearchParams();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [message, setMessage] = useState("");
  const [room, setRoom] = useState("");
  const [name, setName] = useState("");
  const [joined, setJoined] = useState(false);
  const [typingUsers, setTypingUsers] = useState<TypingSignal[]>([]);
  const messageEndRef = useRef<HTMLDivElement>(null);
  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const [urlJoinPending, setUrlJoinPending] = useState(false);
  const pendingRoomRef = useRef<string | null>(null);
  const [shareLink, setShareLink] = useState<string>("");

  useEffect(() => {
    const newSocket = io("http://localhost:3001");
    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  useEffect(() => {
    if (!socket) return;

    socket.on("message", async (message: Message) => {
      const decryptedMessage = await decrypt(message.text);
      setMessages((prev) => [...prev, { ...message, text: decryptedMessage }]);
    });

    socket.on("messages", async (data: { messages: Message[] }) => {
      const decryptedMessages = await Promise.all(
        data.messages.map(async (msg: Message) => ({
          ...msg,
          text: await decrypt(msg.text),
        }))
      );
      setMessages(decryptedMessages);
    });

    socket.on("message-echo", async (message: Message) => {
      const decryptedMessage = await decrypt(message.text);
      setMessages((prev) => [...prev, { ...message, text: decryptedMessage }]);
    });

    socket.on("server_message", (message: string) => {
      setMessages((prev) => [
        ...prev,
        { user: "System", text: message, date: new Date().toISOString() },
      ]);
    });

    socket.on("typing", (user: TypingSignal) => {
      setTypingUsers((prev) => {
        if (!prev.some((u) => u.user === user.user)) {
          return [...prev, { user: user.user }];
        }
        return prev;
      });
    });

    socket.on("stop_typing", (user: TypingSignal) => {
      setTypingUsers((prev) => prev.filter((u) => u.user !== user.user));
    });

    return () => {
      socket.off("messages");
      socket.off("message");
      socket.off("server_message");
      socket.off("typing");
      socket.off("stop_typing");
    };
  }, [socket]);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (socket && room && name) {
      const currentKey = window.sessionStorage.getItem("ENCRYPTION_KEY");
      const key = currentKey || generateKey();

      if (!currentKey) {
        window.sessionStorage.setItem("ENCRYPTION_KEY", key);
      }

      try {
        const shareUrl = await generateShareableLink(room, key);
        setShareLink(shareUrl);
      } catch (error) {
        console.error("Failed to generate share link:", error);
      }

      socket.emit("join", {
        room: room,
        user: name,
      });
      setJoined(true);
    }
  };

  const handleLeave = () => {
    if (socket && room) {
      socket.emit("leave", { room: room });
      setJoined(false);
      setRoom("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const encryptedMessage = await encrypt(message);
    if (socket && message.trim()) {
      socket.emit("message", {
        text: encryptedMessage,
      });
      setMessage("");
    }
  };

  let typingTimeout: NodeJS.Timeout;
  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessage(e.target.value);

    if (socket) {
      socket.emit("typing", {
        user: name,
      });

      clearTimeout(typingTimeout);

      typingTimeout = setTimeout(() => {
        socket.emit("stop_typing", {
          user: name,
        });
      }, 2000);
    }
  };

  useEffect(() => {
    const roomParam = searchParams.get("room");
    const token = searchParams.get("token");

    if (roomParam && token) {
      setRoom(roomParam);
      pendingRoomRef.current = roomParam;

      decryptRoomKey(token)
        .then((key) => {
          window.sessionStorage.setItem("ENCRYPTION_KEY", key);

          if (!joined && !name) {
            setShowUsernameModal(true);
            setUrlJoinPending(true);
          }
        })
        .catch((error) => {
          console.error("Failed to decrypt room key:", error);
        });
    }
  }, [searchParams, joined, name]);

  const handleUsernameSubmit = (username: string) => {
    setName(username);
    setShowUsernameModal(false);

    if (urlJoinPending && socket && pendingRoomRef.current) {
      socket.emit("join", {
        room: pendingRoomRef.current,
        user: username,
      });
      setJoined(true);
      setUrlJoinPending(false);
    }
  };

  const copyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
    } catch (err) {
      console.error("Failed to copy link:", err);
    }
  };

  return (
    <div className="max-w-4xl mx-auto h-screen flex flex-col bg-gray-800">
      <UsernameModal
        isOpen={showUsernameModal}
        onSubmit={handleUsernameSubmit}
      />

      {!joined ? (
        <form onSubmit={handleJoin} className="space-y-4 p-4">
          <input
            type="text"
            value={room}
            onChange={(e) => setRoom(e.target.value)}
            placeholder="Enter room name"
            className="w-full p-2 border rounded bg-gray-700 text-white border-gray-600"
          />
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter your name"
            className="w-full p-2 border rounded bg-gray-700 text-white border-gray-600"
          />
          <button
            type="submit"
            className="w-full p-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded transition"
          >
            Join Room
          </button>
        </form>
      ) : (
        <div className="flex flex-col h-full">
          <div className="bg-gray-900 p-4 shadow flex justify-between items-center">
            <div className="flex items-center gap-4 flex-1">
              <h2 className="text-xl font-bold text-white">#{room}</h2>
              {shareLink && (
                <div className="flex items-center gap-2 flex-1">
                  <input
                    type="text"
                    value={shareLink}
                    readOnly
                    className="flex-1 p-2 text-sm bg-gray-700 text-white rounded border border-gray-600"
                  />
                  <button
                    onClick={copyShareLink}
                    className="p-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded transition text-sm"
                  >
                    Copy Link
                  </button>
                </div>
              )}
            </div>
            <button
              onClick={handleLeave}
              className="p-2 bg-red-500 hover:bg-red-600 text-white rounded transition ml-4"
            >
              Leave Room
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg, i) => (
              <div key={i} className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-indigo-500 flex-shrink-0 flex items-center justify-center text-white font-bold">
                  {msg.user[0]}
                </div>
                <div className="flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="font-bold text-indigo-400">
                      {msg.user}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(msg.date).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-gray-100 mt-1">{msg.text}</p>
                </div>
              </div>
            ))}
            <div ref={messageEndRef} />
          </div>

          <div className="p-4 bg-gray-750 relative">
            {typingUsers.length > 0 && (
              <div className="absolute -top-6 left-4 text-gray-400 text-sm flex items-center gap-1">
                <div className="flex gap-1">
                  <span className="w-1 h-1 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                  <span className="w-1 h-1 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                  <span className="w-1 h-1 bg-gray-400 rounded-full animate-bounce"></span>
                </div>
                <span>
                  {typingUsers.map((user) => user.user).join(", ")}{" "}
                  {typingUsers.length === 1 ? "is" : "are"} typing
                </span>
              </div>
            )}
            <form onSubmit={handleSubmit} className="flex gap-2">
              <input
                type="text"
                value={message}
                onChange={handleTyping}
                placeholder={`Message #${room}`}
                className="flex-1 p-3 rounded-md bg-gray-700 text-white border-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="submit"
                className="p-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-md transition"
              >
                Send
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
