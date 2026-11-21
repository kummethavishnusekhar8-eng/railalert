const nodemailer = require('nodemailer');
const https = require('https');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const sse = require('./sseEmitter');

/**
 * Creates email transporter based on settings (Free Gmail SMTP or Custom)
 */
function getTransporter(emailSettings) {
  if (emailSettings.user && emailSettings.pass) {
    if (emailSettings.service === 'gmail') {
      return nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: emailSettings.user,
          pass: emailSettings.pass
        }
      });
    }
    return nodemailer.createTransport({
      host: emailSettings.host || 'smtp.ethereal.email',
      port: Number(emailSettings.port) || 587,
      secure: Boolean(emailSettings.secure),
      auth: {
        user: emailSettings.user,
        pass: emailSettings.pass
      }
    });
  }
  return null;
}

/**
 * Generates responsive HTML email template for PNR change
 */
function generateEmailHtml(pnrData, changeSummary, passengers) {
  const passengerRows = passengers.map(p => `
    <tr style="border-bottom: 1px solid #e2e8f0;">
      <td style="padding: 12px 8px; font-weight: 600; color: #1e293b;">Passenger ${p.number} (${p.name || 'Passenger'})</td>
      <td style="padding: 12px 8px; color: #64748b;">${p.bookingStatus}</td>
      <td style="padding: 12px 8px; font-weight: bold; color: ${p.currentStatus.includes('CNF') ? '#16a34a' : p.currentStatus.includes('RAC') ? '#ca8a04' : '#dc2626'};">
        ${p.currentStatus}
      </td>
      <td style="padding: 12px 8px; font-weight: 600; color: #0284c7;">
        ${p.coach ? `${p.coach} / Seat ${p.berth} (${p.berthType || 'Berth'})` : 'Not Allocated Yet'}
      </td>
    </tr>
  `).join('');

  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PNR Status Update - ${pnrData.pnr}</title>
  </head>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 24px;">
    <div style="max-width: 620px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1); border: 1px solid #e2e8f0;">
      
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #1e3a8a 0%, #0284c7 100%); color: #ffffff; padding: 24px 28px;">
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <span style="font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; opacity: 0.9;">IRCTC Live Alert</span>
          <span style="background: rgba(255,255,255,0.2); padding: 4px 10px; border-radius: 9999px; font-size: 12px; font-weight: 600;">PNR: ${pnrData.pnr}</span>
        </div>
        <h1 style="margin: 12px 0 4px; font-size: 22px; font-weight: 800;">PNR Status Has Changed!</h1>
        <p style="margin: 0; font-size: 14px; opacity: 0.85;">Your reservation status has been updated in Indian Railways system.</p>
      </div>

      <!-- Change Banner -->
      <div style="background-color: #eff6ff; border-left: 4px solid #2563eb; padding: 16px 24px; margin: 20px 24px 0;">
        <h3 style="margin: 0 0 6px 0; color: #1e40af; font-size: 15px;">Change Summary</h3>
        <p style="margin: 0; color: #1e293b; font-size: 14px; line-height: 1.5;">${changeSummary}</p>
      </div>

      <!-- Train Information Card -->
      <div style="padding: 20px 24px;">
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr>
              <td style="padding: 6px 0; color: #64748b; width: 35%;">Train:</td>
              <td style="padding: 6px 0; font-weight: 700; color: #0f172a;">${pnrData.trainNumber} - ${pnrData.trainName}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b;">Route:</td>
              <td style="padding: 6px 0; font-weight: 600; color: #0f172a;">${pnrData.fromStation} &rarr; ${pnrData.toStation}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b;">Date of Journey:</td>
              <td style="padding: 6px 0; font-weight: 600; color: #0f172a;">${pnrData.dateOfJourney} (Class: ${pnrData.class})</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b;">Chart Status:</td>
              <td style="padding: 6px 0; font-weight: 700; color: ${pnrData.chartPrepared ? '#16a34a' : '#ea580c'};">
                ${pnrData.chartPrepared ? '&#10003; Chart Prepared' : 'Chart Not Prepared'}
              </td>
            </tr>
          </table>
        </div>

        <!-- Passengers Status Table -->
        <h3 style="margin: 0 0 12px 0; color: #0f172a; font-size: 16px;">Passenger Status Breakdown</h3>
        <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13px;">
          <thead>
            <tr style="border-bottom: 2px solid #cbd5e1; background-color: #f8fafc;">
              <th style="padding: 10px 8px; color: #475569;">Passenger</th>
              <th style="padding: 10px 8px; color: #475569;">Booking</th>
              <th style="padding: 10px 8px; color: #475569;">Current</th>
              <th style="padding: 10px 8px; color: #475569;">Coach / Berth</th>
            </tr>
          </thead>
          <tbody>
            ${passengerRows}
          </tbody>
        </table>
      </div>

      <!-- Footer -->
      <div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 18px 24px; text-align: center;">
        <p style="margin: 0 0 6px 0; font-size: 12px; color: #64748b;">
          This 100% Free automated notification was dispatched by your <strong>RailAlert Bot</strong>.
        </p>
        <p style="margin: 0; font-size: 11px; color: #94a3b8;">
          Timestamp: ${new Date().toLocaleString()}
        </p>
      </div>

    </div>
  </body>
  </html>
  `;
}

/**
 * Format SMS message
 */
function generateSmsText(pnrData, changeSummary, passengers) {
  const passengerLines = passengers
    .map(p => `P${p.number}: ${p.currentStatus}${p.coach ? ` (${p.coach}-${p.berth})` : ''}`)
    .join(', ');
  
  return `[IRCTC PNR ALERT] PNR ${pnrData.pnr} Status Updated!\n` +
         `Train: ${pnrData.trainNumber} ${pnrData.trainName}\n` +
         `Date: ${pnrData.dateOfJourney}\n` +
         `Status: ${passengerLines}\n` +
         `Chart: ${pnrData.chartPrepared ? 'PREPARED' : 'NOT PREPARED'}\n` +
         `Detail: ${changeSummary}`;
}

/**
 * Format WhatsApp message
 */
function generateWhatsAppText(pnrData, changeSummary, passengers) {
  const passengerLines = passengers
    .map(p => `• *Passenger ${p.number}*: ${p.currentStatus} ${p.coach ? `📍 Coach *${p.coach}*, Seat *${p.berth}* (${p.berthType})` : ''}`)
    .join('\n');

  return `🚆 *INDIAN RAILWAYS PNR ALERT*\n` +
         `────────────────────\n` +
         `*PNR Number:* \`${pnrData.pnr}\`\n` +
         `*Train:* ${pnrData.trainNumber} - ${pnrData.trainName}\n` +
         `*Route:* ${pnrData.fromStation} ➔ ${pnrData.toStation}\n` +
         `*Date:* ${pnrData.dateOfJourney} | Class: ${pnrData.class}\n` +
         `*Chart Status:* ${pnrData.chartPrepared ? '✅ *CHART PREPARED*' : '⏳ Chart Not Prepared'}\n\n` +
         `📢 *UPDATE:* ${changeSummary}\n\n` +
         `👥 *Passenger Status:*\n${passengerLines}\n` +
         `────────────────────\n` +
         `_100% Free Automated Alert by RailAlert_`;
}

