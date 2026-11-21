const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const pnrRoutes = require('./routes/pnrRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const eventsRoutes = require('./routes/eventsRoutes');
const scheduler = require('./services/scheduler');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend static files
app.use(express.static(path.join(__dirname, '..', 'public')));

// API routes
app.use('/api/pnr', pnrRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/events', eventsRoutes);

// Fallback to index.html for SPA
app.use((req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚆 PNR Automatic Update & Alert System`);
  console.log(`📡 Server running on http://localhost:${PORT}`);
  console.log(`🔔 Background status polling initialized`);
  console.log(`=======================================================`);
  
  // Start the background scheduler
  scheduler.startScheduler();
});
