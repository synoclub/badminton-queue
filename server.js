import { WebSocketServer } from 'ws';

const PORT = 8080;
const wss = new WebSocketServer({ port: PORT });

// Store the latest application state
let latestState = {
  players: [],
  courts: [],
  members: [],
  timestamp: Date.now()
};

// Track all connected clients
const clients = new Set();

console.log(`🚀 WebSocket server started on ws://localhost:${PORT}`);

wss.on('connection', (ws) => {
  console.log('✅ New client connected');
  clients.add(ws);

  // Send current state to newly connected client
  ws.send(JSON.stringify({
    type: 'sync_response',
    state: latestState,
    timestamp: Date.now(),
    clientId: 'server'
  }));

  // Handle incoming messages
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());

      switch (message.type) {
        case 'state_update':
          // Update the latest state
          latestState = {
            ...latestState,
            ...message.state,
            timestamp: message.timestamp
          };

          // Broadcast to all OTHER clients (not the sender)
          broadcast(data.toString(), ws);
          console.log(`📡 State update broadcasted from client ${message.clientId}`);
          break;

        case 'sync_request':
          // Send current state to requesting client
          ws.send(JSON.stringify({
            type: 'sync_response',
            state: latestState,
            timestamp: Date.now(),
            clientId: 'server'
          }));
          console.log('🔄 Sync request handled');
          break;

        case 'ping':
          // Respond with pong
          ws.send(JSON.stringify({
            type: 'pong',
            timestamp: Date.now(),
            clientId: 'server'
          }));
          break;

        default:
          console.log('❓ Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('❌ Error processing message:', error);
    }
  });

  // Handle client disconnect
  ws.on('close', () => {
    clients.delete(ws);
    console.log('👋 Client disconnected. Active clients:', clients.size);
  });

  // Handle errors
  ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error);
    clients.delete(ws);
  });
});

// Broadcast message to all clients except sender
function broadcast(message, sender) {
  clients.forEach((client) => {
    if (client !== sender && client.readyState === 1) { // 1 = OPEN
      client.send(message);
    }
  });
}

// Heartbeat to keep connections alive
setInterval(() => {
  clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(JSON.stringify({
        type: 'ping',
        timestamp: Date.now(),
        clientId: 'server'
      }));
    }
  });
}, 30000); // Every 30 seconds

// Handle server shutdown gracefully
process.on('SIGTERM', () => {
  console.log('🛑 Server shutting down...');
  clients.forEach((client) => client.close());
  wss.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});
