// src/lib/socket.ts — Socket.io Client
// Connects to local server in dev, Vercel API in production

import { io, Socket } from "socket.io-client";

// ─── Determine Server URL ─────────────────────────────────────────────────────
function getServerUrl(): string {
  // If custom URL set in env
  const envUrl = (import.meta as any).env?.VITE_SOCKET_URL;
  if (envUrl) return envUrl;
  // Production (Vercel) — same origin
  const isProd = (import.meta as any).env?.PROD;
  if (isProd) return window.location.origin;
  // Development — local server
  return "http://localhost:3001";
}

function getSocketPath(): string {
  const isProd = (import.meta as any).env?.PROD;
  if (isProd) return "/api/socket";
  return "/socket.io";
}

// ─── Socket Instance ──────────────────────────────────────────────────────────
let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket || !socket.connected) {
    const url = getServerUrl();
    const path = getSocketPath();

    console.log(`🔌 Connecting to Socket.io: ${url} (path: ${path})`);

    socket = io(url, {
      path,
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      autoConnect: true,
    });

    socket.on("connect", () => {
      console.log("✅ Socket.io connected:", socket?.id);
    });

    socket.on("disconnect", (reason) => {
      console.log("❌ Socket.io disconnected:", reason);
    });

    socket.on("connect_error", (err) => {
      console.error("🔴 Socket.io connection error:", err.message);
    });

    socket.on("reconnect", (attempt) => {
      console.log(`🔄 Socket.io reconnected after ${attempt} attempts`);
    });
  }

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export default getSocket;
