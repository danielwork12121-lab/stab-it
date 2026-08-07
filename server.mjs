import express from 'express';
import chatHandler from './api/ai/chat.js';

const HOST = process.env.HOST || '127.0.0.1';
const PORT = parseInt(process.env.PORT, 10) || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';

const app = express();

app.use(express.json({ limit: '256kb' }));

app.use((err, _req, res, next) => {
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request body too large' });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON' });
  }
  next(err);
});

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'stabit',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/ai/chat', (_req, res) => {
  res.status(405).json({ error: 'Method not allowed' });
});
app.post('/api/ai/chat', chatHandler);

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use(express.static('public', {
  index: 'index.html',
  extensions: ['html']
}));

app.use((_req, res) => {
  res.sendFile('index.html', { root: 'public' });
});

app.use((err, _req, res, _next) => {
  console.error('[SERVER] Unhandled error:', err.message);
  if (NODE_ENV === 'production') {
    res.status(500).json({ error: 'Internal server error' });
  } else {
    res.status(500).json({ error: err.message });
  }
});

const server = app.listen(PORT, HOST, () => {
  console.log(`[SERVER] StabIt listening on http://${HOST}:${PORT}`);
});

function shutdown(signal) {
  console.log(`[SERVER] Received ${signal}, shutting down gracefully...`);
  server.close(() => {
    console.log('[SERVER] Closed all connections.');
    process.exit(0);
  });
  setTimeout(() => {
    console.error('[SERVER] Forced shutdown after timeout.');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));