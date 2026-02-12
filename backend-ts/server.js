/**
 * Custom Next.js server with Socket.io
 *
 * Wraps the standard Next.js server to attach a Socket.io instance
 * on the same HTTP port. All existing REST API routes continue to
 * work unchanged — Socket.io upgrades only on the /socket.io path.
 */

const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const { Server: SocketIO } = require("socket.io");

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "0.0.0.0";
const port = parseInt(process.env.PORT || "3001", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  const io = new SocketIO(httpServer, {
    path: "/socket.io",
    cors: {
      origin: [
        "http://localhost:5173",
        "http://localhost:3000",
        "https://open-triage.vercel.app",
        "https://opentriage.onrender.com",
      ],
      methods: ["GET", "POST"],
      credentials: true,
    },
    // Prefer websocket, fall back to polling for restrictive networks
    transports: ["websocket", "polling"],
  });

  // Store globally so API routes can access it
  globalThis.__socketIO = io;

  io.on("connection", (socket) => {
    console.log(`[Socket.io] Client connected: ${socket.id}`);

    // Clients join a room scoped to their RAG session
    socket.on("join_rag_session", (sessionId) => {
      socket.join(`rag:${sessionId}`);
      console.log(`[Socket.io] ${socket.id} joined rag:${sessionId}`);
    });

    socket.on("leave_rag_session", (sessionId) => {
      socket.leave(`rag:${sessionId}`);
    });

    // Agent session — same room scheme so agent thoughts stream to the client
    socket.on("join_agent_session", (sessionId) => {
      socket.join(`rag:${sessionId}`);
      console.log(`[Socket.io] ${socket.id} joined agent session ${sessionId}`);
    });

    socket.on("leave_agent_session", (sessionId) => {
      socket.leave(`rag:${sessionId}`);
    });

    // HITL — the frontend sends the human's reply to a guidance request
    socket.on("human_reply", ({ sessionId, reply }) => {
      console.log(
        `[Socket.io] human_reply for session ${sessionId}: ${(reply || "").slice(0, 80)}`,
      );

      // Resolve the pending guidance Promise in the agent
      const pendingMap = globalThis.__pendingGuidance;
      if (pendingMap && typeof pendingMap.get === "function") {
        const pending = pendingMap.get(sessionId);
        if (pending && typeof pending.resolve === "function") {
          pending.resolve({
            sessionId,
            thoughtId: pending.request?.thoughtId ?? 0,
            reply: reply || "No reply provided.",
            timestamp: new Date().toISOString(),
          });
          pendingMap.delete(sessionId);
        } else {
          console.warn(
            `[Socket.io] No pending guidance for session ${sessionId}`,
          );
        }
      }
    });

    socket.on("disconnect", (reason) => {
      console.log(`[Socket.io] Client disconnected: ${socket.id} (${reason})`);
    });
  });

  httpServer.listen(port, hostname, () => {
    console.log(`> Server ready on http://${hostname}:${port}`);
    console.log(`> Socket.io attached on the same port`);
  });
});
