"use client";

import { io } from "socket.io-client";

const serverUrl = process.env.NEXT_PUBLIC_SOCKET_SERVER || "http://localhost:3001";

export const socket = io(serverUrl, {
  transports: ["websocket", "polling"],
  auth: {
    timestamp: Date.now()
  }
});

socket.on("nonce", (nonce: string) => {
  socket.emit("verify", nonce);
});

socket.on("connect_error", (error) => {
  console.error("Connection error:", error);
});
