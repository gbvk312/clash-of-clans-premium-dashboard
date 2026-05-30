// Clash of Clans Dashboard App Controller - Premium Hybrid connection

// ===== CACHING & INSPECTOR UTILITIES =====
const cocCache = {
  maxSize: 50,
  ttl: 5 * 60 * 1000,
  get(endpoint) {
    const cached = localStorage.getItem(`coc_cache_${endpoint}`);
    if (!cached) return null;
    try {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < this.ttl) {
        // Touch for LRU (re-set to update timestamp)
        this.set(endpoint, data);
        return data;
      }
      localStorage.removeItem(`coc_cache_${endpoint}`);
    } catch (e) {}
    return null;
  },
  set(endpoint, data) {
    try {
      this.evictIfNeeded();
      localStorage.setItem(`coc_cache_${endpoint}`, JSON.stringify({
        data,
        timestamp: Date.now()
      }));
    } catch (e) {
      this.clearOld();
    }
  },
  evictIfNeeded() {
    const cacheKeys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('coc_cache_')) {
        try {
          const { timestamp } = JSON.parse(localStorage.getItem(key));
          cacheKeys.push({ key, timestamp });
        } catch(e) {
          localStorage.removeItem(key);
        }
      }
    }
    if (cacheKeys.length >= this.maxSize) {
      cacheKeys.sort((a, b) => a.timestamp - b.timestamp);
      const toRemove = cacheKeys.slice(0, cacheKeys.length - this.maxSize + 10);
      toRemove.forEach(item => localStorage.removeItem(item.key));
    }
  },
  clearOld() {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && key.startsWith('coc_cache_')) {
        localStorage.removeItem(key);
      }
    }
  }
};

let lastPayload = null;
let lastEndpoint = '';

function updatePayloadInspector(endpoint, data) {
  lastPayload = data;
  lastEndpoint = endpoint;
  const tsEl = document.getElementById('payload-timestamp');
  if (tsEl) tsEl.textContent = `Endpoint: ${endpoint}`;
  const renderer = document.getElementById('json-renderer');
  if (renderer) {
    renderer.textContent = JSON.stringify(data, null, 2);
  }
  const btn = document.getElementById('global-inspect-btn');
  if (btn) {
    btn.classList.add('has-data');
  }
}

function openPayloadInspector() {
  const drawer = document.getElementById('inspect-drawer');
  if (!drawer) return;
  if (drawer.showModal) {
    drawer.showModal();
  } else {
    drawer.style.display = 'flex';
  }
}

function closePayloadInspector() {
  const drawer = document.getElementById('inspect-drawer');
  if (!drawer) return;
  if (drawer.close) {
    drawer.close();
  } else {
    drawer.style.display = 'none';
  }
}

function copyInspectorPayload() {
  if (!lastPayload) {
    showToast('No payload data to copy.', 'warning');
    return;
  }
  navigator.clipboard.writeText(JSON.stringify(lastPayload, null, 2)).then(() => {
    showToast('Payload copied to clipboard!', 'success');
  }).catch(() => {
    showToast('Could not copy payload.', 'error');
  });
}

// State Management
const state = {
  activeTab: 'overview',
  apiToken: sessionStorage.getItem('coc_api_token') || localStorage.getItem('coc_api_token') || '',
  proxyUrl: localStorage.getItem('coc_proxy_url') || 'https://cors-anywhere.herokuapp.com/',
  favorites: JSON.parse(localStorage.getItem('coc_favorites')) || [],
  homeClanTag: localStorage.getItem('coc_home_clan') || '',
  mode: localStorage.getItem('coc_dashboard_mode') || 'demo',
  
  // Loaded Data
  currentClan: null,
  currentPlayer: null,
  currentWar: null,

  // Comparison Data
  compareClans: { a: null, b: null },
  comparePlayers: { a: null, b: null },

  // Table Sort State
  rosterSortKey: 'trophies',
  rosterSortDirection: 'desc',

  // Layout gallery state
  layouts: [],
  layoutFilterType: 'all',
  votedLayouts: JSON.parse(localStorage.getItem('coc_voted_layouts') || '[]')
};

// Global Chart references to avoid overlay bugs
let overviewChart = null;
let clanChart = null;
let warInterval = null;
let countdownInterval = null;
let comparisonChart = null;
let playerComparisonChart = null;

// Chart.js lazy-loading
let chartJsLoaded = false;
function loadChartJs() {
  return new Promise((resolve, reject) => {
    if (chartJsLoaded || typeof Chart !== 'undefined') {
      chartJsLoaded = true;
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
    script.onload = () => { chartJsLoaded = true; resolve(); };
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

// ===== UTILITY FUNCTIONS =====

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

function showToast(message, type = 'info', duration = 4000) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  
  const existingToasts = container.querySelectorAll('.toast');
  if (existingToasts.length >= 5) {
    existingToasts[0].remove();
  }

  const icons = {
    success: 'fas fa-check-circle',
    error: 'fas fa-times-circle',
    info: 'fas fa-info-circle',
    warning: 'fas fa-exclamation-triangle'
  };
  
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <i class="toast-icon ${icons[type] || icons.info}"></i>
    <span>${escapeHtml(message)}</span>
  `;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('toast-exit');
    toast.addEventListener('animationend', () => toast.remove());
  }, duration);
}

function animateValue(element, start, end, duration = 1200) {
  if (!element) return;
  let startTime = null;
  const step = (timestamp) => {
    if (!startTime) startTime = timestamp;
    const progress = Math.min((timestamp - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    element.textContent = Math.floor(eased * (end - start) + start).toLocaleString();
    if (progress < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

// ===== SEARCH HISTORY MANAGER =====

const searchHistory = {
  getKey(type) { return `coc_search_history_${type}`; },
  get(type) {
    return JSON.parse(localStorage.getItem(this.getKey(type)) || '[]');
  },
  add(type, tag, name) {
    const history = this.get(type);
    const existing = history.findIndex(h => h.tag === tag);
    if (existing > -1) history.splice(existing, 1);
    history.unshift({ tag, name, timestamp: Date.now() });
    if (history.length > 10) history.pop();
    localStorage.setItem(this.getKey(type), JSON.stringify(history));
  },
  clear(type) {
    localStorage.removeItem(this.getKey(type));
  }
};

// ===== SEARCH DROPDOWN =====

function renderSearchDropdown(inputId, type) {
  const input = document.getElementById(inputId);
  if (!input) return;
  
  // Wrap input if not already wrapped
  if (!input.parentElement.classList.contains('search-wrapper')) {
    const wrapper = document.createElement('div');
    wrapper.className = 'search-wrapper';
    input.parentElement.insertBefore(wrapper, input);
    wrapper.appendChild(input);
    
    const dropdown = document.createElement('div');
    dropdown.className = 'search-dropdown';
    dropdown.id = `${inputId}-dropdown`;
    wrapper.appendChild(dropdown);
  }
  
  const dropdown = document.getElementById(`${inputId}-dropdown`);
  const history = searchHistory.get(type);
  
  if (history.length === 0) {
    dropdown.classList.remove('visible');
    return;
  }
  
  dropdown.innerHTML = `
    <div class="search-dropdown-header">
      <span>Recent Searches</span>
      <button class="search-dropdown-clear" data-action="clear-history" data-type="${type}" data-input-id="${inputId}">Clear</button>
    </div>
    ${history.map(h => `
      <div class="search-dropdown-item" data-action="select-history-item" data-tag="${escapeHtml(h.tag)}" data-input-id="${inputId}">
        <i class="fas fa-history"></i>
        <span>${escapeHtml(h.name || h.tag)}</span>
        <small style="color: var(--text-muted); margin-left: auto;">${escapeHtml(h.tag)}</small>
      </div>
    `).join('')}
  `;
  
  dropdown.classList.add('visible');
}

// ===== THEME TOGGLE =====

function toggleTheme() {
  document.body.classList.toggle('theme-light');
  const isLight = document.body.classList.contains('theme-light');
  localStorage.setItem('coc_theme', isLight ? 'light' : 'dark');
  const btn = document.getElementById('theme-toggle-btn');
  if (btn) {
    btn.innerHTML = isLight
      ? '<i class="fas fa-moon"></i><span>Dark Mode</span>'
      : '<i class="fas fa-sun"></i><span>Light Mode</span>';
  }
}

// ===== EXPORT / SHARE =====

function exportToClipboard(type) {
  let text = '';
  if (type === 'clan' && state.currentClan) {
    const c = state.currentClan;
    text = `⚔️ ${c.name} (${c.tag})\n` +
      `Level: ${c.clanLevel} | Members: ${c.members}/50\n` +
      `🏆 Trophies: ${c.clanPoints?.toLocaleString()}\n` +
      `⚔️ Wars: ${c.warWins}W / ${c.warLosses}L (Streak: ${c.warWinStreak || 0})\n` +
      `📍 ${c.type} | ${c.warFrequency}\n` +
      `📋 ${c.description || 'No description'}`;
  } else if (type === 'player' && state.currentPlayer) {
    const p = state.currentPlayer;
    text = `🛡️ ${p.name} (${p.tag})\n` +
      `TH${p.townHallLevel} | Exp: ${p.expLevel}\n` +
      `🏆 Trophies: ${p.trophies} (Best: ${p.bestTrophies})\n` +
      `⭐ War Stars: ${p.warStars}\n` +
      `💝 Donations: ${p.donations} given / ${p.donationsReceived} received`;
  }
  if (text) {
    navigator.clipboard.writeText(text).then(() => {
      showToast('Stats copied to clipboard! Paste anywhere to share.', 'success');
    }).catch(() => {
      showToast('Could not copy to clipboard.', 'error');
    });
  }
}

function exportToCSV(type) {
  let csvContent = "data:text/csv;charset=utf-8,";
  let filename = "export.csv";
  
  if (type === 'clan' && state.currentClan) {
    filename = `${state.currentClan.name.replace(/\s+/g, '_')}_roster.csv`;
    csvContent += "Name,Tag,Role,ExpLevel,Trophies,DonationsGiven,DonationsReceived\n";
    state.currentClan.memberList.forEach(m => {
      csvContent += `"${m.name}","${m.tag}","${m.role}",${m.expLevel},${m.trophies},${m.donations},${m.donationsReceived}\n`;
    });
  } else if (type === 'war' && state.currentWar) {
    filename = `war_${state.currentWar.clan.name.replace(/\s+/g, '_')}_vs_${state.currentWar.opponent.name.replace(/\s+/g, '_')}.csv`;
    csvContent += "Attacker Name,Attacker Tag,Defender Name,Defender Tag,Stars,DestructionPercent,Order\n";
    state.currentWar.clan.members.forEach(m => {
      if (m.attacks) {
        m.attacks.forEach(atk => {
          const defender = state.currentWar.opponent.members.find(o => o.tag === atk.defenderTag) || { name: "Unknown" };
          csvContent += `"${m.name}","${m.tag}","${defender.name}","${atk.defenderTag}",${atk.stars},${atk.destructionPercentage},${atk.order}\n`;
        });
      }
    });
  } else {
    showToast("No data available to export.", "warning");
    return;
  }
  
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast(`CSV data exported: ${filename}`, "success");
}

// ===== WAR COUNTDOWN =====

function startWarCountdown(endTimeStr) {
  if (countdownInterval) clearInterval(countdownInterval);
  const el = document.getElementById('war-countdown');
  if (!el) return;
  function update() {
    const endTime = new Date(endTimeStr).getTime();
    const now = Date.now();
    const diff = Math.max(0, endTime - now);
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const secs = Math.floor((diff % (1000 * 60)) / 1000);
    el.innerHTML = `
      <div class="countdown-segment">
        <span class="countdown-value">${String(hours).padStart(2, '0')}</span>
        <span class="countdown-label">Hours</span>
      </div>
      <span class="countdown-separator">:</span>
      <div class="countdown-segment">
        <span class="countdown-value">${String(mins).padStart(2, '0')}</span>
        <span class="countdown-label">Minutes</span>
      </div>
      <span class="countdown-separator">:</span>
      <div class="countdown-segment">
        <span class="countdown-value">${String(secs).padStart(2, '0')}</span>
        <span class="countdown-label">Seconds</span>
      </div>
    `;
    if (diff <= 0) {
      clearInterval(countdownInterval);
      el.innerHTML = '<span class="text-gold font-extrabold">⚔️ WAR HAS ENDED</span>';
    }
  }
  update();
  countdownInterval = setInterval(update, 1000);
}

// ===== SKELETON LOADING HTML =====

function getSkeletonHTML() {
  return `
    <div style="padding: 24px;">
      <div class="skeleton-row">
        <div class="skeleton skeleton-badge"></div>
        <div class="flex-col gap-8" style="flex: 1;">
          <div class="skeleton skeleton-title"></div>
          <div class="skeleton skeleton-text medium"></div>
        </div>
      </div>
      <div class="stats-row mt-24">
        <div class="skeleton skeleton-card"></div>
        <div class="skeleton skeleton-card"></div>
        <div class="skeleton skeleton-card"></div>
      </div>
      <div class="skeleton skeleton-card mt-16" style="height: 200px;"></div>
    </div>
  `;
}

// Event Delegation setup
function setupEventDelegation() {
  document.addEventListener('click', (e) => {
    // Handle dropdown toggles
    const exportDropBtn = e.target.closest('#export-drop-btn');
    const dropdownContent = document.getElementById('export-dropdown-menu');
    if (exportDropBtn && dropdownContent) {
      e.stopPropagation();
      dropdownContent.classList.toggle('show');
      return;
    } else if (dropdownContent && !e.target.closest('.export-dropdown')) {
      dropdownContent.classList.remove('show');
    }

    const target = e.target.closest('[data-action]');
    if (!target) return;
    const action = target.dataset.action;
    
    switch(action) {
      case 'load-player':
        quickLoadBookmark('player', target.dataset.tag);
        break;
      case 'load-clan':
        quickLoadBookmark('clan', target.dataset.tag);
        break;
      case 'toggle-favorite':
        toggleFavorite(target.dataset.type, target.dataset.tag, target.dataset.name);
        break;
      case 'set-home-clan':
        state.homeClanTag = target.dataset.tag;
        localStorage.setItem('coc_home_clan', target.dataset.tag);
        showToast('Home Clan updated!', 'success');
        loadOverviewClan(target.dataset.tag);
        break;
      case 'export-clipboard':
        exportToClipboard(target.dataset.type);
        break;
      case 'export-csv':
        exportToCSV(target.dataset.type);
        break;
      case 'vote-layout':
        voteLayout(parseInt(target.dataset.id));
        break;
      case 'copy-layout-link':
        copyLayoutLink(target.dataset.link);
        break;
      case 'remove-favorite':
        e.stopPropagation();
        removeFavorite(parseInt(target.dataset.index), e);
        break;
      case 'switch-tab':
        switchTab(target.dataset.tab);
        break;
      case 'reset-home':
        state.homeClanTag = '';
        localStorage.removeItem('coc_home_clan');
        showInitialPlaceholders();
        break;
      case 'clear-history':
        searchHistory.clear(target.dataset.type);
        document.getElementById(`${target.dataset.inputId}-dropdown`)?.classList.remove('visible');
        break;
      case 'select-history-item':
        const inp = document.getElementById(target.dataset.inputId);
        if (inp) {
          inp.value = target.dataset.tag;
          document.getElementById(`${target.dataset.inputId}-dropdown`)?.classList.remove('visible');
          inp.closest('form')?.dispatchEvent(new Event('submit', { cancelable: true }));
        }
        break;
      case 'filter-layouts':
        state.layoutFilterType = target.dataset.filter;
        document.querySelectorAll('.layout-filter-btn').forEach(btn => {
          btn.classList.toggle('active', btn.dataset.filter === state.layoutFilterType);
        });
        renderLayoutGallery();
        break;
    }
  });
}

// DOM Elements
document.addEventListener('DOMContentLoaded', () => {
  initApp();
  
  // Register PWA Service Worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        .then(reg => console.log('🛡️ Clash Command Center Service Worker Registered successfully!', reg.scope))
        .catch(err => console.warn('❌ Service Worker registration failed:', err));
    });
  }
});

function initApp() {
  setupNavigation();
  setupSettingsModal();
  setupSearchForms();
  renderFavorites();
  setupEventDelegation();
  setupLayoutGallery();
  setupPlayerCompare();
  setupClanNameSearch();
  initBaseCanvas();
  initWarRoomPlanner();
  applyWidgetConfigurations();
  
  // Set default state values to UI
  document.getElementById('api-token-input').value = state.apiToken;
  document.getElementById('proxy-url-input').value = state.proxyUrl;

  // Settle Live vs Demo Toggle state in header
  const toggleEl = document.getElementById('mode-toggle');
  if (toggleEl) {
    if (state.mode === 'live') {
      toggleEl.className = 'mode-toggle-container live-active';
    } else {
      toggleEl.className = 'mode-toggle-container demo-active';
    }
  }

  // Pre-seed default Home Clan for demo mode to show a gorgeous screen instantly
  if (state.mode === 'demo' && !state.homeClanTag) {
    state.homeClanTag = '#2PP2PP2P';
    localStorage.setItem('coc_home_clan', '#2PP2PP2P');
  }

  // Theme initialization
  if (localStorage.getItem('coc_theme') === 'light') {
    document.body.classList.add('theme-light');
    const btn = document.getElementById('theme-toggle-btn');
    if (btn) btn.innerHTML = '<i class="fas fa-moon"></i><span>Dark Mode</span>';
  }
  document.getElementById('theme-toggle-btn')?.addEventListener('click', toggleTheme);

  // Mobile hamburger menu
  const hamburger = document.getElementById('hamburger-btn');
  const sidebar = document.querySelector('aside');
  const overlay = document.getElementById('sidebar-overlay');
  if (hamburger && sidebar && overlay) {
    hamburger.addEventListener('click', () => {
      sidebar.classList.toggle('sidebar-open');
      overlay.classList.toggle('visible');
    });
    overlay.addEventListener('click', () => {
      sidebar.classList.remove('sidebar-open');
      overlay.classList.remove('visible');
    });
  }

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    const modal = document.getElementById('settings-modal');
    if (modal && (modal.open || modal.style.display === 'flex')) {
      if (e.key === 'Escape') {
        modal.close ? modal.close() : (modal.style.display = 'none');
      }
      return;
    }
    switch(e.key) {
      case '1': switchTab('overview'); break;
      case '2': switchTab('clan'); break;
      case '3': switchTab('player'); break;
      case '4': switchTab('war'); break;
      case '5': switchTab('leaderboards'); break;
      case '6': switchTab('capital'); break;
      case '7': switchTab('layouts'); break;
      case '8': switchTab('compare'); break;
      case '9': switchTab('player-compare'); break;
      case '/':
        e.preventDefault();
        const activePane = document.querySelector('.view-pane.active');
        const input = activePane?.querySelector('input[type="text"]');
        if (input) input.focus();
        break;
    }
  });

  // Initialize new premium features
  setupWarHubSubnav();
  initLeaderboardsView();
  setupCapitalSearchForm();
  
  // Start Latency Monitor and setup Inspector triggers
  startLatencyMonitor();
  document.getElementById('drawer-close')?.addEventListener('click', closePayloadInspector);

  // Initialize page components
  if (state.homeClanTag) {
    loadOverviewClan(state.homeClanTag);
  } else {
    showInitialPlaceholders();
  }
}

// ===== API LATENCY & HEALTH MONITOR =====
function startLatencyMonitor() {
  const indicator = document.getElementById('latency-indicator');
  if (!indicator) return;
  
  async function checkLatency() {
    const start = Date.now();
    try {
      if (state.mode === 'demo') {
        setTimeout(() => {
          const latency = Math.floor(Math.random() * 20) + 12;
          updateLatencyUI(latency, 'success');
        }, 150);
        return;
      }
      
      let testUrl = state.proxyUrl;
      if (window.location.port === '3000' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        testUrl = '/api/locations';
      } else {
        testUrl = `${state.proxyUrl}https://api.clashofclans.com/v1/locations`;
      }
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      
      const headers = { "Accept": "application/json" };
      if (state.apiToken) {
        headers["Authorization"] = `Bearer ${state.apiToken}`;
      }
      
      const res = await fetch(testUrl, { 
        method: 'GET', 
        signal: controller.signal,
        headers: headers
      });
      clearTimeout(timeoutId);
      
      const end = Date.now();
      const latency = end - start;
      
      if (res.ok) {
        updateLatencyUI(latency, latency < 350 ? 'success' : 'warning');
      } else {
        updateLatencyUI(latency, 'error');
      }
    } catch (err) {
      updateLatencyUI(0, 'offline');
    }
  }
  
  function updateLatencyUI(ms, status) {
    const dot = indicator.querySelector('.latency-dot');
    const text = indicator.querySelector('.latency-text');
    if (!dot || !text) return;
    
    indicator.className = `latency-pill status-${status}`;
    if (status === 'success') {
      text.textContent = `Online: ${ms}ms`;
    } else if (status === 'warning') {
      text.textContent = `Slow: ${ms}ms`;
    } else if (status === 'error') {
      text.textContent = `Auth/Proxy Error`;
    } else {
      text.textContent = `Disconnected`;
    }
  }
  
  checkLatency();
  setInterval(checkLatency, 20000);
}

// Live vs Demo dashboard toggler
function toggleDashboardMode() {
  const toggleEl = document.getElementById('mode-toggle');
  if (state.mode === 'live') {
    state.mode = 'demo';
    if (toggleEl) toggleEl.className = 'mode-toggle-container demo-active';
  } else {
    state.mode = 'live';
    if (toggleEl) toggleEl.className = 'mode-toggle-container live-active';
  }
  
  localStorage.setItem('coc_dashboard_mode', state.mode);

  // Clear data references
  state.currentClan = null;
  state.currentPlayer = null;
  state.currentWar = null;

  if (warInterval) {
    clearInterval(warInterval);
    warInterval = null;
  }

  // Reload or reset viewport
  if (state.homeClanTag) {
    loadOverviewClan(state.homeClanTag);
  } else {
    showInitialPlaceholders();
  }
  
  // Reset other panes placeholder
  showInitialPlaceholders();
}
window.toggleDashboardMode = toggleDashboardMode;

// Navigation & Tabs Setup
function setupNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const tabName = item.getAttribute('data-tab');
      switchTab(tabName);

      // Close sidebar on mobile
      if (window.innerWidth <= 768) {
        document.querySelector('aside')?.classList.remove('sidebar-open');
        document.getElementById('sidebar-overlay')?.classList.remove('visible');
      }
    });
  });
}

function switchTab(tabName) {
  state.activeTab = tabName;
  
  // Update nav sidebar links with ARIA
  document.querySelectorAll('.nav-item').forEach(item => {
    const isActive = item.getAttribute('data-tab') === tabName;
    item.classList.toggle('active', isActive);
    item.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });

  const performTransition = () => {
    // Update visible pane
    document.querySelectorAll('.view-pane').forEach(pane => {
      pane.classList.toggle('active', pane.id === `${tabName}-pane`);
    });
  };

  // Implement native browser View Transitions if supported
  if (document.startViewTransition) {
    document.startViewTransition(performTransition);
  } else {
    performTransition();
  }
}

// Settings Modal Setup
function setupSettingsModal() {
  const modal = document.getElementById('settings-modal');
  const configBtn = document.getElementById('config-btn');
  const closeBtn = document.getElementById('modal-close');
  const saveBtn = document.getElementById('save-settings-btn');
  
  configBtn.addEventListener('click', () => {
    if (modal.showModal) {
      modal.showModal();
    } else {
      modal.style.display = 'flex';
    }
  });
  
  closeBtn.addEventListener('click', () => {
    if (modal.close) {
      modal.close();
    } else {
      modal.style.display = 'none';
    }
  });
  
  window.addEventListener('click', (e) => {
    if (e.target === modal) {
      if (modal.close) {
        modal.close();
      } else {
        modal.style.display = 'none';
      }
    }
  });
  
  saveBtn.addEventListener('click', () => {
    const token = document.getElementById('api-token-input').value.trim();
    const proxy = document.getElementById('proxy-url-input').value.trim();
    
    state.apiToken = token;
    state.proxyUrl = proxy;
    
    sessionStorage.setItem('coc_api_token', token);
    localStorage.setItem('coc_proxy_url', proxy);

    // Save widget configuration checkboxes
    const cbChart = document.getElementById('widget-toggle-chart');
    const cbGoldpass = document.getElementById('widget-toggle-goldpass');
    const cbHeatmap = document.getElementById('widget-toggle-heatmap');
    const cbBookmarks = document.getElementById('widget-toggle-bookmarks');

    if (cbChart) localStorage.setItem('coc_widget_chart', cbChart.checked.toString());
    if (cbGoldpass) localStorage.setItem('coc_widget_goldpass', cbGoldpass.checked.toString());
    if (cbHeatmap) localStorage.setItem('coc_widget_heatmap', cbHeatmap.checked.toString());
    if (cbBookmarks) localStorage.setItem('coc_widget_bookmarks', cbBookmarks.checked.toString());

    applyWidgetConfigurations();
    
    if (modal.close) {
      modal.close();
    } else {
      modal.style.display = 'none';
    }
    
    // Switch to live mode since they just input settings
    state.mode = 'live';
    const toggleEl = document.getElementById('mode-toggle');
    if (toggleEl) toggleEl.className = 'mode-toggle-container live-active';
    localStorage.setItem('coc_dashboard_mode', 'live');
    
    if (state.homeClanTag) {
      loadOverviewClan(state.homeClanTag);
    } else {
      showInitialPlaceholders();
    }
    
    showToast('Live API credentials saved! Dashboard set to Live Connection.', 'success');
  });
}

// Favorites Management
function renderFavorites() {
  const container = document.getElementById('favorites-list');
  if (state.favorites.length === 0) {
    container.innerHTML = `<li style="color: var(--text-muted); font-size: 13px; font-style: italic; padding: 4px 10px;">No bookmarks</li>`;
    return;
  }
  
  container.innerHTML = state.favorites.map((fav, index) => `
    <li class="favorite-item" data-index="${index}">
      <div class="fav-details" data-action="${fav.type === 'clan' ? 'load-clan' : 'load-player'}" data-tag="${escapeHtml(fav.tag)}">
        <strong>${escapeHtml(fav.nickname || fav.name)}</strong>
        <small style="color: var(--clash-gold); font-size: 10px;">${escapeHtml(fav.tag)}</small>
      </div>
      <div style="display: flex; gap: 8px; align-items: center;">
        <i class="fas fa-edit edit-fav" onclick="renameFavorite(${index}, event)" style="color: var(--text-muted); font-size: 11px; cursor: pointer;" title="Rename Bookmark"></i>
        <i class="fas fa-trash delete-fav" data-action="remove-favorite" data-index="${index}"></i>
      </div>
    </li>
  `).join('');
}

function quickLoadBookmark(type, tag) {
  if (type === 'clan') {
    switchTab('clan');
    document.getElementById('clan-tag-input').value = tag;
    loadClanData(tag);
  } else {
    switchTab('player');
    document.getElementById('player-tag-input').value = tag;
    loadPlayerData(tag);
  }
}

function toggleFavorite(type, tag, name) {
  const existingIdx = state.favorites.findIndex(fav => fav.tag === tag);
  if (existingIdx > -1) {
    state.favorites.splice(existingIdx, 1);
  } else {
    state.favorites.push({ type, tag, name });
  }
  localStorage.setItem('coc_favorites', JSON.stringify(state.favorites));
  renderFavorites();
  
  // Toggle UI state
  const btn = document.getElementById(`${type}-bookmark-btn`);
  if (btn) {
    btn.classList.toggle('active');
    const icon = btn.querySelector('i');
    if (icon) {
      icon.className = icon.className.includes('far') ? 'fas fa-star' : 'far fa-star';
    }
  }
}

function removeFavorite(index, event) {
  state.favorites.splice(index, 1);
  localStorage.setItem('coc_favorites', JSON.stringify(state.favorites));
  renderFavorites();
  
  // Refresh current view bookmarked star if active
  if (state.currentClan) {
    const btn = document.getElementById('clan-bookmark-btn');
    if (btn && !state.favorites.some(fav => fav.tag === state.currentClan.tag)) {
      btn.classList.remove('active');
      const icon = btn.querySelector('i');
      if (icon) icon.className = 'far fa-star';
    }
  }
  if (state.currentPlayer) {
    const btn = document.getElementById('player-bookmark-btn');
    if (btn && !state.favorites.some(fav => fav.tag === state.currentPlayer.tag)) {
      btn.classList.remove('active');
      const icon = btn.querySelector('i');
      if (icon) icon.className = 'far fa-star';
    }
  }
}

// Search Operations
function setupSearchForms() {
  // Clan Search
  const clanForm = document.getElementById('clan-search-form');
  clanForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const tag = document.getElementById('clan-tag-input').value.trim().toUpperCase();
    await loadClanData(tag);
  });

  // Player Search
  const playerForm = document.getElementById('player-search-form');
  playerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const tag = document.getElementById('player-tag-input').value.trim().toUpperCase();
    await loadPlayerData(tag);
  });

  // Standalone War Search
  const warForm = document.getElementById('war-search-form');
  if (warForm) {
    warForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const tag = document.getElementById('war-clan-tag-input').value.trim().toUpperCase();
      await loadWarData(tag);
    });
  }

  // Comparison forms
  const compareFormA = document.getElementById('compare-clan-a-form');
  if (compareFormA) {
    compareFormA.addEventListener('submit', async (e) => {
      e.preventDefault();
      const tag = document.getElementById('compare-clan-a-input').value.trim().toUpperCase();
      await loadComparisonClan('a', tag);
    });
  }
  const compareFormB = document.getElementById('compare-clan-b-form');
  if (compareFormB) {
    compareFormB.addEventListener('submit', async (e) => {
      e.preventDefault();
      const tag = document.getElementById('compare-clan-b-input').value.trim().toUpperCase();
      await loadComparisonClan('b', tag);
    });
  }

  // Search history dropdowns with debouncing
  ['clan-tag-input', 'player-tag-input', 'war-clan-tag-input'].forEach(inputId => {
    const type = inputId.includes('player') ? 'player' : 'clan';
    const input = document.getElementById(inputId);
    if (input) {
      input.addEventListener('focus', () => renderSearchDropdown(inputId, type));
      input.addEventListener('blur', () => {
        setTimeout(() => {
          document.getElementById(`${inputId}-dropdown`)?.classList.remove('visible');
        }, 200);
      });
      // Add debounce input validation visually or dynamically if needed
      input.addEventListener('input', debounce((e) => {
        const val = e.target.value.trim();
        if (val && !val.startsWith('#') && val.length > 2 && !isNaN(val.charAt(0)) === false) {
          // Just format prefix helper if user forgot #
          if (/^[A-Z0-9]+$/i.test(val)) {
            // Can help highlight
          }
        }
      }, 300));
    }
  });
}

