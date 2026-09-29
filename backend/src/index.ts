import express from 'express';
import http from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';

// Load .env from the root x-chatter folder
dotenv.config({ path: path.join(__dirname, '../../.env') });

import { ChatGateway } from './chat/chat.gateway';

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);

// Initialize WebSockets for real-time E2EE chat
const chatGateway = new ChatGateway(server);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'X Chatter Backend is running!' });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`[X Chatter] Server listening on port ${PORT}`);
});
