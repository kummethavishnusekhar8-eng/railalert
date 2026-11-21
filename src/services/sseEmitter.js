const EventEmitter = require('events');

class SSEBroadcaster extends EventEmitter {
  constructor() {
    super();
    this.clients = new Map(); // res -> deviceId
  }

  addClient(res, deviceId = null) {
    this.clients.set(res, deviceId);
    res.on('close', () => {
      this.clients.delete(res);
    });
  }

  broadcast(eventType, data, targetDeviceId = null) {
    const payload = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const [client, clientDeviceId] of this.clients.entries()) {
      try {
        // If targetDeviceId specified, only send to matching device
        if (targetDeviceId) {
          if (Array.isArray(targetDeviceId)) {
            if (clientDeviceId && !targetDeviceId.includes(clientDeviceId)) continue;
          } else if (clientDeviceId && clientDeviceId !== targetDeviceId) {
            continue;
          }
        }
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
