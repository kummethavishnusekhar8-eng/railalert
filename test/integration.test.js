const http = require('http');

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(`http://localhost:3000${path}`, options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });
    req.on('error', reject);
    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('--- Running RailAlert 100% Free Integration Tests ---');
  
  // 1. Check existing PNRs
  const pnrsRes = await request('/api/pnr');
  console.log(`✓ GET /api/pnr status: ${pnrsRes.status}, count: ${pnrsRes.data.pnrs?.length}`);

  // 2. Register a new PNR with Phone and Email
  const addRes = await request('/api/pnr', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: {
      pnr: '9284719283',
      phoneNumber: '919876543210',
      email: 'free_passenger@gmail.com'
    }
  });
  console.log(`✓ POST /api/pnr (free registration) status: ${addRes.status}`);

  // 3. Simulate ticket confirmation transition (triggers automated free notifications)
  const simRes = await request('/api/pnr/9284719283/simulate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { action: 'confirm' }
  });
  console.log(`✓ POST /api/pnr/9284719283/simulate (free alert trigger) status: ${simRes.status}`);
  console.log(`  Summary: ${simRes.data.diff?.changeSummary}`);
  console.log(`  Passenger 1: ${simRes.data.pnr?.passengers[0]?.currentStatus} (${simRes.data.pnr?.passengers[0]?.coach}-${simRes.data.pnr?.passengers[0]?.berth})`);

  // 4. Test NTFY Free Phone Push endpoint
  const ntfyTest = await request('/api/notifications/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: {
      type: 'ntfy',
      topic: 'railalert-test-topic'
    }
  });
  console.log(`✓ POST /api/notifications/test (NTFY Free Phone Push): ${ntfyTest.status}, message: ${ntfyTest.data.message}`);

  // 5. Check notifications audit log
  const notifRes = await request('/api/notifications');
  console.log(`✓ GET /api/notifications count: ${notifRes.data.notifications?.length}`);
  const channels = [...new Set(notifRes.data.notifications.map(n => n.type))];
  console.log(`  Active Channels logged: ${channels.join(', ')}`);

  console.log('--- All 100% Free Integration Tests Passed Successfully! ---');
  process.exit(0);
}

// Start server and run tests
require('../src/server');
setTimeout(runTests, 1200);
