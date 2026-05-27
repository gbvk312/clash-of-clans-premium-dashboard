# ⚔️ Clash Command Center — Premium Dashboard

A visually stunning, glassmorphic dark-mode dashboard for **Clash of Clans** players and clan leaders. Powered by the official Clash of Clans Developer API, this dashboard delivers high-fidelity tracking, performance metrics, and tactical tools.

👉 **Public Repository**: [https://github.com/gbvk312/clash-of-clans-premium-dashboard](https://github.com/gbvk312/clash-of-clans-premium-dashboard)

---

## ✨ Features

* **🛡️ Home Command Center**: Instant overview of your designated home clan, featuring total trophies, active members, and war records.
* **🔍 Clan Search by Name & Tag**: Search clans dynamically by their tag or toggle to name-based lookup with active player count filters.
* **⚔️ War Hub (CWL, History, & Attack Matrix)**: Track active wars in real-time, inspect Round-by-Round **CWL brackets & standings**, explore **War Log histories**, and utilize the brand-new **⚔️ War Attack Matrix** to inspect attacker-vs-defender star performance grids.
* **📊 Player Head-to-Head Compare**: Compare two clashing profiles side-by-side on all major metrics, featuring automatic winner highlighting in vibrant HSL-green.
* **🛡️ Community Layout Gallery**: A completely integrated tactical layout explorer. Filter community designs by Town Hall (TH 7-17) and base type (War, Home, CWL), upvote layouts dynamically, and copy layout links directly.
* **🌎 Global & Local Leaderboards**: Search and browse top players and clans globally (International) or sorted by country regions (e.g. United States, India, Germany).
* **🏰 Capital Raids Tracker**: Inspect your Clan Capital district layout levels and trace historical logs of Capital Gold gathered during Raid Weekends.
* **🎟️ Gold Pass Season Progress**: Sleek glassmorphic Battle Pass widget showing season countdowns, progress bars, and high-tier rewards.
* **📅 Clan Activity Heatmap**: Visual GitHub-style login and contribution calendar tracking mock or live activity indexes.
* **💝 Donation Leaderboard**: Beautiful HSL-gradient donation progress meters displaying members' given vs received metrics.
* **📥 CSV Data Exporter**: Integrated single-click CSV export utility to download local spreadsheets for active clan rosters and war campaign results.
* **🌗 Dual Theme Controls**: Easily toggle between dark obsidian mode and sleek light mode.
* **⌨️ Keyboard Shortcuts**: Smooth dashboard traversal (`1`-`9` for tabs, `/` to focus search inputs, `Esc` to exit settings).

### 👑 Premium Upgrades & Architecture
* **🛡️ Strict Endpoint Allowlisting**: Added a robust regex validator inside the secure proxy server ([server.js](file:///Users/gbvk/Downloads/repo/clash_of_clans/server.js)) to block unauthorized endpoints.
* **⚡ Live Latency Meter**: Responsive header pill measuring connection latency and displaying live health status dot.
* **💾 LRU Cache Engine**: Advanced caching in [app.js](file:///Users/gbvk/Downloads/repo/clash_of_clans/app.js) with a hard-cap limit of `50` cached endpoints to protect rate-limits and optimize speeds.
* **💻 Developer Prettified JSON Inspector**: Slide-out drawer displaying beautified, formatted API JSON payloads for any queried clan, player, or war campaign, complete with single-click copying.

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
