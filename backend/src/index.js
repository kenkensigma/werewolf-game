const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const { registerRoomHandlers } = require("./socket/roomHandlers.js");
require("dotenv").config();

const app = express();
const server = http.createServer(app);

app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
}));

app.use(express.json());

const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

io.on("connection", (socket) => {
  console.log(`Player connected: ${socket.id}`);

  socket.emit("server:welcome", {
    message: "Connected to Werewolf server!",
  });

  registerRoomHandlers(io, socket);

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

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Werewolf server running on port ${PORT}`);
});