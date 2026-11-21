const express = require('express');
const router = express.Router();
const db = require('../db');
const pnrService = require('../services/pnrService');
const notificationService = require('../services/notificationService');
const sse = require('../services/sseEmitter');

// Extract client device identifier from header, query, or body
function getDeviceId(req) {
  return req.headers['x-device-id'] || req.query.deviceId || (req.body && req.body.deviceId) || '';
}

// Check if a PNR belongs to this device
function belongsToDevice(pnrObj, deviceId) {
  if (!pnrObj || !deviceId) return false;
  if (pnrObj.deviceId === deviceId) return true;
  if (Array.isArray(pnrObj.deviceIds) && pnrObj.deviceIds.includes(deviceId)) return true;
  return false;
}

// GET all tracked PNRs for this device only
router.get('/', (req, res) => {
  const deviceId = getDeviceId(req);
  if (!deviceId) {
    // If no device ID is sent, return an empty list for privacy protection
    return res.json({ success: true, pnrs: [] });
  }

  const allPnrs = db.getPnrs();
  const devicePnrs = allPnrs.filter(p => belongsToDevice(p, deviceId));

  res.json({ success: true, pnrs: devicePnrs });
});

// GET single PNR (device-scoped)
router.get('/:pnr', (req, res) => {
  const deviceId = getDeviceId(req);
  const pnr = db.getPnr(req.params.pnr);
  if (!pnr || !belongsToDevice(pnr, deviceId)) {
    return res.status(404).json({ success: false, error: 'PNR not found on your device' });
  }
  res.json({ success: true, pnr });
});

// GET train route for this PNR
router.get('/:pnr/route', async (req, res) => {
  const deviceId = getDeviceId(req);
  const pnr = db.getPnr(req.params.pnr);
  if (!pnr || !belongsToDevice(pnr, deviceId)) {
    return res.status(404).json({ success: false, error: 'PNR not found on your device' });
  }

  // If route is already populated with timings (arr/dep), return it directly
  if (pnr.route && pnr.route.length > 0 && typeof pnr.route[0] === 'object' && pnr.route[0].dep) {
    return res.json({ success: true, route: pnr.route });
  }

  const route = await pnrService.fetchTrainRoute(pnr.trainNumber);
  if (route && route.length > 0) {
    pnr.route = route;
    db.savePnr(pnr);
  }
  res.json({ success: true, route: route || [] });
});

// POST register new PNR (associated with device)
router.post('/', async (req, res) => {
  try {
    const { pnr } = req.body;
    const deviceId = getDeviceId(req);

    if (!pnr || !/^\d{10}$/.test(pnr.trim())) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a valid 10-digit Indian Railways PNR number.'
      });
    }

    if (!deviceId) {
      return res.status(400).json({
        success: false,
        error: 'Device identification missing. Please refresh your browser.'
      });
    }

    const cleanPnr = pnr.trim();
    const existing = db.getPnr(cleanPnr);

    if (existing) {
      if (belongsToDevice(existing, deviceId)) {
        return res.status(409).json({
          success: false,
          error: 'This PNR is already being tracked on your device.'
        });
      }

      // Claim / link this PNR to the current device
      if (!Array.isArray(existing.deviceIds)) {
        existing.deviceIds = existing.deviceId ? [existing.deviceId] : [];
      }
      if (!existing.deviceIds.includes(deviceId)) {
        existing.deviceIds.push(deviceId);
      }
      if (!existing.deviceId) {
        existing.deviceId = deviceId;
      }

      db.savePnr(existing);
      sse.broadcast('pnr_added', existing, existing.deviceIds);

      return res.status(200).json({
        success: true,
        message: 'PNR linked to your device.',
        pnr: existing
      });
    }

    // Fetch real live Indian Railways details & initialize PNR
    const newPnrObj = await pnrService.registerPnr(cleanPnr, {});

    newPnrObj.deviceId = deviceId;
    newPnrObj.deviceIds = [deviceId];

    db.savePnr(newPnrObj);
    sse.broadcast('pnr_added', newPnrObj, newPnrObj.deviceIds);

    res.status(201).json({
      success: true,
      message: 'PNR registered successfully.',
      pnr: newPnrObj
    });
  } catch (err) {
    console.error('Error adding PNR:', err.message);
    res.status(400).json({ success: false, error: err.message });
  }
});

// DELETE tracked PNR (from this device)
router.delete('/:pnr', (req, res) => {
  const deviceId = getDeviceId(req);
  const existing = db.getPnr(req.params.pnr);
  if (!existing || !belongsToDevice(existing, deviceId)) {
    return res.status(404).json({ success: false, error: 'PNR not found on your device' });
  }

  if (Array.isArray(existing.deviceIds)) {
    existing.deviceIds = existing.deviceIds.filter(id => id !== deviceId);
    if (existing.deviceIds.length === 0) {
      db.deletePnr(req.params.pnr);
    } else {
      if (existing.deviceId === deviceId) {
        existing.deviceId = existing.deviceIds[0];
      }
      db.savePnr(existing);
    }
  } else {
    db.deletePnr(req.params.pnr);
  }

  sse.broadcast('pnr_deleted', { pnr: req.params.pnr }, deviceId);
  res.json({ success: true, message: 'PNR removed from your tracking.' });
});

// POST toggle tracking status
router.post('/:pnr/toggle', (req, res) => {
  const deviceId = getDeviceId(req);
  const pnr = db.getPnr(req.params.pnr);
  if (!pnr || !belongsToDevice(pnr, deviceId)) {
    return res.status(404).json({ success: false, error: 'PNR not found on your device' });
  }
  pnr.active = !pnr.active;
  db.savePnr(pnr);
  sse.broadcast('pnr_updated', pnr, pnr.deviceIds || pnr.deviceId);
  res.json({ success: true, pnr });
});

// POST trigger manual check for this PNR
router.post('/:pnr/check', async (req, res) => {
  try {
    const deviceId = getDeviceId(req);
    const existing = db.getPnr(req.params.pnr);
    if (!existing || !belongsToDevice(existing, deviceId)) {
      return res.status(404).json({ success: false, error: 'PNR not found on your device' });
    }

    const result = await pnrService.checkPnr(req.params.pnr);
    if (!result) {
      return res.status(404).json({ success: false, error: 'PNR not found or inactive' });
    }
    sse.broadcast('pnr_updated', result.pnr, result.pnr.deviceIds || result.pnr.deviceId);
    res.json({
      success: true,
      diff: result.diff,
      pnr: result.pnr
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
