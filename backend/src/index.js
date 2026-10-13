const express = require("express");
const http = require("http");
const path = require("path");
const cors = require("cors");
const { Server } = require("socket.io");
const { registerRoomHandlers } = require("./socket/roomHandlers.js");
const { registerVoiceHandlers } = require("./socket/voiceHandlers.js");
require("dotenv").config();

const app = express();
const server = http.createServer(app);

app.use(cors({
  origin: "*",
}));

app.use(express.json());

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Serve compiled frontend if available (same-origin production/tunnel deployment)
const frontendDist = path.join(__dirname, "../../frontend/dist");
app.use(express.static(frontendDist));

io.on("connection", (socket) => {
  console.log(`Player connected: ${socket.id}`);

  socket.emit("server:welcome", {
    message: "Connected to Werewolf server!",
  });

  registerRoomHandlers(io, socket);
  registerVoiceHandlers(io, socket);

  socket.on("client:ping", (data, callback) => {
    const timestamp = Date.now();
    if (typeof callback === "function") {
      callback({ pong: true, serverTime: timestamp });
    } else {
      socket.emit("server:pong", { pong: true, serverTime: timestamp });
    }
  });

  socket.on("disconnect", () => {
    console.log(`Player disconnected: ${socket.id}`);
  });
});
 
// Fallback to React index.html for all non-API and non-socket routes
app.use((req, res, next) => {
  if (req.path.startsWith("/socket.io") || req.path === "/health") {
    return next();
  }
  res.sendFile(path.join(frontendDist, "index.html"), (err) => {
    if (err) next();
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Werewolf server running on port ${PORT}`);
});