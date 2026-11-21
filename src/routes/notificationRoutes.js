const express = require('express');
const router = express.Router();
const db = require('../db');
const notificationService = require('../services/notificationService');

// Check if a PNR belongs to this device
function belongsToDevice(pnrObj, deviceId) {
  if (!pnrObj || !deviceId) return false;
  if (pnrObj.deviceId === deviceId) return true;
  if (Array.isArray(pnrObj.deviceIds) && pnrObj.deviceIds.includes(deviceId)) return true;
  return false;
}

// GET notification audit history (filtered by device's PNRs)
router.get('/', (req, res) => {
  const deviceId = req.headers['x-device-id'] || req.query.deviceId;
  if (!deviceId) {
    return res.json({ success: true, notifications: [] });
  }

  const userPnrs = new Set(
    db.getPnrs()
      .filter(p => belongsToDevice(p, deviceId))
      .map(p => p.pnr)
  );

  const limit = parseInt(req.query.limit, 10) || 100;
  const filtered = db.getNotifications(limit).filter(n => userPnrs.has(n.pnr));
  res.json({
    success: true,
    notifications: filtered
  });
});

// POST test notification
router.post('/test', async (req, res) => {
  try {
    const { type, recipient, apiKey, botToken, chatId, topic } = req.body;
    const settings = db.getSettings();

    // Direct test for NTFY (Free Phone Push)
    if (type === 'ntfy') {
      const targetTopic = topic || recipient || settings.ntfy?.topic || 'railalert-updates';
      const pushRes = await notificationService.sendNtfyPush(
        targetTopic,
        'RailAlert Test Notification',
        'This is a test notification from your 100% Free PNR Auto-Updater!'
      );
      return res.json({
        success: pushRes.success,
        message: pushRes.success ? `Test push sent to ntfy.sh/${targetTopic}` : pushRes.error,
        topic: targetTopic
      });
    }

    // Direct test for CallMeBot (Free WhatsApp)
    if (type === 'callmebot' || type === 'whatsapp-free') {
      const phone = recipient || settings.callmebot?.phone;
      const key = apiKey || settings.callmebot?.apiKey;
      if (!phone || !key) {
        return res.status(400).json({
          success: false,
          error: 'Please provide your phone number and CallMeBot API key.'
        });
      }
      const waRes = await notificationService.sendCallMeBotWhatsApp(
        phone,
        key,
        '🚆 *RailAlert Free WhatsApp Test*\nYour 100% free PNR status updater is connected successfully!'
      );
      return res.json({
        success: waRes.success,
        message: waRes.success ? `WhatsApp test message dispatched to ${phone}` : waRes.error
      });
    }

    res.status(400).json({ success: false, error: 'Unknown notification test type' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