// Fetch Logic (Supports Live API & Demo / Sandbox interception)
async function fetchCocData(endpoint) {
  // Check Local Cache First!
  const cached = cocCache.get(endpoint);
  if (cached) {
    updatePayloadInspector(endpoint, cached);
    return cached;
  }

  // If in Demo Mode, bypass the real HTTP request and serve mockData instead!
  if (state.mode === 'demo') {
    // Add dynamic network delay for that premium high-fidelity interface feel
    await new Promise(resolve => setTimeout(resolve, 600));

    let result = null;

    // Handle Gold Pass
    if (endpoint.startsWith('/goldpass/')) {
      result = structuredClone(window.MOCK_DATA.goldPass || window.MOCK_GOLD_PASS);
    }
    // Handle Locations & rankings
    else if (endpoint.startsWith('/locations')) {
      const parts = endpoint.split('/');
      if (parts.length === 2) {
        result = { items: structuredClone(window.MOCK_DATA.leaderboards.locations || window.MOCK_LEADERBOARDS.locations) };
      } else {
        const locId = parts[2];
        const type = parts[4]; // e.g. "clans" or "players"
        const data = window.MOCK_DATA.leaderboards[type]?.[locId] || window.MOCK_DATA.leaderboards[type]?.[32000006] || window.MOCK_LEADERBOARDS[type]?.[locId] || [];
        result = { items: structuredClone(data) };
      }
    }
    // Handle Clan Search endpoint
    else if (endpoint.startsWith('/clans?') || endpoint.startsWith('/clans%3F')) {
      result = structuredClone(window.MOCK_DATA.clanSearchResults || window.MOCK_CLAN_SEARCH_RESULTS || { items: Object.values(window.MOCK_CLANS) });
    }
    // Handle Clan & CurrentWar routing
    else if (endpoint.startsWith('/clans/')) {
      const parts = endpoint.split('/');
      const tag = parts[2];
      
      // If requesting active war
      if (parts[3] === 'currentwar') {
        if (window.MOCK_DATA.wars && window.MOCK_DATA.wars[tag]) {
          result = structuredClone(window.MOCK_DATA.wars[tag]);
        } else if (window.MOCK_WARS && window.MOCK_WARS[tag]) {
          result = structuredClone(window.MOCK_WARS[tag]);
        } else {
          result = structuredClone(Object.values(window.MOCK_WARS)[0]);
        }
      }
      // If requesting war league group (CWL)
      else if (parts[3] === 'warleague' && parts[4] === 'group') {
        if (window.MOCK_DATA.cwl && window.MOCK_DATA.cwl[tag]) {
          result = structuredClone(window.MOCK_DATA.cwl[tag]);
        } else if (window.MOCK_CWL && window.MOCK_CWL[tag]) {
          result = structuredClone(window.MOCK_CWL[tag]);
        } else {
          result = structuredClone(Object.values(window.MOCK_CWL)[0]);
        }
      }
      // If requesting war logs
      else if (parts[3] === 'warlog') {
        if (window.MOCK_DATA.warLog && window.MOCK_DATA.warLog[tag]) {
          result = structuredClone(window.MOCK_DATA.warLog[tag]);
        } else if (window.MOCK_WAR_LOG && window.MOCK_WAR_LOG[tag]) {
          result = structuredClone(window.MOCK_WAR_LOG[tag]);
        } else {
          result = structuredClone(Object.values(window.MOCK_WAR_LOG)[0]);
        }
      }
      // If requesting capital raids log
      else if (parts[3] === 'capitalraidlog') {
        if (window.MOCK_DATA.capitalRaids && window.MOCK_DATA.capitalRaids[tag]) {
          result = structuredClone(window.MOCK_DATA.capitalRaids[tag]);
        } else if (window.MOCK_CAPITAL_RAIDS && window.MOCK_CAPITAL_RAIDS[tag]) {
      if (parts.length === 3) {
        if (window.MOCK_DATA.clans && window.MOCK_DATA.clans[tag]) {
          result = structuredClone(window.MOCK_DATA.clans[tag]);
        } else if (window.MOCK_CLANS && window.MOCK_CLANS[tag]) {
          result = structuredClone(window.MOCK_CLANS[tag]);
        } else {
          const template = Object.values(window.MOCK_CLANS)[0];
          const copy = structuredClone(template);
          copy.tag = tag;
          copy.name = `Clan ${tag.replace('#', '')}`;
          result = copy;
        }
      } else if (parts[3] === 'currentwar') {
        const data = window.MOCK_DATA.wars[tag] || window.MOCK_WARS[tag] || window.MOCK_WARS["#2PP2PP2P"];
        result = structuredClone(data);
      } else if (parts[3] === 'warleaguequeue') {
        const data = window.MOCK_DATA.cwl[tag] || window.MOCK_CWL[tag] || window.MOCK_CWL["#2PP2PP2P"];
        result = structuredClone(data);
      } else if (parts[3] === 'warlog') {
        const data = window.MOCK_DATA.warLog[tag] || window.MOCK_WAR_LOG[tag] || window.MOCK_WAR_LOG["#2PP2PP2P"];
        result = structuredClone(data);
      } else if (parts[3] === 'capitalraidseasons') {
        const data = window.MOCK_DATA.capitalRaids[tag] || window.MOCK_CAPITAL_RAIDS[tag] || window.MOCK_CAPITAL_RAIDS["#2PP2PP2P"];
        result = structuredClone(data);
      }
    }
    // Handle Player profiling routing
    else if (endpoint.startsWith('/players/')) {
      const tag = endpoint.split('/')[2];
      if (window.MOCK_DATA.players && window.MOCK_DATA.players[tag]) {
        result = structuredClone(window.MOCK_DATA.players[tag]);
      } else if (window.MOCK_PLAYERS && window.MOCK_PLAYERS[tag]) {
        result = structuredClone(window.MOCK_PLAYERS[tag]);
      } else {
        const template = Object.values(window.MOCK_PLAYERS)[0];
        const copy = structuredClone(template);
        copy.tag = tag;
        copy.name = `Clasher ${tag.replace('#', '')}`;
        result = copy;
      }
    }
    
    if (result) {
      updatePayloadInspector(endpoint, result);
      logTelemetryQuery(endpoint, performance.now() - startTime, false);
      return result;
    }

    throw new Error("Invalid Demo Mode Endpoint requested");
  }

  // Live Mode connection logic
  if (!state.apiToken) {
    throw new Error("API Token is not set. Please set it in the API Settings modal, or switch to Demo Mode above!");
  }

  // Replace all '#' in the endpoint path with '%23' to prevent browser truncation
  const safeEndpoint = endpoint.replace(/#/g, '%23');
  
  let url;
  if (window.location.port === '3000' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    url = `/api${safeEndpoint}`;
  } else {
    const apiBase = "https://api.clashofclans.com/v1";
    url = `${state.proxyUrl}${apiBase}${safeEndpoint}`;
  }

  const response = await fetch(url, {
    headers: {
      "Authorization": `Bearer ${state.apiToken}`,
      "Accept": "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.status} - ${response.statusText}. Please verify token, proxy, and Tag validity.`);
  }

  const json = await response.json();
  cocCache.set(endpoint, json);
  updatePayloadInspector(endpoint, json);
  
  // Track telemetry variables
  if (response.headers.get('x-ratelimit-remaining')) {
    state.telemetryRateRemaining = parseInt(response.headers.get('x-ratelimit-remaining'));
    state.telemetryRateLimit = parseInt(response.headers.get('x-ratelimit-limit') || '30');
  } else {
    // If local proxy mock is active, count internally
    state.telemetryRateRemaining = Math.max(0, 30 - cocCache.size);
    state.telemetryRateLimit = 30;
  }
  
  logTelemetryQuery(endpoint, performance.now() - startTime, false);
  return json;
}

// Data Loaders
async function loadClanData(tag) {
  const container = document.getElementById('clan-results-container');
  container.innerHTML = getSkeletonHTML();
  
  try {
    const clan = await fetchCocData(`/clans/${tag}`);
    if (!clan) {
      container.innerHTML = `<div class="placeholder-state"><i class="fas fa-exclamation-triangle"></i><p>Clan not found. Double check your tag.</p></div>`;
      return;
    }
    state.currentClan = clan;
    searchHistory.add('clan', tag, clan.name);
    renderClan(clan);
    
    // Auto load war data
    await loadWarData(tag);
  } catch (err) {
    container.innerHTML = `<div class="placeholder-state"><i class="fas fa-times-circle"></i><p>Error: ${escapeHtml(err.message)}</p><button class="primary-btn mt-16" data-action="load-clan" data-tag="${escapeHtml(tag)}">Retry</button></div>`;
  }
}

async function loadPlayerData(tag) {
  const container = document.getElementById('player-results-container');
  container.innerHTML = getSkeletonHTML();
  
  try {
    const player = await fetchCocData(`/players/${tag}`);
    if (!player) {
      container.innerHTML = `<div class="placeholder-state"><i class="fas fa-exclamation-triangle"></i><p>Player profile not found. Double check your tag.</p></div>`;
      return;
    }
    state.currentPlayer = player;
    searchHistory.add('player', tag, player.name);
    renderPlayer(player);
  } catch (err) {
    container.innerHTML = `<div class="placeholder-state"><i class="fas fa-times-circle"></i><p>Error: ${escapeHtml(err.message)}</p><button class="primary-btn mt-16" data-action="load-player" data-tag="${escapeHtml(tag)}">Retry</button></div>`;
  }
}

async function loadWarData(clanTag) {
  const container = document.getElementById('war-results-container');
  container.innerHTML = getSkeletonHTML();
  
  // Hide subnav and subviews initially
  document.getElementById('war-hub-subnav').style.display = 'none';
  
  try {
    const war = await fetchCocData(`/clans/${clanTag}/currentwar`);
    if (!war || war.state === 'notInWar') {
      container.innerHTML = `<div class="placeholder-state"><i class="fas fa-shield-alt"></i><p>This clan is currently not in an active war.</p></div>`;
      return;
    }
    state.currentWar = war;
    renderWar(war);
    
    // Show subnavigation and trigger loading other subviews
    document.getElementById('war-hub-subnav').style.display = 'flex';
    loadCWLData(clanTag);
    loadWarHistoryData(clanTag);
  } catch (err) {
    container.innerHTML = `<div class="placeholder-state"><i class="fas fa-times-circle"></i><p>Error loading war log: ${escapeHtml(err.message)}</p><button class="primary-btn mt-16" data-action="load-clan" data-tag="${escapeHtml(clanTag)}">Retry</button></div>`;
  }
}

// Initial View Placeholders
function showInitialPlaceholders() {
  document.getElementById('clan-results-container').innerHTML = `
    <div class="placeholder-state">
      <i class="fas fa-users" style="font-size: 48px; color: var(--clash-gold); opacity: 0.6; margin-bottom: 12px;"></i>
      <p style="font-size: 15px; color: var(--text-muted);">Enter a Clan Tag on the left to explore the roster & metrics.</p>
    </div>
  `;
  document.getElementById('player-results-container').innerHTML = `
    <div class="placeholder-state">
      <i class="fas fa-user-shield" style="font-size: 48px; color: var(--clash-gold); opacity: 0.6; margin-bottom: 12px;"></i>
      <p style="font-size: 15px; color: var(--text-muted);">Search a player tag to profile their army levels & achievements.</p>
    </div>
  `;
  document.getElementById('war-results-container').innerHTML = `
    <div class="placeholder-state">
      <i class="fas fa-fire" style="font-size: 48px; color: var(--clash-gold); opacity: 0.6; margin-bottom: 12px;"></i>
      <p style="font-size: 15px; color: var(--text-muted);">Track active clan wars & feed events in real-time.</p>
    </div>
  `;
}

// ===== OVERVIEW / COMMAND CENTER PANEL =====
async function loadOverviewClan(tag) {
  try {
    const clan = await fetchCocData(`/clans/${tag}`);
    if (!clan) {
      state.homeClanTag = '';
      localStorage.removeItem('coc_home_clan');
      showInitialPlaceholders();
      return;
    }
    
    state.currentClan = clan;

    // Update Overview Header Summary
    const badgeEl = document.getElementById('overview-clan-badge');
    const nameEl = document.getElementById('overview-clan-name');
    const levelEl = document.getElementById('overview-clan-level');
    const descEl = document.getElementById('overview-clan-desc');
    const trophiesEl = document.getElementById('overview-trophies');
    const membersEl = document.getElementById('overview-members-count');
    const warWinsEl = document.getElementById('overview-war-wins');
    const labelsEl = document.getElementById('overview-clan-labels');

    if (badgeEl) badgeEl.src = clan.badgeUrls.medium;
    if (nameEl) nameEl.textContent = clan.name;
    if (levelEl) levelEl.textContent = `Level ${clan.clanLevel}`;
    if (descEl) descEl.textContent = clan.description || 'No description provided by clan leader.';
    
    // Animate stats
    if (trophiesEl) animateValue(trophiesEl, 0, clan.clanPoints || 0, 1200);
    if (membersEl) membersEl.textContent = `${clan.members} / 50`;
    if (warWinsEl) animateValue(warWinsEl, 0, clan.warWins || 0, 1000);

    // Populate labels
    if (labelsEl) {
      labelsEl.innerHTML = (clan.labels || []).map(l => `
        <span class="badge-small" style="background: rgba(255,255,255,0.06); border: 1px solid var(--border-subtle); display: flex; align-items: center; gap: 4px; padding: 4px 10px; border-radius: 8px;">
          <img src="${l.iconUrls.small}" alt="${l.name}" style="width: 14px; height: 14px; object-fit: contain;"/>
          ${escapeHtml(l.name)}
        </span>
      `).join('');
    }

    // Load Chart.js and render the overview chart
    await loadChartJs();
    initOverviewChart(clan.memberList);

    // Populate Git-style activity heatmap
    const heatmapWrapper = document.getElementById('activity-heatmap-wrapper');
    if (heatmapWrapper) {
      heatmapWrapper.innerHTML = renderActivityHeatmap();
    }

    // Apply custom active widget configs
    applyWidgetConfigurations();

    // Load Gold Pass rewards
    try {
      const goldpass = await fetchCocData('/goldpass/seasons/current');
      if (goldpass) {
        loadGoldPassRewards(goldpass);
      }
    } catch (e) {
      console.warn("Gold pass load failed", e);
    }

  } catch (err) {
    showToast(`Error loading Overview Clan: ${err.message}`, "error");
    const overviewContainer = document.querySelector('#overview-pane .explorer-grid');
    if (overviewContainer) {
      overviewContainer.innerHTML = `
        <div class="results-card" style="grid-column: span 2; min-height: auto; align-items: center; justify-content: center; padding: 40px; text-align: center; gap: 16px;">
          <i class="fas fa-exclamation-triangle" style="font-size: 48px; color: var(--clash-elixir); margin-bottom: 16px;"></i>
          <h3 style="font-size: 18px; font-weight: 700; margin-bottom: 8px;">Live API Connection Failed</h3>
          <p style="color: var(--text-muted); max-width: 500px; line-height: 1.6; margin: 0 auto 16px;">
            Failed to connect to the live API (${escapeHtml(err.message)}). 
            Your API token may be rate-limited, expired, or your IP/CORS proxy configuration is blocked.
          </p>
          <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
            <button class="primary-btn" onclick="toggleDashboardMode()">
              <i class="fas fa-toggle-on"></i> Switch to Demo Mode
            </button>
            <button class="config-btn" onclick="document.getElementById('config-btn').click()">
              <i class="fas fa-cog"></i> Check API Settings
            </button>
          </div>
        </div>
      `;
    }
  }
}

function renderActivityHeatmap() {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  let html = '<div class="heatmap-container">';
  
  for (let i = 0; i < 7; i++) {
    html += `<div class="heatmap-row"><span class="heatmap-label">${days[i]}</span>`;
    for (let j = 0; j < 24; j++) {
      // Simulate activity level (0 to 4)
      const level = Math.floor(Math.pow(Math.random(), 2.2) * 5);
      html += `<div class="heatmap-cell heatmap-level-${level}" title="Day ${days[i]}, Hour ${j}: Activity Level ${level}"></div>`;
    }
    html += '</div>';
  }
  
  html += `
    <div class="heatmap-legend">
      <span>Less</span>
      <div class="heatmap-cell heatmap-level-0"></div>
      <div class="heatmap-cell heatmap-level-1"></div>
      <div class="heatmap-cell heatmap-level-2"></div>
      <div class="heatmap-cell heatmap-level-3"></div>
      <div class="heatmap-cell heatmap-level-4"></div>
      <span>More</span>
    </div>
  </div>`;
  
  return html;
}

function initOverviewChart(members) {
  loadChartJs().then(() => {
    const canvas = document.getElementById('overview-chart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    // Group members by trophy range or league
    const leaguesCount = {};
    members.forEach(m => {
      const name = m.league?.name || 'Unranked';
      leaguesCount[name] = (leaguesCount[name] || 0) + 1;
    });

    if (overviewChart) overviewChart.destroy();
    
    try {
      overviewChart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: Object.keys(leaguesCount),
          datasets: [{
            label: 'Player count',
            data: Object.values(leaguesCount),
            backgroundColor: 'rgba(245, 166, 35, 0.75)',
            borderColor: '#f5a623',
            borderWidth: 1.5,
            borderRadius: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: 'rgba(11, 12, 16, 0.95)',
              borderColor: 'rgba(255,255,255,0.08)',
              borderWidth: 1
            }
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: { color: '#a8a8a8', font: { family: 'Outfit', size: 10 } }
            },
            y: {
              grid: { color: 'rgba(255, 255, 255, 0.05)' },
              ticks: { color: '#a8a8a8', font: { family: 'Outfit', size: 10 } }
            }
          }
        }
      });
    } catch(err) {
      canvas.parentElement.innerHTML = `<p class="text-muted" style="text-align: center; padding-top: 50px;">Chart.js rendering issue. Falling back to data list.</p>`;
    }
  }).catch(() => {
    const canvas = document.getElementById('overviewChartCanvas');
    if (canvas) canvas.parentElement.innerHTML = `<p class="text-muted" style="text-align: center; padding-top: 50px;">Could not load Chart.js library from CDN.</p>`;
  });
}

// ===== CLAN PROFILE PANEL =====
function renderClan(clan) {
  const container = document.getElementById('clan-results-container');
  if (!container) return;

  const isBookmarked = state.favorites.some(fav => fav.tag === clan.tag);
  const winRate = ((clan.warWins / (clan.warWins + clan.warLosses || 1)) * 100).toFixed(1);

  // Group members into trophies
  const th16Count = clan.memberList.filter(m => m.expLevel > 200).length; // Simulated TH metrics safely
  const legendPlayers = clan.memberList.filter(m => m.league?.name === 'Legend League').length;

  container.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 24px;">
      <!-- Clan Profile Header Card -->
      <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border-subtle); padding-bottom: 20px; flex-wrap: wrap; gap: 16px;">
        <div style="display: flex; align-items: center; gap: 16px;">
          <img src="${clan.badgeUrls.medium}" alt="badge" style="width: 56px; height: 56px; object-fit: contain;"/>
          <div>
            <h2 class="gold-gradient-text" style="font-size: 24px; font-weight: 800; margin: 0;">${escapeHtml(clan.name)}</h2>
            <div style="display: flex; gap: 8px; align-items: center; font-size: 13px; color: var(--text-muted); margin-top: 4px;">
              <span>LVL ${clan.clanLevel}</span>
              <span>&bull;</span>
              <span>${escapeHtml(clan.tag)}</span>
              <span>&bull;</span>
              <span>${clan.members}/50 Members</span>
            </div>
          </div>
        </div>

        <div style="display: flex; gap: 8px;">
          <button id="clan-bookmark-btn" class="bookmark-btn ${isBookmarked ? 'active' : ''}" data-action="toggle-favorite" data-type="clan" data-tag="${escapeHtml(clan.tag)}" data-name="${escapeHtml(clan.name)}">
            <i class="${isBookmarked ? 'fas' : 'far'} fa-star"></i> Bookmarks
          </button>
          <button class="primary-btn" data-action="set-home-clan" data-tag="${escapeHtml(clan.tag)}">
            <i class="fas fa-home"></i> Set Home
          </button>
          
          <div class="export-dropdown">
            <button class="export-btn" id="export-drop-btn">
              <i class="fas fa-download"></i> Export Data
            </button>
            <div class="export-dropdown-content" id="export-dropdown-menu">
              <button class="export-dropdown-item" data-action="export-clipboard" data-type="clan">
                <i class="fas fa-copy"></i> Clipboard
              </button>
              <button class="export-dropdown-item" data-action="export-csv" data-type="clan">
                <i class="fas fa-file-csv"></i> CSV File
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- General Stats row -->
      <div class="stats-row">
        <div class="stat-card" style="padding: 16px; background: var(--bg-stone-dark);">
          <div class="stat-icon gold" style="width: 44px; height: 44px; font-size: 16px;"><i class="fas fa-trophy"></i></div>
          <div class="stat-details">
            <h4 style="font-size: 11px;">Points</h4>
            <p style="font-size: 18px;">${clan.clanPoints?.toLocaleString() || 0}</p>
          </div>
        </div>
        <div class="stat-card" style="padding: 16px; background: var(--bg-stone-dark);">
          <div class="stat-icon elixir" style="width: 44px; height: 44px; font-size: 16px;"><i class="fas fa-shield-alt"></i></div>
          <div class="stat-details">
            <h4 style="font-size: 11px;">CWL Tier</h4>
            <p style="font-size: 18px;">${clan.warLeague?.name || 'Unranked'}</p>
          </div>
        </div>
        <div class="stat-card" style="padding: 16px; background: var(--bg-stone-dark);">
          <div class="stat-icon dark" style="width: 44px; height: 44px; font-size: 16px;"><i class="fas fa-chart-line"></i></div>
          <div class="stat-details">
            <h4 style="font-size: 11px;">War Win Rate</h4>
            <p style="font-size: 18px;">${winRate}%</p>
          </div>
        </div>
      </div>

      <!-- Roster density graph & quick stats -->
      <div class="explorer-grid" style="grid-template-columns: 1fr 1.6fr; gap: 24px;">
        <div class="results-card">
          <h3>Command Intel</h3>
          <div style="display: flex; flex-direction: column; gap: 14px; margin-top: 16px;">
            <div class="flex-between border-bottom-subtle pb-8">
              <span style="font-size: 13px; color: var(--text-muted);">Legend League Players</span>
              <strong style="color: var(--clash-gold); font-size: 15px;">${legendPlayers}</strong>
            </div>
            <div class="flex-between border-bottom-subtle pb-8">
              <span style="font-size: 13px; color: var(--text-muted);">Elite Exp Level Players</span>
              <strong style="color: var(--text-main); font-size: 15px;">${th16Count}</strong>
            </div>
            <div class="flex-between">
              <span style="font-size: 13px; color: var(--text-muted);">Required Trophies</span>
              <strong style="color: var(--text-main); font-size: 15px;">🏆 ${clan.requiredTrophies || 0}</strong>
            </div>
          </div>
        </div>
        <div class="results-card">
          <h3>📈 Roster Trophies Share</h3>
          <div class="chart-container-responsive mt-12" style="position: relative; height: 160px;">
            <canvas id="clanChartCanvas"></canvas>
          </div>
        </div>
      </div>

      <!-- Split comparative donation bar charts -->
      <div class="results-card mt-8">
        <h3>📊 Donation Balances (Top 5 Donors)</h3>
        <div class="chart-container-responsive mt-12" style="position: relative; height: 200px;">
          <canvas id="donationChartCanvas"></canvas>
        </div>
      </div>

      <!-- Roster table listing -->
      <div class="results-card mt-8">
        <div class="section-header">
          <h3>🛡️ Active Clan Roster Roster</h3>
          <span style="font-size: 12px; color: var(--text-muted);">Click on any member to explore their full profile</span>
        </div>
        <div style="overflow-x: auto; margin-top: 16px;">
          <table class="roster-table" style="width: 100%; border-collapse: collapse; font-size: 13px;">
            <thead>
              <tr style="border-bottom: 2px solid var(--border-subtle); color: var(--text-muted); text-align: left;">
                <th style="padding: 10px 14px;">Rank</th>
                <th style="padding: 10px 14px;">Player Name</th>
                <th style="padding: 10px 14px;">Exp Lvl</th>
                <th style="padding: 10px 14px;">Role</th>
                <th style="padding: 10px 14px;">Donations</th>
                <th style="padding: 10px 14px; text-align: right;">Trophies</th>
              </tr>
            </thead>
            <tbody>
              ${clan.memberList.map((m, index) => {
                let roleLabel = m.role === 'leader' ? 'Leader' : m.role === 'coLeader' ? 'Co-Leader' : m.role === 'elder' ? 'Elder' : 'Member';
                return `
                  <tr class="roster-row" data-action="load-player" data-tag="${escapeHtml(m.tag)}" style="border-bottom: 1px solid var(--border-subtle); cursor: pointer; transition: var(--transition-smooth);">
                    <td style="padding: 12px 14px;"><span class="rank-badge ${index < 3 ? `rank-${index + 1}` : ''}">${index + 1}</span></td>
                    <td style="padding: 12px 14px;">
                      <div style="display: flex; align-items: center; gap: 8px;">
                        <img src="${m.league?.iconUrls?.small || ''}" alt="" style="width: 20px; height: 20px; object-fit: contain;"/>
                        <strong style="color: var(--text-main);">${escapeHtml(m.name)}</strong>
                      </div>
                    </td>
                    <td style="padding: 12px 14px; color: var(--text-muted);">${m.expLevel}</td>
                    <td style="padding: 12px 14px; color: var(--text-muted);">${roleLabel}</td>
                    <td style="padding: 12px 14px; color: var(--text-muted); font-size: 11px;">
                      <span>Given: ${m.donations}</span> &bull; <span>Rec: ${m.donationsReceived}</span>
                    </td>
                    <td style="padding: 12px 14px; text-align: right; font-weight: 700; color: var(--clash-gold);"><i class="fas fa-trophy"></i> ${m.trophies}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  initClanChart(clan.memberList);
}

function initClanChart(members) {
  loadChartJs().then(() => {
    const canvas = document.getElementById('clanChartCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const top5Players = [...members].sort((a, b) => b.trophies - a.trophies).slice(0, 5);

    if (clanChart) clanChart.destroy();
    
    try {
      clanChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: top5Players.map(p => p.name),
          datasets: [{
            data: top5Players.map(p => p.trophies),
            backgroundColor: [
              'rgba(245, 166, 35, 0.85)',
              'rgba(236, 59, 131, 0.85)',
              'rgba(139, 68, 253, 0.85)',
              'rgba(74, 219, 134, 0.85)',
              'rgba(74, 144, 226, 0.85)'
            ],
            borderColor: 'rgba(11, 12, 16, 0.95)',
            borderWidth: 2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { 
              position: 'right',
              labels: { color: '#a8a8a8', font: { family: 'Outfit', size: 10 } }
            },
            tooltip: {
              backgroundColor: 'rgba(11, 12, 16, 0.95)',
              borderColor: 'rgba(255,255,255,0.08)',
              borderWidth: 1
            }
          }
        }
      });
    } catch(err) {
      canvas.parentElement.innerHTML = `<p class="text-muted" style="text-align: center; padding-top: 50px;">Chart rendering issue. Falling back to roster list.</p>`;
    }

    // Initialize Donation Split-Bar Chart
    const donCanvas = document.getElementById('donationChartCanvas');
    if (donCanvas) {
      const donCtx = donCanvas.getContext('2d');
      const topDonors = [...members].sort((a, b) => b.donations - a.donations).slice(0, 5);
      
      try {
        new Chart(donCtx, {
          type: 'bar',
          data: {
            labels: topDonors.map(p => p.name),
            datasets: [
              {
                label: 'Given',
                data: topDonors.map(p => p.donations),
                backgroundColor: 'rgba(74, 219, 134, 0.75)',
                borderColor: '#4adb86',
                borderWidth: 1
              },
              {
                label: 'Received',
                data: topDonors.map(p => p.donationsReceived),
                backgroundColor: 'rgba(236, 59, 131, 0.75)',
                borderColor: '#EC3B83',
                borderWidth: 1
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { labels: { color: '#a8a8a8', font: { family: 'Outfit', size: 10 } } }
            },
            scales: {
              x: { ticks: { color: '#a8a8a8', font: { family: 'Outfit', size: 9 } } },
              y: { ticks: { color: '#a8a8a8', font: { family: 'Outfit', size: 9 } } }
            }
          }
        });
      } catch(e) {
        console.warn("Donation chart issue", e);
      }
    }
  }).catch(() => {
    const canvas = document.getElementById('clanChartCanvas');
    if (canvas) canvas.parentElement.innerHTML = `<p class="text-muted" style="text-align: center; padding-top: 50px;">Could not load Chart.js library from CDN.</p>`;
  });
}

// ===== PLAYER PROFILE PANEL =====
function renderPlayer(player) {
  const container = document.getElementById('player-results-container');
  if (!container) return;

  const isBookmarked = state.favorites.some(fav => fav.tag === player.tag);

  let builderBaseHtml = '';
  if (player.builderHallLevel) {
    builderBaseHtml = `
      <div class="mt-32">
        <h3 class="gold-gradient-text" style="font-size: 18px; font-weight: 800;">🔨 Builder Base Profiler</h3>
        <div class="stats-row mt-16">
          <div class="stat-card" style="padding: 16px; background: var(--bg-stone-dark);">
            <div class="stat-icon gold" style="width: 40px; height: 40px; font-size: 16px;"><i class="fas fa-hammer"></i></div>
            <div class="stat-details">
              <h4 style="font-size: 12px;">Builder Hall</h4>
              <p style="font-size: 18px;">Level ${player.builderHallLevel}</p>
            </div>
          </div>
          <div class="stat-card" style="padding: 16px; background: var(--bg-stone-dark);">
            <div class="stat-icon elixir" style="width: 40px; height: 40px; font-size: 16px;"><i class="fas fa-trophy"></i></div>
            <div class="stat-details">
              <h4 style="font-size: 12px;">Versus Trophies</h4>
              <p style="font-size: 18px;">${player.versusTrophies || 0}</p>
            </div>
          </div>
          <div class="stat-card" style="padding: 16px; background: var(--bg-stone-dark);">
            <div class="stat-icon dark" style="width: 40px; height: 40px; font-size: 16px;"><i class="fas fa-fist-raised"></i></div>
            <div class="stat-details">
              <h4 style="font-size: 12px;">Versus Wins</h4>
              <p style="font-size: 18px;">${player.versusBattleWins || 0}</p>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  container.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 24px;">
      <!-- Profile Header Card -->
      <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border-subtle); padding-bottom: 20px; flex-wrap: wrap; gap: 16px;">
        <div style="display: flex; align-items: center; gap: 16px;">
          <img src="${player.league?.iconUrls?.medium || player.league?.iconUrls?.small || ''}" alt="" style="width: 56px; height: 56px; object-fit: contain;"/>
          <div>
            <h2 class="gold-gradient-text" style="font-size: 24px; font-weight: 800; margin: 0;">${escapeHtml(player.name)}</h2>
            <div style="display: flex; gap: 8px; align-items: center; font-size: 13px; color: var(--text-muted); margin-top: 4px;">
              <span>Town Hall ${player.townHallLevel}</span>
              <span>&bull;</span>
              <span>${escapeHtml(player.tag)}</span>
              <span>&bull;</span>
              <span style="cursor: pointer;" data-action="load-clan" data-tag="${escapeHtml(player.clan?.tag)}">${escapeHtml(player.clan?.name || 'No Clan')}</span>
            </div>
          </div>
        </div>

        <div style="display: flex; gap: 8px;">
          <button id="player-bookmark-btn" class="bookmark-btn ${isBookmarked ? 'active' : ''}" data-action="toggle-favorite" data-type="player" data-tag="${escapeHtml(player.tag)}" data-name="${escapeHtml(player.name)}">
            <i class="${isBookmarked ? 'fas' : 'far'} fa-star"></i> Bookmarks
          </button>
          <button class="export-btn" data-action="export-clipboard" data-type="player">
            <i class="fas fa-share-alt"></i> Share
          </button>
        </div>
      </div>

      <!-- Core Stats row -->
      <div class="stats-row">
        <div class="stat-card" style="padding: 16px; background: var(--bg-stone-dark);">
          <div class="stat-icon gold" style="width: 44px; height: 44px; font-size: 16px;"><i class="fas fa-trophy"></i></div>
          <div class="stat-details">
            <h4 style="font-size: 11px;">Trophies</h4>
            <p style="font-size: 18px;">${player.trophies?.toLocaleString() || 0}</p>
          </div>
        </div>
        <div class="stat-card" style="padding: 16px; background: var(--bg-stone-dark);">
          <div class="stat-icon elixir" style="width: 44px; height: 44px; font-size: 16px;"><i class="fas fa-star"></i></div>
          <div class="stat-details">
            <h4 style="font-size: 11px;">War Stars</h4>
            <p style="font-size: 18px;">${player.warStars || 0}</p>
          </div>
        </div>
        <div class="stat-card" style="padding: 16px; background: var(--bg-stone-dark);">
          <div class="stat-icon dark" style="width: 44px; height: 44px; font-size: 16px;"><i class="fas fa-award"></i></div>
          <div class="stat-details">
            <h4 style="font-size: 11px;">Experience</h4>
            <p style="font-size: 18px;">Lvl ${player.expLevel}</p>
          </div>
        </div>
      </div>

      <!-- Radar comparison / Hero details grid -->
      <div class="explorer-grid" style="grid-template-columns: 1fr 1.5fr; gap: 24px;">
        <div class="results-card">
          <h3>🛡️ Hero Command</h3>
          <div style="display: flex; flex-direction: column; gap: 12px; margin-top: 16px;">
            ${(player.heroes || []).map(h => {
              const pct = (h.level / h.maxLevel) * 100;
              return `
                <div>
                  <div class="flex-between" style="font-size: 12px; margin-bottom: 4px;">
                    <strong>${escapeHtml(h.name)}</strong>
                    <span style="color: var(--clash-gold);">LVL ${h.level} / ${h.maxLevel}</span>
                  </div>
                  <div style="height: 6px; background: var(--bg-stone-medium); border-radius: 3px; overflow: hidden;">
                    <div style="width: ${pct}%; height: 100%; background: var(--clash-gold-gradient); border-radius: 3px;"></div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <div class="results-card">
          <h3>📊 Army Strengths Distribution</h3>
          <div class="chart-container-responsive mt-12">
            <canvas id="playerRadarCanvas"></canvas>
          </div>
        </div>
      </div>

      <!-- Hero Equipment Synergy recommendations card -->
      ${renderHeroEquipmentSynergies(player)}

      <!-- Builder Base details -->
      ${builderBaseHtml}

      <!-- Troops & Spells list -->
      <div class="results-card mt-8">
        <h3>⚔️ Laboratory Research Levels</h3>
        <div class="explorer-grid mt-16" style="grid-template-columns: 1fr 1fr; gap: 20px;">
          <div>
            <h4 style="font-size: 13px; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Troops</h4>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 10px;">
              ${(player.troops || []).slice(0, 10).map(t => `
                <div style="padding: 8px 12px; background: var(--bg-stone-dark); border: 1px solid var(--border-subtle); border-radius: 8px; display: flex; justify-content: space-between; font-size: 12px;">
                  <span>${escapeHtml(t.name)}</span>
                  <strong style="color: var(--clash-gold);">Lvl ${t.level}</strong>
                </div>
              `).join('')}
            </div>
          </div>
          <div>
            <h4 style="font-size: 13px; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Spells</h4>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 10px;">
              ${(player.spells || []).slice(0, 10).map(s => `
                <div style="padding: 8px 12px; background: var(--bg-stone-dark); border: 1px solid var(--border-subtle); border-radius: 8px; display: flex; justify-content: space-between; font-size: 12px;">
                  <span>${escapeHtml(s.name)}</span>
                  <strong style="color: var(--clash-elixir);">Lvl ${s.level}</strong>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      </div>
      
      <!-- Progression Audit Card -->
      ${renderProgressionAudit(player)}
    </div>
  `;

  initPlayerRadarChart(player);
}

function initPlayerRadarChart(player) {
  loadChartJs().then(() => {
    const canvas = document.getElementById('playerRadarCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const heroLevels = (player.heroes || []).map(h => h.level);
    const heroNames = (player.heroes || []).map(h => h.name.replace("Hero", "").trim());

    if (heroLevels.length === 0) {
      canvas.parentElement.innerHTML = `<p class="text-muted" style="text-align: center; padding-top: 50px;">No hero levels to display on chart.</p>`;
      return;
    }

    if (overviewChart) {
      // Re-use reference or destroy safely
    }
    
    try {
      new Chart(ctx, {
        type: 'radar',
        data: {
          labels: heroNames,
          datasets: [{
            label: 'Hero Level',
            data: heroLevels,
            backgroundColor: 'rgba(236, 59, 131, 0.2)',
            borderColor: 'var(--clash-elixir)',
            pointBackgroundColor: 'var(--clash-gold)',
            borderWidth: 2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false }
          },
          scales: {
            r: {
              angleLines: { color: 'rgba(255, 255, 255, 0.05)' },
              grid: { color: 'rgba(255, 255, 255, 0.05)' },
              pointLabels: { color: '#a8a8a8', font: { family: 'Outfit', size: 10 } },
              ticks: { display: false }
            }
          }
        }
      });
    } catch(err) {
      canvas.parentElement.innerHTML = `<p class="text-muted" style="text-align: center; padding-top: 50px;">Chart rendering issue.</p>`;
    }
  }).catch(() => {
    const canvas = document.getElementById('playerRadarCanvas');
    if (canvas) canvas.parentElement.innerHTML = `<p class="text-muted" style="text-align: center; padding-top: 50px;">Could not load Chart.js library.</p>`;
  });
}

// ===== WAR HUB & LOGS PANEL =====
function renderWar(war) {
  const container = document.getElementById('war-results-container');
  if (!container) return;

  const clanStars = war.clan.stars || 0;
  const oppStars = war.opponent.stars || 0;
  
  let stateLabel = 'Unknown';
  let stateClass = '';
  if (war.state === 'preparation') {
    stateLabel = 'Preparation Day — Scouting Phase';
    stateClass = 'preparation';
  } else if (war.state === 'inWar') {
    stateLabel = 'In Progress — Active Battle';
    stateClass = 'active';
  } else if (war.state === 'warEnded') {
    stateLabel = 'War Ended — Results Final';
    stateClass = 'ended';
  }

  container.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 24px;">
      <!-- War Title Block Banner -->
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px; border-bottom: 1px solid var(--border-subtle); padding-bottom: 20px;">
        <div>
          <h2 class="gold-gradient-text" style="font-size: 24px; font-weight: 800; margin: 0;">⚔️ Clan War Command Hub</h2>
          <div style="display: flex; gap: 8px; align-items: center; font-size: 13px; color: var(--text-muted); margin-top: 4px;">
            <span class="badge-small ${stateClass}" style="background: rgba(245,166,35,0.15); color: var(--clash-gold); font-weight: 700;">${stateLabel}</span>
            <span>&bull;</span>
            <span>Team Size: ${war.teamSize} vs ${war.teamSize}</span>
          </div>
        </div>

        <button class="export-btn" data-action="export-csv" data-type="war">
          <i class="fas fa-file-csv"></i> Export War Log
        </button>
      </div>

      <!-- Scoreboard Display -->
      <div class="player-compare-layout">
        <div class="player-compare-column">
          <div style="display: flex; align-items: center; gap: 12px; justify-content: center;">
            <img src="${war.clan.badgeUrls.small}" alt="badge" style="width: 32px; height: 32px; object-fit: contain;"/>
            <strong style="font-size: 16px; color: var(--text-main);">${escapeHtml(war.clan.name)}</strong>
          </div>
          <div style="font-size: 48px; font-weight: 800; text-align: center; color: var(--clash-gold); margin: 8px 0;">⭐ ${clanStars}</div>
          <div style="text-align: center; font-size: 12px; color: var(--text-muted);">Destruction: ${war.clan.destructionPercentage}%</div>
        </div>

        <div class="player-compare-vs">
          <span style="font-size: 20px; font-weight: 800; color: var(--text-muted); background: rgba(255,255,255,0.05); padding: 8px 12px; border-radius: 8px; border: 1px solid var(--border-subtle);">VS</span>
        </div>

        <div class="player-compare-column">
          <div style="display: flex; align-items: center; gap: 12px; justify-content: center;">
            <img src="${war.opponent.badgeUrls.small}" alt="badge" style="width: 32px; height: 32px; object-fit: contain;"/>
            <strong style="font-size: 16px; color: var(--text-main);">${escapeHtml(war.opponent.name)}</strong>
          </div>
          <div style="font-size: 48px; font-weight: 800; text-align: center; color: var(--text-muted); margin: 8px 0;">⭐ ${oppStars}</div>
          <div style="text-align: center; font-size: 12px; color: var(--text-muted);">Destruction: ${war.opponent.destructionPercentage}%</div>
        </div>
      </div>

      <!-- War Countdown timer -->
      <div class="countdown-timer" id="war-countdown">
        <!-- Rendered by startWarCountdown dynamically -->
      </div>

      <!-- Interactive War map grid -->
      <div style="margin-top: 12px; background: rgba(255,255,255,0.01); border: 1px solid var(--border-subtle); padding: 20px; border-radius: 14px;">
        <h3 class="gold-gradient-text" style="font-size: 18px; font-weight: 800; margin: 0 0 4px;"><i class="fas fa-map-marked-alt"></i> Tactical War Map</h3>
        <p style="font-size: 12px; color: var(--text-muted); margin-bottom: 16px;">Click any base node to view active attacker logs, destruction statistics, and captured stars.</p>
        <div class="war-battle-map">
          <!-- Blue team bases -->
          <div class="battle-map-team">
            <div class="battle-map-header" style="color: #4adb86;">🔵 ${escapeHtml(war.clan.name)} Bases</div>
            <div class="battle-map-grid">
              ${Array.from({ length: war.teamSize }, (_, i) => {
                const mapPos = i + 1;
                const member = war.clan.members.find(m => m.mapPosition === mapPos) || {};
                let stars = 0;
                let stateClass = 'untouched';
                if (member.opponentAttacks > 0) {
                  stars = Math.floor(Math.random() * 4);
                  stateClass = stars === 3 ? 'cleared' : stars > 0 ? 'damaged' : 'untouched';
                }
                return `
                  <div class="base-node ${stateClass}" onclick="selectWarMapNode('clan', ${mapPos})">
                    <span>#${mapPos}</span>
                    <div class="base-node-stars">${'★'.repeat(stars) || '—'}</div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          <!-- Red team bases -->
          <div class="battle-map-team">
            <div class="battle-map-header" style="color: var(--clash-elixir);">🔴 ${escapeHtml(war.opponent.name)} Bases</div>
            <div class="battle-map-grid">
              ${Array.from({ length: war.teamSize }, (_, i) => {
                const mapPos = i + 1;
                const member = war.opponent.members.find(m => m.mapPosition === mapPos) || {};
                let stars = 0;
                let stateClass = 'untouched';
                
                // Find attacks on this opponent base by our clan
                const attacks = [];
                war.clan.members.forEach(m => {
                  if (m.attacks) {
                    m.attacks.forEach(att => {
                      if (att.defenderTag === member.tag) {
                        attacks.push(att);
                      }
                    });
                  }
                });
                if (attacks.length > 0) {
                  stars = Math.max(...attacks.map(a => a.stars));
                  stateClass = stars === 3 ? 'cleared' : stars > 0 ? 'damaged' : 'untouched';
                }
                
                return `
                  <div class="base-node ${stateClass}" onclick="selectWarMapNode('opponent', ${mapPos})">
                    <span>#${mapPos}</span>
                    <div class="base-node-stars">${'★'.repeat(stars) || '—'}</div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        </div>
        
        <!-- Target Detail slide down slot -->
        <div id="war-map-target-detail" style="display: none;"></div>
      </div>

      <!-- Live war feed simulation list -->
      <div class="war-feed-container">
        <h3>⚔️ Active Combat Engagement Feed</h3>
        <ul class="war-feed-list" id="war-feed-list-element">
          <!-- Filled by initWarTimelineSimulation -->
        </ul>
      </div>

      <!-- War Attack Matrix (Feature 2) -->
      <div class="attack-matrix-container" id="war-attack-matrix">
        <div class="flex-between border-bottom-subtle pb-12">
          <h3 class="text-lg font-bold">⚔️ Attack Matrix Matrix</h3>
          <span class="text-xs text-muted">Who attacked whom — star breakdown</span>
        </div>
        <div id="war-attack-matrix-grid" style="margin-top: 16px; overflow-x: auto;">
          <!-- Populated in renderWarAttackMatrix -->
        </div>
      </div>
    </div>
  `;

  // Start countdown timer
  startWarCountdown(war.endTime);

  // Initialize Timeline simulation feed
  initWarTimelineSimulation(war);

  // Render Attack Matrix
  renderWarAttackMatrix(war);
}

function renderWarAttackMatrix(war) {
  const grid = document.getElementById('war-attack-matrix-grid');
  if (!grid || !war || !war.clan || !war.clan.members) return;

  const clanMembers = war.clan.members || [];
  const opponentMembers = war.opponent.members || [];

  // Build lookup
  const attackMap = {};
  clanMembers.forEach(m => {
    if (m.attacks) {
      m.attacks.forEach(atk => {
        attackMap[`${m.tag}_${atk.defenderTag}`] = atk;
      });
    }
  });

  let html = `<table class="attack-matrix-table"><thead><tr><th>Attacker \\ Defender</th>`;
  opponentMembers.forEach(o => {
    html += `<th title="${escapeHtml(o.name)}">${escapeHtml(o.name.substring(0, 8))}</th>`;
  });
  html += `</tr></thead><tbody>`;

  clanMembers.forEach(c => {
    html += `<tr><td style="text-align: left; font-weight: 600; color: var(--clash-gold);">${escapeHtml(c.name)}</td>`;
    opponentMembers.forEach(o => {
      const key = `${c.tag}_${o.tag}`;
      const atk = attackMap[key];
      if (atk) {
        const stars = '⭐'.repeat(atk.stars) + '☆'.repeat(3 - atk.stars);
        html += `<td class="attack-cell"><span class="attack-cell-stars">${stars}</span><span class="attack-cell-destruction">${atk.destructionPercentage}%</span></td>`;
      } else {
        html += `<td class="attack-cell"><span class="attack-cell-empty">—</span></td>`;
      }
    });
    html += `</tr>`;
  });

  html += `</tbody></table>`;
  grid.innerHTML = html;
}

function initWarTimelineSimulation(war) {
  const list = document.getElementById('war-feed-list-element');
  if (!list) return;

  if (warInterval) clearInterval(warInterval);

  const mockEvents = [
    { attacker: 'ClashMaster', defender: 'ShadowNinja', stars: 3, dest: 100, team: 'clan' },
    { attacker: 'ShadowNinja', defender: 'DarkKnight', stars: 2, dest: 85, team: 'opp' },
    { attacker: 'ElixirQueen', defender: 'LavaMaster', stars: 2, dest: 92, team: 'clan' },
    { attacker: 'ElixirQueen', defender: 'PhoenixReborn', stars: 3, dest: 100, team: 'clan' },
    { attacker: 'GoblinKing', defender: 'USA_Patriot', stars: 1, dest: 67, team: 'clan' },
    { attacker: 'LavaHound', defender: 'GrandWarlock', stars: 3, dest: 100, team: 'opp' }
  ];

  let currentIdx = 0;
  function addEvent() {
    if (currentIdx >= mockEvents.length) {
      currentIdx = 0; // Loop simulation
    }
    const e = mockEvents[currentIdx++];
    const li = document.createElement('li');
    li.className = `war-feed-item ${e.team === 'opp' ? 'opponent-event' : ''}`;
    const starsHtml = '⭐'.repeat(e.stars) + '☆'.repeat(3 - e.stars);
    li.innerHTML = `
      <i class="fas fa-swords" style="color: ${e.team === 'opp' ? 'var(--clash-elixir)' : 'var(--clash-gold)'};"></i>
      <div>
        <strong>${escapeHtml(e.attacker)}</strong> attacked <strong>${escapeHtml(e.defender)}</strong><br/>
        <small style="color: var(--text-muted);">${starsHtml} (${e.dest}% destruction)</small>
      </div>
      <span class="war-feed-time">Just now</span>
    `;
    list.prepend(li);
  }

  // Add 3 initial events
  addEvent();
  addEvent();
  addEvent();

  warInterval = setInterval(addEvent, 12000);
}

// ===== CLAN COMPARISON PANEL =====
async function loadComparisonClan(col, tag) {
  const card = document.getElementById(`compare-clan-${col}-card`);
  if (card) card.innerHTML = getSkeletonHTML();

  try {
    const clan = await fetchCocData(`/clans/${tag}`);
    state.compareClans[col] = clan;
    renderComparison();
  } catch (err) {
    if (card) {
      card.innerHTML = `<p class="text-muted">Error loading comparison clan: ${escapeHtml(err.message)}</p>`;
    }
  }
}

function renderComparison() {
  const container = document.getElementById('comparison-results-container');
  if (!container) return;

  const ca = state.compareClans.a;
  const cb = state.compareClans.b;

  if (!ca || !cb) {
    container.innerHTML = `
      <div class="placeholder-state">
        <i class="fas fa-balance-scale" style="font-size: 48px; color: var(--clash-gold); opacity: 0.6; margin-bottom: 12px;"></i>
        <p style="font-size: 15px; color: var(--text-muted);">Please load two valid Clans above to generate comparison stats.</p>
      </div>
    `;
    return;
  }

  const winRateA = ((ca.warWins / (ca.warWins + ca.warLosses || 1)) * 100).toFixed(1);
  const winRateB = ((cb.warWins / (cb.warWins + cb.warLosses || 1)) * 100).toFixed(1);

  container.innerHTML = `
    <!-- Top Comparison summary headers -->
    <div class="comparison-layout">
      <div class="comparison-column">
        <div style="display: flex; align-items: center; gap: 12px; justify-content: center;">
          <img src="${ca.badgeUrls.small}" alt="badge" style="width: 32px; height: 32px; object-fit: contain;"/>
          <h4 style="font-size: 16px; color: var(--text-main); margin: 0;">${escapeHtml(ca.name)}</h4>
        </div>
      </div>
      <div class="comparison-vs">
        <span class="comparison-vs-badge">VS</span>
      </div>
      <div class="comparison-column">
        <div style="display: flex; align-items: center; gap: 12px; justify-content: center;">
          <img src="${cb.badgeUrls.small}" alt="badge" style="width: 32px; height: 32px; object-fit: contain;"/>
          <h4 style="font-size: 16px; color: var(--text-main); margin: 0;">${escapeHtml(cb.name)}</h4>
        </div>
      </div>
    </div>

    <!-- Stats Table side-by-side -->
    <div class="results-card mt-24">
      <h3>⚔️ Metric Comparison Metrics</h3>
      <div style="display: flex; flex-direction: column; margin-top: 16px;">
        ${renderCompareRow("Level", ca.clanLevel, cb.clanLevel)}
        ${renderCompareRow("Total Points", ca.clanPoints || 0, cb.clanPoints || 0)}
        ${renderCompareRow("Members Count", ca.members, cb.members)}
        ${renderCompareRow("War Wins", ca.warWins, cb.warWins)}
        ${renderCompareRow("War Win Rate", parseFloat(winRateA), parseFloat(winRateB), "%")}
        ${renderCompareRow("Streak", ca.warWinStreak || 0, cb.warWinStreak || 0)}
      </div>
    </div>

    <!-- Chart container -->
    <div class="comparison-chart-container">
      <h3>📈 Comparative Chart</h3>
      <div class="chart-container-responsive mt-16">
        <canvas id="comparisonChartCanvas"></canvas>
      </div>
    </div>
  `;

  initComparisonChart(ca, cb);
}

function renderCompareRow(label, valA, valB, suffix = '') {
  const classA = valA > valB ? 'comparison-winner' : valA < valB ? 'comparison-loser' : '';
  const classB = valB > valA ? 'comparison-winner' : valB < valA ? 'comparison-loser' : '';
  return `
    <div class="comparison-stat-row">
      <div style="flex: 1; text-align: left;"><strong class="${classA}">${valA.toLocaleString()}${suffix}</strong></div>
      <div class="comparison-stat-label" style="flex: 1.2; text-align: center;">${label}</div>
      <div style="flex: 1; text-align: right;"><strong class="${classB}">${valB.toLocaleString()}${suffix}</strong></div>
    </div>
  `;
}

function initComparisonChart(ca, cb) {
  loadChartJs().then(() => {
    const canvas = document.getElementById('comparisonChartCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    if (comparisonChart) comparisonChart.destroy();
    
    try {
      comparisonChart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: ['Trophies / 10', 'War Wins', 'Win Streak'],
          datasets: [
            {
              label: ca.name,
              data: [Math.floor((ca.clanPoints || 0)/10), ca.warWins || 0, ca.warWinStreak || 0],
              backgroundColor: 'rgba(245, 166, 35, 0.75)',
              borderColor: 'var(--clash-gold)',
              borderWidth: 1.5
            },
            {
              label: cb.name,
              data: [Math.floor((cb.clanPoints || 0)/10), cb.warWins || 0, cb.warWinStreak || 0],
              backgroundColor: 'rgba(139, 68, 253, 0.75)',
              borderColor: 'var(--clash-dark-elixir)',
              borderWidth: 1.5
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { labels: { color: '#a8a8a8', font: { family: 'Outfit', size: 10 } } }
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: { color: '#a8a8a8', font: { family: 'Outfit', size: 10 } }
            },
            y: {
              grid: { color: 'rgba(255, 255, 255, 0.05)' },
              ticks: { color: '#a8a8a8', font: { family: 'Outfit', size: 10 } }
            }
          }
        }
      });
    } catch(err) {
      canvas.parentElement.innerHTML = `<p class="text-muted">Chart rendering failed.</p>`;
    }
  }).catch(() => {});
}

// ===== GOLD PASS REWARDS =====
async function loadGoldPassRewards(goldpass) {
  const container = document.getElementById('goldpass-widget-container');
  if (!container) return;

  try {
    const rewards = goldpass.rewards || [];
    const currentPoints = 1850; // Mock current progress points
    const maxPoints = 2600;
    const progressPercent = Math.min(100, (currentPoints / maxPoints) * 100);

    container.innerHTML = `
      <div style="border-bottom: 1px solid var(--border-subtle); padding-bottom: 16px; margin-bottom: 16px;">
        <h3 class="gold-gradient-text" style="font-size: 20px; font-weight: 800; margin: 0;">🎟️ Gold Pass Season Rewards</h3>
        <span style="font-size: 12px; color: var(--text-muted);">Interactive Milestone track &bull; Current Progress: <strong>${currentPoints} / ${maxPoints} Points</strong></span>
      </div>

      <div style="position: relative; margin-top: 10px; padding: 20px 0 40px;">
        <!-- Track line background -->
        <div style="position: absolute; top: 44px; left: 0; right: 0; height: 6px; background: var(--bg-stone-medium); border-radius: 3px; z-index: 1;"></div>
        <!-- Progress fill -->
        <div style="position: absolute; top: 44px; left: 0; width: ${progressPercent}%; height: 6px; background: var(--clash-gold-gradient); border-radius: 3px; z-index: 2; transition: width 1.2s ease-in-out;"></div>

        <div style="display: flex; justify-content: space-between; position: relative; z-index: 3;">
          ${rewards.map(rew => {
            const isCompleted = currentPoints >= rew.points;
            const nodeClass = isCompleted ? 'milestone-node completed' : 'milestone-node';
            let icon = '🎁';
            if (rew.type === 'skin') icon = '👑';
            else if (rew.type === 'book') icon = '📖';
            else if (rew.type === 'rune') icon = '💎';

            return `
              <div style="display: flex; flex-direction: column; align-items: center; position: relative; width: 80px;">
                <div class="${nodeClass}" onclick="showGoldPassRewardInfo('${escapeHtml(rew.name)}', '${escapeHtml(rew.type)}', ${rew.points})" style="margin: 0 auto;">
                  <span style="font-size: 18px;">${icon}</span>
                </div>
                <span class="milestone-node-label" style="position: absolute; top: 58px; font-size: 11px; text-align: center; color: ${isCompleted ? 'var(--clash-gold)' : 'var(--text-muted)'}; font-weight: 700; width: 100px; white-space: normal; line-height: 1.2;">
                  ${escapeHtml(rew.name)}<br/>
                  <small style="font-size: 9px; opacity: 0.8;">${rew.points} pts</small>
                </span>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<p class="text-muted">Error loading Gold Pass: ${escapeHtml(err.message)}</p>`;
  }
}

function showGoldPassRewardInfo(name, type, points) {
  const desc = type === 'skin' 
    ? `Exclusive custom cosmetic theme to style your heroes with animated visuals.` 
    : type === 'book' 
    ? `Instantly completes any upgrade timers in the laboratory, barracks, or spell factory.` 
    : `Fills your resources instantly to maximum capacity.`;
  showToast(`🎁 Pass Unlock: ${name} (${points} Pts) - ${desc}`, 'info', 6000);
}

// 2. War Hub subnav controller
function setupWarHubSubnav() {
  const subnav = document.getElementById('war-hub-subnav');
  if (!subnav) return;
  
  subnav.querySelectorAll('.sub-nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      // Toggle active tab classes
      subnav.querySelectorAll('.sub-nav-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      // Toggle active subviews
      const targetSubtab = btn.getAttribute('data-subtab');
      document.querySelectorAll('.war-subview').forEach(view => {
        view.style.display = view.id === `war-subview-${targetSubtab}` ? 'flex' : 'none';
      });
    });
  });
}

// 3. CWL standings loader & renderer
async function loadCWLData(clanTag) {
  const container = document.getElementById('cwl-results-container');
  if (!container) return;
  
  container.innerHTML = getSkeletonHTML();
  
  try {
    const cwl = await fetchCocData(`/clans/${clanTag}/warleague/group`);
    if (!cwl || cwl.state === 'notInWar') {
      container.innerHTML = `
        <div class="placeholder-state" style="padding: 40px;">
          <i class="fas fa-trophy" style="font-size: 48px; color: var(--text-muted); margin-bottom: 12px;"></i>
          <p>This clan is currently not participating in Clan War Leagues.</p>
        </div>
      `;
      return;
    }
    
    container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 16px;">
        <div style="border-bottom: 1px solid var(--border-subtle); padding-bottom: 12px;">
          <h3 class="gold-gradient-text" style="font-size: 20px; font-weight: 800; margin: 0;">🛡️ Clan War League Standings</h3>
          <span style="font-size: 12px; color: var(--text-muted);">Season: ${cwl.season} &bull; League Tier: Champion I</span>
        </div>
        
        <table class="leaderboard-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Clan Name</th>
              <th>Clan Level</th>
            </tr>
          </thead>
          <tbody>
            ${cwl.clans.map((c, index) => `
              <tr style="${c.tag === clanTag ? 'background: rgba(245,166,35,0.05); font-weight: 700;' : ''}">
                <td><span class="rank-badge ${index < 3 ? `rank-${index + 1}` : ''}">${index + 1}</span></td>
                <td>
                  <div style="display: flex; align-items: center; gap: 10px;">
                    <img src="${c.badgeUrls.small}" alt="badge" style="width: 24px; height: 24px; object-fit: contain;"/>
                    <span style="color: var(--text-main); cursor: pointer;" data-action="load-clan" data-tag="${escapeHtml(c.tag)}">${escapeHtml(c.name)}</span>
                    ${c.tag === clanTag ? '<span class="badge-small" style="background: rgba(245,166,35,0.15); color: var(--clash-gold); font-size: 10px; margin-left: 8px;">HOME</span>' : ''}
                  </div>
                </td>
                <td style="color: var(--text-muted);">Level ${c.clanLevel}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <div style="margin-top: 16px;">
          <h4 style="font-size: 13px; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">CWL Tournament Rounds</h4>
          <div style="display: flex; gap: 12px; flex-wrap: wrap; margin-top: 8px;">
            ${cwl.rounds.map((round, rIndex) => `
              <div class="card-item" style="flex: 1; min-width: 140px; padding: 12px; text-align: center;">
                <strong style="color: var(--text-main); font-size: 13px;">Round ${rIndex + 1}</strong><br/>
                <small style="color: var(--text-muted);">${round.warTags.length} active match-ups</small>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `
      <div class="placeholder-state" style="padding: 40px;">
        <i class="fas fa-exclamation-triangle" style="font-size: 36px; color: var(--clash-elixir); margin-bottom: 12px;"></i>
        <p>Could not load Clan War Leagues: ${escapeHtml(err.message)}</p>
      </div>
    `;
  }
}

// 4. War History (War Logs)
async function loadWarHistoryData(clanTag) {
  const container = document.getElementById('war-history-results-container');
  if (!container) return;
  
  container.innerHTML = getSkeletonHTML();
  
  try {
    const logs = await fetchCocData(`/clans/${clanTag}/warlog`);
    if (!logs || !logs.items || logs.items.length === 0) {
      container.innerHTML = `
        <div class="placeholder-state" style="padding: 40px;">
          <i class="fas fa-folder-open" style="font-size: 48px; color: var(--text-muted); margin-bottom: 12px;"></i>
          <p>This clan's war log is private or has no records.</p>
        </div>
      `;
      return;
    }
    
    container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 16px;">
        <div style="border-bottom: 1px solid var(--border-subtle); padding-bottom: 12px;">
          <h3 class="gold-gradient-text" style="font-size: 20px; font-weight: 800; margin: 0;">📜 War Log History</h3>
          <span style="font-size: 12px; color: var(--text-muted);">Archived performance metrics for past combat campaigns</span>
        </div>
        
        <div class="war-log-list">
          ${logs.items.map(log => {
            const isWin = log.result === 'win';
            return `
              <div class="war-log-item ${isWin ? 'win' : 'lose'}">
                <div style="display: flex; align-items: center; gap: 16px;">
                  <img src="${log.opponent.badgeUrls.small}" alt="badge" style="width: 36px; height: 36px; object-fit: contain;"/>
                  <div>
                    <strong style="color: var(--text-main); font-size: 14px;">vs. ${escapeHtml(log.opponent.name)}</strong><br/>
                    <small style="color: var(--text-muted);">Opponent Level: ${log.opponent.clanLevel} &bull; End: ${new Date(log.endTime).toLocaleDateString()}</small>
                  </div>
                </div>
                
                <div style="display: flex; align-items: center; gap: 24px; text-align: right;">
                  <div>
                    <span style="font-size: 15px; font-weight: 800; color: var(--clash-gold);">⭐ ${log.clan.stars}</span>
                    <span style="color: var(--text-muted); font-size: 12px;"> vs ${log.opponentResult.stars}</span><br/>
                    <small style="color: var(--text-muted); font-size: 11px;">Destruction: ${log.clan.destructionPercentage}%</small>
                  </div>
                  <span class="war-log-badge-result">${log.result}</span>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `
      <div class="placeholder-state" style="padding: 40px;">
        <i class="fas fa-exclamation-triangle" style="font-size: 36px; color: var(--clash-elixir); margin-bottom: 12px;"></i>
        <p>Could not load War Log history: ${escapeHtml(err.message)}</p>
      </div>
    `;
  }
}

// 5. Leaderboard View initialization
function initLeaderboardsView() {
  const typeSelect = document.getElementById('leaderboard-type');
  const locSelect = document.getElementById('leaderboard-location');
  const fetchBtn = document.getElementById('fetch-leaderboard-btn');
  
  if (!typeSelect || !locSelect || !fetchBtn) return;
  
  loadLeaderboardLocations();
  
  fetchBtn.addEventListener('click', () => {
    const type = typeSelect.value;
    const locId = locSelect.value;
    fetchLeaderboardRankings(type, locId);
  });
}

// 6. Populate regions / locations
async function loadLeaderboardLocations() {
  const select = document.getElementById('leaderboard-location');
  if (!select) return;
  
  try {
    const locs = await fetchCocData('/locations');
    if (locs && locs.items) {
      // Sort locations: place International (32000006) and US (32000254) at the top of the list!
      const prioritized = [];
      const others = [];
      
      locs.items.forEach(l => {
        if (l.id === 32000006 || l.id === 32000254) {
          prioritized.push(l);
        } else {
          others.push(l);
        }
      });
      
      // Sort prioritized so International is first
      prioritized.sort((a, b) => a.id === 32000006 ? -1 : 1);
      
      const finalLocs = [...prioritized, ...others];
      
      select.innerHTML = finalLocs.map(l => `
        <option value="${l.id}" ${l.id === 32000006 ? 'selected' : ''}>${escapeHtml(l.name)} (${l.isCountry ? 'Country' : 'Global'})</option>
      `).join('');
      
      // Load International rankings initially as it is guaranteed to exist
      fetchLeaderboardRankings('clans', 32000006);
    }
  } catch (err) {
    select.innerHTML = `<option value="32000006" selected>International (Global)</option>`;
    fetchLeaderboardRankings('clans', 32000006);
  }
}

// 7. Load Leaderboard rankings
async function fetchLeaderboardRankings(type, locationId) {
  const container = document.getElementById('leaderboards-results-container');
  if (!container) return;
  
  container.innerHTML = getSkeletonHTML();
  
  let apiLocationId = locationId;
  if (state.mode === 'live' && String(apiLocationId) === '32000006') {
    apiLocationId = 'global';
  }
  
  try {
    const data = await fetchCocData(`/locations/${apiLocationId}/rankings/${type}`);
    if (!data || !data.items || data.items.length === 0) {
      container.innerHTML = `
        <div class="placeholder-state" style="padding: 40px;">
          <i class="fas fa-history" style="font-size: 48px; color: var(--text-muted); margin-bottom: 12px;"></i>
          <p>No leaderboard records found for this location.</p>
        </div>
      `;
      return;
    }
    
    const isClans = type === 'clans';
    container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 16px;">
        <div style="border-bottom: 1px solid var(--border-subtle); padding-bottom: 12px;">
          <h3 class="gold-gradient-text" style="font-size: 20px; font-weight: 800; margin: 0;">🌎 Top Rankings (${isClans ? 'Clans' : 'Players'})</h3>
          <span style="font-size: 12px; color: var(--text-muted);">Real-time leaderboards by competitive standing</span>
        </div>
        
        <table class="leaderboard-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Name</th>
              <th>${isClans ? 'Points / Trophies' : 'Trophies'}</th>
            </tr>
          </thead>
          <tbody>
            ${data.items.map((item, index) => {
              const rankVal = item.rank || (index + 1);
              const nameVal = escapeHtml(item.name || 'Unknown Clasher');
              const tagVal = escapeHtml(item.tag || '');
              const scoreVal = (item.clanPoints || item.trophies || 0).toLocaleString();
              
              let subtext = '';
              if (item.clan && item.clan.name) {
                subtext = `Clan: ${escapeHtml(item.clan.name)}`;
              } else {
                subtext = `Level ${item.expLevel || item.clanLevel || 0}`;
              }
              
              const badgeImg = item.badgeUrls && item.badgeUrls.small 
                ? `<img src="${item.badgeUrls.small}" alt="badge" style="width: 24px; height: 24px; object-fit: contain;"/>` 
                : '';
                
              const leagueImg = item.league && item.league.iconUrls && item.league.iconUrls.small
                ? `<img src="${item.league.iconUrls.small}" alt="league" style="width: 20px; height: 20px; object-fit: contain;"/>` 
                : '';

              return `
                <tr>
                  <td><span class="rank-badge ${index < 3 ? `rank-${index + 1}` : ''}">${rankVal}</span></td>
                  <td>
                    <div style="display: flex; align-items: center; gap: 10px;">
                      ${badgeImg}
                      ${leagueImg}
                      <div>
                        <strong style="color: var(--text-main); cursor: pointer;" data-action="${isClans ? 'load-clan' : 'load-player'}" data-tag="${tagVal}">${nameVal}</strong>
                        <span class="inspect-badge" data-action="${isClans ? 'load-clan' : 'load-player'}" data-tag="${tagVal}" style="margin-left: 8px;">Inspect</span><br/>
                        <small style="color: var(--text-muted); font-size: 11px;">${subtext}</small>
                      </div>
                    </div>
                  </td>
                  <td><strong style="color: var(--clash-gold);"><i class="fas fa-trophy"></i> ${scoreVal}</strong></td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `
      <div class="placeholder-state" style="padding: 40px;">
        <i class="fas fa-exclamation-triangle" style="font-size: 36px; color: var(--clash-elixir); margin-bottom: 12px;"></i>
        <p>Could not fetch Leaderboards: ${escapeHtml(err.message)}</p>
      </div>
    `;
  }
}

// 8. Capital Lookup form
function setupCapitalSearchForm() {
  const form = document.getElementById('capital-search-form');
  if (!form) return;
  
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const tag = document.getElementById('capital-clan-tag-input').value.trim().toUpperCase();
    loadCapitalRaids(tag);
  });
  
  // Set default capital lookups inside placeholders
  document.getElementById('capital-results-container').innerHTML = `
    <div class="placeholder-state">
      <i class="fas fa-fort-awesome" style="font-size: 48px; color: var(--clash-gold); opacity: 0.6; margin-bottom: 12px;"></i>
      <p style="font-size: 15px; color: var(--text-muted);">Enter a Clan Tag on the left to inspect Capital Hall layout & Raids.</p>
    </div>
  `;
}

// 9. Load Capital Districts and Raids
async function loadCapitalRaids(clanTag) {
  const container = document.getElementById('capital-results-container');
  if (!container) return;
  
  container.innerHTML = getSkeletonHTML();
  
  try {
    const clan = await fetchCocData(`/clans/${clanTag}`);
    const raids = await fetchCocData(`/clans/${clanTag}/capitalraidlog`);
    
    if (!clan || !clan.clanCapital) {
      container.innerHTML = `
        <div class="placeholder-state" style="padding: 40px;">
          <i class="fas fa-fort-awesome" style="font-size: 48px; color: var(--text-muted); margin-bottom: 12px;"></i>
          <p>Capital details are not available for this clan.</p>
        </div>
      `;
      return;
    }
    
    // Capital Districts rendering
    const districtsHtml = `
      <div style="margin-top: 16px;">
        <h4 style="font-size: 13px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px;">District Hal Level Layouts</h4>
        <div class="district-grid">
          ${(clan.clanCapital.districts || []).map(dist => `
            <div class="district-card">
              <span style="font-size: 14px; font-weight: 700; color: var(--text-main);">${escapeHtml(dist.name)}</span>
              <span class="level-tag" style="background: var(--clash-dark-elixir-gradient); color: #fff; width: max-content; font-size: 10px;">LVL ${dist.districtHallLevel}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
    
    // Raid History rendering
    let raidsHtml = `
      <div style="margin-top: 24px; border-top: 1px solid var(--border-subtle); padding-top: 24px;">
        <h4 style="font-size: 13px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px;">Raid Weekend Performance</h4>
      </div>
    `;
    
    if (raids && raids.items && raids.items.length > 0) {
      raidsHtml += `
        <div class="war-log-list" style="margin-top: 12px;">
          ${raids.items.map(log => `
            <div class="war-log-item" style="border-left: 4px solid var(--clash-gold);">
              <div style="display: flex; flex-direction: column; gap: 4px;">
                <strong style="color: var(--text-main); font-size: 14px;">Weekend Raid Event</strong>
                <small style="color: var(--text-muted);">Completed: ${new Date(log.startDate).toLocaleDateString()} - ${new Date(log.endDate).toLocaleDateString()}</small>
              </div>
              
              <div style="display: flex; gap: 32px; text-align: right;">
                <div>
                  <span style="font-weight: 800; color: var(--clash-gold); font-size: 15px;">🪙 ${log.totalLoot.toLocaleString()}</span><br/>
                  <small style="color: var(--text-muted); font-size: 11px;">Resources Gathered</small>
                </div>
                <div>
                  <span style="font-weight: 700; color: var(--text-main); font-size: 15px;">⚔️ ${log.attackCount}</span><br/>
                  <small style="color: var(--text-muted); font-size: 11px;">Attacks conducted</small>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
      `;
    } else {
      raidsHtml += `<p class="text-muted" style="font-size: 13px; margin-top: 12px;">No historical Raid Weekend logs are available.</p>`;
    }
    
    container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 16px;">
        <div style="display: flex; align-items: center; gap: 16px; border-bottom: 1px solid var(--border-subtle); padding-bottom: 16px;">
          <img src="${clan.badgeUrls.small}" alt="badge" style="width: 40px; height: 40px; object-fit: contain;"/>
          <div>
            <h3 class="gold-gradient-text" style="font-size: 20px; font-weight: 800; margin: 0;">🏰 Clan Capital command center</h3>
            <span style="font-size: 12px; color: var(--text-muted);">${escapeHtml(clan.name)} &bull; Hall Level: ${clan.clanCapital.capitalHallLevel}</span>
          </div>
        </div>
        
        ${districtsHtml}
        ${raidsHtml}
      </div>
    `;
  } catch (err) {
    container.innerHTML = `
      <div class="placeholder-state" style="padding: 40px;">
        <i class="fas fa-exclamation-triangle" style="font-size: 36px; color: var(--clash-elixir); margin-bottom: 12px;"></i>
        <p>Could not load Capital: ${escapeHtml(err.message)}</p>
      </div>
    `;
  }
}

// ===== FEATURE 1: CLAN SEARCH BY NAME =====
function toggleClanSearchMode(mode) {
  const tagForm = document.getElementById('clan-search-form');
  const nameForm = document.getElementById('clan-name-search-form');
  document.querySelectorAll('.search-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.searchMode === mode);
  });
  tagForm.style.display = mode === 'tag' ? 'flex' : 'none';
  nameForm.style.display = mode === 'name' ? 'flex' : 'none';
}
window.toggleClanSearchMode = toggleClanSearchMode; // expose globally

function setupClanNameSearch() {
  const form = document.getElementById('clan-name-search-form');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('clan-name-input').value.trim();
    const minMembers = document.getElementById('clan-min-members').value;
    await searchClansByName(name, minMembers);
  });
}

async function searchClansByName(name, minMembers) {
  const container = document.getElementById('clan-results-container');
  container.innerHTML = getSkeletonHTML();
  try {
    const encodedName = encodeURIComponent(name);
    const data = await fetchCocData(`/clans?name=${encodedName}&minMembers=${minMembers}&limit=10`);
    if (!data || !data.items || data.items.length === 0) {
      container.innerHTML = `
        <div class="placeholder-state">
          <i class="fas fa-search"></i>
          <p>No clans found matching "${escapeHtml(name)}"</p>
        </div>`;
      return;
    }
    renderClanSearchResults(data.items);
  } catch(err) {
    container.innerHTML = `
      <div class="placeholder-state">
        <i class="fas fa-times-circle"></i>
        <p>Error searching clans: ${escapeHtml(err.message)}</p>
      </div>`;
  }
}

function renderClanSearchResults(clans) {
  const container = document.getElementById('clan-results-container');
  container.innerHTML = `
    <div style="border-bottom: 1px solid var(--border-subtle); padding-bottom: 12px; margin-bottom: 16px;">
      <h3 class="gold-gradient-text" style="font-size: 20px; font-weight: 800; margin: 0;">🔍 Search Results</h3>
      <span style="font-size: 12px; color: var(--text-muted);">${clans.length} clans found</span>
    </div>
    <div class="clan-search-results-grid">
      ${clans.map(clan => `
        <div class="clan-search-result-card" data-action="load-clan" data-tag="${escapeHtml(clan.tag)}">
          <img src="${clan.badgeUrls.small}" alt="badge" style="width: 40px; height: 40px; object-fit: contain;"/>
          <div class="clan-search-result-info">
            <strong style="color: var(--text-main); font-size: 15px;">${escapeHtml(clan.name)}</strong>
            <div class="clan-search-result-stats">
              <span><i class="fas fa-trophy" style="color: var(--clash-gold); font-size: 11px;"></i> ${clan.clanPoints?.toLocaleString() || 0}</span>
              <span><i class="fas fa-users"></i> ${clan.members}/50</span>
              <span>LVL ${clan.clanLevel}</span>
              <span>${clan.warWins || 0} war wins</span>
            </div>
          </div>
          <span class="level-tag" style="font-size: 10px; padding: 2px 6px;">LVL ${clan.clanLevel}</span>
        </div>
      `).join('')}
    </div>
  `;
}

// ===== FEATURE 3: PLAYER COMPARE TOOL =====
function setupPlayerCompare() {
  const formA = document.getElementById('player-compare-a-form');
  const formB = document.getElementById('player-compare-b-form');
  
  if (formA) {
    formA.addEventListener('submit', async (e) => {
      e.preventDefault();
      const tag = document.getElementById('player-compare-a-input').value.trim().toUpperCase();
      await loadComparePlayer('a', tag);
    });
  }
  if (formB) {
    formB.addEventListener('submit', async (e) => {
      e.preventDefault();
      const tag = document.getElementById('player-compare-b-input').value.trim().toUpperCase();
      await loadComparePlayer('b', tag);
    });
  }
}

async function loadComparePlayer(col, tag) {
  const container = document.getElementById('player-compare-results-container');
  try {
    const player = await fetchCocData(`/players/${tag}`);
    state.comparePlayers[col] = player;
    showToast(`Player ${col.toUpperCase()} Loaded: ${player.name}`, "success");
    renderPlayerComparison();
  } catch(err) {
    showToast(`Error loading player: ${err.message}`, "error");
  }
}

function renderPlayerComparison() {
  const container = document.getElementById('player-compare-results-container');
  if (!container) return;

  const pa = state.comparePlayers.a;
  const pb = state.comparePlayers.b;

  if (!pa || !pb) {
    container.innerHTML = `
      <div class="placeholder-state">
        <i class="fas fa-exchange-alt" style="font-size: 48px; color: var(--clash-gold); opacity: 0.6; margin-bottom: 12px;"></i>
        <p style="font-size: 15px; color: var(--text-muted);">Please load two Players above to compare head-to-head.</p>
      </div>`;
    return;
  }

  container.innerHTML = `
    <div class="player-compare-layout mt-24">
      <div class="player-compare-column">
        <div style="display: flex; align-items: center; gap: 12px; justify-content: center;">
          <img src="${pa.league?.iconUrls?.small || ''}" alt="" style="width: 32px; height: 32px; object-fit: contain;"/>
          <strong style="font-size: 16px; color: var(--text-main);">${escapeHtml(pa.name)}</strong>
        </div>
        <div style="text-align: center; color: var(--text-muted); font-size: 12px;">${escapeHtml(pa.tag)}</div>
      </div>

      <div class="player-compare-vs">
        <span class="comparison-vs-badge">VS</span>
      </div>

      <div class="player-compare-column">
        <div style="display: flex; align-items: center; gap: 12px; justify-content: center;">
          <img src="${pb.league?.iconUrls?.small || ''}" alt="" style="width: 32px; height: 32px; object-fit: contain;"/>
          <strong style="font-size: 16px; color: var(--text-main);">${escapeHtml(pb.name)}</strong>
        </div>
        <div style="text-align: center; color: var(--text-muted); font-size: 12px;">${escapeHtml(pb.tag)}</div>
      </div>
    </div>

    <!-- Comparative stats list -->
    <div class="results-card mt-24">
      <h3>⚔️ Head-to-Head Attributes</h3>
      <div style="display: flex; flex-direction: column; margin-top: 16px;">
        ${renderCompareRow("Town Hall Level", pa.townHallLevel, pb.townHallLevel)}
        ${renderCompareRow("Experience Lvl", pa.expLevel, pb.expLevel)}
        ${renderCompareRow("Multiplayer Trophies", pa.trophies || 0, pb.trophies || 0)}
        ${renderCompareRow("Best Trophies", pa.bestTrophies || 0, pb.bestTrophies || 0)}
        ${renderCompareRow("War Stars Captured", pa.warStars || 0, pb.warStars || 0)}
        ${renderCompareRow("Hero Upgrades", (pa.heroes || []).length, (pb.heroes || []).length)}
        ${renderCompareRow("Donations Given", pa.donations || 0, pb.donations || 0)}
      </div>
    </div>
  `;
}

// ===== FEATURE 4: COMMUNITY BASE LAYOUTS GALLERY =====
function setupLayoutGallery() {
  const form = document.getElementById('layout-submit-form');
  if (!form) return;
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const link = document.getElementById('layout-link-input').value.trim();
    const th = parseInt(document.getElementById('layout-th-select').value);
    const type = document.getElementById('layout-type-select').value;
    const desc = document.getElementById('layout-desc-input').value.trim();
    
    if (!link.startsWith('https://link.clashofclans.com')) {
      showToast("Invalid Clash of Clans layout link.", "error");
      return;
    }

    const newLayout = {
      id: Date.now(),
      thLevel: th,
      type: type,
      description: desc,
      link: link,
      author: 'You',
      votes: 0,
      createdAt: new Date().toISOString()
    };

    state.layouts.unshift(newLayout);
    showToast("Community Layout added successfully!", "success");
    form.reset();
    renderLayoutGallery();
  });

  // Load initial mocks
  state.layouts = structuredClone(window.MOCK_DATA.layoutGallery || window.MOCK_LAYOUT_GALLERY || []);
  renderLayoutGallery();
}

function renderLayoutGallery() {
  const container = document.getElementById('layout-gallery-container');
  if (!container) return;

  const filtered = state.layouts.filter(l => {
    if (state.layoutFilterType === 'all') return true;
    return l.type === state.layoutFilterType;
  });

  container.innerHTML = `
    <div class="flex-between border-bottom-subtle pb-12 mb-16">
      <h3 class="gold-gradient-text" style="font-size: 20px; font-weight: 800; margin:0;">🛡️ Layout Gallery</h3>
      <span class="text-xs text-muted">${filtered.length} layouts listed</span>
    </div>

    <!-- Filter Tab Bar -->
    <div class="layout-filter-bar">
      <button class="layout-filter-btn ${state.layoutFilterType === 'all' ? 'active' : ''}" data-action="filter-layouts" data-filter="all">All</button>
      <button class="layout-filter-btn ${state.layoutFilterType === 'war' ? 'active' : ''}" data-action="filter-layouts" data-filter="war">War</button>
      <button class="layout-filter-btn ${state.layoutFilterType === 'home' ? 'active' : ''}" data-action="filter-layouts" data-filter="home">Home</button>
      <button class="layout-filter-btn ${state.layoutFilterType === 'cwl' ? 'active' : ''}" data-action="filter-layouts" data-filter="cwl">CWL</button>
    </div>

    <div class="layout-gallery-grid">
      ${filtered.map(l => {
        const hasVoted = state.votedLayouts.includes(l.id);
        return `
          <div class="layout-card">
            <div class="layout-card-header">
              <span class="layout-th-badge">TH ${l.thLevel}</span>
              <span class="layout-type-badge ${l.type}">${l.type}</span>
            </div>
            <p class="layout-card-desc">${escapeHtml(l.description)}</p>
            <div style="font-size: 12px; color: var(--text-muted);">Uploaded by <strong>${escapeHtml(l.author)}</strong></div>
            <div class="layout-card-meta">
              <button class="layout-vote-btn ${hasVoted ? 'voted' : ''}" data-action="vote-layout" data-id="${l.id}">
                <i class="fas fa-thumbs-up"></i> ${l.votes}
              </button>
              <button class="layout-copy-btn" data-action="copy-layout-link" data-link="${escapeHtml(l.link)}">
                <i class="fas fa-copy"></i> Copy Link
              </button>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function voteLayout(id) {
  if (state.votedLayouts.includes(id)) {
    // Unvote
    state.votedLayouts = state.votedLayouts.filter(vid => vid !== id);
    const item = state.layouts.find(l => l.id === id);
    if (item) item.votes = Math.max(0, item.votes - 1);
    showToast("Vote retracted", "info");
  } else {
    // Vote
    state.votedLayouts.push(id);
    const item = state.layouts.find(l => l.id === id);
    if (item) item.votes++;
    showToast("Layout upvoted!", "success");
  }
  localStorage.setItem('coc_voted_layouts', JSON.stringify(state.votedLayouts));
  renderLayoutGallery();
}

function copyLayoutLink(link) {
  navigator.clipboard.writeText(link).then(() => {
    showToast("Clash Layout link copied! Open Clash of Clans to load layout.", "success");
  }).catch(() => {
    showToast("Could not copy layout link.", "error");
  });
}

// ===== 🛡️ MODULE 2: INTERACTIVE DEFENSE SIMULATOR =====
state.placedDefenses = [];
let selectedDefenseType = 'eagle';
let selectedDefenseRange = 120;
let isDrawingPathMode = false;
let currentPathPoints = [];
let isDpsHeatmapActive = false;

function initBaseCanvas() {
  const container = document.getElementById('base-grid-container');
  if (!container) return;

  // Add click to place defense or draw path points
  container.addEventListener('mousedown', (e) => {
    // If clicking a delete button or placed structure, do not place
    if (e.target.closest('.placed-structure') || e.target.closest('.structure-delete')) return;

    const bounds = container.getBoundingClientRect();
    const x = ((e.clientX - bounds.left) / bounds.width) * 100;
    const y = ((e.clientY - bounds.top) / bounds.height) * 100;

    if (isDrawingPathMode) {
      currentPathPoints.push({ x: x.toFixed(2), y: y.toFixed(2) });
      renderStrategicPaths();
      if (typeof ClashSoundEngine !== 'undefined') ClashSoundEngine.playClick();
      return;
    }

    const newDefense = {
      id: Date.now(),
      type: selectedDefenseType,
      range: selectedDefenseRange,
      x: x.toFixed(2),
      y: y.toFixed(2)
    };

    state.placedDefenses.push(newDefense);
    renderPlacedDefenses();
    if (typeof ClashSoundEngine !== 'undefined') ClashSoundEngine.playClick();
    showToast(`Placed ${selectedDefenseType.toUpperCase()} on defensive grid!`, "success");
  });

  // Setup toolbar clicks
  const toolbar = document.querySelector('.canvas-toolbar');
  if (toolbar) {
    toolbar.querySelectorAll('.palette-btn').forEach(btn => {
      // Don't bind to Heatmap or Draw path triggers which have custom inline handlers
      if (btn.id === 'canvas-heatmap-toggle-btn' || btn.id === 'canvas-draw-path-btn') return;
      btn.addEventListener('click', () => {
        toolbar.querySelectorAll('.palette-btn').forEach(b => {
          if (b.id !== 'canvas-heatmap-toggle-btn' && b.id !== 'canvas-draw-path-btn') b.classList.remove('selected');
        });
        btn.classList.add('selected');
        selectedDefenseType = btn.getAttribute('data-defense');
        selectedDefenseRange = parseInt(btn.getAttribute('data-range'));
        
        // Turn off path drawing mode when selecting a new defense to place
        if (isDrawingPathMode) togglePathDrawing();
      });
    });
  }
}

function renderPlacedDefenses() {
  const container = document.getElementById('base-grid-container');
  if (!container) return;

  // Remove existing structures & ranges, but keep grid lines and SVG overlay
  container.querySelectorAll('.placed-structure, .range-circle').forEach(el => el.remove());

  // Render heatmap class toggle
  container.classList.toggle('dps-heatmap-active', isDpsHeatmapActive);

  state.placedDefenses.forEach(def => {
    let icon = '🛡️';
    if (def.type === 'eagle') icon = '🦅';
    else if (def.type === 'scatter') icon = '🎯';
    else if (def.type === 'monolith') icon = '💀';
    else if (def.type === 'inferno') icon = '🔥';
    else if (def.type === 'townhall') icon = '🏰';
    else if (def.type === 'tornado') icon = '🌪️';
    else if (def.type === 'giantbomb') icon = '💣';
    else if (def.type === 'airmine') icon = '👻';

    // Renders the structure
    const struct = document.createElement('div');
    struct.className = 'placed-structure';
    struct.style.left = `${def.x}%`;
    struct.style.top = `${def.y}%`;
    
    // Add custom coloring for traps
    if (def.type === 'tornado' || def.type === 'giantbomb' || def.type === 'airmine') {
      struct.style.background = 'var(--clash-dark-elixir-gradient)';
      struct.style.boxShadow = '0 0 10px rgba(139,68,253,0.5)';
    }

    struct.innerHTML = `
      ${icon}
      <button class="structure-delete" onclick="removeDefense(${def.id}, event)">&times;</button>
    `;

    // Render range circle
    const range = document.createElement('div');
    range.className = `range-circle ${def.type}`;
    range.style.left = `${def.x}%`;
    range.style.top = `${def.y}%`;
    range.style.width = `${def.range * 2}px`;
    range.style.height = `${def.range * 2}px`;
    
    // Trap ranges should look slightly different
    if (def.type === 'tornado' || def.type === 'giantbomb' || def.type === 'airmine') {
      range.style.border = '1px dotted #8b44fd';
      range.style.background = 'rgba(139, 68, 253, 0.03)';
    }

    if (isDpsHeatmapActive) {
      // Heatmap mode makes ranges look more intense and overlapping
      range.style.opacity = '0.5';
      range.style.background = 'rgba(236, 59, 131, 0.08)';
      range.style.borderColor = 'rgba(236, 59, 131, 0.6)';
    } else {
      range.style.opacity = '0.35';
    }

    // Add drag support
    setupDragDrop(struct, def);

    container.appendChild(range);
    container.appendChild(struct);
  });
}

function setupDragDrop(el, def) {
  let isDragging = false;
  let startX, startY;

  el.addEventListener('mousedown', (e) => {
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    e.stopPropagation();
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const container = document.getElementById('base-grid-container');
    const bounds = container.getBoundingClientRect();
    const x = ((e.clientX - bounds.left) / bounds.width) * 100;
    const y = ((e.clientY - bounds.top) / bounds.height) * 100;

    // Boundary check
    if (x >= 0 && x <= 100 && y >= 0 && y <= 100) {
      def.x = x.toFixed(2);
      def.y = y.toFixed(2);
      renderPlacedDefenses();
    }
  });

  document.addEventListener('mouseup', () => {
    if (isDragging && typeof ClashSoundEngine !== 'undefined') {
      ClashSoundEngine.playClick();
    }
    isDragging = false;
  });
}

function removeDefense(id, event) {
  if (event) event.stopPropagation();
  state.placedDefenses = state.placedDefenses.filter(def => def.id !== id);
  renderPlacedDefenses();
  if (typeof ClashSoundEngine !== 'undefined') ClashSoundEngine.playClick();
  showToast("Removed defense from grid", "info");
}

function clearBaseCanvas() {
  state.placedDefenses = [];
  currentPathPoints = [];
  renderPlacedDefenses();
  renderStrategicPaths();
  if (typeof ClashSoundEngine !== 'undefined') ClashSoundEngine.playHorn();
  showToast("Defensive grid cleared!", "info");
}

function toggleDPSHeatmap() {
  isDpsHeatmapActive = !isDpsHeatmapActive;
  const btn = document.getElementById('canvas-heatmap-toggle-btn');
  if (btn) {
    btn.textContent = isDpsHeatmapActive ? "Heatmap: ON" : "Heatmap: OFF";
    btn.style.background = isDpsHeatmapActive ? 'var(--clash-gold-gradient)' : 'rgba(245, 166, 35, 0.15)';
    btn.style.color = isDpsHeatmapActive ? '#000' : 'var(--clash-gold)';
  }
  renderPlacedDefenses();
  if (typeof ClashSoundEngine !== 'undefined') ClashSoundEngine.playClick();
}

function togglePathDrawing() {
  isDrawingPathMode = !isDrawingPathMode;
  const btn = document.getElementById('canvas-draw-path-btn');
  if (btn) {
    btn.textContent = isDrawingPathMode ? "Draw: ACTIVE" : "Draw Path";
    btn.style.background = isDrawingPathMode ? 'var(--clash-elixir-gradient)' : 'rgba(74, 144, 226, 0.15)';
    btn.style.color = isDrawingPathMode ? '#fff' : '#4a90e2';
  }
  if (typeof ClashSoundEngine !== 'undefined') ClashSoundEngine.playClick();
  showToast(isDrawingPathMode ? "Path drawing active! Tap coordinates on grid to draw arrows." : "Path drawing stopped.", "info");
}

function renderStrategicPaths() {
  const svg = document.getElementById('canvas-svg-overlay');
  if (!svg) return;
  
  svg.innerHTML = '';
  if (currentPathPoints.length < 2) return;

  // Render continuous lines
  let pathD = `M ${currentPathPoints[0].x}% ${currentPathPoints[0].y}%`;
  for (let i = 1; i < currentPathPoints.length; i++) {
    pathD += ` L ${currentPathPoints[i].x}% ${currentPathPoints[i].y}%`;
  }

  // Draw Path Line
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", pathD);
  path.setAttribute("stroke", "#4a90e2");
  path.setAttribute("stroke-width", "3");
  path.setAttribute("fill", "none");
  path.setAttribute("stroke-dasharray", "5,5");
  svg.appendChild(path);

  // Draw node chimes/circles
  currentPathPoints.forEach((pt, idx) => {
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", `${pt.x}%`);
    circle.setAttribute("cy", `${pt.y}%`);
    circle.setAttribute("r", "5");
    circle.setAttribute("fill", idx === currentPathPoints.length - 1 ? "#ec3b83" : "#4a90e2");
    svg.appendChild(circle);
  });
}

window.removeDefense = removeDefense;
window.clearBaseCanvas = clearBaseCanvas;
window.toggleDPSHeatmap = toggleDPSHeatmap;
window.togglePathDrawing = togglePathDrawing;

function saveCanvasPreset() {
  localStorage.setItem('coc_canvas_preset_defenses', JSON.stringify(state.placedDefenses));
  localStorage.setItem('coc_canvas_preset_paths', JSON.stringify(currentPathPoints));
  showToast("Defensive grid setup saved to local storage!", "success");
  if (typeof ClashSoundEngine !== 'undefined') ClashSoundEngine.playFanfare();
}

function loadCanvasPreset() {
  const savedDef = localStorage.getItem('coc_canvas_preset_defenses');
  const savedPath = localStorage.getItem('coc_canvas_preset_paths');
  if (savedDef) {
    state.placedDefenses = JSON.parse(savedDef);
    currentPathPoints = savedPath ? JSON.parse(savedPath) : [];
    renderPlacedDefenses();
    renderStrategicPaths();
    showToast("Defensive grid setup loaded successfully!", "success");
    if (typeof ClashSoundEngine !== 'undefined') ClashSoundEngine.playHorn();
  } else {
    showToast("No saved presets found in local storage.", "error");
  }
}

function exportCanvasJSON() {
  const data = {
    defenses: state.placedDefenses,
    paths: currentPathPoints
  };
  const jsonStr = JSON.stringify(data);
  navigator.clipboard.writeText(jsonStr).then(() => {
    showToast("Layout JSON copied to clipboard!", "success");
    if (typeof ClashSoundEngine !== 'undefined') ClashSoundEngine.playClick();
  }).catch(() => {
    showToast("Failed to copy layout JSON. Copy manually from console.", "error");
    console.log("Exported Layout JSON:", jsonStr);
  });
}

function importCanvasJSON() {
  const jsonStr = prompt("Paste your exported layout JSON code here:");
  if (!jsonStr) return;
  try {
    const data = JSON.parse(jsonStr);
    if (data.defenses && Array.isArray(data.defenses)) {
      state.placedDefenses = data.defenses;
      currentPathPoints = data.paths && Array.isArray(data.paths) ? data.paths : [];
      renderPlacedDefenses();
      renderStrategicPaths();
      showToast("Layout imported successfully!", "success");
      if (typeof ClashSoundEngine !== 'undefined') ClashSoundEngine.playHorn();
    } else {
      showToast("Invalid layout JSON format.", "error");
    }
  } catch (e) {
    showToast("Invalid JSON syntax. Load failed.", "error");
  }
}

window.saveCanvasPreset = saveCanvasPreset;
window.loadCanvasPreset = loadCanvasPreset;
window.exportCanvasJSON = exportCanvasJSON;
window.importCanvasJSON = importCanvasJSON;

// ===== ⚔️ MODULE 1: WAR ROOM STRATEGY =====
function initWarRoomPlanner() {
  // Load saved strategist notes
  const target1 = document.getElementById('strategy-target-1');
  const target2 = document.getElementById('strategy-target-2');
  if (target1) target1.value = localStorage.getItem('coc_strat_target1') || '';
  if (target2) target2.value = localStorage.getItem('coc_strat_target2') || '';

  // Setup range sliders for Win Odds Simulator
  const attackSlider = document.getElementById('sim-attack-strength');
  const defenseSlider = document.getElementById('sim-defense-strength');
  const attackVal = document.getElementById('sim-attack-val');
  const defenseVal = document.getElementById('sim-defense-val');

  if (attackSlider && defenseSlider) {
    const updateSim = () => {
      const atk = parseInt(attackSlider.value);
      const def = parseInt(defenseSlider.value);
      
      if (attackVal) attackVal.textContent = `${atk}% attacking capability`;
      if (defenseVal) defenseVal.textContent = `${def}% defensive upgrades`;

      // Simple game theory estimation logic
      const probability = Math.round((atk / (atk + def)) * 100);
      
      const probEl = document.getElementById('sim-win-probability');
      const verdictEl = document.getElementById('sim-verdict');

      if (probEl) {
        probEl.textContent = `${probability}%`;
        if (probability >= 60) {
          probEl.style.color = '#4adb86';
        } else if (probability >= 45) {
          probEl.style.color = 'var(--clash-gold)';
        } else {
          probEl.style.color = 'var(--clash-elixir)';
        }
      }

      if (verdictEl) {
        if (probability >= 65) {
          verdictEl.innerHTML = `🌟 <strong>Command Verdict: High Win Odds.</strong> Roster capabilities heavily surpass target layout level. Go for 3-star targets.`;
        } else if (probability >= 50) {
          verdictEl.innerHTML = `⚖️ <strong>Command Verdict: Tight Match.</strong> Defensive configurations match attacking level. Queen-walk tactics recommended.`;
        } else {
          verdictEl.innerHTML = `⚠️ <strong>Command Verdict: High Defeat Risk.</strong> Target base design is extremely heavily fortified. Focus on 2-star safety strategies.`;
        }
      }
    };

    attackSlider.addEventListener('input', updateSim);
    defenseSlider.addEventListener('input', updateSim);
    updateSim();
  }
}

function saveTacticalNotes() {
  const target1 = document.getElementById('strategy-target-1')?.value || '';
  const target2 = document.getElementById('strategy-target-2')?.value || '';

  localStorage.setItem('coc_strat_target1', target1);
  localStorage.setItem('coc_strat_target2', target2);
  
  showToast("Strategic war notes saved successfully!", "success");
}

window.saveTacticalNotes = saveTacticalNotes;

// ===== 🔍 MODULE 4: BOOKMARK RENAMING =====
function renameFavorite(index, event) {
  event.stopPropagation();
  const fav = state.favorites[index];
  const nickname = prompt(`Enter a custom nickname for ${fav.name}:`, fav.nickname || fav.name);
  if (nickname !== null) {
    fav.nickname = nickname.trim() || fav.name;
    localStorage.setItem('coc_favorites', JSON.stringify(state.favorites));
    renderFavorites();
  }
}
window.renameFavorite = renameFavorite;

// ===== 🛡️ MODULE 7: INTERACTIVE BATTLE MAP GRID NODES =====
function selectWarMapNode(team, mapPos) {
  const detailEl = document.getElementById('war-map-target-detail');
  if (!detailEl) return;

  const war = state.currentWar || window.MOCK_WARS["#2PP2PP2P"];
  if (!war) return;

  let member = null;
  let label = '';
  let attacksHtml = '';

  if (team === 'clan') {
    member = war.clan.members.find(m => m.mapPosition === mapPos) || { name: `Nova Defender #${mapPos}`, tag: `#CLAN_${mapPos}`, townhallLevel: 16 };
    label = `🔵 Target Base #${mapPos} (${war.clan.name})`;
    attacksHtml = `
      <div class="strategy-row-item">
        <div>
          <strong>Under attack by Opponent #${Math.floor(Math.random() * war.teamSize) + 1}</strong><br/>
          <small style="color: var(--text-muted);">Queen Charge Hybrid tactic</small>
        </div>
        <span style="color: var(--clash-gold); font-weight: 800;">★ 2 Stars (88% Destruction)</span>
      </div>
    `;
  } else {
    member = war.opponent.members.find(m => m.mapPosition === mapPos) || { name: `Opponent Base #${mapPos}`, tag: `#OPP_${mapPos}`, townhallLevel: 16 };
    label = `🔴 Target Base #${mapPos} (${war.opponent.name})`;
    
    // Find attacks by our clan
    const ourAttacks = [];
    war.clan.members.forEach(m => {
      if (m.attacks) {
        m.attacks.forEach(att => {
          if (att.defenderTag === member.tag) {
            ourAttacks.push({ attackerName: m.name, ...att });
          }
        });
      }
    });

    if (ourAttacks.length > 0) {
      attacksHtml = ourAttacks.map(att => `
        <div class="strategy-row-item">
          <div>
            <strong>Attacked by ${escapeHtml(att.attackerName)}</strong><br/>
            <small style="color: var(--text-muted);">Siegbarr Drag-rider smash strategy</small>
          </div>
          <span style="color: ${att.stars === 3 ? '#4adb86' : 'var(--clash-gold)'}; font-weight: 800;">★ ${att.stars} Stars (${att.destructionPercentage}%)</span>
        </div>
      `).join('');
    } else {
      attacksHtml = `
        <div style="color: var(--text-muted); font-size: 13px; font-style: italic; text-align: center; padding: 12px;">
          No attacks conducted on this base yet. Plan tactical strike in War Room!
        </div>
      `;
    }
  }

  detailEl.innerHTML = `
    <div class="target-detail-card" style="margin-top: 16px;">
      <div class="flex-between border-bottom-subtle pb-12" style="display:flex; justify-content:space-between; align-items:center;">
        <h4 style="font-size: 16px; font-weight: 800; color: var(--clash-gold); margin: 0;">${escapeHtml(label)}</h4>
        <span class="level-tag" style="font-size: 10px;">TH ${member.townhallLevel || 16}</span>
      </div>
      <div style="margin-top: 12px; display: flex; flex-direction: column; gap: 8px;">
        <div style="font-size: 13px; color: var(--text-muted);">Player Nickname: <strong style="color: var(--text-main);">${escapeHtml(member.name)}</strong> (${escapeHtml(member.tag)})</div>
        <div style="margin-top: 8px;">
          <h5 style="font-size: 12px; color: var(--text-muted); text-transform: uppercase; margin-bottom: 8px;">Combat Attack Log</h5>
          ${attacksHtml}
        </div>
      </div>
    </div>
  `;
  detailEl.style.display = 'block';
}
window.selectWarMapNode = selectWarMapNode;

// ===== 🛡️ MODULE 8: HERO EQUIPMENT SYNERGY ENGINE =====
function renderHeroEquipmentSynergies(player) {
  const equipment = player.heroEquipment || [];
  if (equipment.length === 0) return '';

  // Classify active gear sets
  const bkGear = equipment.filter(e => e.heroName === 'Barbarian King');
  const aqGear = equipment.filter(e => e.heroName === 'Archer Queen');

  let bkRecommendation = 'Standard equipment active.';
  if (bkGear.some(g => g.name === 'Giant Gauntlet') && bkGear.some(g => g.name === 'Vampstache')) {
    bkRecommendation = '❤️ <strong>Active Set: Giant Gauntlet + Vampstache</strong>. Unrivaled lane sustain. Allows your King to clear corners independently.';
  } else if (bkGear.some(g => g.name === 'Giant Gauntlet')) {
    bkRecommendation = '🔥 <strong>Active Set: Giant Gauntlet + Rage Vial</strong>. Highly optimized for massive splash damage and fast hero rage strikes.';
  }

  let aqRecommendation = 'Standard equipment active.';
  if (aqGear.some(g => g.name === 'Invisibility Vial') && aqGear.some(g => g.name === 'Healer Puppet')) {
    aqRecommendation = '🧚 <strong>Active Set: Invisibility Vial + Healer Puppet</strong>. Meta Queen Charge set. Self-sustains under heavy single-target defenses.';
  } else if (aqGear.some(g => g.name === 'Invisibility Vial')) {
    aqRecommendation = '🎯 <strong>Active Set: Invisibility Vial + Archer Puppet</strong>. Classic safety kit. Excellent for final damage bursts on core targets.';
  }

  return `
    <div class="synergy-recommend-card">
      <div class="flex-between pb-12 border-bottom-subtle" style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 16px;">
        <h3 class="gold-gradient-text" style="font-size: 18px; font-weight: 800; margin: 0;"><i class="fas fa-screwdriver-wrench"></i> Hero Gear Strategy & Ore Forge</h3>
        <button class="primary-btn" onclick="openOreForgeModal('${escapeHtml(player.tag)}')" style="padding: 6px 14px; font-size: 12px; font-weight: bold; border-radius: 8px; box-shadow: none;">
          <i class="fas fa-hammer" style="margin-right: 6px;"></i> Ore Forge Sandbox
        </button>
      </div>
      
      <div style="display: flex; flex-direction: column; gap: 16px;">
        <!-- Barbarian King -->
        <div class="card-item" style="background: rgba(0,0,0,0.2);">
          <div class="flex-between" style="display:flex; justify-content:space-between; align-items:center;">
            <strong>Barbarian King Synergy Strategy</strong>
            <span class="synergy-gear-tag active-set">META DETECTED</span>
          </div>
          <p style="font-size: 13px; color: var(--text-muted); margin-top: 8px; line-height: 1.5;">${bkRecommendation}</p>
        </div>

        <!-- Archer Queen -->
        <div class="card-item" style="background: rgba(0,0,0,0.2);">
          <div class="flex-between" style="display:flex; justify-content:space-between; align-items:center;">
            <strong>Archer Queen Synergy Strategy</strong>
            <span class="synergy-gear-tag active-set">META DETECTED</span>
          </div>
          <p style="font-size: 13px; color: var(--text-muted); margin-top: 8px; line-height: 1.5;">${aqRecommendation}</p>
        </div>
      </div>
    </div>
  `;
}

// ===== 🔊 PROGRAMMATIC GAME-AUDIO SYNTHESIS SYSTEM =====
const ClashSoundEngine = {
  ctx: null,
  enabled: false,
  init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    
    // Read state from localStorage
    const savedSound = localStorage.getItem('coc_sound_enabled');
    this.enabled = savedSound === 'true';
    const btn = document.getElementById('sound-toggle-btn');
    if (btn) {
      btn.classList.toggle('sound-on', this.enabled);
      btn.querySelector('span').textContent = this.enabled ? "SFX: ON" : "SFX: OFF";
    }
  },
  toggle() {
    if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.enabled = !this.enabled;
    localStorage.setItem('coc_sound_enabled', this.enabled);
    
    const btn = document.getElementById('sound-toggle-btn');
    if (btn) {
      btn.classList.toggle('sound-on', this.enabled);
      btn.querySelector('span').textContent = this.enabled ? "SFX: ON" : "SFX: OFF";
    }
    
    if (this.enabled) {
      this.playFanfare();
      showToast("Sound effects enabled!", "success");
    } else {
      showToast("Sound effects muted.", "info");
    }
    return this.enabled;
  },
  playClick() {
    if (!this.enabled) return;
    try {
      const ctx = this.ctx;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.frequency.setValueAtTime(750, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } catch (e) {
      console.warn("Audio Context blocked or not initialized yet.");
    }
  },
  playHorn() {
    if (!this.enabled) return;
    try {
      const ctx = this.ctx;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      
      osc1.type = 'sawtooth';
      osc2.type = 'sawtooth';
      osc1.frequency.setValueAtTime(130, ctx.currentTime);
      osc2.frequency.setValueAtTime(132, ctx.currentTime);
      
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(220, ctx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(750, ctx.currentTime + 0.15);
      filter.frequency.linearRampToValueAtTime(120, ctx.currentTime + 0.4);
      
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.45);
      
      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      
      osc1.start();
      osc2.start();
      osc1.stop(ctx.currentTime + 0.45);
      osc2.stop(ctx.currentTime + 0.45);
    } catch (e) {}
  },
  playFanfare() {
    if (!this.enabled) return;
    try {
      const ctx = this.ctx;
      const notes = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.08);
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.04, ctx.currentTime + idx * 0.08 + 0.01);
        gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + idx * 0.08 + 0.3);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + idx * 0.08);
        osc.stop(ctx.currentTime + idx * 0.08 + 0.3);
      });
    } catch (e) {}
  },
  playHammer() {
    if (!this.enabled) return;
    try {
      const ctx = this.ctx;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(10, ctx.currentTime + 0.2);
      
      filter.type = 'peaking';
      filter.frequency.setValueAtTime(1000, ctx.currentTime);
      
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } catch (e) {}
  }
};

function toggleDashboardSound() {
  ClashSoundEngine.toggle();
}

// ===== 🏰 PROGRESSION RUSH ANALYZER =====
function calculateProgressionRush(player) {
  const th = player.townHallLevel || 9;
  
  // Define maximum levels for heroes at specific Town Hall steps
  const maxHeroLevels = {
    16: { bk: 95, aq: 95, gw: 70, rc: 45 },
    15: { bk: 90, aq: 90, gw: 65, rc: 40 },
    14: { bk: 80, aq: 80, gw: 55, rc: 30 },
    13: { bk: 75, aq: 75, gw: 50, rc: 25 },
    12: { bk: 65, aq: 65, gw: 40, rc: 0 },
    11: { bk: 50, aq: 50, gw: 20, rc: 0 },
    10: { bk: 40, aq: 40, gw: 0, rc: 0 },
    9: { bk: 30, aq: 30, gw: 0, rc: 0 }
  };

  const limits = maxHeroLevels[th] || maxHeroLevels[9];
  
  let currentTotal = 0;
  let maxTotal = 0;
  
  (player.heroes || []).forEach(h => {
    let cap = 30;
    if (h.name.includes("King")) cap = limits.bk;
    else if (h.name.includes("Queen")) cap = limits.aq;
    else if (h.name.includes("Warden")) cap = limits.gw;
    else if (h.name.includes("Champion")) cap = limits.rc;
    
    if (cap > 0) {
      currentTotal += h.level;
      maxTotal += cap;
    }
  });

  const heroPercent = maxTotal > 0 ? Math.round((currentTotal / maxTotal) * 100) : 80;
  
  // Estimate lab levels
  const labPercent = player.troops && player.troops.length > 0 ? Math.round((player.troops.filter(t => t.level === t.maxLevel).length / player.troops.length) * 100) : 75;
  
  // Calculate average rush index
  const progressPercent = Math.round((heroPercent + labPercent) / 2);
  const isRushed = progressPercent < 70;
  
  // Calculate resources and time remaining estimates
  const missingHeros = maxTotal - currentTotal;
  const simulatedGold = isRushed ? "450M" : "45M";
  const simulatedElixir = isRushed ? "320M" : "32M";
  const simulatedDarkElixir = (missingHeros * 8500).toLocaleString() + " DE";
  const simulatedBuilderDays = Math.max(0, missingHeros * 3 + (100 - labPercent) * 2);

  return {
    percentage: progressPercent,
    heroPercent,
    labPercent,
    gold: simulatedGold,
    elixir: simulatedElixir,
    darkElixir: simulatedDarkElixir,
    days: simulatedBuilderDays,
    status: isRushed ? "RUSHED BASE" : "MAX PROGRESSING"
  };
}

function renderProgressionAudit(player) {
  const audit = calculateProgressionRush(player);
  
  const statusColor = audit.percentage >= 80 ? "#4adb86" : audit.percentage >= 65 ? "var(--clash-gold)" : "var(--clash-elixir)";
  const statusGlow = audit.percentage >= 80 ? "rgba(74, 219, 134, 0.3)" : audit.percentage >= 65 ? "rgba(245, 166, 35, 0.3)" : "rgba(236, 59, 131, 0.3)";

  return `
    <div class="progression-audit-card">
      <div style="border-bottom: 1px solid var(--border-subtle); padding-bottom: 12px; margin-bottom: 16px;">
        <h3 class="gold-gradient-text" style="font-size: 18px; font-weight: 800; margin: 0;"><i class="fas fa-chart-line"></i> Village Progression & Rush Auditor</h3>
        <span style="font-size: 11px; color: var(--text-muted);">Real-time upgrade audit compared to Town Hall ${player.townHallLevel} caps</span>
      </div>

      <div class="gauge-wrapper">
        <div class="radial-gauge" style="--gauge-percent: ${audit.percentage}%; --gauge-color: ${statusColor}; --gauge-glow: ${statusGlow};">
          <div class="radial-gauge-text">${audit.percentage}%</div>
        </div>
        
        <div style="flex: 1; display: flex; flex-direction: column; gap: 6px;">
          <div style="font-size: 16px; font-weight: 800; color: ${statusColor}">${audit.status}</div>
          <p style="font-size: 13px; color: var(--text-muted); line-height: 1.5;">
            This clashing village has completed <strong>${audit.percentage}%</strong> of all offense targets. 
            Estimated upgrade remaining budget demands:
          </p>
          
          <div style="display: flex; gap: 12px; flex-wrap: wrap; margin-top: 8px;">
            <span class="badge-small" style="background: rgba(245, 166, 35, 0.1); color: var(--clash-gold); font-size: 11px;">🟡 ${audit.gold} Gold</span>
            <span class="badge-small" style="background: rgba(236, 59, 131, 0.1); color: var(--clash-elixir); font-size: 11px;">🟣 ${audit.elixir} Elixir</span>
            <span class="badge-small" style="background: rgba(139, 68, 253, 0.1); color: var(--clash-dark-elixir); font-size: 11px;">🟪 ${audit.darkElixir}</span>
            <span class="badge-small" style="background: rgba(255,255,255,0.06); color: #fff; font-size: 11px;">⏳ ${audit.days} Builder Days</span>
          </div>
        </div>
      </div>

      <div class="progression-bars-grid">
        <div class="progression-bar-row">
          <div class="flex-between" style="font-size: 12px; font-weight: bold;">
            <span>Hero Progression Cap</span>
            <span style="color: var(--clash-gold);">${audit.heroPercent}%</span>
          </div>
          <div class="progression-bar-fill-container">
            <div class="progression-bar-fill" style="width: ${audit.heroPercent}%; --fill-color: var(--clash-gold-gradient);"></div>
          </div>
        </div>

        <div class="progression-bar-row">
          <div class="flex-between" style="font-size: 12px; font-weight: bold;">
            <span>Lab Research (Max Tech)</span>
            <span style="color: var(--clash-elixir);">${audit.labPercent}%</span>
          </div>
          <div class="progression-bar-fill-container">
            <div class="progression-bar-fill" style="width: ${audit.labPercent}%; --fill-color: var(--clash-elixir-gradient);"></div>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ===== 🦸 HERO ORE FORGE SANDBOX ENGINE =====
let activeForgeGear = null;
let currentSimulatedForgeLevel = 1;

function openOreForgeModal(playerTag) {
  const modal = document.getElementById('ore-forge-modal');
  if (!modal) return;

  const player = window.MOCK_PLAYERS[playerTag] || Object.values(window.MOCK_PLAYERS)[0];
  state.currentForgePlayer = player;
  
  renderForgeEquipment(player);
  modal.showModal();
  if (typeof ClashSoundEngine !== 'undefined') ClashSoundEngine.playFanfare();
}

function closeOreForgeModal() {
  const modal = document.getElementById('ore-forge-modal');
  if (modal) modal.close();
  if (typeof ClashSoundEngine !== 'undefined') ClashSoundEngine.playClick();
}

// Global state values for Expanded Hero Loadout Builder
state.forgeSelectedHero = "Barbarian King";
state.forgeSlot1Gear = null;
state.forgeSlot2Gear = null;
state.activeForgeSlot = 1;
state.forgeSlot1SimLevel = 1;
state.forgeSlot2SimLevel = 1;

// Define default gears if not present in player profile (e.g., Royal Champion)
const DEFAULT_RC_GEARS = [
  { name: "Royal Gem", level: 15, maxLevel: 18, village: "home", heroName: "Royal Champion" },
  { name: "Seeking Shield", level: 15, maxLevel: 18, village: "home", heroName: "Royal Champion" },
  { name: "Haste Vial", level: 12, maxLevel: 18, village: "home", heroName: "Royal Champion" }
];

function renderForgeEquipment(player) {
  const container = document.getElementById('forge-equipment-grid-container');
  if (!container) return;

  // Render Hero Tabs + Slotted Gears + Gear Palette
  const heroesList = ["Barbarian King", "Archer Queen", "Grand Warden", "Royal Champion"];
  
  // Consolidate player equipment list
  let allEquipment = [...(player.heroEquipment || [])];
  
  // Add RC gears if empty or not fully represented
  if (!allEquipment.some(eq => eq.heroName === "Royal Champion")) {
    allEquipment = allEquipment.concat(DEFAULT_RC_GEARS);
  }

  // Filter gears by active hero
  const heroGears = allEquipment.filter(eq => eq.heroName === state.forgeSelectedHero);

  // Auto-slot first two items if not set or if hero changed
  const firstGear = heroGears[0] || null;
  const secondGear = heroGears[1] || null;
  
  if (!state.forgeSlot1Gear || state.forgeSlot1Gear.heroName !== state.forgeSelectedHero) {
    state.forgeSlot1Gear = firstGear;
    state.forgeSlot1SimLevel = firstGear ? firstGear.level : 1;
  }
  if (!state.forgeSlot2Gear || state.forgeSlot2Gear.heroName !== state.forgeSelectedHero) {
    state.forgeSlot2Gear = secondGear;
    state.forgeSlot2SimLevel = secondGear ? secondGear.level : 1;
  }

  // Render container layout
  container.style.display = "flex";
  container.style.flexDirection = "column";
  container.style.gap = "16px";
  container.style.maxHeight = "none";
  container.style.overflow = "visible";

  container.innerHTML = `
    <!-- Hero Selection Tabs -->
    <div style="display: flex; gap: 6px; flex-wrap: wrap; border-bottom: 1px solid var(--border-subtle); padding-bottom: 12px;">
      ${heroesList.map(hero => `
        <button class="primary-btn" onclick="selectForgeHero('${escapeHtml(hero)}')" style="padding: 6px 12px; font-size: 11px; font-weight: bold; background: ${state.forgeSelectedHero === hero ? 'var(--clash-gold-gradient)' : 'rgba(255,255,255,0.03)'}; color: ${state.forgeSelectedHero === hero ? '#000' : 'var(--text-muted)'}; border-color: ${state.forgeSelectedHero === hero ? '#ffe066' : 'var(--border-subtle)'}; box-shadow: none;">
          ${escapeHtml(hero)}
        </button>
      `).join('')}
    </div>

    <!-- Active Slotted Gears Row -->
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
      <div class="forge-equipment-card ${state.activeForgeSlot === 1 ? 'selected' : ''}" onclick="toggleActiveForgeSlot(1)" style="border-style: ${state.activeForgeSlot === 1 ? 'solid' : 'dashed'}; border-color: ${state.activeForgeSlot === 1 ? 'var(--clash-gold)' : 'var(--border-subtle)'}; min-height: 85px;">
        <span style="font-size: 9px; text-transform: uppercase; color: var(--text-muted); position: absolute; top: 4px; left: 8px;">Active Slot 1</span>
        ${state.forgeSlot1Gear ? `
          <div class="forge-level-pill" style="top: 4px; right: 4px;">LVL ${state.forgeSlot1SimLevel}</div>
          <div style="font-size: 20px; margin-top: 14px;">🗡️</div>
          <div style="font-size: 12px; font-weight: bold; margin-top: 4px;">${escapeHtml(state.forgeSlot1Gear.name)}</div>
        ` : `
          <div style="color: var(--text-muted); font-size: 11px; margin-top: 24px;">Empty Slot</div>
        `}
      </div>
      <div class="forge-equipment-card ${state.activeForgeSlot === 2 ? 'selected' : ''}" onclick="toggleActiveForgeSlot(2)" style="border-style: ${state.activeForgeSlot === 2 ? 'solid' : 'dashed'}; border-color: ${state.activeForgeSlot === 2 ? 'var(--clash-gold)' : 'var(--border-subtle)'}; min-height: 85px;">
        <span style="font-size: 9px; text-transform: uppercase; color: var(--text-muted); position: absolute; top: 4px; left: 8px;">Active Slot 2</span>
        ${state.forgeSlot2Gear ? `
          <div class="forge-level-pill" style="top: 4px; right: 4px;">LVL ${state.forgeSlot2SimLevel}</div>
          <div style="font-size: 20px; margin-top: 14px;">⚡</div>
          <div style="font-size: 12px; font-weight: bold; margin-top: 4px;">${escapeHtml(state.forgeSlot2Gear.name)}</div>
        ` : `
          <div style="color: var(--text-muted); font-size: 11px; margin-top: 24px;">Empty Slot</div>
        `}
      </div>
    </div>

    <!-- Available Gear Palette -->
    <div>
      <h5 style="font-size: 11px; color: var(--text-muted); text-transform: uppercase; margin-bottom: 8px;">Slotted Gear Inventory</h5>
      <div class="forge-equipment-grid" style="grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));">
        ${heroGears.map(eq => {
          const isSlotted = (state.forgeSlot1Gear && state.forgeSlot1Gear.name === eq.name) || (state.forgeSlot2Gear && state.forgeSlot2Gear.name === eq.name);
          return `
            <div class="forge-equipment-card" onclick="slotForgeGear('${escapeHtml(eq.name)}')" style="opacity: ${isSlotted ? 0.4 : 1}; pointer-events: ${isSlotted ? 'none' : 'auto'}; border-color: var(--border-subtle);">
              <div class="forge-level-pill">LVL ${eq.level}</div>
              <div style="font-size: 24px; margin-bottom: 4px;">🛡️</div>
              <div style="font-size: 11px; font-weight: 700; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${escapeHtml(eq.name)}</div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;

  updateForgeControlPanel();
}

function selectForgeHero(hero) {
  state.forgeSelectedHero = hero;
  state.forgeSlot1Gear = null;
  state.forgeSlot2Gear = null;
  state.activeForgeSlot = 1;
  const player = state.currentForgePlayer;
  renderForgeEquipment(player);
  if (typeof ClashSoundEngine !== 'undefined') ClashSoundEngine.playClick();
}

function toggleActiveForgeSlot(slotNum) {
  state.activeForgeSlot = slotNum;
  const player = state.currentForgePlayer;
  renderForgeEquipment(player);
  if (typeof ClashSoundEngine !== 'undefined') ClashSoundEngine.playClick();
}

function slotForgeGear(gearName) {
  const player = state.currentForgePlayer;
  if (!player) return;

  let allEquipment = [...(player.heroEquipment || [])];
  if (!allEquipment.some(eq => eq.heroName === "Royal Champion")) {
    allEquipment = allEquipment.concat(DEFAULT_RC_GEARS);
  }

  const eq = allEquipment.find(e => e.name === gearName && e.heroName === state.forgeSelectedHero);
  if (!eq) return;

  if (state.activeForgeSlot === 1) {
    // Swap/Ensure no duplicate slotted
    if (state.forgeSlot2Gear && state.forgeSlot2Gear.name === eq.name) {
      state.forgeSlot2Gear = null;
    }
    state.forgeSlot1Gear = eq;
    state.forgeSlot1SimLevel = eq.level;
    state.activeForgeSlot = 2; // Auto-focus next slot
  } else {
    if (state.forgeSlot1Gear && state.forgeSlot1Gear.name === eq.name) {
      state.forgeSlot1Gear = null;
    }
    state.forgeSlot2Gear = eq;
    state.forgeSlot2SimLevel = eq.level;
    state.activeForgeSlot = 1; // Auto-focus first slot
  }

  renderForgeEquipment(player);
  if (typeof ClashSoundEngine !== 'undefined') ClashSoundEngine.playClick();
}

function updateForgeControlPanel() {
  const panel = document.getElementById('forge-control-panel-container');
  if (!panel) return;

  // Cumulative Ore Costs
  let totalShiny = 0;
  let totalGlowy = 0;
  let totalStarry = 0;

  // Combined stats
  let totalDpsGained = 0;
  let totalHpGained = 0;

  const calculateGearOres = (gear, targetLvl) => {
    if (!gear) return { s: 0, g: 0, st: 0 };
    const isEpic = gear.name === "Giant Gauntlet" || gear.name === "Frozen Arrow";
    const maxLvl = isEpic ? 27 : 18;
    const diff = targetLvl - gear.level;
    if (diff <= 0) return { s: 0, g: 0, st: 0 };

    const baseShiny = isEpic ? 240 : 120;
    const baseGlowy = isEpic ? 30 : 15;
    const baseStarry = isEpic ? 6 : 0;

    return {
      s: (diff + 1) * baseShiny,
      g: (diff + 1) * baseGlowy,
      st: (diff + 1) * baseStarry
    };
  };

  const getStats = (gear, lvl) => {
    if (!gear) return { dps: 0, hp: 0 };
    return {
      dps: 4 * lvl,
      hp: 12 * lvl
    };
  };

  const o1 = calculateGearOres(state.forgeSlot1Gear, state.forgeSlot1SimLevel);
  const o2 = calculateGearOres(state.forgeSlot2Gear, state.forgeSlot2SimLevel);

  totalShiny = o1.s + o2.s;
  totalGlowy = o1.g + o2.g;
  totalStarry = o1.st + o2.st;

  const s1 = getStats(state.forgeSlot1Gear, state.forgeSlot1SimLevel);
  const s2 = getStats(state.forgeSlot2Gear, state.forgeSlot2SimLevel);

  totalDpsGained = s1.dps + s2.dps;
  totalHpGained = s1.hp + s2.hp;

  const epic1 = state.forgeSlot1Gear && (state.forgeSlot1Gear.name === "Giant Gauntlet" || state.forgeSlot1Gear.name === "Frozen Arrow");
  const epic2 = state.forgeSlot2Gear && (state.forgeSlot2Gear.name === "Giant Gauntlet" || state.forgeSlot2Gear.name === "Frozen Arrow");

  panel.innerHTML = `
    <div>
      <h4 class="gold-gradient-text" style="font-size: 16px; font-weight: 800; margin: 0;">🛠️ Loadout Upgrade Simulator</h4>
      <span style="font-size: 11px; color: var(--text-muted);">${state.forgeSelectedHero} &bull; Synergy Optimizer</span>
    </div>

    <!-- Slotted 1 controls -->
    ${state.forgeSlot1Gear ? `
      <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border-subtle); padding: 10px; border-radius: 8px;">
        <div class="flex-between" style="font-size: 12px; margin-bottom: 6px;">
          <strong>Slot 1: ${escapeHtml(state.forgeSlot1Gear.name)}</strong>
          <span style="font-size: 10px; color: var(--text-muted);">Max Level: ${epic1 ? 27 : 18}</span>
        </div>
        <div class="level-spinner-row" style="padding: 4px 10px;">
          <button class="level-spinner-btn" style="width:24px; height:24px;" onclick="adjustLoadoutLevel(1, -1)">&minus;</button>
          <div style="font-size: 13px; font-weight: bold;">LVL ${state.forgeSlot1SimLevel}</div>
          <button class="level-spinner-btn" style="width:24px; height:24px;" onclick="adjustLoadoutLevel(1, 1)">&plus;</button>
        </div>
      </div>
    ` : ''}

    <!-- Slotted 2 controls -->
    ${state.forgeSlot2Gear ? `
      <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border-subtle); padding: 10px; border-radius: 8px;">
        <div class="flex-between" style="font-size: 12px; margin-bottom: 6px;">
          <strong>Slot 2: ${escapeHtml(state.forgeSlot2Gear.name)}</strong>
          <span style="font-size: 10px; color: var(--text-muted);">Max Level: ${epic2 ? 27 : 18}</span>
        </div>
        <div class="level-spinner-row" style="padding: 4px 10px;">
          <button class="level-spinner-btn" style="width:24px; height:24px;" onclick="adjustLoadoutLevel(2, -1)">&minus;</button>
          <div style="font-size: 13px; font-weight: bold;">LVL ${state.forgeSlot2SimLevel}</div>
          <button class="level-spinner-btn" style="width:24px; height:24px;" onclick="adjustLoadoutLevel(2, 1)">&plus;</button>
        </div>
      </div>
    ` : ''}

    <div>
      <h5 style="font-size: 11px; color: var(--text-muted); margin-bottom: 8px; text-transform: uppercase;">Aggregated Cost Tracker</h5>
      <div class="ore-cost-badge-row">
        <div class="ore-cost-badge" style="padding: 6px 4px;">
          <i class="fas fa-star" style="color: #4a90e2; font-size: 14px;"></i>
          <div style="font-size:12px;">${totalShiny}</div>
          <span style="font-size:9px;">Shiny</span>
        </div>
        <div class="ore-cost-badge" style="padding: 6px 4px;">
          <i class="fas fa-star" style="color: #ec3b83; font-size: 14px;"></i>
          <div style="font-size:12px;">${totalGlowy}</div>
          <span style="font-size:9px;">Glowy</span>
        </div>
        <div class="ore-cost-badge" style="padding: 6px 4px;">
          <i class="fas fa-star" style="color: var(--clash-gold); font-size: 14px;"></i>
          <div style="font-size:12px;">${totalStarry}</div>
          <span style="font-size:9px;">Starry</span>
        </div>
      </div>
    </div>

    <div style="background: rgba(0,0,0,0.2); border: 1px solid var(--border-subtle); border-radius: 10px; padding: 12px;">
      <h5 style="font-size: 11px; color: var(--text-muted); text-transform: uppercase; margin-bottom: 8px;">Synergy Loadout Stats</h5>
      <div class="flex-between border-bottom-subtle pb-6" style="font-size: 12px; margin-bottom: 6px;">
        <span>Total Passive DPS Boost</span>
        <strong style="color: #4adb86;">+${totalDpsGained}% DPS</strong>
      </div>
      <div class="flex-between" style="font-size: 12px;">
        <span>Total HP Recovery Boost</span>
        <strong style="color: #4adb86;">+${totalHpGained} HP</strong>
      </div>
    </div>
  `;
}

function adjustLoadoutLevel(slot, delta) {
  if (slot === 1 && state.forgeSlot1Gear) {
    const isEpic = state.forgeSlot1Gear.name === "Giant Gauntlet" || state.forgeSlot1Gear.name === "Frozen Arrow";
    const maxLvl = isEpic ? 27 : 18;
    const target = state.forgeSlot1SimLevel + delta;
    if (target >= state.forgeSlot1Gear.level && target <= maxLvl) {
      state.forgeSlot1SimLevel = target;
    }
  } else if (slot === 2 && state.forgeSlot2Gear) {
    const isEpic = state.forgeSlot2Gear.name === "Giant Gauntlet" || state.forgeSlot2Gear.name === "Frozen Arrow";
    const maxLvl = isEpic ? 27 : 18;
    const target = state.forgeSlot2SimLevel + delta;
    if (target >= state.forgeSlot2Gear.level && target <= maxLvl) {
      state.forgeSlot2SimLevel = target;
    }
  }
  updateForgeControlPanel();
  if (typeof ClashSoundEngine !== 'undefined') ClashSoundEngine.playHammer();
}

window.selectForgeHero = selectForgeHero;
window.toggleActiveForgeSlot = toggleActiveForgeSlot;
window.slotForgeGear = slotForgeGear;
window.adjustLoadoutLevel = adjustLoadoutLevel;

// ===== 🔔 DISCORD WEBHOOK SYSTEM =====
function triggerWebhookTest() {
  const url = document.getElementById('discord-webhook-input').value.trim();
  if (!url) {
    showToast("Please input a valid Discord webhook URL.", "error");
    return;
  }

  const payload = {
    embeds: [{
      title: "⚔️ Clash Command Center — Tactical War Plan Alert",
      description: "Leader strategic objectives saved successfully. Plan outlines target entry vectors and attack parameters.",
      color: 16101923, // Clash Gold
      fields: [
        { name: "Clan Name", value: "Nova Esports (#2PP2PP2P)", inline: true },
        { name: "Tactical Verdict", value: "High Win Odds. Core defenses heavily scouted.", inline: true }
      ],
      footer: { text: "Clash Command Center Pro • Live API proxy active" }
    }]
  };

  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  }).then(() => {
    showToast("Discord Webhook ping sent successfully!", "success");
    if (typeof ClashSoundEngine !== 'undefined') ClashSoundEngine.playFanfare();
  }).catch(() => {
    showToast("Failed to ping Discord. Check CORS policy or URL endpoint.", "error");
  });
}

function simulateWebhookEmbed() {
  const panel = document.getElementById('discord-simulation-panel');
  if (!panel) return;

  const isDark = document.body.classList.contains('light-theme') === false;

  panel.innerHTML = `
    <div class="sim-discord-card">
      <div class="sim-discord-header">⚔️ Clash Command Center — Tactical Alert</div>
      <p style="margin: 0; color: #dbdee1; line-height: 1.4;">Leader strategic objectives saved successfully. Plan outlines target entry vectors and attack parameters.</p>
      
      <div class="sim-discord-field-grid">
        <div class="sim-discord-field">
          <strong>Clan Name</strong>
          <span style="color: #fff;">Nova Esports (#2PP2PP2P)</span>
        </div>
        <div class="sim-discord-field">
          <strong>Tactical Verdict</strong>
          <span style="color: #fff;">High Win Odds. Core defenses scouted.</span>
        </div>
      </div>
    </div>
  `;
  showToast("Simulated Discord embed rendered below!", "success");
  if (typeof ClashSoundEngine !== 'undefined') ClashSoundEngine.playClick();
}

// Save Webhook to local storage on save settings click
document.addEventListener('DOMContentLoaded', () => {
  ClashSoundEngine.init();
  
  // Hook tab clicks to Sound Engine
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      if (typeof ClashSoundEngine !== 'undefined') ClashSoundEngine.playClick();
    });
  });

  // Bind settings load
  const webInput = document.getElementById('discord-webhook-input');
  if (webInput) {
    webInput.value = localStorage.getItem('coc_discord_webhook') || '';
  }

  const saveBtn = document.getElementById('save-settings-btn');
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      const url = document.getElementById('discord-webhook-input').value.trim();
      localStorage.setItem('coc_discord_webhook', url);
      showToast("Webhook preferences saved successfully!", "success");
      if (typeof ClashSoundEngine !== 'undefined') ClashSoundEngine.playClick();
    });
  }
});

// ===== 🎛️ CUSTOM WORKSPACE WIDGETS TOGGLE =====
function applyWidgetConfigurations() {
  const showChart = localStorage.getItem('coc_widget_chart') !== 'false';
  const showGoldpass = localStorage.getItem('coc_widget_goldpass') !== 'false';
  const showHeatmap = localStorage.getItem('coc_widget_heatmap') !== 'false';
  const showBookmarks = localStorage.getItem('coc_widget_bookmarks') !== 'false';

  // Toggle DOM nodes
  const chartEl = document.getElementById('overview-chart-card');
  const gpEl = document.getElementById('goldpass-widget-container');
  const hmEl = document.getElementById('heatmap-widget-container');
  const bmEl = document.getElementById('bookmarks-container');

  if (chartEl) chartEl.classList.toggle('hidden', !showChart);
  if (gpEl) gpEl.classList.toggle('hidden', !showGoldpass);
  if (hmEl) hmEl.classList.toggle('hidden', !showHeatmap);
  if (bmEl) bmEl.classList.toggle('hidden', !showBookmarks);

  // Set checkbox checked states on UI modal if visible
  const cbChart = document.getElementById('widget-toggle-chart');
  const cbGoldpass = document.getElementById('widget-toggle-goldpass');
  const cbHeatmap = document.getElementById('widget-toggle-heatmap');
  const cbBookmarks = document.getElementById('widget-toggle-bookmarks');

  if (cbChart) cbChart.checked = showChart;
  if (cbGoldpass) cbGoldpass.checked = showGoldpass;
  if (cbHeatmap) cbHeatmap.checked = showHeatmap;
  if (cbBookmarks) cbBookmarks.checked = showBookmarks;
}

window.applyWidgetConfigurations = applyWidgetConfigurations;

// ===== 🛡️ MODULE 11: LEGEND LEAGUE SHIELD DAY SIMULATOR =====
state.legendStartTrophies = 5200;
state.legendAttacks = Array(8).fill(40); // Trophies gained per slot
state.legendDefenses = Array(8).fill(16); // Trophies lost per slot
let legendForecastChart = null;

function initLegendSimulator() {
  const startInput = document.getElementById('legend-start-trophies');
  if (startInput) {
    startInput.value = localStorage.getItem('coc_legend_start') || '5200';
    state.legendStartTrophies = parseInt(startInput.value);
    startInput.addEventListener('input', (e) => {
      state.legendStartTrophies = parseInt(e.target.value) || 5000;
      localStorage.setItem('coc_legend_start', state.legendStartTrophies);
      calculateLegendTrophies();
    });
  }

  // Check if we need to load active inputs
  const savedAttacks = JSON.parse(localStorage.getItem('coc_legend_attacks'));
  const savedDefenses = JSON.parse(localStorage.getItem('coc_legend_defenses'));
  if (savedAttacks) state.legendAttacks = savedAttacks;
  if (savedDefenses) state.legendDefenses = savedDefenses;

  renderLegendSlots();
  calculateLegendTrophies();
}

function renderLegendSlots() {
  const attacksContainer = document.getElementById('legend-attacks-grid');
  const defensesContainer = document.getElementById('legend-defenses-grid');
  if (!attacksContainer || !defensesContainer) return;

  attacksContainer.innerHTML = Array.from({ length: 8 }, (_, i) => {
    return `
      <div class="legend-slot-row">
        <span class="legend-slot-title">Attack #${i + 1}</span>
        <select class="legend-select-control" onchange="updateLegendSlot('attack', ${i}, this.value)">
          <option value="40" ${state.legendAttacks[i] === 40 ? 'selected' : ''}>3★ (+40)</option>
          <option value="32" ${state.legendAttacks[i] === 32 ? 'selected' : ''}>2★ (+32)</option>
          <option value="26" ${state.legendAttacks[i] === 26 ? 'selected' : ''}>2★ (+26)</option>
          <option value="16" ${state.legendAttacks[i] === 16 ? 'selected' : ''}>1★ (+16)</option>
          <option value="0" ${state.legendAttacks[i] === 0 ? 'selected' : ''}>0★ (+0)</option>
        </select>
      </div>
    `;
  }).join('');

  defensesContainer.innerHTML = Array.from({ length: 8 }, (_, i) => {
    return `
      <div class="legend-slot-row">
        <span class="legend-slot-title">Defense #${i + 1}</span>
        <select class="legend-select-control" onchange="updateLegendSlot('defense', ${i}, this.value)" style="border-color: var(--clash-elixir);">
          <option value="40" ${state.legendDefenses[i] === 40 ? 'selected' : ''}>3★ (-40)</option>
          <option value="32" ${state.legendDefenses[i] === 32 ? 'selected' : ''}>2★ (-32)</option>
          <option value="24" ${state.legendDefenses[i] === 24 ? 'selected' : ''}>2★ (-24)</option>
          <option value="16" ${state.legendDefenses[i] === 16 ? 'selected' : ''}>1★ (-16)</option>
          <option value="0" ${state.legendDefenses[i] === 0 ? 'selected' : ''}>0★ (-0)</option>
        </select>
      </div>
    `;
  }).join('');
}

function updateLegendSlot(type, index, value) {
  const val = parseInt(value);
  if (type === 'attack') {
    state.legendAttacks[index] = val;
    localStorage.setItem('coc_legend_attacks', JSON.stringify(state.legendAttacks));
  } else {
    state.legendDefenses[index] = val;
    localStorage.setItem('coc_legend_defenses', JSON.stringify(state.legendDefenses));
  }
  calculateLegendTrophies();
  if (typeof ClashSoundEngine !== 'undefined') ClashSoundEngine.playClick();
}

function calculateLegendTrophies() {
  const attacksTotal = state.legendAttacks.reduce((a, b) => a + b, 0);
  const defensesTotal = state.legendDefenses.reduce((a, b) => a + b, 0);
  const net = attacksTotal - defensesTotal;

  const netEl = document.getElementById('legend-net-trophies');
  if (netEl) {
    netEl.textContent = `${net >= 0 ? '+' : ''}${net} Net Trophies`;
    netEl.style.background = net >= 0 ? 'rgba(74, 219, 134, 0.15)' : 'rgba(236, 59, 131, 0.15)';
    netEl.style.color = net >= 0 ? '#4adb86' : 'var(--clash-elixir)';
  }

  initLegendForecastChart(net);
}

function simulateAllLegendRuns() {
  const atkPresets = [40, 32, 26, 16, 0];
  const defPresets = [40, 32, 24, 16, 0];

  state.legendAttacks = Array.from({ length: 8 }, () => atkPresets[Math.floor(Math.random() * atkPresets.length)]);
  state.legendDefenses = Array.from({ length: 8 }, () => defPresets[Math.floor(Math.random() * defPresets.length)]);

  localStorage.setItem('coc_legend_attacks', JSON.stringify(state.legendAttacks));
  localStorage.setItem('coc_legend_defenses', JSON.stringify(state.legendDefenses));

  renderLegendSlots();
  calculateLegendTrophies();
  if (typeof ClashSoundEngine !== 'undefined') ClashSoundEngine.playFanfare();
  showToast("Daily Legend Runs simulated randomly!", "success");
}

function clearLegendRuns() {
  state.legendAttacks = Array(8).fill(40);
  state.legendDefenses = Array(8).fill(16);
  
  localStorage.setItem('coc_legend_attacks', JSON.stringify(state.legendAttacks));
  localStorage.setItem('coc_legend_defenses', JSON.stringify(state.legendDefenses));

  renderLegendSlots();
  calculateLegendTrophies();
  if (typeof ClashSoundEngine !== 'undefined') ClashSoundEngine.playHorn();
  showToast("Legend logs cleared.", "info");
}

function initLegendForecastChart(dailyNet) {
  loadChartJs().then(() => {
    const canvas = document.getElementById('legendForecastCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const days = Array.from({ length: 30 }, (_, i) => `Day ${i + 1}`);
    const forecastData = Array.from({ length: 30 }, (_, i) => {
      return state.legendStartTrophies + (dailyNet * (i + 1));
    });

    if (legendForecastChart) legendForecastChart.destroy();

    try {
      legendForecastChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: days,
          datasets: [{
            label: 'Predicted Trophies',
            data: forecastData,
            borderColor: 'var(--clash-gold)',
            backgroundColor: 'rgba(245, 166, 35, 0.1)',
            fill: true,
            borderWidth: 2,
            tension: 0.1,
            pointRadius: 1
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false }
          },
          scales: {
            x: { grid: { display: false }, ticks: { color: '#a8a8a8', font: { size: 9 } } },
            y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#a8a8a8', font: { size: 9 } } }
          }
        }
      });
    } catch (e) {
      console.warn("Forecast chart issues", e);
    }
  });
}

// ===== 🏰 CAPITAL SUB-TAB & GPA COORDINATOR =====
// Intercept renderCapital to add sub-tabs dynamically
const originalRenderCapital = window.renderCapital || function() {};
function premiumRenderCapital(capital) {
  const container = document.getElementById('capital-results-container');
  if (!container) return;

  // Render subtabs layout
  container.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 24px;">
      <!-- Sub Nav -->
      <div class="sub-nav-bar" id="capital-hub-subnav" style="display: flex; gap: 8px;">
        <button class="sub-nav-btn active" id="btn-cap-districts" onclick="toggleCapitalSubTab('districts')">Districts Overview</button>
        <button class="sub-nav-btn" id="btn-cap-coordinator" onclick="toggleCapitalSubTab('coordinator')">Raid Coordinator & GPA</button>
      </div>

      <!-- districts view container -->
      <div id="capital-subview-districts">
        <!-- Render normal districts overview inside -->
        <div class="results-card" style="min-height: auto; border: none; padding: 0; background: none; box-shadow: none;">
          <h3>🏰 Capital Peak & District Halls</h3>
          <div style="display: flex; flex-direction: column; gap: 14px; margin-top: 16px;">
            ${(capital.clanCapital?.districts || []).map(dist => `
              <div class="flex-between border-bottom-subtle pb-8">
                <div>
                  <strong>${escapeHtml(dist.name)}</strong><br/>
                  <small style="color: var(--text-muted);">District Hall Level ${dist.districtHallLevel}</small>
                </div>
                <span class="level-tag">LVL ${dist.districtHallLevel}</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>

      <!-- Raid coordinator view container -->
      <div id="capital-subview-coordinator" style="display: none; flex-direction: column; gap: 24px;">
        <div class="results-card" style="min-height: auto;">
          <h3>🎖️ Gold-per-Attack (GPA) Leaderboard</h3>
          <p style="font-size: 12px; color: var(--text-muted); margin-bottom: 16px;">Ranks raid weekend participants by gold looted per attack. Green badges show top looting efficiency.</p>
          <div class="gpa-leaderboard-list">
            <div class="gpa-row">
              <div style="display:flex; align-items:center; gap: 12px;">
                <span class="gpa-rank-tag gold">1</span>
                <strong>ClashMaster</strong>
              </div>
              <span class="badge-small" style="background: rgba(74, 219, 134, 0.15); color: #4adb86;">4,083 GPA (24,500 gold)</span>
            </div>
            <div class="gpa-row">
              <div style="display:flex; align-items:center; gap: 12px;">
                <span class="gpa-rank-tag elixir">2</span>
                <strong>ElixirQueen</strong>
              </div>
              <span class="badge-small" style="background: rgba(74, 219, 134, 0.15); color: #4adb86;">3,800 GPA (22,800 gold)</span>
            </div>
            <div class="gpa-row">
              <div style="display:flex; align-items:center; gap: 12px;">
                <span class="gpa-rank-tag">3</span>
                <strong>DarkKnight</strong>
              </div>
              <span class="badge-small" style="background: rgba(255,255,255,0.06); color: #fff;">3,500 GPA (21,000 gold)</span>
            </div>
          </div>
        </div>

        <div class="results-card" style="min-height: auto;">
          <h3>🛡️ District Completion Optimizer</h3>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 12px;">
            <div style="background: rgba(236, 59, 131, 0.08); border: 1px solid rgba(236,59,131,0.25); border-radius: 8px; padding: 12px;">
              <strong>Wizard Valley (94% destroyed)</strong>
              <p style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">Recommended cleanup entry. Requires only 1 air attack to claim maximum loot bonus!</p>
            </div>
            <div style="background: rgba(74, 219, 134, 0.08); border: 1px solid rgba(74,219,134,0.25); border-radius: 8px; padding: 12px;">
              <strong>Balloon Lagoon (45% destroyed)</strong>
              <p style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">Heavy fortifications remaining. Direct a ground smash with Super Giants first.</p>
            </div>
          </div>
        </div>

        <div class="results-card" style="min-height: auto;">
          <h3>🏰 Capital Gold Upgrade Planner</h3>
          <p style="font-size: 12px; color: var(--text-muted); margin-bottom: 12px;">Simulate allocating Capital Gold to leveling district halls. Enter cumulative looted gold to estimate forecasts.</p>
          <div style="display: flex; flex-direction: column; gap: 12px;">
            <div class="input-group">
              <label>Capital Gold Allocated</label>
              <input type="number" id="cap-gold-alloc" value="25000" style="width: 100%; background: var(--bg-stone); border: 1px solid var(--border-subtle); color: var(--text-main); padding: 8px 12px; border-radius: 8px;" oninput="recalculateCapitalUpgrades()">
            </div>
            <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border-subtle); padding: 12px; border-radius: 8px; font-size: 13px;">
              <div class="flex-between">
                <span>District Peak Upgrade Target</span>
                <strong style="color: var(--clash-gold);">Level 10 (Max Peak)</strong>
              </div>
              <div class="flex-between" style="margin-top: 6px;">
                <span>Estimated Upgrade Progress</span>
                <strong style="color: var(--clash-gold);" id="cap-upgrade-percentage">50% (Remaining: 25,000 gold)</strong>
              </div>
              <div class="flex-between" style="margin-top: 6px;">
                <span>Estimated Level Up Time</span>
                <strong style="color: #4a90e2;" id="cap-upgrade-time">4 Days needed (at ~8k GPA/day)</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  setTimeout(recalculateCapitalUpgrades, 20);
}

function recalculateCapitalUpgrades() {
  const input = document.getElementById('cap-gold-alloc');
  if (!input) return;
  const val = parseInt(input.value) || 0;
  
  const percentageEl = document.getElementById('cap-upgrade-percentage');
  const timeEl = document.getElementById('cap-upgrade-time');
  if (!percentageEl || !timeEl) return;

  const costToUpgrade = 50000;
  const remaining = Math.max(0, costToUpgrade - val);
  
  const progress = Math.min(100, Math.floor((val / costToUpgrade) * 100));
  percentageEl.textContent = `${progress}% (Remaining: ${remaining.toLocaleString()} gold)`;
  percentageEl.style.color = progress >= 100 ? '#4adb86' : 'var(--clash-gold)';

  const daysNeeded = Math.ceil(remaining / 8000);
  timeEl.textContent = progress >= 100 ? "Level Up Ready!" : `${daysNeeded} Days needed (at ~8k GPA/day)`;
}
window.recalculateCapitalUpgrades = recalculateCapitalUpgrades;

function toggleCapitalSubTab(tab) {
  const distEl = document.getElementById('capital-subview-districts');
  const coordEl = document.getElementById('capital-subview-coordinator');
  const btnDist = document.getElementById('btn-cap-districts');
  const btnCoord = document.getElementById('btn-cap-coordinator');

  if (tab === 'districts') {
    if (distEl) distEl.style.display = 'block';
    if (coordEl) coordEl.style.display = 'none';
    if (btnDist) btnDist.classList.add('active');
    if (btnCoord) btnCoord.classList.remove('active');
  } else {
    if (distEl) distEl.style.display = 'none';
    if (coordEl) coordEl.style.display = 'flex';
    if (btnDist) btnDist.classList.remove('active');
    if (btnCoord) btnCoord.classList.add('active');
  }
  if (typeof ClashSoundEngine !== 'undefined') ClashSoundEngine.playClick();
}

window.renderCapital = premiumRenderCapital;
window.toggleCapitalSubTab = toggleCapitalSubTab;

// ===== 🎯 CLAN GAMES COORDINATOR & ROSTER BOARD =====
const originalRenderClan = window.renderClan || function() {};
function premiumRenderClan(clan) {
  const container = document.getElementById('clan-results-container');
  if (!container) return;

  container.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 24px;">
      <!-- Subnav Bar -->
      <div class="sub-nav-bar" id="clan-hub-subnav" style="display: flex; gap: 8px;">
        <button class="sub-nav-btn active" id="btn-clan-roster" onclick="toggleClanSubTab('roster')">Roster & Intel</button>
        <button class="sub-nav-btn" id="btn-clan-games" onclick="toggleClanSubTab('games')">Clan Games Tracker</button>
      </div>

      <!-- subview roster -->
      <div id="clan-subview-roster" style="display: flex; flex-direction: column; gap: 24px;">
        <!-- Inject normal renderClan HTML -->
        <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border-subtle); padding-bottom: 20px;">
          <div style="display: flex; align-items: center; gap: 16px;">
            <img src="${clan.badgeUrls.medium}" alt="badge" style="width: 56px; height: 56px; object-fit: contain;"/>
            <div>
              <h2 class="gold-gradient-text" style="font-size: 24px; font-weight: 800; margin: 0;">${escapeHtml(clan.name)}</h2>
              <div style="display: flex; gap: 8px; align-items: center; font-size: 13px; color: var(--text-muted); margin-top: 4px;">
                <span>LVL ${clan.clanLevel}</span> &bull; <span>${escapeHtml(clan.tag)}</span> &bull; <span>${clan.members}/50 Players</span>
              </div>
            </div>
          </div>
        </div>
        
        <div class="stats-row">
          <div class="stat-card" style="padding: 16px; background: var(--bg-stone-dark);">
            <div class="stat-icon gold"><i class="fas fa-trophy"></i></div>
            <div class="stat-details">
              <h4 style="font-size: 11px;">Points</h4>
              <p style="font-size: 18px;">${clan.clanPoints?.toLocaleString() || 0}</p>
            </div>
          </div>
          <div class="stat-card" style="padding: 16px; background: var(--bg-stone-dark);">
            <div class="stat-icon elixir"><i class="fas fa-shield-alt"></i></div>
            <div class="stat-details">
              <h4 style="font-size: 11px;">CWL Tier</h4>
              <p style="font-size: 18px;">${clan.warLeague?.name || 'Unranked'}</p>
            </div>
          </div>
        </div>

        <div style="overflow-x: auto;">
          <table class="roster-table" style="width: 100%; border-collapse: collapse; font-size: 13px;">
            <thead>
              <tr style="border-bottom: 2px solid var(--border-subtle); color: var(--text-muted); text-align: left;">
                <th style="padding: 10px 14px;">Player Name</th>
                <th style="padding: 10px 14px;">Role</th>
                <th style="padding: 10px 14px; text-align: right;">Trophies</th>
              </tr>
            </thead>
            <tbody>
              ${(clan.memberList || []).map(m => `
                <tr class="roster-row" data-action="load-player" data-tag="${escapeHtml(m.tag)}" style="border-bottom: 1px solid var(--border-subtle); cursor: pointer;">
                  <td style="padding: 12px 14px;"><strong style="color: var(--text-main);">${escapeHtml(m.name)}</strong></td>
                  <td style="padding: 12px 14px; color: var(--text-muted);">${escapeHtml(m.role)}</td>
                  <td style="padding: 12px 14px; text-align: right; font-weight: 700; color: var(--clash-gold);"><i class="fas fa-trophy"></i> ${m.trophies}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- subview games board -->
      <div id="clan-subview-games" style="display: none; flex-direction: column; gap: 24px;">
        <div class="results-card" style="min-height: auto;">
          <h3 class="gold-gradient-text" style="font-size: 20px; font-weight: 800; margin: 0;">🎯 Clan Games Milestone Tracker</h3>
          <span style="font-size: 12px; color: var(--text-muted);">Unlock tier chimes together! Current Clan Points: <strong>42,800 / 50,000 pts</strong></span>
          
          <div class="games-milestone-track">
            <div class="games-milestone-fill" style="width: 85.6%;"></div>
          </div>
          
          <div class="games-milestone-nodes-row">
            <div class="games-milestone-node unlocked" title="Tier 1 Unlocked (10,000 pts)">1</div>
            <div class="games-milestone-node unlocked" title="Tier 2 Unlocked (18,000 pts)">2</div>
            <div class="games-milestone-node unlocked" title="Tier 3 Unlocked (30,000 pts)">3</div>
            <div class="games-milestone-node" title="Tier 4 Locked (50,000 pts)">4</div>
          </div>
        </div>

        <div class="results-card" style="min-height: auto;">
          <h3>⚔️ Recommended Active Quests</h3>
          <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 12px;">
            <div class="ai-coach-funnel-step" style="border-color: rgba(245,166,35,0.35); background: rgba(245,166,35,0.02);">
              <i class="fas fa-crosshairs" style="color: var(--clash-gold); margin-top: 2px;"></i>
              <div>
                <strong>Loot 3,000,000 Gold (+600 pts)</strong>
                <p style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">Highly recommended for <strong>ClashMaster</strong> due to active multiplayer pushing.</p>
              </div>
            </div>
            <div class="ai-coach-funnel-step" style="border-color: rgba(139,68,253,0.35); background: rgba(139,68,253,0.02);">
              <i class="fas fa-bolt" style="color: var(--clash-dark-elixir); margin-top: 2px;"></i>
              <div>
                <strong>Destroy 4 Air Defenses with Dragons (+400 pts)</strong>
                <p style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">Highly recommended for <strong>GoblinKing</strong> (Level 10 Dragons meta active).</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Hook new load-player actions dynamically
  container.querySelectorAll('[data-action="load-player"]').forEach(el => {
    el.addEventListener('click', () => {
      const tag = el.getAttribute('data-tag');
      const p = window.MOCK_PLAYERS[tag];
      if (p) {
        renderPlayer(p);
        switchTab('player');
        if (typeof ClashSoundEngine !== 'undefined') ClashSoundEngine.playClick();
      }
    });
  });
}

function toggleClanSubTab(tab) {
  const rosterEl = document.getElementById('clan-subview-roster');
  const gamesEl = document.getElementById('clan-subview-games');
  const btnRoster = document.getElementById('btn-clan-roster');
  const btnGames = document.getElementById('btn-clan-games');

  if (tab === 'roster') {
    if (rosterEl) rosterEl.style.display = 'flex';
    if (gamesEl) gamesEl.style.display = 'none';
    if (btnRoster) btnRoster.classList.add('active');
    if (btnGames) btnGames.classList.remove('active');
  } else {
    if (rosterEl) rosterEl.style.display = 'none';
    if (gamesEl) gamesEl.style.display = 'flex';
    if (btnRoster) btnRoster.classList.remove('active');
    if (btnGames) btnGames.classList.add('active');
  }
  if (typeof ClashSoundEngine !== 'undefined') ClashSoundEngine.playClick();
}

window.renderClan = premiumRenderClan;
window.toggleClanSubTab = toggleClanSubTab;

// ===== 🧠 MODULE 12: AI ATTACK STRATEGY COACH =====
function renderAICoachBoard() {
  const container = document.getElementById('war-subview-strategy');
  if (!container) return;

  // Insert AI Coach Board card dynamically next to standard win simulator elements
  const coachDiv = document.createElement('div');
  coachDiv.className = 'ai-coach-card';
  coachDiv.innerHTML = `
    <div style="border-bottom: 1px solid rgba(74, 144, 226, 0.25); padding-bottom: 12px; margin-bottom: 16px;">
      <h3 style="color: #4a90e2; font-size: 18px; font-weight: 800; margin: 0; display:flex; align-items:center; gap:8px;">
        <i class="fas fa-brain"></i> AI Strategy Coach Board
      </h3>
      <span style="font-size: 11px; color: var(--text-muted);">Real-time funneling timelines and spell drops helper</span>
    </div>

    <div class="input-group">
      <label>Attack Phase Timer Selector</label>
      <input type="range" class="ai-coach-timeline-slider" id="ai-timeline" min="0" max="180" value="0">
      <div class="flex-between" style="font-size: 12px; font-weight: bold; color: #4a90e2; margin-top: 4px;">
        <span>Funnels Phase (0s)</span>
        <span id="ai-timeline-val">0 seconds elapsed</span>
      </div>
    </div>

    <div id="ai-coaching-output-step" style="margin-top: 16px;">
      <!-- Populated by sliders listener -->
    </div>
  `;

  // Find strategist column and append
  const strategyPanel = container.querySelector('.war-room-panel');
  if (strategyPanel) {
    strategyPanel.appendChild(coachDiv);
    
    // Bind slider listener
    const slider = document.getElementById('ai-timeline');
    const valText = document.getElementById('ai-timeline-val');
    const output = document.getElementById('ai-coaching-output-step');

    const updateCoach = () => {
      const val = parseInt(slider.value);
      if (valText) valText.textContent = `${val} seconds elapsed`;
      
      let stepHtml = '';
      if (val < 30) {
        stepHtml = `
          <div class="ai-coach-funnel-step">
            <i class="fas fa-flag" style="color: #4a90e2; margin-top: 2px;"></i>
            <div>
              <strong>Phase 1: Funneling Setup (0s - 30s)</strong>
              <p style="font-size: 12px; color: var(--text-muted); margin-top: 4px; line-height: 1.4;">
                Drop Baby Dragons or King at 3 o'clock corner to establish funnels. Clear trash structures so that heroes target core layers cleanly.
              </p>
            </div>
          </div>
        `;
      } else if (val < 90) {
        stepHtml = `
          <div class="ai-coach-funnel-step" style="border-color: var(--clash-gold);">
            <i class="fas fa-crosshairs" style="color: var(--clash-gold); margin-top: 2px;"></i>
            <div>
              <strong>Phase 2: Core Push & Spells drop (31s - 90s)</strong>
              <p style="font-size: 12px; color: var(--text-muted); margin-top: 4px; line-height: 1.4;">
                Deploy main smash troops (Hogs/Miner/Electro Titans) directly behind Archer Queen. Drop **Rage Spell** as they enter Monolith weapon range.
              </p>
            </div>
          </div>
        `;
      } else {
        stepHtml = `
          <div class="ai-coach-funnel-step" style="border-color: var(--clash-elixir);">
            <i class="fas fa-shield-halved" style="color: var(--clash-elixir); margin-top: 2px;"></i>
            <div>
              <strong>Phase 3: Cleanup & Warden Ability (91s - 180s)</strong>
              <p style="font-size: 12px; color: var(--text-muted); margin-top: 4px; line-height: 1.4;">
                Trigger Grand Warden **Eternal Tome** invulnerability ability immediately as Town Hall explosion bomb triggers at the center. Use Minions to sweep corners.
              </p>
            </div>
          </div>
        `;
      }
      if (output) output.innerHTML = stepHtml;
    };

    slider.addEventListener('input', updateCoach);
    updateCoach(); // Initial run
  }
}

function renderWarBattleSimulator() {
  const container = document.getElementById('war-subview-strategy');
  if (!container) return;

  const panel = container.querySelector('.war-room-panel');
  if (!panel) return;

  // Check if already exists
  let simDiv = document.getElementById('war-battle-simulator-card');
  if (simDiv) return;

  simDiv = document.createElement('div');
  simDiv.id = 'war-battle-simulator-card';
  simDiv.className = 'strategy-board';
  simDiv.style.gridColumn = 'span 2';
  simDiv.style.marginTop = '24px';

  simDiv.innerHTML = `
    <div style="border-bottom: 1px solid var(--border-subtle); padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center;">
      <div>
        <h3 class="gold-gradient-text" style="font-size: 18px; font-weight: 800; margin: 0;"><i class="fas fa-gamepad"></i> Tactical Combat Simulator</h3>
        <span style="font-size: 11px; color: var(--text-muted);">Simulate tactical attack execution steps in real-time</span>
      </div>
      <select id="sim-troop-comp" style="background: var(--bg-stone-medium); border: 1px solid var(--border-subtle); color: #fff; padding: 4px 8px; border-radius: 6px; font-size: 12px;">
        <option value="Lalo">Queen Charge Lavaloon</option>
        <option value="Hybrid">Hog Miner Hybrid</option>
        <option value="Edrags">Electro Dragons</option>
        <option value="Smash">Yeti Titan Smash</option>
      </select>
    </div>

    <div style="display: flex; flex-direction: column; gap: 16px;">
      <button class="primary-btn" onclick="startCombatSimulation()" style="width: 100%; font-size: 14px; padding: 10px; background: var(--clash-gold-gradient); color: #000; font-weight: 800;">
        ⚔️ Execute Simulation Campaign
      </button>

      <!-- Simulated terminal window -->
      <div id="sim-terminal-screen" style="background: #090b0e; border: 1px solid var(--border-subtle); border-radius: 8px; padding: 16px; min-height: 180px; max-height: 250px; overflow-y: auto; font-family: monospace; font-size: 12px; color: #a5d6ff; line-height: 1.6;">
        [Console Ready] Select a troop composition and click Execute above to launch simulated campaign...
      </div>
    </div>
  `;

  panel.appendChild(simDiv);
}

let activeCombatInterval = null;

function startCombatSimulation() {
  const screen = document.getElementById('sim-terminal-screen');
  if (!screen) return;

  if (activeCombatInterval) {
    clearInterval(activeCombatInterval);
  }

  const comp = document.getElementById('sim-troop-comp').value;
  const attackPower = parseInt(document.getElementById('sim-attack-strength').value);
  const defensePower = parseInt(document.getElementById('sim-defense-strength').value);
  
  // Calculate probability
  const ratio = attackPower / (attackPower + defensePower);
  const starsProbability = ratio * 100;

  let stars = 1;
  if (starsProbability > 75) stars = 3;
  else if (starsProbability > 45) stars = 2;

  let stepIndex = 0;
  
  // Battle step timelines mapping
  const steps = [
    { time: "0s", log: `[SYSTEM] Preparing attack layout corridor. Troop layout composition: ${comp}.`, sound: "click" },
    { time: "5s", log: `[DROP] funnel units dropped at 3 o'clock positions. Funnels clearance started.`, sound: "click" },
    { time: "20s", log: `[DEPLOY] Main heroes deployed. Grand Warden in ground aura coverage mode.`, sound: "click" },
    { time: "45s", log: `[ENGAGE] Core defense boundary reached. Opponent CC dragon pulled! Poison spell dropped.`, sound: "click" },
    { time: "70s", log: `[SPELL] Rage Spell dropped in center corridor. Monolith laser locked. Warden ability active!`, sound: "fanfare" },
    { time: "105s", log: `[BREACH] Town Hall structure cleared! 50% threshold secured. 2 Stars achieved!`, sound: "horn" },
    { time: "140s", log: `[CLEANUP] Archer Queen sweeping defensive deadzones. Minions dropped.`, sound: "click" },
    { time: "175s", log: `[BATTLE ENDED] Campaign concluded successfully! Final Star Rating: ${stars} Stars! (${stars === 3 ? '100% destruction!' : Math.floor(60 + Math.random() * 30) + '% destruction'})`, sound: stars === 3 ? "fanfare" : "horn" }
  ];

  screen.innerHTML = `<span style="color:#4adb86;">[BATTLE STARTED] Launching combat simulation campaign...</span><br>`;
  if (typeof ClashSoundEngine !== 'undefined') ClashSoundEngine.playClick();

  activeCombatInterval = setInterval(() => {
    if (stepIndex >= steps.length) {
      clearInterval(activeCombatInterval);
      activeCombatInterval = null;
      return;
    }

    const s = steps[stepIndex];
    screen.innerHTML += `<span style="color:#888;">[${s.time}]</span> <span style="color:${s.log.includes('SYSTEM') ? '#a5d6ff' : s.log.includes('BATTLE') ? '#4adb86' : '#fff'};">${escapeHtml(s.log)}</span><br>`;
    screen.scrollTop = screen.scrollHeight;

    // Trigger programmatic chimes/horns matching steps
    if (typeof ClashSoundEngine !== 'undefined') {
      if (s.sound === "click") ClashSoundEngine.playClick();
      else if (s.sound === "fanfare") ClashSoundEngine.playFanfare();
      else if (s.sound === "horn") ClashSoundEngine.playHorn();
    }

    stepIndex++;
  }, 1200);
}

window.renderWarBattleSimulator = renderWarBattleSimulator;
window.startCombatSimulation = startCombatSimulation;

// Bind Legends load in tab navigation
document.addEventListener('DOMContentLoaded', () => {
  // Bind active tabs switcher
  const sidebar = document.querySelector('.nav-links');
  if (sidebar) {
    sidebar.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', () => {
        const tab = item.getAttribute('data-tab');
        if (tab === 'legends') {
          setTimeout(initLegendSimulator, 50);
        } else if (tab === 'hero-sandbox') {
          setTimeout(initHeroSandboxTab, 50);
        }
      });
    });
  }

  // Hook War Room subtab renderAICoachBoard trigger
  const warSubnav = document.getElementById('war-hub-subnav');
  if (warSubnav) {
    warSubnav.querySelectorAll('.sub-nav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const sub = btn.getAttribute('data-subtab');
        if (sub === 'strategy') {
          setTimeout(() => {
            renderAICoachBoard();
            renderWarBattleSimulator();
            initTacticsPlannerCanvas();
          }, 50);
        }
      });
    });
  }
});

// Global bindings
window.simulateAllLegendRuns = simulateAllLegendRuns;
window.clearLegendRuns = clearLegendRuns;
window.renderAICoachBoard = renderAICoachBoard;
window.toggleDashboardSound = toggleDashboardSound;
window.openOreForgeModal = openOreForgeModal;
window.closeOreForgeModal = closeOreForgeModal;
window.selectForgeGear = selectForgeGear;
window.adjustForgeLevel = adjustForgeLevel;
window.triggerWebhookTest = triggerWebhookTest;
window.simulateWebhookEmbed = simulateWebhookEmbed;
window.renderProgressionAudit = renderProgressionAudit;

// ============================================================================
// 🌟 DEDICATED HERO SANDBOX VIEW (MODULE 1)
// ============================================================================
function initHeroSandboxTab() {
  if (!state.currentForgePlayer) {
    state.currentForgePlayer = Object.values(window.MOCK_PLAYERS)[0];
  }
  renderHeroSandbox();
  renderSandboxComparison();
}

function renderHeroSandbox() {
  const container = document.getElementById('tab-sandbox-equipment-container');
  const panel = document.getElementById('tab-sandbox-control-panel');
  if (!container || !panel) return;

  const player = state.currentForgePlayer;
  const heroesList = ["Barbarian King", "Archer Queen", "Grand Warden", "Royal Champion"];
  let allEquipment = [...(player.heroEquipment || [])];

  if (!allEquipment.some(eq => eq.heroName === "Royal Champion")) {
    allEquipment = allEquipment.concat(DEFAULT_RC_GEARS);
  }

  const heroGears = allEquipment.filter(eq => eq.heroName === state.forgeSelectedHero);

  const firstGear = heroGears[0] || null;
  const secondGear = heroGears[1] || null;
  
  if (!state.forgeSlot1Gear || state.forgeSlot1Gear.heroName !== state.forgeSelectedHero) {
    state.forgeSlot1Gear = firstGear;
    state.forgeSlot1SimLevel = firstGear ? firstGear.level : 1;
  }
  if (!state.forgeSlot2Gear || state.forgeSlot2Gear.heroName !== state.forgeSelectedHero) {
    state.forgeSlot2Gear = secondGear;
    state.forgeSlot2SimLevel = secondGear ? secondGear.level : 1;
  }

  // Render hero selection & gear list
  container.innerHTML = `
    <!-- Hero Selection Tabs -->
    <div style="display: flex; gap: 8px; flex-wrap: wrap; border-bottom: 1px solid var(--border-subtle); padding-bottom: 12px; width: 100%;">
      ${heroesList.map(hero => `
        <button class="primary-btn" onclick="selectSandboxHero('${escapeHtml(hero)}')" style="padding: 8px 16px; font-size: 12px; font-weight: bold; background: ${state.forgeSelectedHero === hero ? 'var(--clash-gold-gradient)' : 'rgba(255,255,255,0.03)'}; color: ${state.forgeSelectedHero === hero ? '#000' : 'var(--text-muted)'}; border-color: ${state.forgeSelectedHero === hero ? '#ffe066' : 'var(--border-subtle)'}; box-shadow: none;">
          ${escapeHtml(hero)}
        </button>
      `).join('')}
    </div>

    <!-- Active Slotted Gears -->
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 12px;">
      <div class="forge-equipment-card ${state.activeForgeSlot === 1 ? 'selected' : ''}" onclick="toggleActiveSandboxSlot(1)" style="border-style: ${state.activeForgeSlot === 1 ? 'solid' : 'dashed'}; border-color: ${state.activeForgeSlot === 1 ? 'var(--clash-gold)' : 'var(--border-subtle)'}; min-height: 90px; position: relative;">
        <span style="font-size: 9px; text-transform: uppercase; color: var(--text-muted); position: absolute; top: 6px; left: 8px;">Active Slot 1</span>
        ${state.forgeSlot1Gear ? `
          <div class="forge-level-pill" style="top: 6px; right: 8px;">LVL ${state.forgeSlot1SimLevel}</div>
          <div style="font-size: 24px; margin-top: 18px;">🗡️</div>
          <div style="font-size: 13px; font-weight: bold; margin-top: 6px;">${escapeHtml(state.forgeSlot1Gear.name)}</div>
        ` : `
          <div style="color: var(--text-muted); font-size: 12px; margin-top: 30px;">Empty Slot</div>
        `}
      </div>
      <div class="forge-equipment-card ${state.activeForgeSlot === 2 ? 'selected' : ''}" onclick="toggleActiveSandboxSlot(2)" style="border-style: ${state.activeForgeSlot === 2 ? 'solid' : 'dashed'}; border-color: ${state.activeForgeSlot === 2 ? 'var(--clash-gold)' : 'var(--border-subtle)'}; min-height: 90px; position: relative;">
        <span style="font-size: 9px; text-transform: uppercase; color: var(--text-muted); position: absolute; top: 6px; left: 8px;">Active Slot 2</span>
        ${state.forgeSlot2Gear ? `
          <div class="forge-level-pill" style="top: 6px; right: 8px;">LVL ${state.forgeSlot2SimLevel}</div>
          <div style="font-size: 24px; margin-top: 18px;">⚡</div>
          <div style="font-size: 13px; font-weight: bold; margin-top: 6px;">${escapeHtml(state.forgeSlot2Gear.name)}</div>
        ` : `
          <div style="color: var(--text-muted); font-size: 12px; margin-top: 30px;">Empty Slot</div>
        `}
      </div>
    </div>

    <!-- Inventory Palette -->
    <div style="margin-top: 16px; width: 100%;">
      <h5 style="font-size: 11px; color: var(--text-muted); text-transform: uppercase; margin-bottom: 8px; font-weight: 700; letter-spacing: 0.5px;">Slotted Gear Inventory</h5>
      <div class="forge-equipment-grid" style="grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); max-height: 250px;">
        ${heroGears.map(eq => {
          const isSlotted = (state.forgeSlot1Gear && state.forgeSlot1Gear.name === eq.name) || (state.forgeSlot2Gear && state.forgeSlot2Gear.name === eq.name);
          return `
            <div class="forge-equipment-card" onclick="slotSandboxGear('${escapeHtml(eq.name)}')" style="opacity: ${isSlotted ? 0.4 : 1}; pointer-events: ${isSlotted ? 'none' : 'auto'}; border-color: var(--border-subtle); position: relative;">
              <div class="forge-level-pill">LVL ${eq.level}</div>
              <div style="font-size: 28px; margin-bottom: 6px; margin-top: 6px;">🛡️</div>
              <div style="font-size: 11px; font-weight: 700; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; width: 100%;">${escapeHtml(eq.name)}</div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;

  // Render upgrade costs controls panel
  let totalShiny = 0;
  let totalGlowy = 0;
  let totalStarry = 0;
  let totalDpsGained = 0;
  let totalHpGained = 0;

  const calculateGearOres = (gear, targetLvl) => {
    if (!gear) return { s: 0, g: 0, st: 0 };
    const isEpic = gear.name === "Giant Gauntlet" || gear.name === "Frozen Arrow";
    const diff = targetLvl - gear.level;
    if (diff <= 0) return { s: 0, g: 0, st: 0 };
    const baseShiny = isEpic ? 240 : 120;
    const baseGlowy = isEpic ? 30 : 15;
    const baseStarry = isEpic ? 6 : 0;
    return { s: diff * baseShiny, g: diff * baseGlowy, st: diff * baseStarry };
  };

  const getStats = (gear, lvl) => {
    if (!gear) return { dps: 0, hp: 0 };
    return { dps: 5 * lvl, hp: 15 * lvl };
  };

  const o1 = calculateGearOres(state.forgeSlot1Gear, state.forgeSlot1SimLevel);
  const o2 = calculateGearOres(state.forgeSlot2Gear, state.forgeSlot2SimLevel);
  totalShiny = o1.s + o2.s;
  totalGlowy = o1.g + o2.g;
  totalStarry = o1.st + o2.st;

  const s1 = getStats(state.forgeSlot1Gear, state.forgeSlot1SimLevel);
  const s2 = getStats(state.forgeSlot2Gear, state.forgeSlot2SimLevel);
  totalDpsGained = s1.dps + s2.dps;
  totalHpGained = s1.hp + s2.hp;

  const epic1 = state.forgeSlot1Gear && (state.forgeSlot1Gear.name === "Giant Gauntlet" || state.forgeSlot1Gear.name === "Frozen Arrow");
  const epic2 = state.forgeSlot2Gear && (state.forgeSlot2Gear.name === "Giant Gauntlet" || state.forgeSlot2Gear.name === "Frozen Arrow");

  panel.innerHTML = `
    <div>
      <h3 class="gold-gradient-text" style="font-size: 18px; font-weight: 800; margin: 0;">🛠️ Upgrade Cost & Synergy Optimizer</h3>
      <span style="font-size: 11px; color: var(--text-muted);">${state.forgeSelectedHero} &bull; Progression Planner</span>
    </div>

    <!-- Slotted 1 controls -->
    ${state.forgeSlot1Gear ? `
      <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border-subtle); padding: 12px; border-radius: 8px;">
        <div class="flex-between" style="font-size: 12px; margin-bottom: 6px;">
          <strong>Slot 1: ${escapeHtml(state.forgeSlot1Gear.name)}</strong>
          <span style="font-size: 10px; color: var(--text-muted);">Max level: ${epic1 ? 27 : 18}</span>
        </div>
        <div class="level-spinner-row" style="padding: 6px 12px;">
          <button class="level-spinner-btn" onclick="adjustSandboxGearLevel(1, -1)">&minus;</button>
          <div style="font-size: 14px; font-weight: bold;">LVL ${state.forgeSlot1SimLevel}</div>
          <button class="level-spinner-btn" onclick="adjustSandboxGearLevel(1, 1)">&plus;</button>
        </div>
      </div>
    ` : ''}

    <!-- Slotted 2 controls -->
    ${state.forgeSlot2Gear ? `
      <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border-subtle); padding: 12px; border-radius: 8px; margin-top: 12px;">
        <div class="flex-between" style="font-size: 12px; margin-bottom: 6px;">
          <strong>Slot 2: ${escapeHtml(state.forgeSlot2Gear.name)}</strong>
          <span style="font-size: 10px; color: var(--text-muted);">Max level: ${epic2 ? 27 : 18}</span>
        </div>
        <div class="level-spinner-row" style="padding: 6px 12px;">
          <button class="level-spinner-btn" onclick="adjustSandboxGearLevel(2, -1)">&minus;</button>
          <div style="font-size: 14px; font-weight: bold;">LVL ${state.forgeSlot2SimLevel}</div>
          <button class="level-spinner-btn" onclick="adjustSandboxGearLevel(2, 1)">&plus;</button>
        </div>
      </div>
    ` : ''}

    <div style="margin-top: 16px;">
      <h5 style="font-size: 11px; color: var(--text-muted); margin-bottom: 8px; text-transform: uppercase;">Aggregated Cost Tracker</h5>
      <div class="ore-cost-badge-row">
        <div class="ore-cost-badge">
          <i class="fas fa-star" style="color: #4a90e2; font-size: 16px; margin-bottom: 4px;"></i>
          <div>${totalShiny.toLocaleString()}</div>
          <span>Shiny</span>
        </div>
        <div class="ore-cost-badge">
          <i class="fas fa-star" style="color: #ec3b83; font-size: 16px; margin-bottom: 4px;"></i>
          <div>${totalGlowy.toLocaleString()}</div>
          <span>Glowy</span>
        </div>
        <div class="ore-cost-badge">
          <i class="fas fa-star" style="color: var(--clash-gold); font-size: 16px; margin-bottom: 4px;"></i>
          <div>${totalStarry.toLocaleString()}</div>
          <span>Starry</span>
        </div>
      </div>
    </div>

    <div style="background: rgba(0,0,0,0.2); border: 1px solid var(--border-subtle); border-radius: 10px; padding: 14px; margin-top: 12px;">
      <h5 style="font-size: 11px; color: var(--text-muted); text-transform: uppercase; margin-bottom: 8px;">Synergy Loadout Boosts</h5>
      <div class="flex-between border-bottom-subtle pb-6" style="font-size: 13px; margin-bottom: 6px;">
        <span>Total Passive DPS Boost</span>
        <strong style="color: #4adb86;">+${totalDpsGained} DPS</strong>
      </div>
      <div class="flex-between" style="font-size: 13px;">
        <span>Total HP Recovery Boost</span>
        <strong style="color: #4adb86;">+${totalHpGained} HP</strong>
      </div>
    </div>
  `;
}

function selectSandboxHero(heroName) {
  state.forgeSelectedHero = heroName;
  state.forgeSlot1Gear = null;
  state.forgeSlot2Gear = null;
  state.activeForgeSlot = 1;
  renderHeroSandbox();
  if (typeof ClashSoundEngine !== 'undefined') ClashSoundEngine.playClick();
}

function toggleActiveSandboxSlot(slotNum) {
  state.activeForgeSlot = slotNum;
  renderHeroSandbox();
  if (typeof ClashSoundEngine !== 'undefined') ClashSoundEngine.playClick();
}

function slotSandboxGear(gearName) {
  slotForgeGear(gearName);
  renderHeroSandbox();
}

function adjustSandboxGearLevel(slot, delta) {
  adjustLoadoutLevel(slot, delta);
  renderHeroSandbox();
}

function saveSandboxLoadout(letter) {
  const current = {
    hero: state.forgeSelectedHero,
    gear1: state.forgeSlot1Gear ? { name: state.forgeSlot1Gear.name, level: state.forgeSlot1SimLevel } : null,
    gear2: state.forgeSlot2Gear ? { name: state.forgeSlot2Gear.name, level: state.forgeSlot2SimLevel } : null,
    dps: (state.forgeSlot1SimLevel * 5) + (state.forgeSlot2SimLevel * 5),
    hp: (state.forgeSlot1SimLevel * 15) + (state.forgeSlot2SimLevel * 15)
  };
  localStorage.setItem(`coc_sandbox_loadout_${letter}`, JSON.stringify(current));
  showToast(`Loadout saved as Loadout ${letter}!`, "success");
  if (typeof ClashSoundEngine !== 'undefined') ClashSoundEngine.playFanfare();
  renderSandboxComparison();
}

function renderSandboxComparison() {
  const resultsContainer = document.getElementById('sandbox-comparison-results');
  if (!resultsContainer) return;

  const a = JSON.parse(localStorage.getItem('coc_sandbox_loadout_A'));
  const b = JSON.parse(localStorage.getItem('coc_sandbox_loadout_B'));

  if (!a || !b) {
    resultsContainer.innerHTML = `
      <div class="placeholder-state" style="padding: 20px 0;">
        <i class="fas fa-chart-bar" style="font-size: 32px; color: var(--clash-gold); opacity: 0.5; margin-bottom: 8px;"></i>
        <p style="font-size: 13px; color: var(--text-muted);">Save both loadouts above to display a side-by-side audit.</p>
      </div>
    `;
    return;
  }

  const maxDpsVal = Math.max(a.dps, b.dps, 1);
  const maxHpVal = Math.max(a.hp, b.hp, 1);

  const pctA_Dps = Math.round((a.dps / maxDpsVal) * 100);
  const pctB_Dps = Math.round((b.dps / maxDpsVal) * 100);
  const pctA_Hp = Math.round((a.hp / maxHpVal) * 100);
  const pctB_Hp = Math.round((b.hp / maxHpVal) * 100);

  resultsContainer.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 16px;">
      <!-- Row 1: Loadout Overviews -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
        <div style="background: rgba(245, 166, 35, 0.05); border: 1px solid rgba(245, 166, 35, 0.2); padding: 14px; border-radius: 8px;">
          <strong style="color: var(--clash-gold); font-size: 14px;">Loadout A (${a.hero})</strong>
          <ul style="list-style: none; padding: 0; margin: 8px 0 0 0; font-size: 12px; color: var(--text-muted); display:flex; flex-direction:column; gap:4px;">
            <li>${a.gear1 ? `${escapeHtml(a.gear1.name)} (LVL ${a.gear1.level})` : 'Empty Slot'}</li>
            <li>${a.gear2 ? `${escapeHtml(a.gear2.name)} (LVL ${a.gear2.level})` : 'Empty Slot'}</li>
          </ul>
        </div>
        <div style="background: rgba(236, 59, 131, 0.05); border: 1px solid rgba(236, 59, 131, 0.2); padding: 14px; border-radius: 8px;">
          <strong style="color: var(--clash-elixir); font-size: 14px;">Loadout B (${b.hero})</strong>
          <ul style="list-style: none; padding: 0; margin: 8px 0 0 0; font-size: 12px; color: var(--text-muted); display:flex; flex-direction:column; gap:4px;">
            <li>${b.gear1 ? `${escapeHtml(b.gear1.name)} (LVL ${b.gear1.level})` : 'Empty Slot'}</li>
            <li>${b.gear2 ? `${escapeHtml(b.gear2.name)} (LVL ${b.gear2.level})` : 'Empty Slot'}</li>
          </ul>
        </div>
      </div>

      <!-- Compare Stat 1: DPS -->
      <div class="sandbox-comparison-card">
        <div class="flex-between" style="font-size: 13px; font-weight: bold;">
          <span>Combined DPS Boosts</span>
          <span style="font-size: 11px; color: var(--text-muted);">
            A: <strong style="color: var(--clash-gold);">+${a.dps}</strong> vs. B: <strong style="color: var(--clash-elixir);">+${b.dps}</strong>
          </span>
        </div>
        <div class="sandbox-comparison-bar-container">
          <div class="sandbox-comparison-bar loadout-a-fill" style="width: ${pctA_Dps}%;"></div>
        </div>
        <div class="sandbox-comparison-bar-container" style="margin-top: -6px;">
          <div class="sandbox-comparison-bar loadout-b-fill" style="width: ${pctB_Dps}%;"></div>
        </div>
      </div>

      <!-- Compare Stat 2: HP -->
      <div class="sandbox-comparison-card">
        <div class="flex-between" style="font-size: 13px; font-weight: bold;">
          <span>Combined HP Recovery Boosts</span>
          <span style="font-size: 11px; color: var(--text-muted);">
            A: <strong style="color: var(--clash-gold);">+${a.hp}</strong> vs. B: <strong style="color: var(--clash-elixir);">+${b.hp}</strong>
          </span>
        </div>
        <div class="sandbox-comparison-bar-container">
          <div class="sandbox-comparison-bar loadout-a-fill" style="width: ${pctA_Hp}%;"></div>
        </div>
        <div class="sandbox-comparison-bar-container" style="margin-top: -6px;">
          <div class="sandbox-comparison-bar loadout-b-fill" style="width: ${pctB_Hp}%;"></div>
        </div>
      </div>
    </div>
  `;
}

window.selectSandboxHero = selectSandboxHero;
window.toggleActiveSandboxSlot = toggleActiveSandboxSlot;
window.slotSandboxGear = slotSandboxGear;
window.adjustSandboxGearLevel = adjustSandboxGearLevel;
window.saveSandboxLoadout = saveSandboxLoadout;
window.initHeroSandboxTab = initHeroSandboxTab;

// ============================================================================
// ⚔️ INTERACTIVE WAR TACTICS PLANNER CANVAS (MODULE 2)
// ============================================================================
state.tacticsNodes = [];
state.isTacticsDrawing = false;
state.tacticsPathPoints = [];

function initTacticsPlannerCanvas() {
  const container = document.getElementById('tactics-grid-container');
  const palette = document.getElementById('tactics-palette');
  const overlay = document.getElementById('tactics-svg-overlay');
  if (!container || !palette || !overlay) return;

  // Bind palette clicks
  palette.querySelectorAll('.palette-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      palette.querySelectorAll('.palette-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      if (typeof ClashSoundEngine !== 'undefined') ClashSoundEngine.playClick();
    });
  });

  // Bind click-to-place on grid
  container.addEventListener('click', (e) => {
    if (e.target.closest('.remove-tactic-btn') || e.target.closest('.tactic-node')) return;

    const rect = container.getBoundingClientRect();
    const x = Math.round(e.clientX - rect.left);
    const y = Math.round(e.clientY - rect.top);

    if (state.isTacticsDrawing) {
      // Draw path line
      state.tacticsPathPoints.push({ x, y });
      redrawTacticsSVG();
      if (typeof ClashSoundEngine !== 'undefined') ClashSoundEngine.playClick();
    } else {
      // Place marker node
      const activeBtn = palette.querySelector('.palette-btn.selected');
      if (!activeBtn) return;
      const type = activeBtn.getAttribute('data-tactic');
      const text = activeBtn.textContent.trim().split(' ')[1] || activeBtn.textContent.trim().substring(0,2);
      const color = activeBtn.getAttribute('data-color') || '';

      const node = { id: Date.now(), type, text, color, x, y };
      state.tacticsNodes.push(node);
      drawTacticsNodeElement(node);
      if (typeof ClashSoundEngine !== 'undefined') ClashSoundEngine.playHammer();
    }
  });

  // Load preset if exists
  const saved = localStorage.getItem('coc_tactics_preset');
  if (saved) {
    try {
      const data = JSON.parse(saved);
      state.tacticsNodes = data.nodes || [];
      state.tacticsPathPoints = data.paths || [];
      
      // Render
      clearTacticsCanvasElements();
      state.tacticsNodes.forEach(drawTacticsNodeElement);
      redrawTacticsSVG();
    } catch(err) {
      console.warn("Could not load tactics preset", err);
    }
  }
}

function drawTacticsNodeElement(node) {
  const container = document.getElementById('tactics-grid-container');
  if (!container) return;

  const div = document.createElement('div');
  div.className = 'tactic-node';
  div.style.left = `${node.x - 16}px`;
  div.style.top = `${node.y - 16}px`;
  div.style.background = node.color ? 'var(--bg-stone-dark)' : 'var(--clash-gold-gradient)';
  div.style.borderColor = node.color ? '#a5d6ff' : 'var(--clash-gold)';
  div.style.color = node.color ? '#fff' : '#000';
  div.id = `tactic-node-${node.id}`;

  div.innerHTML = `
    <span>${escapeHtml(node.text.substring(0, 2))}</span>
    <button class="remove-tactic-btn" onclick="removeTacticsNode(${node.id})">&times;</button>
  `;

  // Simple drag-to-position trigger
  let isDragging = false;
  div.addEventListener('mousedown', (e) => {
    isDragging = true;
    div.classList.add('active-drag');
    e.stopPropagation();
  });

  container.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const rect = container.getBoundingClientRect();
    const nx = Math.round(e.clientX - rect.left);
    const ny = Math.round(e.clientY - rect.top);
    
    div.style.left = `${nx - 16}px`;
    div.style.top = `${ny - 16}px`;
    
    // Update node coordinate
    const target = state.tacticsNodes.find(n => n.id === node.id);
    if (target) {
      target.x = nx;
      target.y = ny;
    }
  });

  document.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      div.classList.remove('active-drag');
    }
  });

  container.appendChild(div);

  // If spell, add visual radius circle overlay
  if (node.type.startsWith('spell-')) {
    const ring = document.createElement('div');
    ring.className = 'spell-ring-overlay';
    ring.style.left = `${node.x}px`;
    ring.style.top = `${node.y}px`;
    ring.style.width = '70px';
    ring.style.height = '70px';
    ring.style.background = node.color;
    ring.style.borderColor = node.color.replace('0.35', '0.7');
    ring.id = `spell-ring-${node.id}`;
    container.appendChild(ring);
  }
}

function removeTacticsNode(id) {
  state.tacticsNodes = state.tacticsNodes.filter(n => n.id !== id);
  const el = document.getElementById(`tactic-node-${id}`);
  const ring = document.getElementById(`spell-ring-${id}`);
  if (el) el.remove();
  if (ring) ring.remove();
  if (typeof ClashSoundEngine !== 'undefined') ClashSoundEngine.playClick();
}

function toggleTacticsDrawing() {
  state.isTacticsDrawing = !state.isTacticsDrawing;
  const btn = document.getElementById('tactics-draw-btn');
  if (!btn) return;
  btn.textContent = state.isTacticsDrawing ? "Drawing: ACTIVE" : "Draw Route";
  btn.style.background = state.isTacticsDrawing ? 'var(--clash-gold-gradient)' : 'rgba(74, 144, 226, 0.15)';
  btn.style.color = state.isTacticsDrawing ? '#000' : '#4a90e2';
  showToast(state.isTacticsDrawing ? "Route Drawing enabled! Tap on grid to draw corridors." : "Route Drawing disabled.", "info");
}

function redrawTacticsSVG() {
  const overlay = document.getElementById('tactics-svg-overlay');
  if (!overlay) return;

  if (state.tacticsPathPoints.length < 2) {
    overlay.innerHTML = '';
    return;
  }

  let d = `M ${state.tacticsPathPoints[0].x} ${state.tacticsPathPoints[0].y}`;
  for (let i = 1; i < state.tacticsPathPoints.length; i++) {
    d += ` L ${state.tacticsPathPoints[i].x} ${state.tacticsPathPoints[i].y}`;
  }

  overlay.innerHTML = `
    <defs>
      <marker id="tactic-arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 z" fill="#4a90e2" />
      </marker>
    </defs>
    <path d="${d}" fill="none" stroke="#4a90e2" stroke-width="3" stroke-dasharray="6,4" marker-end="url(#tactic-arrow)" />
  `;
}

function clearTacticsCanvas() {
  state.tacticsNodes = [];
  state.tacticsPathPoints = [];
  clearTacticsCanvasElements();
  showToast("Blackboard canvas cleared.", "info");
  if (typeof ClashSoundEngine !== 'undefined') ClashSoundEngine.playHorn();
}

function clearTacticsCanvasElements() {
  const container = document.getElementById('tactics-grid-container');
  if (container) {
    container.querySelectorAll('.tactic-node').forEach(el => el.remove());
    container.querySelectorAll('.spell-ring-overlay').forEach(el => el.remove());
  }
  const overlay = document.getElementById('tactics-svg-overlay');
  if (overlay) overlay.innerHTML = '';
}

function saveTacticsPlan() {
  const data = { nodes: state.tacticsNodes, paths: state.tacticsPathPoints };
  localStorage.setItem('coc_tactics_preset', JSON.stringify(data));
  showToast("Strategic Tactics blackboard layout saved locally!", "success");
  if (typeof ClashSoundEngine !== 'undefined') ClashSoundEngine.playFanfare();
}

function exportTacticsJSON() {
  const data = { nodes: state.tacticsNodes, paths: state.tacticsPathPoints };
  navigator.clipboard.writeText(JSON.stringify(data)).then(() => {
    showToast("Tactics board configuration copied to clipboard as JSON!", "success");
    if (typeof ClashSoundEngine !== 'undefined') ClashSoundEngine.playClick();
  });
}

function importTacticsJSON() {
  const str = prompt("Paste your tactics board JSON config here:");
  if (!str) return;
  try {
    const data = JSON.parse(str);
    state.tacticsNodes = data.nodes || [];
    state.tacticsPathPoints = data.paths || [];
    clearTacticsCanvasElements();
    state.tacticsNodes.forEach(drawTacticsNodeElement);
    redrawTacticsSVG();
    showToast("Tactics blackboard configuration imported successfully!", "success");
    if (typeof ClashSoundEngine !== 'undefined') ClashSoundEngine.playFanfare();
  } catch (err) {
    showToast("Failed to parse JSON configuration.", "error");
  }
}

window.toggleTacticsDrawing = toggleTacticsDrawing;
window.saveTacticsPlan = saveTacticsPlan;
window.exportTacticsJSON = exportTacticsJSON;
window.importTacticsJSON = importTacticsJSON;
window.clearTacticsCanvas = clearTacticsCanvas;
window.removeTacticsNode = removeTacticsNode;
window.initTacticsPlannerCanvas = initTacticsPlannerCanvas;

// ============================================================================
// 📋 CLAN ROSTER INACTIVITY AUDIT & INTEL (MODULE 3)
// ============================================================================
function renderClanAudit(clan) {
  const container = document.getElementById('clan-subview-audit');
  if (!container) return;

  const members = clan.memberList || [];
  
  // Roster audit calculation
  const auditedMembers = members.map(m => {
    const ratio = m.donations / (m.donationsReceived || 1);
    let mvpTag = '';
    let isInactive = false;

    if (m.donations > 8000) {
      mvpTag = `<span class="roster-mvp-badge"><i class="fas fa-trophy"></i> Donation Master</span>`;
    } else if (m.trophies > 5400) {
      mvpTag = `<span class="roster-mvp-badge"><i class="fas fa-crown"></i> Legend Pusher</span>`;
    }

    if (m.donations < 100 && ratio < 0.1 && m.role === 'member') {
      isInactive = true;
    }

    return {
      name: m.name,
      role: m.role,
      donations: m.donations,
      received: m.donationsReceived,
      trophies: m.trophies,
      mvpTag,
      isInactive
    };
  });

  const inactiveList = auditedMembers.filter(m => m.isInactive);
  const mvpList = auditedMembers.filter(m => m.mvpTag);

  container.innerHTML = `
    <div style="display: grid; grid-template-columns: 1fr 1.3fr; gap: 24px;">
      <!-- Left: Leader Diagnostics summary -->
      <div style="display:flex; flex-direction:column; gap: 20px;">
        <div class="results-card" style="min-height: auto;">
          <h3 class="gold-gradient-text" style="font-size: 18px; font-weight: 800; margin: 0;"><i class="fas fa-satellite"></i> Leadership Roster Intel</h3>
          <p style="font-size: 12px; color: var(--text-muted); margin-top: 4px; margin-bottom: 16px;">System diagnostics evaluating donation rates and pushes.</p>
          
          <div style="background: rgba(0,0,0,0.15); border: 1px solid var(--border-subtle); padding: 12px; border-radius: 8px;">
            <div class="flex-between" style="font-size: 13px; margin-bottom: 6px;">
              <span>Roster Audit Size</span>
              <strong>${members.length} members</strong>
            </div>
            <div class="flex-between" style="font-size: 13px; margin-bottom: 6px;">
              <span>MVP Ranks Flagged</span>
              <strong style="color: #4adb86;">${mvpList.length} MVPs</strong>
            </div>
            <div class="flex-between" style="font-size: 13px;">
              <span>Inactive flags (Warning)</span>
              <strong style="color: var(--clash-elixir);">${inactiveList.length} players</strong>
            </div>
          </div>
        </div>

        <!-- Inactivity Warnings Card -->
        <div class="results-card" style="min-height: auto;">
          <h3 style="font-size: 16px; font-weight: 800; color: var(--clash-elixir); margin-bottom: 12px;"><i class="fas fa-exclamation-triangle"></i> At Risk of Inactivity</h3>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            ${inactiveList.length === 0 ? `
              <div style="font-size: 12px; color: var(--text-muted); font-style: italic;">All clan roster members meet active thresholds!</div>
            ` : inactiveList.map(m => `
              <div class="flex-between" style="padding: 8px 12px; background: rgba(236, 59, 131, 0.05); border: 1px solid rgba(236, 59, 131, 0.2); border-radius: 8px; font-size: 12px;">
                <strong>${escapeHtml(m.name)}</strong>
                <span class="roster-inactive-badge"><i class="fas fa-clock"></i> Inactive (${m.donations} dn)</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>

      <!-- Right: Detailed audited members grid list -->
      <div class="results-card" style="min-height: auto;">
        <h3 style="font-size: 18px; font-weight: 800; border-bottom: 1px solid var(--border-subtle); padding-bottom: 12px; margin-bottom: 16px;"> Roster Audit Standings</h3>
        <div style="overflow-y: auto; max-height: 480px; display: flex; flex-direction: column; gap: 10px;">
          ${auditedMembers.map(m => `
            <div class="telemetry-row" style="border-color: ${m.isInactive ? 'rgba(236,59,131,0.2)' : 'var(--border-subtle)'}; background: ${m.isInactive ? 'rgba(236,59,131,0.02)' : 'rgba(0,0,0,0.1)'}; padding: 12px;">
              <div style="display: flex; flex-direction: column; gap: 4px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                  <strong style="color: var(--text-main); font-size: 13px;">${escapeHtml(m.name)}</strong>
                  <span style="font-size: 10px; color: var(--text-muted); text-transform: uppercase;">${escapeHtml(m.role)}</span>
                </div>
                <div style="font-size: 11px; color: var(--text-muted);">
                  Donated: <strong style="color:var(--text-main);">${m.donations}</strong> &bull; Received: <strong style="color:var(--text-main);">${m.received}</strong>
                </div>
              </div>
              <div style="text-align: right; display: flex; flex-direction: column; align-items: flex-end; gap: 6px;">
                <strong style="color: var(--clash-gold); font-size: 12px;"><i class="fas fa-trophy"></i> ${m.trophies}</strong>
                ${m.mvpTag}
                ${m.isInactive ? '<span class="roster-inactive-badge"><i class="fas fa-warning"></i> Flagged</span>' : ''}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

// Override toggleClanSubTab to support 'audit' subview
const originalToggleClanSubTab = window.toggleClanSubTab;
function premiumToggleClanSubTab(tab) {
  const rosterEl = document.getElementById('clan-subview-roster');
  const gamesEl = document.getElementById('clan-subview-games');
  const auditEl = document.getElementById('clan-subview-audit');

  const btnRoster = document.getElementById('btn-clan-roster');
  const btnGames = document.getElementById('btn-clan-games');
  const btnAudit = document.getElementById('btn-clan-audit');

  if (tab === 'audit') {
    if (rosterEl) rosterEl.style.display = 'none';
    if (gamesEl) gamesEl.style.display = 'none';
    if (auditEl) {
      auditEl.style.display = 'block';
      if (state.activeClanForAudit) {
        renderClanAudit(state.activeClanForAudit);
      }
    }

    if (btnRoster) btnRoster.classList.remove('active');
    if (btnGames) btnGames.classList.remove('active');
    if (btnAudit) btnAudit.classList.add('active');
    if (typeof ClashSoundEngine !== 'undefined') ClashSoundEngine.playClick();
  } else {
    if (auditEl) auditEl.style.display = 'none';
    if (btnAudit) btnAudit.classList.remove('active');
    
    // Call original toggle function for roster/games compatibility
    if (typeof originalToggleClanSubTab === 'function') {
      originalToggleClanSubTab(tab);
    } else {
      if (tab === 'roster') {
        if (rosterEl) rosterEl.style.display = 'flex';
        if (gamesEl) gamesEl.style.display = 'none';
        if (btnRoster) btnRoster.classList.add('active');
        if (btnGames) btnGames.classList.remove('active');
      } else {
        if (rosterEl) rosterEl.style.display = 'none';
        if (gamesEl) gamesEl.style.display = 'flex';
        if (btnRoster) btnRoster.classList.remove('active');
        if (btnGames) btnGames.classList.add('active');
      }
    }
  }
}
window.toggleClanSubTab = premiumToggleClanSubTab;
window.renderClanAudit = renderClanAudit;

// ============================================================================
// 🏆 CWL STANDINGS PREDICTION & GROUP SIMULATOR (MODULE 4)
// ============================================================================
function toggleCWLSimulator() {
  const container = document.getElementById('cwl-sim-container');
  const btn = document.getElementById('cwl-sim-toggle-btn');
  if (!container || !btn) return;

  const isHidden = container.style.display === 'none';
  container.style.display = isHidden ? 'flex' : 'none';
  btn.textContent = isHidden ? "📊 Close Standings Simulator" : "📊 Open CWL Standings Simulator";

  if (isHidden) {
    // Populate base standings
    const activeClanTag = state.activeClanTag || "#2PP2PP2P";
    const cwl = structuredClone(window.MOCK_DATA.cwl[activeClanTag] || window.MOCK_CWL[activeClanTag] || window.MOCK_CWL["#2PP2PP2P"]);
    
    // Seed simulation values
    state.cwlSimClans = cwl.clans.map((clan, idx) => {
      return {
        tag: clan.tag,
        name: clan.name,
        badgeUrls: clan.badgeUrls,
        stars: 32 - (idx * 3), // seed realistic base scores
        destruction: Math.max(0, 94.5 - (idx * 4.2))
      };
    });
    renderCWLSimulatorGrid();
  }
  if (typeof ClashSoundEngine !== 'undefined') ClashSoundEngine.playClick();
}

function renderCWLSimulatorGrid() {
  const container = document.getElementById('cwl-sim-container');
  if (!container) return;

  // Sort clans by predicted stars, then destruction
  const sortedClans = [...state.cwlSimClans].sort((a, b) => {
    if (b.stars !== a.stars) return b.stars - a.stars;
    return b.destruction - a.destruction;
  });

  const activeClanTag = state.activeClanTag || "#2PP2PP2P";
  const myClanIndex = sortedClans.findIndex(c => c.tag === activeClanTag);
  const myClanRank = myClanIndex + 1;

  let feedbackText = '';
  let statusColor = '#a8a8a8';
  if (myClanRank <= 2) {
    feedbackText = `🏆 Nova Esports is in rank ${myClanRank} (Promotion Zone)! Maintain simulated rate of stars to secure Champ II!`;
    statusColor = '#4adb86';
  } else if (myClanRank >= 7) {
    feedbackText = `⚠️ Nova Esports is in rank ${myClanRank} (Demotion Zone)! Increase simulated attacks to dodge demotion.`;
    statusColor = 'var(--clash-elixir)';
  } else {
    feedbackText = `🛡️ Nova Esports is rank ${myClanRank}. Stable standings tier secure. Needs ${sortedClans[1].stars - sortedClans[myClanIndex].stars + 1} stars to reach promotion zone.`;
    statusColor = 'var(--clash-gold)';
  }

  container.innerHTML = `
    <div class="results-card" style="min-height: auto; width: 100%;">
      <h3 style="font-size: 15px; color: var(--clash-gold); margin-bottom: 4px;"><i class="fas fa-calculator"></i> Simulated Bracket Standings</h3>
      <p style="font-size: 12px; color: var(--text-muted); margin-bottom: 16px;">Modify daily predicted stars to inspect real-time promotional updates.</p>
      
      <div style="overflow-x: auto; width: 100%;">
        <table class="leaderboard-table" style="font-size: 12px; width:100%;">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Clan Name</th>
              <th style="text-align: center;">Simulated Stars</th>
              <th style="text-align: center;">Simulated Destruction</th>
            </tr>
          </thead>
          <tbody>
            ${sortedClans.map((c, index) => {
              const isPromo = index < 2;
              const isDemo = index >= 6;
              const isHome = c.tag === activeClanTag;
              
              let rowStyle = '';
              if (isPromo) rowStyle = 'border-left: 4px solid #4adb86;';
              else if (isDemo) rowStyle = 'border-left: 4px solid #ff3b80;';
              if (isHome) rowStyle += ' background: rgba(245,166,35,0.05); font-weight:700;';

              return `
                <tr class="cwl-sim-row" style="${rowStyle}">
                  <td><span class="rank-badge ${index < 3 ? `rank-${index + 1}` : ''}">${index + 1}</span></td>
                  <td>
                    <div style="display: flex; align-items: center; gap: 8px;">
                      <img src="${c.badgeUrls.small}" alt="badge" style="width: 20px; height: 20px; object-fit: contain;"/>
                      <span>${escapeHtml(c.name)}</span>
                      ${isHome ? '<span class="badge-small" style="background: rgba(245,166,35,0.15); color: var(--clash-gold); font-size: 9px; padding: 1px 4px;">HOME</span>' : ''}
                    </div>
                  </td>
                  <td style="text-align: center;">
                    <div style="display:flex; justify-content:center; align-items:center; gap: 4px;">
                      <button onclick="adjustSimStars('${c.tag}', -1)" style="border:1px solid var(--border-subtle); background:rgba(255,255,255,0.05); color:#fff; width:20px; height:20px; border-radius:4px; font-weight:bold; cursor:pointer;">&minus;</button>
                      <input type="number" class="cwl-sim-input" value="${c.stars}" onchange="setSimStars('${c.tag}', this.value)">
                      <button onclick="adjustSimStars('${c.tag}', 1)" style="border:1px solid var(--border-subtle); background:rgba(255,255,255,0.05); color:#fff; width:20px; height:20px; border-radius:4px; font-weight:bold; cursor:pointer;">&plus;</button>
                    </div>
                  </td>
                  <td style="text-align: center;">
                    <input type="number" class="cwl-sim-input" style="width:56px;" value="${c.destruction}" onchange="setSimDestruction('${c.tag}', this.value)">%
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>

      <div style="background: rgba(0,0,0,0.2); border: 1px solid var(--border-subtle); padding: 12px; border-radius: 8px; margin-top: 16px; display: flex; align-items: center; gap: 10px;">
        <i class="fas fa-info-circle" style="color: ${statusColor}; font-size: 16px;"></i>
        <span style="font-size: 12px; font-weight: 700; color: ${statusColor};">${feedbackText}</span>
      </div>
    </div>
  `;
}

function adjustSimStars(tag, delta) {
  const target = state.cwlSimClans.find(c => c.tag === tag);
  if (target) {
    target.stars = Math.max(0, target.stars + delta);
    renderCWLSimulatorGrid();
  }
}

function setSimStars(tag, value) {
  const target = state.cwlSimClans.find(c => c.tag === tag);
  if (target) {
    target.stars = Math.max(0, parseInt(value) || 0);
    renderCWLSimulatorGrid();
  }
}

function setSimDestruction(tag, value) {
  const target = state.cwlSimClans.find(c => c.tag === tag);
  if (target) {
    target.destruction = Math.max(0, parseFloat(value) || 0);
    renderCWLSimulatorGrid();
  }
}

window.toggleCWLSimulator = toggleCWLSimulator;
window.adjustSimStars = adjustSimStars;
window.setSimStars = setSimStars;
window.setSimDestruction = setSimDestruction;

// Hook premium simulator trigger inside cwl loader
const originalLoadCWLData = window.loadCWLData;
async function premiumLoadCWLData(clanTag) {
  state.activeClanTag = clanTag;
  await originalLoadCWLData(clanTag);
  const container = document.getElementById('cwl-results-container');
  if (container) {
    const simToggleBtn = document.createElement('button');
    simToggleBtn.className = 'primary-btn';
    simToggleBtn.id = 'cwl-sim-toggle-btn';
    simToggleBtn.style.marginTop = '16px';
    simToggleBtn.style.width = '100%';
    simToggleBtn.textContent = "📊 Open CWL Standings Simulator";
    simToggleBtn.onclick = toggleCWLSimulator;
    container.appendChild(simToggleBtn);

    const simContainer = document.createElement('div');
    simContainer.id = 'cwl-sim-container';
    simContainer.style.display = 'none';
    simContainer.style.marginTop = '16px';
    simContainer.style.flexDirection = 'column';
    simContainer.style.gap = '16px';
    container.appendChild(simContainer);
  }
}
window.loadCWLData = premiumLoadCWLData;

// ============================================================================
// 🎛️ DIAGNOSTICS CONSOLE & TELEMETRY (MODULE 5)
// ============================================================================
state.telemetryQueries = [];

function toggleInspectTab(tab) {
  const jsonTab = document.getElementById('inspect-tab-json');
  const telTab = document.getElementById('inspect-tab-telemetry');
  const jsonView = document.getElementById('inspect-json-view');
  const telView = document.getElementById('inspect-telemetry-view');
  
  if (!jsonTab || !telTab || !jsonView || !telView) return;

  if (tab === 'json') {
    jsonTab.classList.add('active');
    telTab.classList.remove('active');
    jsonView.style.display = 'flex';
    telView.style.display = 'none';
  } else {
    jsonTab.classList.remove('active');
    telTab.classList.add('active');
    jsonView.style.display = 'none';
    telView.style.display = 'flex';
    updateTelemetryCacheUI();
  }
  if (typeof ClashSoundEngine !== 'undefined') ClashSoundEngine.playClick();
}

function logTelemetryQuery(endpoint, latencyMs, isHit) {
  const latency = Math.round(latencyMs);
  state.telemetryQueries.unshift({ endpoint, latency, isHit });
  if (state.telemetryQueries.length > 5) state.telemetryQueries.pop();

  const list = document.getElementById('telemetry-latency-list');
  if (list) {
    list.innerHTML = state.telemetryQueries.map(q => {
      let speedClass = 'good';
      if (q.latency > 500) speedClass = 'slow';
      else if (q.latency > 150) speedClass = 'average';

      return `
        <div class="telemetry-row">
          <span style="font-family: monospace; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; width: 65%;" title="${escapeHtml(q.endpoint)}">${escapeHtml(q.endpoint)}</span>
          <div style="display:flex; align-items:center; gap: 8px;">
            ${q.isHit ? '<span class="badge-small" style="background: rgba(74,219,134,0.1); color: #4adb86; font-size:9px;">CACHE HIT</span>' : ''}
            <span class="telemetry-latency-tag ${speedClass}">${q.latency} ms</span>
          </div>
        </div>
      `;
    }).join('');
  }
  updateTelemetryCacheUI();
}

function updateTelemetryCacheUI() {
  const sizeEl = document.getElementById('telemetry-cache-allocated');
  const hitRatioEl = document.getElementById('telemetry-cache-hitratio');
  const rLimitEl = document.getElementById('telemetry-rate-remaining');
  const rBarEl = document.getElementById('telemetry-rate-bar');

  if (sizeEl) sizeEl.textContent = `${cocCache.size} / 50 items`;

  if (hitRatioEl) {
    if (state.telemetryQueries.length === 0) {
      hitRatioEl.textContent = '0%';
    } else {
      const hits = state.telemetryQueries.filter(q => q.isHit).length;
      const ratio = Math.round((hits / state.telemetryQueries.length) * 100);
      hitRatioEl.textContent = `${ratio}%`;
    }
  }

  const remaining = state.telemetryRateRemaining !== undefined ? state.telemetryRateRemaining : 30;
  const limit = state.telemetryRateLimit || 30;
  
  if (rLimitEl) rLimitEl.textContent = `${remaining} / ${limit} remaining`;
  if (rBarEl) {
    const pct = Math.round((remaining / limit) * 100);
    rBarEl.style.width = `${pct}%`;
    rBarEl.style.setProperty('--fill-color', pct < 35 ? 'var(--clash-elixir-gradient)' : pct < 70 ? 'var(--clash-gold-gradient)' : 'linear-gradient(90deg, #4adb86 0%, #a2f9c5 100%)');
  }
}

function clearTelemetryCache() {
  cocCache.clear();
  showToast("LRU Cache map memory successfully purged!", "success");
  if (typeof ClashSoundEngine !== 'undefined') ClashSoundEngine.playHorn();
  updateTelemetryCacheUI();
}

window.toggleInspectTab = toggleInspectTab;
window.clearTelemetryCache = clearTelemetryCache;
window.logTelemetryQuery = logTelemetryQuery;

// ============================================================================
// 💾 DASHBOARD SYNC & BACKUP CENTRE (MODULE 6)
// ============================================================================
function exportDashboardBackup() {
  const backup = {
    favorites: localStorage.getItem('coc_favorites'),
    legend_attacks: localStorage.getItem('coc_legend_attacks'),
    legend_defenses: localStorage.getItem('coc_legend_defenses'),
    legend_start: localStorage.getItem('coc_legend_start'),
    canvas_preset: localStorage.getItem('coc_canvas_preset'),
    discord_webhook: localStorage.getItem('coc_discord_webhook'),
    tactics_preset: localStorage.getItem('coc_tactics_preset'),
    widget_chart: localStorage.getItem('coc_widget_chart'),
    widget_goldpass: localStorage.getItem('coc_widget_goldpass'),
    widget_heatmap: localStorage.getItem('coc_widget_heatmap'),
    widget_bookmarks: localStorage.getItem('coc_widget_bookmarks')
  };

  const str = JSON.stringify(backup, null, 2);
  const blob = new Blob([str], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `clash-command-center-backup-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 0);

  showToast("Backup exported successfully!", "success");
  if (typeof ClashSoundEngine !== 'undefined') ClashSoundEngine.playFanfare();
}

function triggerImportFile() {
  const input = document.getElementById('import-backup-file-input');
  if (input) input.click();
}

function importDashboardBackup(fileInput) {
  const file = fileInput.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = JSON.parse(e.target.result);
      
      // Validation check
      const keys = ['favorites', 'legend_attacks', 'canvas_preset', 'discord_webhook'];
      const isValid = keys.some(k => Object.keys(data).includes(k));
      if (!isValid) {
        showToast("Invalid backup file structure.", "error");
        return;
      }

      // Restore
      Object.keys(data).forEach(key => {
        if (data[key] !== null && data[key] !== undefined) {
          localStorage.setItem(key, data[key]);
        }
      });

      showToast("Backup imported successfully! Reloading...", "success");
      if (typeof ClashSoundEngine !== 'undefined') ClashSoundEngine.playFanfare();
      
      setTimeout(() => {
        window.location.reload();
      }, 1500);

    } catch (err) {
      showToast("Failed to read or parse backup file.", "error");
    }
  };
  reader.readAsText(file);
}

window.exportDashboardBackup = exportDashboardBackup;
window.triggerImportFile = triggerImportFile;
window.importDashboardBackup = importDashboardBackup;

