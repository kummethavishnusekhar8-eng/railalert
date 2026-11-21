const express = require('express');
const router = express.Router();
const db = require('../db');
const scheduler = require('../services/scheduler');
const sse = require('../services/sseEmitter');

// GET settings
router.get('/', (req, res) => {
  res.json({
    success: true,
    settings: db.getSettings()
  });
});

// POST update settings
router.post('/', (req, res) => {
  try {
    const updated = db.updateSettings(req.body);
    // Restart scheduler with new interval / status
    scheduler.restartScheduler();
    sse.broadcast('settings_updated', updated);
    res.json({
      success: true,
      message: 'Settings updated successfully.',
      settings: updated
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST trigger immediate check of all PNRs
router.post('/check-all', async (req, res) => {
  try {
    const results = await scheduler.checkAllPnrs();
    res.json({
      success: true,
      message: 'Check cycle initiated.',
      count: results ? results.length : 0
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
