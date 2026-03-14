// api/socket.js — Vercel Serverless Socket.io Handler
const { Server } = require("socket.io");

// Store rooms in memory (resets on cold start)
const rooms = new Map();

let io;

function initSocket(res) {
  if (io) return io;

  io = new Server(res.socket?.server || {}, {
    path: "/api/socket",
    addTrailingSlash: false,
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
    transports: ["polling", "websocket"],
  });

  io.on("connection", (socket) => {
    console.log("🔌 Client connected:", socket.id);

    // ─── Create Room ───────────────────────────────────────────
    socket.on("create-room", ({ roomId, roomCode, name, subject, hostId, hostName, maxSeats }) => {
      rooms.set(roomId, {
        roomId,
        roomCode: roomCode.toUpperCase(),
        name,
        subject,
        hostId,
        hostName,
        maxSeats: maxSeats || 10,
        seats: {},
        viewers: {},
        createdAt: Date.now(),
      });

      socket.join(roomId);
      socket.roomId = roomId;
      socket.userId = hostId;

      // Notify all clients about new room
      io.emit("new-room", {
        roomId,
        roomCode: roomCode.toUpperCase(),
        name,
        subject,
        hostName,
        createdAt: Date.now(),
      });

      socket.emit("room-created", { roomId, roomCode: roomCode.toUpperCase() });
      console.log(`🏠 Room created: ${name} [${roomCode}]`);
    });

    // ─── Find Room by Code ──────────────────────────────────────
    socket.on("find-room", ({ code }) => {
      const room = [...rooms.values()].find(
        (r) => r.roomCode === code.toUpperCase()
      );

      if (room) {
        const seats = Object.values(room.seats || {});
        const viewers = Object.values(room.viewers || {});
        socket.emit("room-found", {
          ...room,
          seatsCount: seats.length,
          viewersCount: viewers.length,
        });
      } else {
        socket.emit("room-not-found");
      }
    });

    // ─── Get All Rooms ──────────────────────────────────────────
    socket.on("get-rooms", () => {
      const allRooms = [...rooms.values()].map((r) => ({
        ...r,
        seatsCount: Object.keys(r.seats || {}).length,
        viewersCount: Object.keys(r.viewers || {}).length,
      }));
      socket.emit("rooms-list", allRooms);
    });

    // ─── Join Room as Participant ───────────────────────────────
    socket.on("join-room", ({ roomId, userId, userName, seatIndex }) => {
      const room = rooms.get(roomId);
      if (!room) return socket.emit("error", { message: "الغرفة غير موجودة" });

      const seats = Object.keys(room.seats || {}).length;
      if (seats >= room.maxSeats) {
        return socket.emit("room-full", { roomId });
      }

      room.seats[userId] = {
        userId,
        userName,
        seatIndex,
        joinedAt: Date.now(),
        micOn: true,
        camOn: true,
      };

      socket.join(roomId);
      socket.roomId = roomId;
      socket.userId = userId;
      socket.userName = userName;
      socket.isViewer = false;

      // Send current room state to joiner
      socket.emit("room-state", {
        seats: room.seats,
        viewers: room.viewers,
      });

      // Notify others
      socket.to(roomId).emit("user-joined", {
        userId,
        userName,
        seatIndex,
        seats: room.seats,
      });

      console.log(`👤 ${userName} joined room ${room.name}`);
    });

    // ─── Join Room as Viewer ────────────────────────────────────
    socket.on("join-viewer", ({ roomId, userId, userName }) => {
      const room = rooms.get(roomId);
      if (!room) return socket.emit("error", { message: "الغرفة غير موجودة" });

      room.viewers[userId] = { userId, userName, joinedAt: Date.now() };

      socket.join(roomId);
      socket.roomId = roomId;
      socket.userId = userId;
      socket.userName = userName;
      socket.isViewer = true;

      socket.emit("room-state", {
        seats: room.seats,
        viewers: room.viewers,
      });

      socket.to(roomId).emit("viewer-joined", {
        userId,
        userName,
        viewers: room.viewers,
      });

      console.log(`👁️ ${userName} watching room ${room.name}`);
    });

    // ─── WebRTC Signaling ───────────────────────────────────────
    socket.on("signal-offer", ({ to, from, offer, fromName }) => {
      io.to(getSocketId(to)).emit("signal-offer", { from, offer, fromName });
    });

    socket.on("signal-answer", ({ to, from, answer }) => {
      io.to(getSocketId(to)).emit("signal-answer", { from, answer });
    });

    socket.on("signal-ice", ({ to, from, candidate }) => {
      io.to(getSocketId(to)).emit("signal-ice", { from, candidate });
    });

    // ─── Media Toggle ───────────────────────────────────────────
    socket.on("toggle-media", ({ roomId, userId, micOn, camOn }) => {
      const room = rooms.get(roomId);
      if (room?.seats[userId]) {
        room.seats[userId].micOn = micOn;
        room.seats[userId].camOn = camOn;
      }
      socket.to(roomId).emit("media-updated", { userId, micOn, camOn });
    });

    // ─── Chat Message ───────────────────────────────────────────
    socket.on("chat-message", ({ roomId, userId, userName, text, isViewer }) => {
      const msg = {
        id: Date.now().toString(),
        userId,
        userName,
        text,
        isViewer,
        timestamp: Date.now(),
      };
      io.to(roomId).emit("new-message", msg);
    });

    // ─── Screen Share ───────────────────────────────────────────
    socket.on("screen-share-start", ({ roomId, userId }) => {
      socket.to(roomId).emit("screen-share-started", { userId });
    });

    socket.on("screen-share-stop", ({ roomId, userId }) => {
      socket.to(roomId).emit("screen-share-stopped", { userId });
    });

    // ─── Disconnect ─────────────────────────────────────────────
    socket.on("disconnect", () => {
      const { roomId, userId, userName, isViewer } = socket;
      if (!roomId || !userId) return;

      const room = rooms.get(roomId);
      if (!room) return;

      if (isViewer) {
        delete room.viewers[userId];
        io.to(roomId).emit("viewer-left", { userId, viewers: room.viewers });
      } else {
        delete room.seats[userId];
        io.to(roomId).emit("user-left", { userId, seats: room.seats });

        // Delete room if host left and no one remains
        if (userId === room.hostId && Object.keys(room.seats).length === 0) {
          rooms.delete(roomId);
          io.emit("room-deleted", { roomId });
          console.log(`🗑️ Room deleted: ${room.name}`);
        }
      }

      console.log(`👋 ${userName} left room`);
    });

    // ─── Delete Room ────────────────────────────────────────────
    socket.on("delete-room", ({ roomId, userId }) => {
      const room = rooms.get(roomId);
      if (!room) return;
      if (room.hostId !== userId) return;

      rooms.delete(roomId);
      io.to(roomId).emit("room-deleted", { roomId });
      io.emit("room-removed", { roomId });
      console.log(`🗑️ Room manually deleted`);
    });
  });

  return io;
}

// Helper: get socket id by userId
function getSocketId(userId) {
  if (!io) return null;
  for (const [id, sock] of io.sockets.sockets) {
    if (sock.userId === userId) return id;
  }
  return null;
}

// Vercel Serverless Handler
module.exports = (req, res) => {
  if (!res.socket.server.io) {
    console.log("🚀 Initializing Socket.io on Vercel...");
    res.socket.server.io = initSocket(res);
  }

  res.end();
};
