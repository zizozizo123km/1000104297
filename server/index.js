// server/index.js — Bac DZ AI Signaling Server
// 
// Development:
//   cd server && npm install && node index.js
//
// Production (Vercel):
//   Vercel auto-runs this via api/socket.js serverless function
//   vercel.json handles: "installCommand": "npm install && cd server && npm install"

const { createServer } = require("http");
const { Server } = require("socket.io");

const PORT = process.env.PORT || 3001;

// ─── HTTP Server ──────────────────────────────────────────────────────────────
const httpServer = createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      status: "ok",
      rooms: rooms.size,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    }));
    return;
  }
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("🚀 Bac DZ AI Signaling Server Running");
});

// ─── Socket.io ────────────────────────────────────────────────────────────────
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
  transports: ["websocket", "polling"],
  pingTimeout: 60000,
  pingInterval: 25000,
});

// ─── Rooms Store ──────────────────────────────────────────────────────────────
const rooms = new Map();
// rooms[roomId] = {
//   roomId, roomCode, name, subject,
//   hostId, hostName, maxSeats,
//   seats: { userId: { userId, userName, seatIndex, micOn, camOn, socketId } },
//   viewers: { userId: { userId, userName, socketId } },
//   createdAt
// }

// ─── Helper: get socket by userId ────────────────────────────────────────────
function getSocketByUserId(userId) {
  for (const [, sock] of io.sockets.sockets) {
    if (sock.userId === userId) return sock;
  }
  return null;
}

