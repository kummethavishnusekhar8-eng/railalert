const express = require('express');
const router = express.Router();
const db = require('../db');
const notificationService = require('../services/notificationService');

// GET notification audit history
router.get('/', (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 100;
  res.json({
    success: true,
    notifications: db.getNotifications(limit)
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
        message: waRes.success ? 'Free WhatsApp test message dispatched!' : waRes.error
      });
    }

    // Direct test for Telegram Bot
    if (type === 'telegram') {
      const token = botToken || settings.telegram?.botToken;
      const chat = chatId || recipient || settings.telegram?.chatId;
      if (!token || !chat) {
        return res.status(400).json({
          success: false,
          error: 'Please provide your Telegram Bot Token and Chat ID.'
        });
      }
      const teleRes = await notificationService.sendTelegramMessage(
        token,
        chat,
        '🚆 *RailAlert Telegram Test*\nYour free PNR status updater is connected to Telegram!'
      );
      return res.json({
        success: teleRes.success,
        message: teleRes.success ? 'Telegram test message sent!' : teleRes.error
      });
    }

    // Default multi-channel test
    const samplePnr = {
      pnr: '2847291845',
      trainNumber: '12952',
      trainName: 'Tejas Rajdhani Express',
      fromStation: 'NDLS (New Delhi)',
      toStation: 'MMCT (Mumbai Central)',
      dateOfJourney: '28-Nov-2026',
      class: '3A',
      chartPrepared: true,
      passengers: [
        {
          number: 1,
          name: 'Primary Passenger',
          bookingStatus: 'WL 14',
          currentStatus: 'CNF',
          coach: 'B3',
          berth: 28,
          berthType: 'Side Lower'
        }
      ],
      email: type === 'email' ? recipient : null,
      phoneNumber: (type === 'sms' || type === 'whatsapp') ? recipient : null
    };

    const summary = 'Test Alert: Status changed from WL 14 to CNF (Coach B3, Berth 28)';
    const results = await notificationService.sendPnrUpdateNotification(samplePnr, summary);

    res.json({
      success: true,
      message: `Test notification dispatched.`,
      results
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
