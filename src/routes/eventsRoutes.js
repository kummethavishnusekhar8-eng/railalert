const express = require('express');
const router = express.Router();
const sse = require('../services/sseEmitter');

// SSE endpoint for live real-time updates
router.get('/', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  res.write('event: connected\ndata: {"status":"connected"}\n\n');

  sse.addClient(res);

  // Send a heartbeat every 25 seconds to keep connection alive
  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
  });
});

module.exports = router;