// ─── Socket.io Events ────────────────────────────────────────────────────────
io.on("connection", (socket) => {
  console.log(`🔌 Connected: ${socket.id}`);

  // ── Create Room ─────────────────────────────────────────────
  socket.on("create-room", ({ roomId, roomCode, name, subject, hostId, hostName, maxSeats = 10 }) => {
    rooms.set(roomId, {
      roomId,
      roomCode: roomCode.toUpperCase(),
      name,
      subject,
      hostId,
      hostName,
      maxSeats,
      seats: {},
      viewers: {},
      createdAt: Date.now(),
    });

    socket.join(roomId);
    socket.roomId = roomId;
    socket.userId = hostId;
    socket.userName = hostName;
    socket.isViewer = false;

    // Add host as first seat
    const room = rooms.get(roomId);
    room.seats[hostId] = {
      userId: hostId,
      userName: hostName,
      seatIndex: 0,
      joinedAt: Date.now(),
      micOn: true,
      camOn: true,
      socketId: socket.id,
    };

    // Notify ALL connected clients about new room
    io.emit("new-room", {
      roomId,
      roomCode: roomCode.toUpperCase(),
      name,
      subject,
      hostName,
      createdAt: Date.now(),
    });

    socket.emit("room-created", {
      roomId,
      roomCode: roomCode.toUpperCase(),
      seats: room.seats,
    });

    console.log(`🏠 Room created: "${name}" [${roomCode}] by ${hostName}`);
  });

  // ── Find Room by Code ────────────────────────────────────────
  socket.on("find-room", ({ code }) => {
    const room = [...rooms.values()].find(
      (r) => r.roomCode === code.toUpperCase().trim()
    );

    if (room) {
      socket.emit("room-found", {
        roomId: room.roomId,
        roomCode: room.roomCode,
        name: room.name,
        subject: room.subject,
        hostName: room.hostName,
        maxSeats: room.maxSeats,
        seatsCount: Object.keys(room.seats).length,
        viewersCount: Object.keys(room.viewers).length,
        createdAt: room.createdAt,
      });
    } else {
      socket.emit("room-not-found");
    }
  });

  // ── Get All Rooms ────────────────────────────────────────────
  socket.on("get-rooms", () => {
    const list = [...rooms.values()].map((r) => ({
      roomId: r.roomId,
      roomCode: r.roomCode,
      name: r.name,
      subject: r.subject,
      hostName: r.hostName,
      maxSeats: r.maxSeats,
      seatsCount: Object.keys(r.seats).length,
      viewersCount: Object.keys(r.viewers).length,
      createdAt: r.createdAt,
    }));
    socket.emit("rooms-list", list);
  });

  // ── Join Room as Participant ─────────────────────────────────
  socket.on("join-room", ({ roomId, userId, userName, seatIndex }) => {
    const room = rooms.get(roomId);
    if (!room) return socket.emit("join-error", { message: "الغرفة غير موجودة" });

    const currentSeats = Object.keys(room.seats).length;
    if (currentSeats >= room.maxSeats) {
      return socket.emit("join-error", { message: "الغرفة ممتلئة" });
    }

    // Find available seat index
    const usedIndexes = Object.values(room.seats).map((s) => s.seatIndex);
    let availableIndex = seatIndex;
    if (usedIndexes.includes(seatIndex)) {
      for (let i = 0; i < room.maxSeats; i++) {
        if (!usedIndexes.includes(i)) { availableIndex = i; break; }
      }
    }

    room.seats[userId] = {
      userId,
      userName,
      seatIndex: availableIndex,
      joinedAt: Date.now(),
      micOn: true,
      camOn: true,
      socketId: socket.id,
    };

    socket.join(roomId);
    socket.roomId = roomId;
    socket.userId = userId;
    socket.userName = userName;
    socket.isViewer = false;

    // Send full room state to new joiner
    socket.emit("room-state", {
      seats: room.seats,
      viewers: room.viewers,
      existingPeers: Object.keys(room.seats).filter((id) => id !== userId),
    });

    // Notify existing participants
    socket.to(roomId).emit("user-joined", {
      userId,
      userName,
      seatIndex: availableIndex,
      seats: room.seats,
    });

    console.log(`👤 ${userName} joined "${room.name}" (seat ${availableIndex})`);
  });

  // ── Join as Viewer ───────────────────────────────────────────
  socket.on("join-viewer", ({ roomId, userId, userName }) => {
    const room = rooms.get(roomId);
    if (!room) return socket.emit("join-error", { message: "الغرفة غير موجودة" });

    room.viewers[userId] = { userId, userName, joinedAt: Date.now(), socketId: socket.id };

    socket.join(roomId);
    socket.roomId = roomId;
    socket.userId = userId;
    socket.userName = userName;
    socket.isViewer = true;

    socket.emit("room-state", {
      seats: room.seats,
      viewers: room.viewers,
      existingPeers: Object.keys(room.seats),
    });

    socket.to(roomId).emit("viewer-joined", {
      userId,
      userName,
      viewers: room.viewers,
    });

    console.log(`👁️ ${userName} watching "${room.name}"`);
  });

  // ── WebRTC Signaling ─────────────────────────────────────────
  socket.on("signal-offer", ({ to, from, fromName, offer }) => {
    const targetSocket = getSocketByUserId(to);
    if (targetSocket) {
      targetSocket.emit("signal-offer", { from, fromName, offer });
    }
  });

  socket.on("signal-answer", ({ to, from, answer }) => {
    const targetSocket = getSocketByUserId(to);
    if (targetSocket) {
      targetSocket.emit("signal-answer", { from, answer });
    }
  });

  socket.on("signal-ice", ({ to, from, candidate }) => {
    const targetSocket = getSocketByUserId(to);
    if (targetSocket) {
      targetSocket.emit("signal-ice", { from, candidate });
    }
  });

  // ── Media Toggle ─────────────────────────────────────────────
  socket.on("toggle-media", ({ roomId, userId, micOn, camOn }) => {
    const room = rooms.get(roomId);
    if (room?.seats[userId]) {
      room.seats[userId].micOn = micOn;
      room.seats[userId].camOn = camOn;
    }
    socket.to(roomId).emit("media-updated", { userId, micOn, camOn });
  });

  // ── Chat Message ─────────────────────────────────────────────
  socket.on("chat-message", ({ roomId, userId, userName, text, isViewer }) => {
    const msg = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      userId,
      userName,
      text,
      isViewer: isViewer || false,
      timestamp: Date.now(),
    };
    io.to(roomId).emit("new-message", msg);
  });

  // ── Screen Share ─────────────────────────────────────────────
  socket.on("screen-share-start", ({ roomId, userId }) => {
    socket.to(roomId).emit("screen-share-started", { userId });
  });

  socket.on("screen-share-stop", ({ roomId, userId }) => {
    socket.to(roomId).emit("screen-share-stopped", { userId });
  });

  // ── Delete Room ──────────────────────────────────────────────
  socket.on("delete-room", ({ roomId, userId }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    if (room.hostId !== userId) return;

    rooms.delete(roomId);
    io.to(roomId).emit("room-deleted", { roomId });
    io.emit("room-removed", { roomId });
    console.log(`🗑️ Room deleted: "${room.name}"`);
  });

  // ── Disconnect ───────────────────────────────────────────────
  socket.on("disconnect", (reason) => {
    const { roomId, userId, userName, isViewer } = socket;
    console.log(`👋 ${userName || socket.id} disconnected (${reason})`);

    if (!roomId || !userId) return;
    const room = rooms.get(roomId);
    if (!room) return;

    if (isViewer) {
      delete room.viewers[userId];
      io.to(roomId).emit("viewer-left", {
        userId,
        viewers: room.viewers,
      });
    } else {
      delete room.seats[userId];
      io.to(roomId).emit("user-left", {
        userId,
        seats: room.seats,
      });

      // Delete room if empty after host leaves
      if (Object.keys(room.seats).length === 0) {
        rooms.delete(roomId);
        io.emit("room-removed", { roomId });
        console.log(`🗑️ Room auto-deleted (empty): "${room.name}"`);
      }
    }
  });
});

// ─── Start Server ─────────────────────────────────────────────────────────────
httpServer.listen(PORT, () => {
  console.log("");
  console.log("  ╔══════════════════════════════════════════╗");
  console.log("  ║   🚀 Bac DZ AI — Signaling Server        ║");
  console.log(`  ║   📡 Port: ${PORT}                           ║`);
  console.log("  ║   🔗 CORS: * (all origins)               ║");
  console.log("  ║   🎥 WebRTC Signaling Ready               ║");
  console.log("  ║   🏠 http://localhost:" + PORT + "/health        ║");
  console.log("  ╚══════════════════════════════════════════╝");
  console.log("");
});