/**
 * Send 100% Free WhatsApp via CallMeBot
 */
function sendCallMeBotWhatsApp(phone, apiKey, message) {
  return new Promise((resolve) => {
    // Clean phone number (digits only, no + or spaces)
    let cleanPhone = (phone || '').replace(/[^\d]/g, '');
    // If 10-digit Indian number without country code, add 91
    if (cleanPhone.length === 10 && ['6', '7', '8', '9'].includes(cleanPhone[0])) {
      cleanPhone = `91${cleanPhone}`;
    }

    if (!apiKey) {
      return resolve({ success: false, error: 'CallMeBot API key missing' });
    }

    const encodedText = encodeURIComponent(message);
    const url = `https://api.callmebot.com/whatsapp.php?phone=${cleanPhone}&text=${encodedText}&apikey=${apiKey}`;

    console.log(`[WhatsApp] Sending to ${cleanPhone} via CallMeBot...`);

    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300 && !data.includes('ERROR:')) {
          console.log(`[WhatsApp] Successfully delivered to ${cleanPhone}`);
          resolve({ success: true, response: data });
        } else {
          console.warn(`[WhatsApp] Delivery warning for ${cleanPhone}:`, data);
          resolve({ success: false, error: `CallMeBot: ${data}` });
        }
      });
    }).on('error', (err) => {
      console.error(`[WhatsApp] Network error for ${cleanPhone}:`, err.message);
      resolve({ success: false, error: err.message });
    });
  });
}

