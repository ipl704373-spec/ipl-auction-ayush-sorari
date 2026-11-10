/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // JSON body parser with generous boundary
  app.use(express.json({ limit: '10mb' }));

  // In-memory room store for instant, zero-latency, cross-device multiplayer
  const roomsStore = new Map<string, any>();
  const clientListeners = new Map<string, Set<Response>>();

  // Broadcast updated room state to all clients connected via SSE
  function broadcastRoomState(code: string, room: any) {
    const clients = clientListeners.get(code);
    if (clients && clients.size > 0) {
      const payload = `data: ${JSON.stringify({ type: 'ROOM_UPDATE', room })}\n\n`;
      for (const client of clients) {
        try {
          client.write(payload);
        } catch {
          clients.delete(client);
        }
      }
    }
  }

  // 1. Health check & status
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', activeRoomsCount: roomsStore.size, timestamp: Date.now() });
  });

  // 2. Get room by code (case-insensitive & sanitized)
  app.get('/api/rooms/:code', (req: Request, res: Response) => {
    const raw = req.params.code || '';
    const code = raw.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    const room = roomsStore.get(code);

    if (!room) {
      return res.status(404).json({
        success: false,
        error: `Room "${code}" not found on server.`,
        code
      });
    }

    return res.json({ success: true, room });
  });

  // 3. Create or register room on server
  app.post('/api/rooms', (req: Request, res: Response) => {
    const room = req.body;
    if (!room || !room.code) {
      return res.status(400).json({ success: false, error: 'Invalid room payload: missing code' });
    }

    const code = String(room.code).replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    room.code = code;
    room.lastUpdated = Date.now();
    roomsStore.set(code, room);

    broadcastRoomState(code, room);

    return res.json({ success: true, room });
  });

  // 4. Update existing room (bids, lots, players joining)
  app.post('/api/rooms/:code/update', (req: Request, res: Response) => {
    const raw = req.params.code || '';
    const code = raw.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    const room = req.body;

    if (!room) {
      return res.status(400).json({ success: false, error: 'Empty room update' });
    }

    room.code = code;
    room.lastUpdated = Date.now();
    roomsStore.set(code, room);

    broadcastRoomState(code, room);

    return res.json({ success: true, room });
  });

  // 5. Server-Sent Events (SSE) live sync stream
  app.get('/api/rooms/:code/events', (req: Request, res: Response) => {
    const raw = req.params.code || '';
    const code = raw.replace(/[^A-Za-z0-9]/g, '').toUpperCase();

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    if (!clientListeners.has(code)) {
      clientListeners.set(code, new Set());
    }
    clientListeners.get(code)!.add(res);

    // Send immediate initial sync if room is already created
    const existing = roomsStore.get(code);
    if (existing) {
      res.write(`data: ${JSON.stringify({ type: 'ROOM_UPDATE', room: existing })}\n\n`);
    }

    // Keep connection alive with periodic comment pings
    const pingInterval = setInterval(() => {
      try {
        res.write(': ping\n\n');
      } catch {
        clearInterval(pingInterval);
      }
    }, 15000);

    req.on('close', () => {
      clearInterval(pingInterval);
      const set = clientListeners.get(code);
      if (set) {
        set.delete(res);
        if (set.size === 0) {
          clientListeners.delete(code);
        }
      }
    });
  });

  // Mount Vite dev middleware or serve static production build
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: process.env.DISABLE_HMR !== 'true' },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[IPL Arena Server] Full-Stack server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[IPL Arena Server] Failed to start server:', err);
  process.exit(1);
});
