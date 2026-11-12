import 'dotenv/config';
import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Modality } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import { WebSocketServer } from 'ws';
import { apiApp } from './server/apiApp.ts';
import { BASE_LEGAL_SYSTEM_INSTRUCTION, getGeminiClient } from './server/geminiClient.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(apiApp);

async function startServer() {
  const port = Number(process.env.PORT) || 3000;
  const server = http.createServer(app);

  // Optional Real-time Voice WebSocket bridge using gemini-3.8-live
  const wss = new WebSocketServer({ server, path: '/live' });
  wss.on('connection', async (clientWs) => {
    let session: { sendRealtimeInput?: (p: unknown) => void; close?: () => void } | null = null;
    try {
      const ai = getGeminiClient();
      const liveSession = await ai.live.connect({
        model: 'gemini-3.8-live',
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: BASE_LEGAL_SYSTEM_INSTRUCTION,
        },
        callbacks: {
          onmessage: (msg) => {
            if (clientWs.readyState === 1) {
              clientWs.send(JSON.stringify(msg));
            }
          },
          onerror: (err) => {
            if (clientWs.readyState === 1) {
              clientWs.send(JSON.stringify({ error: String(err) }));
            }
          },
          onclose: () => {
            if (clientWs.readyState === 1) clientWs.close();
          },
        },
      });
      session = liveSession as unknown as {
        sendRealtimeInput?: (p: unknown) => void;
        close?: () => void;
      };
    } catch (err) {
      if (clientWs.readyState === 1) {
        clientWs.send(
          JSON.stringify({
            error: err instanceof Error ? err.message : 'تعذر فتح الجلسة الصوتية المباشرة.',
          })
        );
        clientWs.close();
      }
      return;
    }

    clientWs.on('message', (raw) => {
      try {
        const parsed = JSON.parse(raw.toString()) as { audioData?: string; mimeType?: string };
        if (parsed.audioData && session?.sendRealtimeInput) {
          session.sendRealtimeInput({
            audio: {
              data: parsed.audioData,
              mimeType: parsed.mimeType ?? 'audio/pcm;rate=16000',
            },
          });
        }
      } catch {
        // Ignore malformed websocket frames
      }
    });

    clientWs.on('close', () => {
      session?.close?.();
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(port, '0.0.0.0', () => {
    console.log(`E3raf Ha2ak server running on http://0.0.0.0:${port}`);
  });
}

startServer();
