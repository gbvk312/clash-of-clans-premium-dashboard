// Clash of Clans Dashboard App Controller - Premium Hybrid connection

// State Management
const state = {
  activeTab: 'overview',
  apiToken: sessionStorage.getItem('coc_api_token') || localStorage.getItem('coc_api_token') || '',
  proxyUrl: localStorage.getItem('coc_proxy_url') || 'https://cors-anywhere.herokuapp.com/',
  favorites: JSON.parse(localStorage.getItem('coc_favorites')) || [],
  homeClanTag: localStorage.getItem('coc_home_clan') || '',
  mode: localStorage.getItem('coc_dashboard_mode') || 'demo', // Defaults to 'demo' for premium visual experience out-of-the-box
  
  // Loaded Data
  currentClan: null,
  currentPlayer: null,
  currentWar: null,

  // Comparison Data
  compareClans: { a: null, b: null },

  // Table Sort State
  rosterSortKey: 'trophies',
  rosterSortDirection: 'desc'
};

// Global Chart references to avoid overlay bugs
let overviewChart = null;
let clanChart = null;
let warInterval = null;
let countdownInterval = null;
let comparisonChart = null;

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
      <button class="search-dropdown-clear" onclick="searchHistory.clear('${type}'); document.getElementById('${inputId}-dropdown').classList.remove('visible');">Clear</button>
    </div>
    ${history.map(h => `
      <div class="search-dropdown-item" data-tag="${escapeHtml(h.tag)}">
        <i class="fas fa-history"></i>
        <span>${escapeHtml(h.name || h.tag)}</span>
        <small style="color: var(--text-muted); margin-left: auto;">${escapeHtml(h.tag)}</small>
      </div>
    `).join('')}
  `;
  
  dropdown.querySelectorAll('.search-dropdown-item').forEach(item => {
    item.addEventListener('click', () => {
      input.value = item.dataset.tag;
      dropdown.classList.remove('visible');
      input.closest('form')?.dispatchEvent(new Event('submit', { cancelable: true }));
    });
  });
  
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


// DOM Elements
document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

function initApp() {
  setupNavigation();
  setupSettingsModal();
  setupSearchForms();
  renderFavorites();
  
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
      case '5': switchTab('compare'); break;
      case '/':
        e.preventDefault();
        const activePane = document.querySelector('.view-pane.active');
        const input = activePane?.querySelector('input[type="text"]');
        if (input) input.focus();
        break;
    }
  });

  // Initialize page components
  showInitialPlaceholders();
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
      <div class="fav-details" onclick="quickLoadBookmark('${escapeHtml(fav.type)}', '${escapeHtml(fav.tag)}')">
        <strong>${escapeHtml(fav.name)}</strong>
        <small style="color: var(--clash-gold); font-size: 10px;">${escapeHtml(fav.tag)}</small>
      </div>
      <i class="fas fa-trash delete-fav" onclick="removeFavorite(${index}, event)"></i>
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
  event.stopPropagation();
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

  // Search history dropdowns
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
    }
  });
}

// Fetch Logic (Supports Live API & Demo / Sandbox interception)
async function fetchCocData(endpoint) {
  // If in Demo Mode, bypass the real HTTP request and serve mockData instead!
  if (state.mode === 'demo') {
    // Add dynamic network delay for that premium high-fidelity interface feel
    await new Promise(resolve => setTimeout(resolve, 600));

    // Handle Clan & CurrentWar routing
    if (endpoint.startsWith('/clans/')) {
      const parts = endpoint.split('/');
      const tag = parts[2];
      
      // If requesting active war
      if (parts[3] === 'currentwar') {
        if (window.MOCK_WARS && window.MOCK_WARS[tag]) {
          return JSON.parse(JSON.stringify(window.MOCK_WARS[tag]));
        }
        // Fallback default war log
        return JSON.parse(JSON.stringify(Object.values(window.MOCK_WARS)[0]));
      }
      
      // Requesting clan itself
      if (window.MOCK_CLANS && window.MOCK_CLANS[tag]) {
        return JSON.parse(JSON.stringify(window.MOCK_CLANS[tag]));
      }
      
      // Dynamically generate a clan if searched tag is not in pre-seed
      const template = Object.values(window.MOCK_CLANS)[0];
      const copy = JSON.parse(JSON.stringify(template));
      copy.tag = tag;
      copy.name = `Clan ${tag.replace('#', '')}`;
      return copy;
    }

    // Handle Player profiling routing
    if (endpoint.startsWith('/players/')) {
      const tag = endpoint.split('/')[2];
      if (window.MOCK_PLAYERS && window.MOCK_PLAYERS[tag]) {
        return JSON.parse(JSON.stringify(window.MOCK_PLAYERS[tag]));
      }
      
      // Dynamically generate player details
      const template = Object.values(window.MOCK_PLAYERS)[0];
      const copy = JSON.parse(JSON.stringify(template));
      copy.tag = tag;
      copy.name = `Clasher ${tag.replace('#', '')}`;
      return copy;
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

  return response.json();
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
    container.innerHTML = `<div class="placeholder-state"><i class="fas fa-times-circle"></i><p>Error: ${escapeHtml(err.message)}</p><button class="primary-btn mt-16" onclick="loadClanData('${escapeHtml(tag)}')">Retry</button></div>`;
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
    container.innerHTML = `<div class="placeholder-state"><i class="fas fa-times-circle"></i><p>Error: ${escapeHtml(err.message)}</p><button class="primary-btn mt-16" onclick="loadPlayerData('${escapeHtml(tag)}')">Retry</button></div>`;
  }
}

async function loadWarData(clanTag) {
  const container = document.getElementById('war-results-container');
  container.innerHTML = getSkeletonHTML();
  
  try {
    const war = await fetchCocData(`/clans/${clanTag}/currentwar`);
    if (!war || war.state === 'notInWar') {
      container.innerHTML = `<div class="placeholder-state"><i class="fas fa-shield-alt"></i><p>This clan is currently not in an active war.</p></div>`;
      return;
    }
    state.currentWar = war;
    renderWar(war);
  } catch (err) {
    container.innerHTML = `<div class="placeholder-state"><i class="fas fa-times-circle"></i><p>Error loading war log: ${escapeHtml(err.message)}</p><button class="primary-btn mt-16" onclick="loadWarData('${escapeHtml(clanTag)}')">Retry</button></div>`;
  }
}

// Initial View Placeholders
function showInitialPlaceholders() {
  document.getElementById('clan-results-container').innerHTML = `
    <div class="placeholder-state">
      <i class="fas fa-users" style="font-size: 48px; color: var(--clash-gold); opacity: 0.6; margin-bottom: 12px;"></i>
      <p style="font-size: 15px; color: var(--text-muted);">Enter your Clan Tag on the left side menu to inspect live statistics.</p>
    </div>
  `;

  document.getElementById('player-results-container').innerHTML = `
    <div class="placeholder-state">
      <i class="fas fa-user-shield" style="font-size: 48px; color: var(--clash-elixir); opacity: 0.6; margin-bottom: 12px;"></i>
      <p style="font-size: 15px; color: var(--text-muted);">Search your Player Tag on the left to inspect levels, equipment, and achievements.</p>
    </div>
  `;

  document.getElementById('war-results-container').innerHTML = `
    <div class="placeholder-state">
      <i class="fas fa-fire" style="font-size: 48px; color: var(--clash-dark-elixir); opacity: 0.6; margin-bottom: 12px;"></i>
      <p style="font-size: 15px; color: var(--text-muted);">Search a Clan Tag on the left to track active war scoreboards.</p>
    </div>
  `;

  // Handle Overview Panel
  const overviewContainer = document.querySelector('#overview-pane .explorer-grid');
  
  if (state.homeClanTag) {
    loadOverviewClan(state.homeClanTag);
    return;
  }

  // Welcome state prompting home clan setup
  overviewContainer.innerHTML = `
    <div class="results-card" style="grid-column: span 2; min-height: auto; align-items: center; justify-content: center; padding: 40px; text-align: center;">
      <i class="fas fa-home" style="font-size: 52px; color: var(--clash-gold); margin-bottom: 16px;"></i>
      <h3 style="font-size: 20px; font-weight: 700; margin-bottom: 8px;">Configure Your Command Center</h3>
      <p style="color: var(--text-muted); max-width: 480px; line-height: 1.6; margin-bottom: 24px;">
        To establish a permanent homepage, set up a default home clan. Simply type your Clan Tag below and save!
      </p>
      <div style="display: flex; gap: 8px; width: 100%; max-width: 400px; margin-bottom: 12px;">
        <input type="text" id="home-tag-setup-input" placeholder="e.g. #2PP2PP2P" style="flex: 1; background: var(--bg-stone-dark); border: 1px solid var(--border-subtle); border-radius: 8px; padding: 10px; color: #fff; text-transform: uppercase;">
        <button class="primary-btn" onclick="saveHomeClan()" style="padding: 10px 20px; border-radius: 8px; font-size: 13px;">Set Home</button>
      </div>
      <div style="font-size: 12px; color: var(--text-muted);">Don't have a token? Set up your credentials under <strong>API Settings</strong>.</div>
    </div>
  `;
}

function saveHomeClan() {
  const tagInput = document.getElementById('home-tag-setup-input');
  if (!tagInput) return;
  const tag = tagInput.value.trim().toUpperCase();
  if (!tag) return;

  state.homeClanTag = tag;
  localStorage.setItem('coc_home_clan', tag);
  loadOverviewClan(tag);
}

// Load Home Clan on Overview
async function loadOverviewClan(tag) {
  const overviewContainer = document.querySelector('#overview-pane .explorer-grid');
  overviewContainer.innerHTML = `
    <div class="results-card" style="grid-column: span 2; min-height: auto; align-items: center; justify-content: center; padding: 40px;">
      ${getSkeletonHTML()}
    </div>
  `;

  try {
    const clan = await fetchCocData(`/clans/${tag}`);
    if (!clan) {
      state.homeClanTag = '';
      localStorage.removeItem('coc_home_clan');
      showInitialPlaceholders();
      return;
    }

    overviewContainer.innerHTML = `
      <!-- Featured Clan Summary -->
      <div class="results-card" style="min-height: auto;">
        <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border-subtle); padding-bottom: 16px;">
          <div style="display: flex; align-items: center; gap: 16px;">
            <img src="${clan.badgeUrls.medium}" alt="badge" style="width: 48px; height: 48px; object-fit: contain;"/>
            <div>
              <h3 style="font-size: 20px; font-weight: 700;">${escapeHtml(clan.name)}</h3>
              <span class="level-tag" style="font-size: 11px; padding: 2px 6px;">Level ${clan.clanLevel}</span>
            </div>
          </div>
          <button class="config-btn" onclick="state.homeClanTag=''; localStorage.removeItem('coc_home_clan'); showInitialPlaceholders();" style="font-size: 11px; padding: 4px 10px; border-radius: 6px; color: var(--clash-elixir);">Reset Home</button>
        </div>
        <p style="color: var(--text-muted); line-height: 1.5; font-size: 14px; margin-top: 10px;">${escapeHtml(clan.description || 'No description provided.')}</p>
        
        <div class="stats-row" style="margin-top: 16px;">
          <div class="stat-card gold-glow" style="padding: 16px; background: var(--bg-stone-dark);">
            <div class="stat-icon gold" style="width: 40px; height: 40px; font-size: 16px;"><i class="fas fa-trophy"></i></div>
            <div class="stat-details">
              <h4 style="font-size: 12px;">Total Trophies</h4>
              <p style="font-size: 18px;" id="overview-trophy-val">${clan.clanPoints.toLocaleString()}</p>
            </div>
          </div>
          <div class="stat-card elixir-glow" style="padding: 16px; background: var(--bg-stone-dark);">
            <div class="stat-icon elixir" style="width: 40px; height: 40px; font-size: 16px;"><i class="fas fa-users"></i></div>
            <div class="stat-details">
              <h4 style="font-size: 12px;">Members</h4>
              <p style="font-size: 18px;">${clan.members} / 50</p>
            </div>
          </div>
          <div class="stat-card dark-glow" style="padding: 16px; background: var(--bg-stone-dark);">
            <div class="stat-icon dark" style="width: 40px; height: 40px; font-size: 16px;"><i class="fas fa-shield"></i></div>
            <div class="stat-details">
              <h4 style="font-size: 12px;">War Wins</h4>
              <p style="font-size: 18px;" id="overview-warwins-val">${clan.warWins}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Overview Analytics Card -->
      <div class="results-card" style="min-height: auto; justify-content: center; align-items: center; gap: 16px;">
        <h3 style="font-size: 18px; font-weight: 700; align-self: flex-start; border-bottom: 1px solid var(--border-subtle); padding-bottom: 12px; width: 100%;">Clan League Distribution</h3>
        <div style="position: relative; width: 100%; height: 200px;">
          <canvas id="overview-chart"></canvas>
        </div>
      </div>
    `;

    // Animate stat values
    const trophyEl = document.getElementById('overview-trophy-val');
    const warsEl = document.getElementById('overview-warwins-val');
    if (trophyEl) animateValue(trophyEl, 0, clan.clanPoints, 1500);
    if (warsEl) animateValue(warsEl, 0, clan.warWins, 1200);

    // Render league band graph
    await loadChartJs();
    initOverviewChart(clan);
  } catch (err) {
    overviewContainer.innerHTML = `
      <div class="results-card" style="grid-column: span 2; min-height: auto; align-items: center; justify-content: center; padding: 40px; text-align: center;">
        <i class="fas fa-times-circle" style="font-size: 48px; color: var(--clash-elixir); margin-bottom: 16px;"></i>
        <h3 style="font-size: 18px; font-weight: 700; margin-bottom: 8px;">Error Loading Home Clan</h3>
        <p style="color: var(--text-muted); line-height: 1.6; margin-bottom: 16px;">${escapeHtml(err.message)}</p>
        <button class="config-btn" onclick="state.homeClanTag=''; localStorage.removeItem('coc_home_clan'); showInitialPlaceholders();">Reset Home Clan</button>
      </div>
    `;
  }
}

// Canvas vertical gradient generator for ChartJS
function createVerticalGradient(ctx, colorStart, colorEnd) {
  const gradient = ctx.createLinearGradient(0, 0, 0, 200);
  gradient.addColorStop(0, colorStart);
  gradient.addColorStop(1, colorEnd);
  return gradient;
}

// Distribution Chart
function initOverviewChart(clan) {
  const ctx = document.getElementById('overview-chart').getContext('2d');
  if (overviewChart) {
    overviewChart.destroy();
  }

  const members = clan.memberList || [];
  const bands = { '5000+': 0, '4500-4999': 0, '4000-4499': 0, 'Under 4000': 0 };
  
  members.forEach(m => {
    if (m.trophies >= 5000) bands['5000+']++;
    else if (m.trophies >= 4500) bands['4500-4999']++;
    else if (m.trophies >= 4000) bands['4000-4499']++;
    else bands['Under 4000']++;
  });

  const goldGrad = createVerticalGradient(ctx, 'rgba(255, 224, 102, 0.85)', 'rgba(212, 130, 0, 0.85)');
  const elixirGrad = createVerticalGradient(ctx, 'rgba(255, 110, 167, 0.85)', 'rgba(181, 19, 87, 0.85)');
  const darkGrad = createVerticalGradient(ctx, 'rgba(178, 127, 255, 0.85)', 'rgba(82, 12, 174, 0.85)');
  const mutedGrad = createVerticalGradient(ctx, 'rgba(142, 155, 174, 0.85)', 'rgba(50, 60, 75, 0.85)');

  overviewChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: Object.keys(bands),
      datasets: [{
        label: 'Members Count',
        data: Object.values(bands),
        backgroundColor: [goldGrad, elixirGrad, darkGrad, mutedGrad],
        borderColor: ['#F5A623', '#EC3B83', '#8B44FD', '#8E9BAE'],
        borderWidth: 2,
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: {
          ticks: { color: '#8E9BAE', stepSize: 1 },
          grid: { color: 'rgba(255, 255, 255, 0.05)' }
        },
        x: {
          ticks: { color: '#8E9BAE' },
          grid: { display: false }
        }
      }
    }
  });
}

// Clan Renderer
function renderClan(clan) {
  const container = document.getElementById('clan-results-container');
  const isBookmarked = state.favorites.some(fav => fav.tag === clan.tag);
  
  // Sort Roster
  const sortedMembers = [...(clan.memberList || [])].sort((a, b) => {
    let aVal = a[state.rosterSortKey];
    let bVal = b[state.rosterSortKey];
    
    if (state.rosterSortKey === 'role') {
      const order = { 'leader': 4, 'coLeader': 3, 'elder': 2, 'member': 1 };
      aVal = order[a.role] || 0;
      bVal = order[b.role] || 0;
    }
    
    if (state.rosterSortDirection === 'asc') {
      return aVal > bVal ? 1 : -1;
    } else {
      return aVal < bVal ? 1 : -1;
    }
  });

  const getSortIcon = (key) => {
    if (state.rosterSortKey === key) {
      return state.rosterSortDirection === 'asc' ? ' <i class="fas fa-sort-up"></i>' : ' <i class="fas fa-sort-down"></i>';
    }
    return ' <i class="fas fa-sort" style="opacity: 0.3;"></i>';
  };

  let rosterHtml = '';
  if (sortedMembers.length > 0) {
    rosterHtml = `
      <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 32px; border-bottom: 1px solid var(--border-subtle); padding-bottom: 12px;">
        <h3>Clan Roster & Leaderboards</h3>
        <small style="color: var(--text-muted);">Click column headers to sort</small>
      </div>
      <table class="clan-roster-table">
        <thead>
          <tr>
            <th class="sort-header" onclick="toggleRosterSort('clanRank')">Rank${getSortIcon('clanRank')}</th>
            <th>Name</th>
            <th class="sort-header" onclick="toggleRosterSort('role')">Role${getSortIcon('role')}</th>
            <th class="sort-header" onclick="toggleRosterSort('trophies')">Trophies${getSortIcon('trophies')}</th>
            <th class="sort-header" onclick="toggleRosterSort('donations')">Donated${getSortIcon('donations')}</th>
            <th class="sort-header" onclick="toggleRosterSort('donationsReceived')">Received${getSortIcon('donationsReceived')}</th>
          </tr>
        </thead>
        <tbody>
          ${sortedMembers.map(member => `
            <tr>
              <td>${member.clanRank}</td>
              <td>
                <div class="name-container">
                  ${member.league && member.league.iconUrls ? `<img class="league-icon" src="${member.league.iconUrls.small}" alt="league"/>` : ''}
                  <div>
                    <strong style="color: var(--text-main); cursor: pointer;" onclick="quickLoadBookmark('player', '${escapeHtml(member.tag)}')">${escapeHtml(member.name)}</strong>
                    <span class="inspect-badge" onclick="quickLoadBookmark('player', '${escapeHtml(member.tag)}')" style="margin-left: 8px;">Inspect</span><br/>
                    <small style="color: var(--text-muted);">${escapeHtml(member.tag)}</small>
                  </div>
                </div>
              </td>
              <td><span class="badge-small role-${member.role}">${member.role.replace(/([A-Z])/g, ' $1')}</span></td>
              <td><strong style="color: var(--clash-gold);"><i class="fas fa-trophy"></i> ${member.trophies}</strong></td>
              <td style="color: var(--clash-elixir); font-weight: 600;">${member.donations}</td>
              <td style="color: var(--clash-dark-elixir); font-weight: 600;">${member.donationsReceived}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  // Clan Capital Districts
  let capitalHtml = '';
  if (clan.clanCapital && clan.clanCapital.districts) {
    capitalHtml = `
      <div style="margin-top: 32px;">
        <h3>Clan Capital Hall (Level ${clan.clanCapital.capitalHallLevel})</h3>
        <div class="capital-grid">
          ${clan.clanCapital.districts.map(d => `
            <div class="capital-item">
              <div class="capital-item-title">${escapeHtml(d.name)}</div>
              <span class="level-tag" style="font-size: 11px; padding: 2px 6px; background: var(--clash-dark-elixir-gradient); color: #fff;">LVL ${d.districtHallLevel}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  container.innerHTML = `
    <div class="detail-header">
      <div class="badge-lg">
        <img src="${clan.badgeUrls.medium}" alt="badge"/>
      </div>
      <div class="header-info" style="flex: 1;">
        <h2 style="display: flex; align-items: center; justify-content: space-between;">
          <span>${escapeHtml(clan.name)} <span class="level-tag">LVL ${clan.clanLevel}</span></span>
          <div style="display: flex; gap: 8px;">
            <button class="export-btn" onclick="exportToClipboard('clan')"><i class="fas fa-share-alt"></i> Share</button>
            <button class="config-btn" onclick="state.homeClanTag='${escapeHtml(clan.tag)}'; localStorage.setItem('coc_home_clan', '${escapeHtml(clan.tag)}'); showToast('Home Clan updated!', 'success');" style="font-size: 12px; padding: 6px 12px; border-radius: 8px;">🏠 Set Home</button>
            <button id="clan-bookmark-btn" class="bookmark-btn ${isBookmarked ? 'active' : ''}" onclick="toggleFavorite('clan', '${escapeHtml(clan.tag)}', '${escapeHtml(clan.name)}')">
              <i class="${isBookmarked ? 'fas' : 'far'} fa-star"></i>
            </button>
          </div>
        </h2>
        <p>${escapeHtml(clan.tag)} &bull; ${escapeHtml(clan.type.replace(/([A-Z])/g, ' $1'))} &bull; ${clan.members} members</p>
      </div>
    </div>
    
    <div class="stats-row">
      <div class="stat-card gold-glow">
        <div class="stat-icon gold"><i class="fas fa-trophy"></i></div>
        <div class="stat-details">
          <h4>Clan Trophies</h4>
          <p>${clan.clanPoints ? clan.clanPoints.toLocaleString() : 0}</p>
        </div>
      </div>
      <div class="stat-card elixir-glow">
        <div class="stat-icon elixir"><i class="fas fa-swords"></i></div>
        <div class="stat-details">
          <h4>War Record</h4>
          <p>${clan.warWins}W / ${clan.warLosses}L</p>
        </div>
      </div>
      <div class="stat-card dark-glow">
        <div class="stat-icon dark"><i class="fas fa-fire"></i></div>
        <div class="stat-details">
          <h4>Win Streak</h4>
          <p>${clan.warWinStreak || 0}</p>
        </div>
      </div>
    </div>

    <!-- Clan Roster Analytics Chart -->
    <div style="margin-top: 32px;">
      <h3>Clan Donation Ratios</h3>
      <div style="position: relative; width: 100%; height: 220px; margin-top: 16px;">
        <canvas id="clan-chart"></canvas>
      </div>
    </div>

    <div>
      <h3>Description</h3>
      <p style="color: var(--text-muted); line-height: 1.6; margin-top: 8px;">${escapeHtml(clan.description || 'No description provided.')}</p>
    </div>

    ${capitalHtml}
    ${rosterHtml}
  `;

  // Draw Clan Donation Charts
  loadChartJs().then(() => initClanChart(clan));
}

async function initClanChart(clan) {
  await loadChartJs();
  const ctx = document.getElementById('clan-chart').getContext('2d');
  if (clanChart) {
    clanChart.destroy();
  }

  const members = clan.memberList || [];
  const names = members.map(m => m.name);
  const donations = members.map(m => m.donations);
  const received = members.map(m => m.donationsReceived);

  const elixirGrad = createVerticalGradient(ctx, 'rgba(255, 110, 167, 0.85)', 'rgba(181, 19, 87, 0.85)');
  const darkGrad = createVerticalGradient(ctx, 'rgba(178, 127, 255, 0.85)', 'rgba(82, 12, 174, 0.85)');

  clanChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: names,
      datasets: [
        {
          label: 'Donations Given',
          data: donations,
          backgroundColor: elixirGrad,
          borderColor: '#EC3B83',
          borderWidth: 2,
          borderRadius: 4
        },
        {
          label: 'Donations Received',
          data: received,
          backgroundColor: darkGrad,
          borderColor: '#8B44FD',
          borderWidth: 2,
          borderRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#8E9BAE' } }
      },
      scales: {
        y: {
          ticks: { color: '#8E9BAE' },
          grid: { color: 'rgba(255, 255, 255, 0.05)' }
        },
        x: {
          ticks: { color: '#8E9BAE' },
          grid: { display: false }
        }
      }
    }
  });
}

function toggleRosterSort(key) {
  if (state.rosterSortKey === key) {
    state.rosterSortDirection = state.rosterSortDirection === 'desc' ? 'asc' : 'desc';
  } else {
    state.rosterSortKey = key;
    state.rosterSortDirection = 'desc';
  }
  if (state.currentClan) {
    renderClan(state.currentClan);
  }
}

// Player Renderer
function renderPlayer(player) {
  const container = document.getElementById('player-results-container');
  const isBookmarked = state.favorites.some(fav => fav.tag === player.tag);
  
  // Hero rendering
  let heroesHtml = '';
  if (player.heroes && player.heroes.length > 0) {
    heroesHtml = `
      <div style="margin-top: 32px;">
        <h3>Heroes & Machines</h3>
        <div class="profile-grid-items" style="margin-top: 16px;">
          ${player.heroes.map(hero => {
            const percent = (hero.level / hero.maxLevel) * 100;
            const barClass = hero.village === 'home' ? 'elixir' : 'gold';
            return `
              <div class="card-item">
                <div class="card-item-title">
                  <span>${escapeHtml(hero.name)}</span>
                  <span class="card-item-val">Lvl ${hero.level} / ${hero.maxLevel}</span>
                </div>
                <div class="progress-container">
                  <div class="progress-bar ${barClass}" style="width: ${percent}%"></div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  // Hero Equipment & recommendation room
  let gearHtml = '';
  if (player.heroEquipment && player.heroEquipment.length > 0) {
    gearHtml = `
      <div style="margin-top: 32px;">
        <h3>Tactical Gear Room (Hero Equipment)</h3>
        <div class="profile-grid-items" style="margin-top: 16px;">
          ${player.heroEquipment.map(eq => `
            <div class="card-item" style="border-color: rgba(139, 68, 253, 0.15);">
              <div class="card-item-title">
                <strong>${escapeHtml(eq.name)}</strong>
                <span class="card-item-val" style="color: var(--clash-dark-elixir);">Lvl ${eq.level}</span>
              </div>
              <small style="color: var(--text-muted);">Assigned: ${escapeHtml(eq.heroName)}</small>
            </div>
          `).join('')}
        </div>
        
        <!-- Strategy recommendation card -->
        <div class="recommendation-card">
          <h4 style="color: var(--clash-gold); font-size: 15px; font-weight: 700; margin-bottom: 6px;">🎯 Meta Tactics Loadout Recommendation</h4>
          ${player.townHallLevel >= 16 
            ? `Your Barbarian King is equipped with the <strong>Giant Gauntlet</strong>. In the current TH16 meta, combining this with the <strong>Rage Vial</strong> provides massive splash damage during target townhall breaches under Warden Tome invincibility!`
            : `To maximize attacks at TH15, pair your Archer Queen's <strong>Invisibility Vial</strong> with the <strong>Healer Puppet</strong> for powerful sustain during critical Queen Charge tactics.`}
        </div>
      </div>
    `;
  }

  // Troops rendering
  let troopsHtml = '';
  if (player.troops && player.troops.length > 0) {
    const homeTroops = player.troops.filter(t => t.village === 'home');
    troopsHtml = `
      <div style="margin-top: 32px;">
        <h3>Troops & Forces</h3>
        <div class="profile-grid-items" style="margin-top: 16px;">
          ${homeTroops.slice(0, 12).map(troop => {
            const percent = (troop.level / troop.maxLevel) * 100;
            return `
              <div class="card-item">
                <div class="card-item-title">
                  <span>${escapeHtml(troop.name)}</span>
                  <span class="card-item-val">Lvl ${troop.level} / ${troop.maxLevel}</span>
                </div>
                <div class="progress-container">
                  <div class="progress-bar elixir" style="width: ${percent}%"></div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  // Spells rendering
  let spellsHtml = '';
  if (player.spells && player.spells.length > 0) {
    spellsHtml = `
      <div class="mt-32">
        <h3>Spell Arsenal</h3>
        <div class="profile-grid-items mt-16">
          ${player.spells.map(spell => {
            const percent = (spell.level / spell.maxLevel) * 100;
            return `
              <div class="card-item">
                <div class="card-item-title">
                  <span>${escapeHtml(spell.name)}</span>
                  <span class="card-item-val">Lvl ${spell.level} / ${spell.maxLevel}</span>
                </div>
                <div class="progress-container">
                  <div class="progress-bar dark" style="width: ${percent}%"></div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  // Achievements rendering
  let achievementsHtml = '';
  if (player.achievements && player.achievements.length > 0) {
    achievementsHtml = `
      <div class="mt-32">
        <h3>Achievements</h3>
        <div class="achievement-grid">
          ${player.achievements.map(ach => {
            const starsHtml = Array(3).fill(0).map((_, i) =>
              `<i class="${i < ach.stars ? 'fas' : 'far'} fa-star ${i >= ach.stars ? 'empty' : ''}"></i>`
            ).join('');
            const progress = ach.target > 0 ? Math.min(100, (ach.value / ach.target) * 100) : 100;
            return `
              <div class="achievement-card">
                <div class="achievement-card-header">
                  <span class="achievement-card-name">${escapeHtml(ach.name)}</span>
                  <div class="achievement-stars">${starsHtml}</div>
                </div>
                <div class="achievement-info">${escapeHtml(ach.info)}</div>
                <div class="progress-container">
                  <div class="progress-bar gold" style="width: ${progress}%"></div>
                </div>
                <div class="achievement-value">${ach.value.toLocaleString()} / ${ach.target.toLocaleString()}</div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  container.innerHTML = `
    <div class="detail-header">
      <div class="badge-lg" style="background: rgba(255,255,255,0.05); border-radius: 16px; padding: 10px; display: flex; align-items: center; justify-content: center;">
        ${player.league && player.league.iconUrls ? `<img src="${player.league.iconUrls.medium}" alt="league"/>` : '<i class="fas fa-shield" style="font-size: 40px; color: var(--text-muted);"></i>'}
      </div>
      <div class="header-info" style="flex: 1;">
        <h2 style="display: flex; align-items: center; justify-content: space-between;">
          <span>${escapeHtml(player.name)} <span class="level-tag" style="background: var(--clash-dark-elixir-gradient); color: #fff;">TH ${player.townHallLevel}</span></span>
          <div style="display: flex; gap: 8px;">
            <button class="export-btn" onclick="exportToClipboard('player')"><i class="fas fa-share-alt"></i> Share</button>
            <button id="player-bookmark-btn" class="bookmark-btn ${isBookmarked ? 'active' : ''}" onclick="toggleFavorite('player', '${escapeHtml(player.tag)}', '${escapeHtml(player.name)}')">
              <i class="${isBookmarked ? 'fas' : 'far'} fa-star"></i>
            </button>
          </div>
        </h2>
        <p>${escapeHtml(player.tag)} &bull; Exp Lvl ${player.expLevel} &bull; ${player.role ? escapeHtml(player.role.replace(/([A-Z])/g, ' $1')) : 'Independent'}</p>
      </div>
    </div>

    <div class="stats-row">
      <div class="stat-card gold-glow">
        <div class="stat-icon gold"><i class="fas fa-trophy"></i></div>
        <div class="stat-details">
          <h4>Trophies</h4>
          <p>${player.trophies}</p>
        </div>
      </div>
      <div class="stat-card elixir-glow">
        <div class="stat-icon elixir"><i class="fas fa-star"></i></div>
        <div class="stat-details">
          <h4>War Stars</h4>
          <p>${player.warStars}</p>
        </div>
      </div>
      <div class="stat-card dark-glow">
        <div class="stat-icon dark"><i class="fas fa-hand-holding-heart"></i></div>
        <div class="stat-details">
          <h4>Donations</h4>
          <p>${player.donations || 0}</p>
        </div>
      </div>
    </div>

    ${heroesHtml}
    ${gearHtml}
    ${troopsHtml}
    ${spellsHtml}
    ${achievementsHtml}
  `;
}

// War Renderer
function renderWar(war) {
  const container = document.getElementById('war-results-container');
  const feedCard = document.getElementById('war-feed-card');
  
  if (!war || war.state === 'notInWar') {
    container.innerHTML = `<div class="placeholder-state"><i class="fas fa-shield-alt"></i><p>This clan is currently not in an active war.</p></div>`;
    if (feedCard) feedCard.style.display = 'none';
    return;
  }

  // Double check properties to avoid nested crashes
  if (!war.clan || !war.opponent) {
    container.innerHTML = `<div class="placeholder-state"><i class="fas fa-exclamation-triangle"></i><p>Invalid war state data received.</p></div>`;
    if (feedCard) feedCard.style.display = 'none';
    return;
  }

  // Countdown timer HTML
  let countdownHtml = '';
  if (war.endTime) {
    countdownHtml = `<div class="countdown-timer" id="war-countdown"></div>`;
  }
  
  container.innerHTML = `
    <div class="war-vs-header">
      <div class="war-clan-side">
        <img src="${war.clan.badgeUrls ? war.clan.badgeUrls.medium : ''}" alt="clan"/>
        <h3>${escapeHtml(war.clan.name || 'Unknown')}</h3>
        <p>LVL ${war.clan.clanLevel || 0}</p>
        <div class="war-score-row">
          <div class="war-score-block">
            <div class="label">Stars</div>
            <div id="clan-war-stars" class="value stars">${war.clan.stars || 0}</div>
          </div>
          <div class="war-score-block">
            <div class="label">Destruction</div>
            <div id="clan-war-destruction" class="value">${war.clan.destructionPercentage || 0}%</div>
          </div>
          <div class="war-score-block">
            <div class="label">Attacks</div>
            <div id="clan-war-attacks" class="value">${war.clan.attacks || 0}</div>
          </div>
        </div>
      </div>
      
      <div class="war-vs-badge">VS</div>
      
      <div class="war-clan-side">
        <img src="${war.opponent.badgeUrls ? war.opponent.badgeUrls.medium : ''}" alt="opponent"/>
        <h3>${escapeHtml(war.opponent.name || 'Unknown')}</h3>
        <p>LVL ${war.opponent.clanLevel || 0}</p>
        <div class="war-score-row">
          <div class="war-score-block">
            <div class="label">Stars</div>
            <div id="opponent-war-stars" class="value stars">${war.opponent.stars || 0}</div>
          </div>
          <div class="war-score-block">
            <div class="label">Destruction</div>
            <div id="opponent-war-destruction" class="value">${war.opponent.destructionPercentage || 0}%</div>
          </div>
          <div class="war-score-block">
            <div class="label">Attacks</div>
            <div id="opponent-war-attacks" class="value">${war.opponent.attacks || 0}</div>
          </div>
        </div>
      </div>
    </div>
    
    <div style="margin-top: 24px; text-align: center;">
      <h4 style="color: var(--text-muted);">War Status: <span style="color: var(--clash-gold); font-weight: 700;">In Progress (Active Battle)</span></h4>
    </div>
    ${countdownHtml}
  `;

  // Start countdown timer
  if (war.endTime) {
    startWarCountdown(war.endTime);
  }

  // Bootstrap Simulated Events Stream for Sandbox mode!
  if (state.mode === 'demo') {
    startSimulatedWarStream(war);
  } else {
    if (feedCard) feedCard.style.display = 'none';
  }
}

// Sandbox Live War Combat Event Stream Generator
function startSimulatedWarStream(war) {
  const feedCard = document.getElementById('war-feed-card');
  const feedTimeline = document.getElementById('war-feed-timeline');
  if (!feedCard || !feedTimeline) return;

  // Render card element
  feedCard.style.display = 'block';
  feedTimeline.innerHTML = '';

  const attackers = ['ClashMaster', 'ElixirQueen', 'DarkKnight', 'GoblinKing', 'ElectroStorm', 'LavaHound', 'GrandWarlock'];
  const defenders = ['ShadowNinja', 'TitanSlayer', 'DragonBreath', 'PekkaPower', 'GiantFist', 'WizardFire', 'ArcherArrow'];
  const troopsUsed = ['Lavaloon', 'Queen Charge Hog', 'Electro Dragons', 'Super Bowler Smash', 'Yeti Whip', 'Golem Witch', 'Super Archer Blimp'];

  // Seed 3 starting events to immediately fill out the timeline!
  for (let i = 0; i < 3; i++) {
    const isAlly = i % 2 === 0;
    const attacker = isAlly ? attackers[i] : defenders[i];
    const defender = isAlly ? defenders[i] : attackers[i];
    const stars = Math.floor(Math.random() * 2) + 2; // 2 or 3 stars
    const destruction = stars === 3 ? 100 : Math.floor(Math.random() * 15) + 85;
    const strategy = troopsUsed[i];
    addWarFeedItem(attacker, defender, stars, destruction, strategy, isAlly);
  }

  // Cancel prior streams
  if (warInterval) {
    clearInterval(warInterval);
  }

  // Launch recurring loop (once every 8 seconds)
  warInterval = setInterval(() => {
    // Break out if active tab changed or demo mode disabled
    if (state.mode !== 'demo' || state.activeTab !== 'war') return;

    const isAlly = Math.random() > 0.45;
    const attacker = isAlly ? attackers[Math.floor(Math.random() * attackers.length)] : defenders[Math.floor(Math.random() * defenders.length)];
    const defender = isAlly ? defenders[Math.floor(Math.random() * defenders.length)] : attackers[Math.floor(Math.random() * attackers.length)];
    const stars = Math.floor(Math.random() * 3) + 1; // 1 to 3 stars
    const destruction = stars === 3 ? 100 : Math.floor(Math.random() * 40) + 60;
    const strategy = troopsUsed[Math.floor(Math.random() * troopsUsed.length)];

    addWarFeedItem(attacker, defender, stars, destruction, strategy, isAlly);

    // Feed stats into war scoreboard context!
    if (state.currentWar) {
      if (isAlly) {
        state.currentWar.clan.stars += stars;
        state.currentWar.clan.attacks++;
        state.currentWar.clan.destructionPercentage = parseFloat((state.currentWar.clan.destructionPercentage * 0.96 + destruction * 0.04).toFixed(1));
      } else {
        state.currentWar.opponent.stars += stars;
        state.currentWar.opponent.attacks++;
        state.currentWar.opponent.destructionPercentage = parseFloat((state.currentWar.opponent.destructionPercentage * 0.96 + destruction * 0.04).toFixed(1));
      }
      updateWarScoreboard();
    }
  }, 8000);
}

function addWarFeedItem(attacker, defender, stars, destruction, strategy, isAlly) {
  const feedTimeline = document.getElementById('war-feed-timeline');
  if (!feedTimeline) return;

  const item = document.createElement('li');
  item.className = `war-feed-item ${isAlly ? '' : 'opponent-event'}`;

  const icon = isAlly ? '⚔️' : '🛡️';
  const starsHtml = '<span class="star-rating">' + 
    Array(stars).fill('<i class="fas fa-star"></i>').join('') + 
    Array(3 - stars).fill('<i class="far fa-star"></i>').join('') + 
    '</span>';

  item.innerHTML = `
    <span style="font-size: 16px;">${icon}</span>
    <div>
      <strong style="color: ${isAlly ? 'var(--clash-gold)' : 'var(--clash-elixir)'};">${escapeHtml(attacker)}</strong> 
      attacked <strong>${escapeHtml(defender)}</strong> 
      using <em>${escapeHtml(strategy)}</em><br/>
      <span style="font-size: 11px; color: var(--text-muted); display: flex; align-items: center; gap: 8px; margin-top: 4px;">
        ${starsHtml} &bull; ${destruction}% Destruction
      </span>
    </div>
    <span class="war-feed-time">Just Now</span>
  `;

  requestAnimationFrame(() => {
    feedTimeline.insertBefore(item, feedTimeline.firstChild);

    // Keep list concise
    while (feedTimeline.children.length > 25) {
      feedTimeline.removeChild(feedTimeline.lastChild);
    }
  });
}

function updateWarScoreboard() {
  const war = state.currentWar;
  if (!war) return;

  const elStars = document.getElementById('clan-war-stars');
  const elDest = document.getElementById('clan-war-destruction');
  const elAttacks = document.getElementById('clan-war-attacks');

  const oppStars = document.getElementById('opponent-war-stars');
  const oppDest = document.getElementById('opponent-war-destruction');
  const oppAttacks = document.getElementById('opponent-war-attacks');

  if (elStars) elStars.innerText = war.clan.stars || 0;
  if (elDest) elDest.innerText = `${war.clan.destructionPercentage || 0}%`;
  if (elAttacks) elAttacks.innerText = war.clan.attacks || 0;

  if (oppStars) oppStars.innerText = war.opponent.stars || 0;
  if (oppDest) oppDest.innerText = `${war.opponent.destructionPercentage || 0}%`;
  if (oppAttacks) oppAttacks.innerText = war.opponent.attacks || 0;
}

// ===== CLAN COMPARISON =====

async function loadComparisonClan(side, tag) {
  try {
    const clan = await fetchCocData(`/clans/${tag}`);
    state.compareClans[side] = clan;
    showToast(`${escapeHtml(clan.name)} loaded as Clan ${side.toUpperCase()}`, 'success');
    if (state.compareClans.a && state.compareClans.b) {
      renderComparison();
    } else {
      renderPartialComparison();
    }
  } catch (err) {
    showToast(`Error loading clan: ${err.message}`, 'error');
  }
}

function renderPartialComparison() {
  const container = document.getElementById('comparison-results-container');
  const loaded = state.compareClans.a || state.compareClans.b;
  const side = state.compareClans.a ? 'A' : 'B';
  const other = state.compareClans.a ? 'B' : 'A';
  container.innerHTML = `
    <div class="placeholder-state">
      <i class="fas fa-check-circle" style="font-size: 48px; color: #4adb86; opacity: 0.8;"></i>
      <p style="font-size: 15px;">Clan ${side} loaded: <strong>${escapeHtml(loaded.name)}</strong>. Now search Clan ${other} to compare!</p>
    </div>
  `;
}

function renderComparison() {
  const container = document.getElementById('comparison-results-container');
  const a = state.compareClans.a;
  const b = state.compareClans.b;
  
  const stats = [
    { label: 'Clan Level', aVal: a.clanLevel, bVal: b.clanLevel },
    { label: 'Total Trophies', aVal: a.clanPoints, bVal: b.clanPoints },
    { label: 'Members', aVal: a.members, bVal: b.members },
    { label: 'War Wins', aVal: a.warWins, bVal: b.warWins },
    { label: 'War Losses', aVal: a.warLosses, bVal: b.warLosses },
    { label: 'Win Streak', aVal: a.warWinStreak || 0, bVal: b.warWinStreak || 0 },
    { label: 'Capital Hall', aVal: a.clanCapital?.capitalHallLevel || 0, bVal: b.clanCapital?.capitalHallLevel || 0 },
  ];

  container.innerHTML = `
    <div class="comparison-layout">
      <div class="comparison-column">
        <div class="flex-row gap-12 border-bottom-subtle pb-16">
          <img src="${a.badgeUrls.medium}" alt="badge" style="width: 48px; height: 48px; object-fit: contain;"/>
          <div>
            <h3 class="text-lg font-bold">${escapeHtml(a.name)}</h3>
            <span class="level-tag text-xs">LVL ${a.clanLevel}</span>
          </div>
        </div>
        ${stats.map(s => `
          <div class="comparison-stat-row">
            <span class="comparison-stat-label">${s.label}</span>
            <span class="comparison-stat-value ${s.aVal > s.bVal ? 'comparison-winner' : s.aVal < s.bVal ? 'comparison-loser' : ''}">${typeof s.aVal === 'number' ? s.aVal.toLocaleString() : s.aVal}</span>
          </div>
        `).join('')}
      </div>
      
      <div class="comparison-vs">
        <div class="comparison-vs-badge">VS</div>
      </div>
      
      <div class="comparison-column">
        <div class="flex-row gap-12 border-bottom-subtle pb-16">
          <img src="${b.badgeUrls.medium}" alt="badge" style="width: 48px; height: 48px; object-fit: contain;"/>
          <div>
            <h3 class="text-lg font-bold">${escapeHtml(b.name)}</h3>
            <span class="level-tag text-xs">LVL ${b.clanLevel}</span>
          </div>
        </div>
        ${stats.map(s => `
          <div class="comparison-stat-row">
            <span class="comparison-stat-label">${s.label}</span>
            <span class="comparison-stat-value ${s.bVal > s.aVal ? 'comparison-winner' : s.bVal < s.aVal ? 'comparison-loser' : ''}">${typeof s.bVal === 'number' ? s.bVal.toLocaleString() : s.bVal}</span>
          </div>
        `).join('')}
      </div>
    </div>
    
    <div class="comparison-chart-container">
      <h3 class="font-bold mb-16">Visual Comparison</h3>
      <div class="chart-container-responsive">
        <canvas id="comparison-chart"></canvas>
      </div>
    </div>
  `;
  
  loadChartJs().then(() => initComparisonChart(a, b));
}

async function initComparisonChart(a, b) {
  await loadChartJs();
  const ctx = document.getElementById('comparison-chart');
  if (!ctx) return;
  if (comparisonChart) comparisonChart.destroy();
  
  comparisonChart = new Chart(ctx.getContext('2d'), {
    type: 'radar',
    data: {
      labels: ['Trophies', 'War Wins', 'Members', 'Level', 'Capital', 'Win Streak'],
      datasets: [
        {
          label: a.name,
          data: [
            a.clanPoints / 600,
            a.warWins,
            a.members * 10,
            a.clanLevel * 25,
            (a.clanCapital?.capitalHallLevel || 0) * 60,
            (a.warWinStreak || 0) * 30
          ],
          borderColor: '#F5A623',
          backgroundColor: 'rgba(245, 166, 35, 0.15)',
          borderWidth: 2,
          pointBackgroundColor: '#F5A623'
        },
        {
          label: b.name,
          data: [
            b.clanPoints / 600,
            b.warWins,
            b.members * 10,
            b.clanLevel * 25,
            (b.clanCapital?.capitalHallLevel || 0) * 60,
            (b.warWinStreak || 0) * 30
          ],
          borderColor: '#EC3B83',
          backgroundColor: 'rgba(236, 59, 131, 0.15)',
          borderWidth: 2,
          pointBackgroundColor: '#EC3B83'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#8E9BAE' } }
      },
      scales: {
        r: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          angleLines: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { display: false },
          pointLabels: { color: '#8E9BAE', font: { size: 12 } }
        }
      }
    }
  });
}
