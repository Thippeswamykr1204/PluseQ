import "dotenv/config";
import http from "http";
import app from "./app.js";
import { connectDB } from "./config/db.js";
import { initIO } from "./realtime.js";

const PORT = process.env.PORT || 5000;

const start = async () => {
  await connectDB();

  const server = http.createServer(app);
  initIO(server, process.env.CLIENT_URL || "*");

  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

start();