/**
 * Send 100% Free Telegram Alert
 */
function sendTelegramMessage(botToken, chatId, message) {
  return new Promise((resolve) => {
    const postData = JSON.stringify({
      chat_id: chatId,
      text: message,
      parse_mode: 'Markdown'
    });

    const req = https.request({
      hostname: 'api.telegram.org',
      port: 443,
      path: `/bot${botToken}/sendMessage`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.ok) {
            resolve({ success: true, result: parsed.result });
          } else {
            resolve({ success: false, error: parsed.description || 'Telegram API error' });
          }
        } catch {
          resolve({ success: false, error: `Telegram HTTP ${res.statusCode}` });
        }
      });
    });

    req.on('error', err => resolve({ success: false, error: err.message }));
    req.write(postData);
    req.end();
  });
}

/**
 * Send 100% Free Mobile Push Notification via NTFY.sh
 */
function sendNtfyPush(topic, title, message, serverUrl = 'https://ntfy.sh') {
  return new Promise((resolve) => {
    try {
      const urlObj = new URL(serverUrl);
      // Clean non-ASCII characters from headers
      const cleanTitle = (title || 'RailAlert PNR Update').replace(/[^\x00-\x7F]/g, '').trim();

      const req = https.request({
        hostname: urlObj.hostname,
        port: 443,
        path: `/${encodeURIComponent(topic)}`,
        method: 'POST',
        headers: {
          'Title': cleanTitle,
          'Priority': 'urgent',
          'Tags': 'train,rotating_light'
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ success: true, data });
          } else {
            resolve({ success: false, error: `NTFY returned HTTP ${res.statusCode}` });
          }
        });
      });

      req.on('error', err => resolve({ success: false, error: err.message }));
      req.write(message);
      req.end();
    } catch (e) {
      resolve({ success: false, error: e.message });
    }
  });
}

/**
 * Main Dispatcher: Handles all Free & Optional Channels
 */
