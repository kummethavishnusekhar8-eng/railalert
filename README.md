# 🚆 RailAlert — 100% Completely Free PNR Status Auto-Updater Bot

A **100% free** system that monitors Indian Railways (IRCTC) 10-digit PNR reservation numbers, periodically checks for status transitions, and automatically dispatches alerts to the passenger's **Phone Number (WhatsApp, Phone Push Notification)** and **Email Address** with **$0.00 / ₹0 cost, zero credit cards, and zero paid subscriptions**.

---

## 🌟 100% Free Notification Gateways (Zero Cost)

| Channel | Free Service | How it Reaches Your Phone | Cost |
| :--- | :--- | :--- | :--- |
| **WhatsApp to Phone** | [CallMeBot Free API](https://www.callmebot.com/) | Sends official WhatsApp messages directly to your phone number | **FREE** |
| **Instant Phone Push** | [ntfy.sh](https://ntfy.sh/) | Rings your Android/iOS phone with loud sound & banner (No signup required) | **FREE** |
| **Telegram Bot** | Telegram Bot API | Instant push notifications to Telegram app on mobile & desktop | **FREE** |
| **HTML Email** | Gmail SMTP (App Password) | Complete styled IRCTC reservation email directly to your inbox | **FREE** |
| **In-App & Desktop** | Web Server-Sent Events (SSE) | Real-time live browser toast and desktop audio notifications | **FREE** |

---

## 📱 Fast 10-Second Free Setup Guide

### 1. Free WhatsApp to Your Phone (CallMeBot)
1. Add **+34 644 91 96 80** to your phone contacts as *CallMeBot*.
2. Send this message on WhatsApp: `I allow callmebot to send me messages`
3. The bot will instantly reply with your free numeric API key.
4. Paste your phone number and key into the **Free Channels & Settings** tab in the dashboard!

### 2. Free Mobile Push Notifications (ntfy.sh)
1. No account or registration needed.
2. Choose any topic name (e.g. `my-railway-alerts-99`).
3. Install the free **ntfy** app from Google Play / iOS App Store (or open `https://ntfy.sh/my-railway-alerts-99` in mobile Chrome/Safari).
4. Tap **Subscribe**. That's it! Every PNR update will ring your phone screen instantly.

### 3. Free Email Alerts (Gmail)
1. Use your regular free `@gmail.com` address.
2. In Google Account: Go to **Security ➔ 2-Step Verification ➔ App Passwords**.
3. Generate a 16-character password and enter it in the dashboard.

---

## 🚀 How to Run

### 1. Start the Server
```bash
npm start
```

### 2. Open the Web Dashboard
```
http://localhost:3000
```

### 3. Run Automated Tests
```bash
npm test
```

---

## 🧪 Testing Free Notifications Instantly

1. Open [http://localhost:3000](http://localhost:3000).
2. Go to the **Simulation & Test Lab** tab:
   - Click **Send Free Phone Buzz** to test phone push notification.
   - Click **Send Test WhatsApp** to test CallMeBot delivery.
   - Click **Send Test Email** to test HTML email delivery.
3. On any tracked PNR card, click **⚡ Waitlist Drop** or **⚡ Confirm (CNF)**:
   - The ticket changes from `WL` to `CNF` with an assigned coach and berth.
   - Instant notifications are dispatched to all configured free channels automatically!
