"use client";

import { io } from "socket.io-client";

const serverUrl = process.env.NEXT_PUBLIC_SOCKET_SERVER || "http://localhost:3001";

export const socket = io(serverUrl, {
  transports: ["websocket", "polling"],
});