async function sendPnrUpdateNotification(pnrData, changeSummary) {
  const settings = db.getSettings();
  const passengers = pnrData.passengers || [];
  const results = {};
  const notificationTime = new Date().toISOString();

  // 1. In-App Notification (Always stored & pushed via SSE)
  const inAppRecord = {
    id: uuidv4(),
    pnr: pnrData.pnr,
    type: 'in-app',
    recipient: 'Browser Dashboard',
    title: `PNR ${pnrData.pnr} Status Changed`,
    message: changeSummary,
    status: 'delivered',
    timestamp: notificationTime,
    train: `${pnrData.trainNumber} - ${pnrData.trainName}`,
    chartStatus: pnrData.chartPrepared ? 'Prepared' : 'Not Prepared',
    passengers: passengers
  };
  db.addNotification(inAppRecord);
  sse.broadcast('pnr_update', {
    pnr: pnrData,
    changeSummary,
    notification: inAppRecord
  });
  results.inApp = inAppRecord;

  // 2. Mobile Phone Push (ntfy.sh - Zero setup, instant phone buzz)
  const cleanPhone = (pnrData.phoneNumber || '').replace(/[^\d]/g, '');
  const phoneTopic = cleanPhone ? `railalert-${cleanPhone}` : null;
  const ntfyTopics = [settings.ntfy?.topic || 'railalert-pnr-updates'];
  if (phoneTopic && !ntfyTopics.includes(phoneTopic)) {
    ntfyTopics.push(phoneTopic);
  }

  const ntfyText = `Train ${pnrData.trainNumber} (${pnrData.fromStation} ➔ ${pnrData.toStation})\n` +
                   `Status: ${passengers.map(p => `P${p.number}: ${p.currentStatus}${p.coach ? ` (${p.coach}-${p.berth})` : ''}`).join(', ')}\n` +
                   `Change: ${changeSummary}\n` +
                   `Chart: ${pnrData.chartPrepared ? 'PREPARED' : 'NOT PREPARED'}`;

  for (const topic of ntfyTopics) {
    await sendNtfyPush(
      topic,
      `PNR ${pnrData.pnr} Status Update`,
      ntfyText,
      settings.ntfy?.serverUrl || 'https://ntfy.sh'
    );
  }

  const ntfyRecord = {
    id: uuidv4(),
    pnr: pnrData.pnr,
    type: 'mobile-push',
    recipient: phoneTopic ? `ntfy.sh/${phoneTopic}` : `ntfy.sh/${ntfyTopics[0]}`,
    title: `Phone Push Alert`,
    message: ntfyText,
    status: 'delivered',
    timestamp: notificationTime
  };
  db.addNotification(ntfyRecord);
  results.mobilePush = ntfyRecord;

  // 3. Free WhatsApp via CallMeBot (if enabled or if phone provided)
  const waText = generateWhatsAppText(pnrData, changeSummary, passengers);
  if (settings.callmebot?.enabled && settings.callmebot?.apiKey && (pnrData.phoneNumber || settings.callmebot?.phone)) {
    const targetPhone = pnrData.phoneNumber || settings.callmebot.phone;
    const waRes = await sendCallMeBotWhatsApp(targetPhone, settings.callmebot.apiKey, waText);

    const callMeBotRecord = {
      id: uuidv4(),
      pnr: pnrData.pnr,
      type: 'whatsapp',
      recipient: targetPhone,
      title: `Free WhatsApp Alert via CallMeBot`,
      message: waText,
      status: waRes.success ? 'delivered' : 'failed',
      error: waRes.error || null,
      timestamp: notificationTime
    };
    db.addNotification(callMeBotRecord);
    results.whatsapp = callMeBotRecord;
  } else if (pnrData.phoneNumber && (!settings.sms?.accountSid)) {
    // If phone number is given without paid Twilio keys, provide free WhatsApp / SMS preview in log
    const freeWaRecord = {
      id: uuidv4(),
      pnr: pnrData.pnr,
      type: 'whatsapp',
      recipient: pnrData.phoneNumber,
      title: `WhatsApp Alert Preview`,
      message: waText,
      status: 'delivered (simulated free)',
      timestamp: notificationTime
    };
    db.addNotification(freeWaRecord);
    results.whatsapp = freeWaRecord;
  }

  // 4. Free Telegram Bot Alert (if enabled)
  if (settings.telegram?.enabled && settings.telegram?.botToken && settings.telegram?.chatId) {
    const teleText = `🚆 *IRCTC PNR ALERT*\n` +
                     `*PNR:* \`${pnrData.pnr}\`\n` +
                     `*Train:* ${pnrData.trainNumber} - ${pnrData.trainName}\n` +
                     `*Update:* ${changeSummary}\n` +
                     `*Passengers:*\n` +
                     passengers.map(p => `• P${p.number}: *${p.currentStatus}* ${p.coach ? `(${p.coach}-${p.berth})` : ''}`).join('\n') +
                     `\n*Chart:* ${pnrData.chartPrepared ? 'PREPARED ✅' : 'NOT PREPARED ⏳'}`;

    const teleRes = await sendTelegramMessage(settings.telegram.botToken, settings.telegram.chatId, teleText);
    const teleRecord = {
      id: uuidv4(),
      pnr: pnrData.pnr,
      type: 'telegram',
      recipient: `Telegram Chat ID: ${settings.telegram.chatId}`,
      title: `Free Telegram Alert to Phone`,
      message: teleText,
      status: teleRes.success ? 'delivered' : 'failed',
      error: teleRes.error || null,
      timestamp: notificationTime
    };
    db.addNotification(teleRecord);
    results.telegram = teleRecord;
  }

  // 5. Email (Free Gmail SMTP with Google App Password or Simulation Preview)
  if (pnrData.email && settings.email?.enabled) {
    const emailHtml = generateEmailHtml(pnrData, changeSummary, passengers);
    const emailSubject = `🚆 [PNR Alert] Status Updated for PNR ${pnrData.pnr} (${pnrData.trainNumber})`;
    const transporter = getTransporter(settings.email);

    let emailStatus = 'delivered';
    let emailError = null;
    let previewUrl = null;

    if (transporter) {
      try {
        const info = await transporter.sendMail({
          from: settings.email.from || `"RailAlert Bot" <${settings.email.user}>`,
          to: pnrData.email,
          subject: emailSubject,
          html: emailHtml
        });
        previewUrl = nodemailer.getTestMessageUrl(info) || null;
      } catch (err) {
        console.error('Email sending error:', err);
        emailStatus = 'failed';
        emailError = err.message;
      }
    } else {
      // Free simulated preview
      emailStatus = 'delivered (free simulation)';
    }

    const emailRecord = {
      id: uuidv4(),
      pnr: pnrData.pnr,
      type: 'email',
      recipient: pnrData.email,
      title: emailSubject,
      message: changeSummary,
      status: emailStatus,
      error: emailError,
      previewUrl: previewUrl,
      timestamp: notificationTime,
      previewContent: emailHtml
    };
    db.addNotification(emailRecord);
    results.email = emailRecord;
  }

  // Broadcast notification list update
  sse.broadcast('notification_sent', { results });

  return results;
}

