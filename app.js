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

  // Update visible pane
  document.querySelectorAll('.view-pane').forEach(pane => {
    pane.classList.toggle('active', pane.id === `${tabName}-pane`);
  });
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
        <strong>${escapeHtml(fav.name)}</strong>
        <small style="color: var(--clash-gold); font-size: 10px;">${escapeHtml(fav.tag)}</small>
      </div>
      <i class="fas fa-trash delete-fav" data-action="remove-favorite" data-index="${index}"></i>
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
          result = structuredClone(window.MOCK_CAPITAL_RAIDS[tag]);
        } else {
          result = structuredClone(Object.values(window.MOCK_CAPITAL_RAIDS)[0]);
        }
      }
      // Requesting clan itself
      else {
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
          <h3>📈 Trophies Density Density</h3>
          <div class="chart-container-responsive mt-12">
            <canvas id="clanChartCanvas"></canvas>
          </div>
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
  const container = document.getElementById('gold-pass-container');
  if (!container) return;

  try {
    container.innerHTML = `
      <div class="section-header">
        <h3>🎁 Season Gold Pass rewards</h3>
        <span style="font-size: 12px; color: var(--text-muted);">Current season rewards</span>
      </div>
      
      <div style="display: flex; flex-direction: column; gap: 12px; margin-top: 16px;">
        ${(goldpass.rewards || []).slice(0, 3).map(rew => `
          <div class="card-item" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; cursor: pointer;" onclick="showGoldPassRewardInfo('${escapeHtml(rew.name)}', '${escapeHtml(rew.type)}', ${rew.points})">
            <div>
              <strong style="color: var(--text-main); font-size: 13px;">${escapeHtml(rew.name)}</strong><br/>
              <span class="badge-small" style="background: rgba(245,166,35,0.1); color: var(--clash-gold); font-size: 9px; margin-top: 4px; display: inline-block;">${escapeHtml(rew.type.toUpperCase())}</span>
            </div>
            <strong style="color: var(--clash-gold); font-size: 13px;">${rew.points} Pts</strong>
          </div>
        `).join('')}
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
