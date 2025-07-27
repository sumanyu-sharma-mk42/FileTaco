import { WebSocketServer } from "ws";

const rooms = {}; // { roomId: { clients: [ws1, ws2], offerer: ws, answerer: ws } }

export function setupSignaling(server) {
  const wss = new WebSocketServer({ server });

  wss.on("connection", (ws) => {
    ws.on("message", (message) => {
      let data;
      try {
        data = JSON.parse(message);
      } catch (err) {
        console.error("Invalid JSON", err);
        return;
      }

      const { type, roomId, payload } = data;

      switch (type) {
        case "join":
          if (!rooms[roomId]) {
            rooms[roomId] = { clients: [], offerer: null, answerer: null };
          }
          rooms[roomId].clients.push(ws);
          ws.roomId = roomId;

          if (rooms[roomId].clients.length === 1) {
            rooms[roomId].offerer = ws;
          } else if (rooms[roomId].clients.length === 2) {
            rooms[roomId].answerer = ws;
            if (rooms[roomId].offerer.readyState === ws.OPEN) {
              rooms[roomId].offerer.send(JSON.stringify({ type: "create_offer" }));
            }
          }
          break;

        case "offer":
          if (rooms[roomId]?.answerer?.readyState === ws.OPEN) {
            rooms[roomId].answerer.send(JSON.stringify({ type: "offer", payload }));
          }
          break;

        case "answer":
          if (rooms[roomId]?.offerer?.readyState === ws.OPEN) {
            rooms[roomId].offerer.send(JSON.stringify({ type: "answer", payload }));
          }
          break;
      }
    });

    ws.on("close", () => {
      const { roomId } = ws;
      if (!roomId || !rooms[roomId]) return;

      // Remove the disconnected client from the list
      rooms[roomId].clients = rooms[roomId].clients.filter(client => client !== ws);
      
      console.log(`Client disconnected. ${rooms[roomId].clients.length} clients remaining in room ${roomId}.`);

      // If the room is now empty, delete it
      if (rooms[roomId].clients.length === 0) {
        delete rooms[roomId];
        console.log(`Room ${roomId} deleted.`);
      } else {
        // Notify the remaining client that their peer has disconnected
        const remainingClient = rooms[roomId].clients[0];
        if (remainingClient && remainingClient.readyState === ws.OPEN) {
          remainingClient.send(JSON.stringify({ type: 'peer_disconnected' }));
        }
      }
    });
  });

  console.log("✅ WebSocket signaling server initialized");
}