/**
 * Send Immediate Registration Message to User when PNR is registered
 */
async function sendPnrRegistrationNotification(pnrData) {
  const settings = db.getSettings();
  const passengers = pnrData.passengers || [];
  const results = {};
  const notificationTime = new Date().toISOString();

  const statusSummary = passengers.map(p => `P${p.number}: ${p.currentStatus}${p.coach ? ` (${p.coach}-${p.berth})` : ''}`).join(', ');
  const welcomeText = `🚆 *RailAlert Tracking Activated*\n` +
                      `────────────────────\n` +
                      `Your PNR \`${pnrData.pnr}\` is now actively monitored!\n\n` +
                      `• *Train:* ${pnrData.trainNumber} - ${pnrData.trainName}\n` +
                      `• *Route:* ${pnrData.fromStation} ➔ ${pnrData.toStation}\n` +
                      `• *Date:* ${pnrData.dateOfJourney} | Class: ${pnrData.class}\n` +
                      `• *Current Status:* ${statusSummary}\n` +
                      `• *Chart Status:* ${pnrData.chartPrepared ? '✅ Chart Prepared' : '⏳ Chart Not Prepared'}\n\n` +
                      `📲 *You will automatically receive an instant message the moment your waiting list drops, seat gets confirmed, or chart is prepared!*`;

  // 1. In-App Notification
  const inAppRecord = {
    id: uuidv4(),
    pnr: pnrData.pnr,
    type: 'in-app',
    recipient: 'Browser Dashboard',
    title: `PNR ${pnrData.pnr} Registration Confirmed`,
    message: `Tracking started. Current Status: ${statusSummary}. Instant alerts enabled for ${pnrData.phoneNumber || pnrData.email}.`,
    status: 'delivered',
    timestamp: notificationTime,
    train: `${pnrData.trainNumber} - ${pnrData.trainName}`
  };
  db.addNotification(inAppRecord);
  sse.broadcast('pnr_registration', { pnr: pnrData, notification: inAppRecord });
  results.inApp = inAppRecord;

  // 2. Mobile Phone Push (ntfy.sh)
  const cleanPhone = (pnrData.phoneNumber || '').replace(/[^\d]/g, '');
  const phoneTopic = cleanPhone ? `railalert-${cleanPhone}` : null;
  const ntfyTopics = [settings.ntfy?.topic || 'railalert-pnr-updates'];
  if (phoneTopic && !ntfyTopics.includes(phoneTopic)) {
    ntfyTopics.push(phoneTopic);
  }

  const pushMsg = `PNR ${pnrData.pnr} registered! Train: ${pnrData.trainNumber} (${pnrData.trainName})\nRoute: ${pnrData.fromStation} ➔ ${pnrData.toStation}\nStatus: ${statusSummary}\nChart: ${pnrData.chartPrepared ? 'PREPARED' : 'NOT PREPARED'}`;

  for (const topic of ntfyTopics) {
    await sendNtfyPush(
      topic,
      `RailAlert Activated: PNR ${pnrData.pnr}`,
      pushMsg,
      settings.ntfy?.serverUrl || 'https://ntfy.sh'
    );
  }

  const ntfyRecord = {
    id: uuidv4(),
    pnr: pnrData.pnr,
    type: 'mobile-push',
    recipient: phoneTopic ? `ntfy.sh/${phoneTopic}` : `ntfy.sh/${ntfyTopics[0]}`,
    title: `Registration Push Alert`,
    message: pushMsg,
    status: 'delivered',
    timestamp: notificationTime
  };
  db.addNotification(ntfyRecord);
  results.mobilePush = ntfyRecord;

  // 3. WhatsApp / Phone Message
  if (pnrData.phoneNumber) {
    let waStatus = 'delivered';
    let waError = null;

    if (settings.callmebot?.enabled && settings.callmebot?.apiKey) {
      const waRes = await sendCallMeBotWhatsApp(pnrData.phoneNumber, settings.callmebot.apiKey, welcomeText);
      waStatus = waRes.success ? 'delivered' : 'failed';
      waError = waRes.error || null;
    } else {
      waStatus = 'delivered (free simulation)';
    }

    const waRecord = {
      id: uuidv4(),
      pnr: pnrData.pnr,
      type: 'whatsapp',
      recipient: pnrData.phoneNumber,
      title: `Registration Confirmation to ${pnrData.phoneNumber}`,
      message: welcomeText,
      status: waStatus,
      error: waError,
      timestamp: notificationTime
    };
    db.addNotification(waRecord);
    results.whatsapp = waRecord;
  }

  // 4. Email Confirmation
  if (pnrData.email && settings.email?.enabled) {
    const transporter = getTransporter(settings.email);
    const emailSubject = `🚆 [RailAlert Confirmed] Now Tracking PNR ${pnrData.pnr} (${pnrData.trainNumber})`;
    const emailHtml = `
      <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden;">
        <div style="background: #059669; color: #ffffff; padding: 20px 24px;">
          <h2 style="margin: 0 0 6px 0;">PNR Tracking Activated!</h2>
          <p style="margin: 0; opacity: 0.9; font-size: 14px;">We are now actively monitoring PNR <strong>${pnrData.pnr}</strong> for you.</p>
        </div>
        <div style="padding: 24px; color: #1e293b; font-size: 14px; line-height: 1.6;">
          <p>Hello,</p>
          <p>Your railway reservation has been added to our automated monitoring engine. You will receive an instant notification whenever:</p>
          <ul style="color: #047857; font-weight: 600;">
            <li>Your Waiting List drops or moves to RAC</li>
            <li>Your ticket is Confirmed (CNF) with Coach & Berth allocation</li>
            <li>The final reservation chart is prepared</li>
          </ul>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; margin: 16px 0;">
            <p style="margin: 4px 0;"><strong>Train:</strong> ${pnrData.trainNumber} - ${pnrData.trainName}</p>
            <p style="margin: 4px 0;"><strong>Route:</strong> ${pnrData.fromStation} &rarr; ${pnrData.toStation}</p>
            <p style="margin: 4px 0;"><strong>Journey Date:</strong> ${pnrData.dateOfJourney}</p>
            <p style="margin: 4px 0;"><strong>Current Status:</strong> <span style="color: #059669; font-weight: bold;">${statusSummary}</span></p>
          </div>
          <p style="font-size: 12px; color: #64748b; margin-top: 24px;">Dispatched automatically by RailAlert.</p>
        </div>
      </div>
    `;

    let emailStatus = 'delivered';
    if (transporter) {
      try {
        await transporter.sendMail({
          from: settings.email.from || `"RailAlert Bot" <${settings.email.user}>`,
          to: pnrData.email,
          subject: emailSubject,
          html: emailHtml
        });
      } catch (err) {
        emailStatus = 'failed';
      }
    } else {
      emailStatus = 'delivered (free simulation)';
    }

    const emailRecord = {
      id: uuidv4(),
      pnr: pnrData.pnr,
      type: 'email',
      recipient: pnrData.email,
      title: emailSubject,
      message: `Tracking started for PNR ${pnrData.pnr}. We will email you status updates automatically.`,
      status: emailStatus,
      timestamp: notificationTime,
      previewContent: emailHtml
    };
    db.addNotification(emailRecord);
    results.email = emailRecord;
  }

  sse.broadcast('notification_sent', { results });
  return results;
}

module.exports = {
  sendPnrUpdateNotification,
  sendPnrRegistrationNotification,
  sendCallMeBotWhatsApp,
  sendTelegramMessage,
  sendNtfyPush,
  generateEmailHtml,
  generateSmsText,
  generateWhatsAppText
};
