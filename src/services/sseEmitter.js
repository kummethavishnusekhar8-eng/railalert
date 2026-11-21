const EventEmitter = require('events');

class SSEBroadcaster extends EventEmitter {
  constructor() {
    super();
    this.clients = new Set();
  }

  addClient(res) {
    this.clients.add(res);
    res.on('close', () => {
      this.clients.delete(res);
    });
  }

  broadcast(eventType, data) {
    const payload = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of this.clients) {
      try {
        client.write(payload);
      } catch (err) {
        console.error('Error writing to SSE client:', err);
        this.clients.delete(client);
      }
    }
  }
}

const broadcaster = new SSEBroadcaster();
module.exports = broadcaster;
