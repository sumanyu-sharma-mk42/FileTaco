// server.js
import express from "express";
import http from "http";
import cors from "cors";
import { setupSignaling } from "./signalling.js";

const app = express();
app.use(cors({
  origin: ["https://file-taco.vercel.app/","http://localhost:5173"]
}));

const server = http.createServer(app);
setupSignaling(server);

server.listen(5000, () => {
  console.log("✅ Server running");
});
