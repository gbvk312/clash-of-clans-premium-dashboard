# ⚔️ Clash Command Center — Premium Dashboard

A visually stunning, glassmorphic dark-mode dashboard for **Clash of Clans** players and clan leaders. Powered by the official Clash of Clans Developer API, this dashboard delivers high-fidelity tracking, performance metrics, and tactical tools.

👉 **Public Repository**: [https://github.com/gbvk312/clash-of-clans-premium-dashboard](https://github.com/gbvk312/clash-of-clans-premium-dashboard)

---

## ✨ Features

* **🛡️ Home Command Center**: Instant overview of your designated home clan, featuring total trophies, active members, and war records.
* **🏆 War Hub (CWL & Logs)**: Track active wars in real-time, view **Clan War League (CWL) brackets & standings**, and explore detailed past **War Log histories** with visual star comparisons.
* **🌎 Global & Local Leaderboards**: Search and browse top players and clans globally (International) or sorted by country regions (e.g. United States, India, Germany).
* **🏰 Capital Raids Tracker**: Inspect your Clan Capital district layout levels and trace historical logs of Capital Gold gathered during Raid Weekends.
* **🎟️ Gold Pass Season Progress**: Sleek glassmorphic Battle Pass widget showing season countdowns, progress bars, and high-tier rewards.
* **🏷️ Recruitment & Playstyle Labels**: Glow playstyle tags (e.g., *Clan Wars*, *Active Donator*) as beautiful badges directly on clan rosters and player profiles.
* **📊 Clan League Distribution**: Dynamic charting (via Chart.js) visualizing your clan members' trophy brackets.
* **🔍 Autocomplete & Search History**: Save recent searches locally for one-click access.
* **📈 Donation Ratios**: Bar chart comparing clan members' donations given versus donations received.
* **⚔️ Head-to-Head Clan Comparison**: Load two clans side-by-side to compare levels, trophy records, capital configurations, win streaks, and overlay radar comparisons.
* **🔥 Live Combat Feed**: Stream real-time battle events simulated directly for Sandbox testing or bridged live.
* **🎒 Spell & Achievement Profiling**: Detailed breakdowns of player spell arsenals, equipment levels, meta recommendations, and achievement stars.
* **🌗 Dual Theme Controls**: Easily toggle between dark obsidian mode and sleek light mode.
* **⌨️ Keyboard Shortcuts**: Smooth dashboard traversal (`1`-`7` for tabs, `/` to focus search inputs, `Esc` to exit settings).

### 👑 Premium Upgrades & Analytics
* **⚡ Live Latency Meter**: Responsive header pill measuring connection latency and displaying live health status dot.
* **💾 Local Cache Engine**: Caches API queries locally for 5 minutes, mitigating rate-limiting blocks and accelerating loading speeds.
* **💻 Developer Prettified JSON Inspector**: Slide-out drawer displaying beautified, formatted API JSON payloads for any queried clan, player, or war campaign, complete with single-click copying.
* **🎯 Combat Strengths Radar**: Interactive 5-point radar charts visualizing clashing indices (War Weight, Aggression, Activity, Trophies, and Defense).
* **🔮 Tactical War Matchmaker**: Base optimizer highlighting optimal rosters matching war brackets.
* **🎁 Clickable Gold Pass rewards**: Interactive rewards previewer with detailed magic item metadata popups.

---

## 🚀 Getting Started

### Prerequisites
* [Node.js](https://nodejs.org/) (v16.0.0 or higher recommended)

### 1. Clone the repository
```bash
git clone https://github.com/gbvk312/clash-of-clans-premium-dashboard.git
cd clash-of-clans-premium-dashboard
```

### 2. Run the server
Start the local server. It serves your static assets and acts as a **local CORS proxy** to securely bridge the browser directly to the Clash of Clans API:
```bash
node server.js
```

### 3. Open the Dashboard
Visit **`http://localhost:3000`** in your browser.

---

## 🛡️ Sandbox vs. Live API Mode

Out of the box, the app launches in **Demo Mode**, displaying mock data with dynamic network delays to let you preview the high-fidelity UI features immediately.

To connect to your **Live Clash of Clans Developer Account**:
1. Get a developer token at [developer.clashofclans.com](https://developer.clashofclans.com/).
2. In the dashboard, click **API Settings** in the bottom-left.
3. Paste your token and save—the Command Center will seamlessly toggle to **Live API**!

---

## 🔒 Security & CORS

The Clash of Clans Developer API restricts browser-side requests due to standard CORS (Cross-Origin Resource Sharing) security. 

* **Local Dev**: When running the app with `node server.js`, the local server acts as a proxy, appending proper header parameters and keeping your secret token secured from leaking in browser history.
* **External Deployment**: If hosted as a static site (e.g. GitHub Pages), you can input a public proxy URL in the settings panel to successfully load live requests.
