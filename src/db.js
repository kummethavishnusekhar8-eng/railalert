const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'database.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initial default state - 100% Free Defaults
const DEFAULT_STATE = {
  settings: {
    pollingIntervalMinutes: 5,
    autoCheckEnabled: true,
    simulationMode: true, // defaults to true for instant free testing
    pnrProvider: 'free-auto', // 'free-auto', 'rapidapi', 'simulation'
    email: {
      enabled: true,
      service: 'gmail', // free gmail smtp with app password
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      user: '',
      pass: '',
      from: '"RailAlert PNR Bot" <notifications@railalert.internal>'
    },
    // 100% Free WhatsApp via CallMeBot
    callmebot: {
      enabled: false,
      apiKey: '',
      phone: ''
    },
    // 100% Free Telegram Bot
    telegram: {
      enabled: false,
      botToken: '',
      chatId: ''
    },
    // 100% Free Mobile Push via ntfy.sh (No signup required)
    ntfy: {
      enabled: true,
      topic: 'railalert-pnr-updates',
      serverUrl: 'https://ntfy.sh'
    },
    // Optional Paid / Trial Gateways
    sms: {
      enabled: false,
      provider: 'twilio',
      accountSid: '',
      authToken: '',
      fromPhone: ''
    },
    whatsapp: {
      enabled: false,
      provider: 'callmebot', // 'callmebot' (free) or 'twilio'
      fromWhatsApp: 'whatsapp:+14155238886'
    },
    rapidApi: {
      apiKey: '',
      apiHost: 'irctc-indian-railway-pnr-status.p.rapidapi.com'
    }
  },
  pnrs: [],
  notifications: []
};

function readDb() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      fs.writeFileSync(DB_FILE, JSON.stringify(DEFAULT_STATE, null, 2), 'utf-8');
      return DEFAULT_STATE;
    }
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const data = JSON.parse(raw);
    return {
      settings: { ...DEFAULT_STATE.settings, ...(data.settings || {}) },
      pnrs: data.pnrs || [],
      notifications: data.notifications || []
    };
  } catch (err) {
    console.error('Error reading database file:', err);
    return DEFAULT_STATE;
  }
}

function writeDb(data) {
  try {
    const tempFile = `${DB_FILE}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempFile, DB_FILE);
    return true;
  } catch (err) {
    console.error('Error writing database file:', err);
    return false;
  }
}

module.exports = {
  getDb: readDb,
  saveDb: writeDb,
  getSettings: () => readDb().settings,
  updateSettings: (newSettings) => {
    const db = readDb();
    db.settings = { ...db.settings, ...newSettings };
    writeDb(db);
    return db.settings;
  },
  getPnrs: () => readDb().pnrs,
  getPnr: (pnrNumber) => readDb().pnrs.find(p => p.pnr === pnrNumber),
  savePnr: (pnrObj) => {
    const db = readDb();
    const idx = db.pnrs.findIndex(p => p.pnr === pnrObj.pnr);
    if (idx >= 0) {
      db.pnrs[idx] = pnrObj;
    } else {
      db.pnrs.unshift(pnrObj);
    }
    writeDb(db);
    return pnrObj;
  },
  deletePnr: (pnrNumber) => {
    const db = readDb();
    const initialLen = db.pnrs.length;
    db.pnrs = db.pnrs.filter(p => p.pnr !== pnrNumber);
    writeDb(db);
    return db.pnrs.length < initialLen;
  },
  getNotifications: (limit = 100) => {
    const db = readDb();
    return (db.notifications || []).slice(0, limit);
  },
  addNotification: (notification) => {
    const db = readDb();
    if (!db.notifications) db.notifications = [];
    db.notifications.unshift(notification);
    if (db.notifications.length > 500) {
      db.notifications = db.notifications.slice(0, 500);
    }
    writeDb(db);
    return notification;
  }
};
