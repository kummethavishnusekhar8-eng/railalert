const cron = require('node-cron');
const db = require('../db');
const pnrService = require('./pnrService');
const sse = require('./sseEmitter');

let cronJob = null;
let isChecking = false;

async function checkAllPnrs() {
  if (isChecking) {
    console.log('[Scheduler] Previous check cycle still in progress, skipping...');
    return;
  }

  isChecking = true;
  const pnrs = db.getPnrs().filter(p => p.active);
  console.log(`[Scheduler] Checking ${pnrs.length} active PNR(s)...`);

  sse.broadcast('scheduler_status', {
    status: 'running',
    message: `Checking ${pnrs.length} active PNR(s)...`,
    timestamp: new Date().toISOString()
  });

  const results = [];
  for (const item of pnrs) {
    try {
      const res = await pnrService.checkPnr(item.pnr);
      results.push(res);
      // Small pause between checks to avoid rate limits
      await new Promise(r => setTimeout(r, 400));
    } catch (err) {
      console.error(`[Scheduler] Error checking PNR ${item.pnr}:`, err);
    }
  }

  isChecking = false;
  sse.broadcast('scheduler_status', {
    status: 'idle',
    message: `Completed check cycle for ${pnrs.length} PNR(s).`,
    timestamp: new Date().toISOString()
  });

  return results;
}

function startScheduler() {
  const settings = db.getSettings();
  if (!settings.autoCheckEnabled) {
    console.log('[Scheduler] Automated periodic checking is disabled in settings.');
    return;
  }

  if (cronJob) {
    cronJob.stop();
  }

  const minutes = Math.max(1, parseInt(settings.pollingIntervalMinutes || 5, 10));
  // Cron expression: runs every X minutes
  const cronExp = `*/${minutes} * * * *`;
  console.log(`[Scheduler] Starting background job: Every ${minutes} minute(s) (${cronExp})`);

  cronJob = cron.schedule(cronExp, () => {
    checkAllPnrs().catch(err => console.error('[Scheduler] Cycle error:', err));
  });
}

function stopScheduler() {
  if (cronJob) {
    cronJob.stop();
    cronJob = null;
    console.log('[Scheduler] Background job stopped.');
  }
}

function restartScheduler() {
  stopScheduler();
  startScheduler();
}

module.exports = {
  startScheduler,
  stopScheduler,
  restartScheduler,
  checkAllPnrs
};
