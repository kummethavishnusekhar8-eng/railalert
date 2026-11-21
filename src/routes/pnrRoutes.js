const express = require('express');
const router = express.Router();
const db = require('../db');
const pnrService = require('../services/pnrService');
const notificationService = require('../services/notificationService');
const sse = require('../services/sseEmitter');

// GET all tracked PNRs
router.get('/', (req, res) => {
  res.json({ success: true, pnrs: db.getPnrs() });
});

// GET single PNR
router.get('/:pnr', (req, res) => {
  const pnr = db.getPnr(req.params.pnr);
  if (!pnr) {
    return res.status(404).json({ success: false, error: 'PNR not found' });
  }
  res.json({ success: true, pnr });
});

// POST register new PNR
router.post('/', async (req, res) => {
  try {
    const { pnr, phoneNumber, email, callmebotApiKey } = req.body;

    if (!pnr || !/^\d{10}$/.test(pnr.trim())) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a valid 10-digit Indian Railways PNR number.'
      });
    }

    if (!phoneNumber && !email) {
      return res.status(400).json({
        success: false,
        error: 'Please provide at least a phone number or email address for updates.'
      });
    }

    // Save CallMeBot WhatsApp API key if provided
    if (callmebotApiKey && callmebotApiKey.trim()) {
      const currentSettings = db.getSettings();
      db.updateSettings({
        callmebot: {
          enabled: true,
          apiKey: callmebotApiKey.trim(),
          phone: phoneNumber ? phoneNumber.trim() : (currentSettings.callmebot?.phone || '')
        }
      });
    }

    const cleanPnr = pnr.trim();
    const existing = db.getPnr(cleanPnr);
    if (existing) {
      return res.status(409).json({
        success: false,
        error: 'This PNR is already being tracked in the system.'
      });
    }

    // Fetch real live Indian Railways details & initialize PNR
    const newPnrObj = await pnrService.registerPnr(cleanPnr, {
      phoneNumber: phoneNumber ? phoneNumber.trim() : '',
      email: email ? email.trim() : ''
    });

    db.savePnr(newPnrObj);
    sse.broadcast('pnr_added', newPnrObj);

    // Immediately dispatch welcome / registration confirmation message to user
    await notificationService.sendPnrRegistrationNotification(newPnrObj);

    res.status(201).json({
      success: true,
      message: 'PNR registered! Confirmation message dispatched to your contact.',
      pnr: newPnrObj
    });
  } catch (err) {
    console.error('Error adding PNR:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE tracked PNR
router.delete('/:pnr', (req, res) => {
  const deleted = db.deletePnr(req.params.pnr);
  if (!deleted) {
    return res.status(404).json({ success: false, error: 'PNR not found' });
  }
  sse.broadcast('pnr_deleted', { pnr: req.params.pnr });
  res.json({ success: true, message: 'PNR removed from tracking.' });
});

// POST toggle tracking status
router.post('/:pnr/toggle', (req, res) => {
  const pnr = db.getPnr(req.params.pnr);
  if (!pnr) {
    return res.status(404).json({ success: false, error: 'PNR not found' });
  }
  pnr.active = !pnr.active;
  db.savePnr(pnr);
  sse.broadcast('pnr_updated', pnr);
  res.json({ success: true, pnr });
});

// POST trigger manual check for this PNR
router.post('/:pnr/check', async (req, res) => {
  try {
    const result = await pnrService.checkPnr(req.params.pnr);
    if (!result) {
      return res.status(404).json({ success: false, error: 'PNR not found or inactive' });
    }
    sse.broadcast('pnr_updated', result.pnr);
    res.json({
      success: true,
      diff: result.diff,
      pnr: result.pnr
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST simulate transition (waitlist-drop, confirm, chart-prepared)
router.post('/:pnr/simulate', async (req, res) => {
  try {
    const { action } = req.body;
    let result = null;

    if (action === 'waitlist-drop') {
      result = await pnrService.simulateWaitlistDrop(req.params.pnr);
    } else if (action === 'confirm') {
      result = await pnrService.simulateConfirmTicket(req.params.pnr);
    } else if (action === 'chart-prepared') {
      result = await pnrService.simulateChartPrepared(req.params.pnr);
    } else {
      return res.status(400).json({
        success: false,
        error: 'Invalid simulation action. Choose waitlist-drop, confirm, or chart-prepared.'
      });
    }

    sse.broadcast('pnr_updated', result.pnr);
    res.json({
      success: true,
      message: `Simulated action "${action}" executed.`,
      diff: result.diff,
      pnr: result.pnr
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
