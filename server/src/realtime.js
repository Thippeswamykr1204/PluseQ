import { Server } from "socket.io";

let io = null;

export const initIO = (httpServer, clientUrl) => {
  io = new Server(httpServer, {
    cors: { origin: clientUrl, credentials: true },
  });

  io.on("connection", (socket) => {
    socket.on("queue:join", (queueId) => {
      socket.join(`queue:${queueId}`);
    });
    socket.on("queue:leave", (queueId) => {
      socket.leave(`queue:${queueId}`);
    });
  });

  return io;
};

export const getIO = () => io;
