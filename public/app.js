/**
 * SpoolControl - Core Application Logic
 * All state is persisted via the server API (/api/state).
 * No localStorage. No GitHub sync. Works with the Docker container backend.
 */

// ==========================================================================
// Application State
// ==========================================================================
let state = {
  filaments: [],
  logs: [],
  users: [],
  activeOwner: 'all',
  settings: {
    appName: 'SpoolControl',
    appSubtitle: 'Filament Manager',
    appLogoEmoji: '🎨'
  }
};

// Color scheme presets
const COLOR_PRESETS = {
  default: { accentPrimary: '#6366f1', accentSecondary: '#ec4899', bgPrimary: '#090d16', bgSecondary: '#111827' },
  ocean:   { accentPrimary: '#0ea5e9', accentSecondary: '#06b6d4', bgPrimary: '#0c1a2e', bgSecondary: '#0f2640' },
  forest:  { accentPrimary: '#16a34a', accentSecondary: '#84cc16', bgPrimary: '#0a1a0e', bgSecondary: '#0f2515' },
  sunset:  { accentPrimary: '#f97316', accentSecondary: '#ef4444', bgPrimary: '#1a0d0a', bgSecondary: '#2a1510' },
  purple:  { accentPrimary: '#a855f7', accentSecondary: '#d946ef', bgPrimary: '#100820', bgSecondary: '#180d30' },
  mono:    { accentPrimary: '#e2e8f0', accentSecondary: '#94a3b8', bgPrimary: '#0f172a', bgSecondary: '#1e293b' }
};

// Chart.js instances to destroy/recreate on update
let charts = {
  materials: null,
  status: null,
  usageOwner: null,
  successRate: null
};

// ==========================================================================
// API Layer — replaces localStorage
// ==========================================================================

/** Load state from the server */
async function loadStateFromServer() {
  try {
    const res = await fetch('/api/state');
    if (!res.ok) throw new Error(`Server returned ${res.status}`);
    const data = await res.json();
    state = data;
    // Backwards-compatibility guards
    if (!state.activeOwner) state.activeOwner = 'all';
    if (!state.settings) {
      state.settings = { appName: 'SpoolControl', appSubtitle: 'Filament Manager', appLogoEmoji: '🎨' };
    }
    if (!state.settings.colorScheme) {
      state.settings.colorScheme = { ...COLOR_PRESETS.default };
    }
  } catch (err) {
    console.error('[SpoolControl] Failed to load state from server:', err);
    showNotification('⚠️ Could not reach the server. Check your connection.', 'error');
  }
}

/** Persist current state to the server */
async function saveState() {
  try {
    const res = await fetch('/api/state', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state)
    });
    if (!res.ok) throw new Error(`Server returned ${res.status}`);
  } catch (err) {
    console.error('[SpoolControl] Failed to save state to server:', err);
    showNotification('⚠️ Save failed — server may be unreachable.', 'error');
  }
}

function loadSampleData() {
  state.users = [
    { id: 'u-1', name: 'Devin', color: '#6366f1', avatar: '👤' },
    { id: 'shared', name: 'Shared Lab', color: '#f59e0b', avatar: '🔬' }
  ];
  state.filaments = [
    {
      id: 'f-s1', brand: 'Prusament', material: 'PLA', colorName: 'Galaxy Black',
      colorHex: '#111827', diameter: 1.75, spoolWeight: 1000, emptySpoolWeight: 220,
      currentWeight: 750, cost: 29.99, purchaseDate: '2026-01-15', location: 'Drybox 1',
      status: 'In Use', ownerId: 'u-1', notes: 'Very clean prints, print at 215°C/60°C.'
    },
    {
      id: 'f-s2', brand: 'Hatchbox', material: 'PLA', colorName: 'Ruby Red',
      colorHex: '#dc2626', diameter: 1.75, spoolWeight: 1000, emptySpoolWeight: 225,
      currentWeight: 420, cost: 22.99, purchaseDate: '2026-02-10', location: 'Shelf A2',
      status: 'In Use', ownerId: 'u-1', notes: 'Prints beautifully at 200°C.'
    },
    {
      id: 'f-s3', brand: 'Polymaker', material: 'PETG', colorName: 'Teal Blue',
      colorHex: '#0d9488', diameter: 1.75, spoolWeight: 1000, emptySpoolWeight: 240,
      currentWeight: 980, cost: 25.99, purchaseDate: '2026-03-01', location: 'Drybox 2',
      status: 'Sealed', ownerId: 'shared', notes: 'Requires 240°C. Bed at 80°C.'
    }
  ];
  state.logs = [
    {
      id: 'l-s1', filamentId: 'f-s1', printName: 'Voron Stealthburner Parts',
      weightUsed: 180, durationMinutes: 480, userId: 'u-1',
      date: '2026-05-10T14:30:00Z', status: 'success',
      notes: 'Perfect surface finish.'
    }
  ];
  state.activeOwner = 'all';
  state.settings = { appName: 'SpoolControl', appSubtitle: 'Filament Manager', appLogoEmoji: '🎨', colorScheme: { ...COLOR_PRESETS.default } };
  saveState().then(() => {
    showNotification('Sample data loaded successfully!');
    updateUI();
  });
}

function clearDatabase() {
  state.users = [
    { id: 'u-default', name: 'Devin', color: '#6366f1', avatar: '👤' },
    { id: 'shared', name: 'Shared Lab', color: '#f59e0b', avatar: '🔬' }
  ];
  state.filaments = [];
  state.logs = [];
  state.activeOwner = 'all';
  state.settings = { appName: 'SpoolControl', appSubtitle: 'Filament Manager', appLogoEmoji: '🎨', colorScheme: { ...COLOR_PRESETS.default } };
  saveState().then(() => {
    showNotification('Database cleared. Default user created.', 'error');
    updateUI();
  });
}

function applyBranding() {
  if (!state.settings) {
    state.settings = { appName: 'SpoolControl', appSubtitle: 'Filament Manager', appLogoEmoji: '🎨' };
  }

  const titleDisplay = document.getElementById('app-title-display');
  const subtitleDisplay = document.getElementById('app-subtitle-display');
  const logoContainer = document.getElementById('app-logo-container');

  if (titleDisplay) titleDisplay.textContent = state.settings.appName || 'SpoolControl';
  if (subtitleDisplay) subtitleDisplay.textContent = state.settings.appSubtitle || 'Filament Manager';

  if (logoContainer) {
    const emoji = (state.settings.appLogoEmoji || '').trim().toUpperCase();
    if (emoji === 'SVG' || !state.settings.appLogoEmoji) {
      logoContainer.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
        </svg>
      `;
    } else {
      logoContainer.innerHTML = `<span style="font-size: 22px; line-height: 1; display: flex; align-items: center; justify-content: center;">${state.settings.appLogoEmoji}</span>`;
    }
  }

  const appNameInput = document.getElementById('settings-app-name');
  const appSubInput = document.getElementById('settings-app-subtitle');
  const appLogoInput = document.getElementById('settings-app-logo');

  if (appNameInput) appNameInput.value = state.settings.appName || 'SpoolControl';
  if (appSubInput) appSubInput.value = state.settings.appSubtitle || 'Filament Manager';
  if (appLogoInput) appLogoInput.value = state.settings.appLogoEmoji || '🎨';

  document.title = `${state.settings.appName || 'SpoolControl'} - 3D Printer Filament Tracker`;
}

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function lightenHex(hex, amount) {
  const r = Math.min(255, parseInt(hex.slice(1, 3), 16) + amount);
  const g = Math.min(255, parseInt(hex.slice(3, 5), 16) + amount);
  const b = Math.min(255, parseInt(hex.slice(5, 7), 16) + amount);
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

function applyColorScheme() {
  const scheme = state.settings && state.settings.colorScheme
    ? state.settings.colorScheme
    : COLOR_PRESETS.default;

  const root = document.documentElement;
  const { accentPrimary, accentSecondary, bgPrimary, bgSecondary } = scheme;

  if (accentPrimary) {
    root.style.setProperty('--accent-primary', accentPrimary);
    root.style.setProperty('--accent-primary-glow', hexToRgba(accentPrimary, 0.15));
  }
  if (accentSecondary) {
    root.style.setProperty('--accent-secondary', accentSecondary);
    root.style.setProperty('--accent-secondary-glow', hexToRgba(accentSecondary, 0.15));
  }
  if (bgPrimary) {
    root.style.setProperty('--bg-primary', bgPrimary);
  }
  if (bgSecondary) {
    root.style.setProperty('--bg-secondary', bgSecondary);
    root.style.setProperty('--bg-tertiary', lightenHex(bgSecondary, 18));
    root.style.setProperty('--card-bg', hexToRgba(bgSecondary, 0.6));
  }

  // Sync pickers with current scheme
  const pa = document.getElementById('color-accent-primary');
  const sa = document.getElementById('color-accent-secondary');
  const bp = document.getElementById('color-bg-primary');
  const bs = document.getElementById('color-bg-secondary');
  if (pa) pa.value = accentPrimary || COLOR_PRESETS.default.accentPrimary;
  if (sa) sa.value = accentSecondary || COLOR_PRESETS.default.accentSecondary;
  if (bp) bp.value = bgPrimary || COLOR_PRESETS.default.bgPrimary;
  if (bs) bs.value = bgSecondary || COLOR_PRESETS.default.bgSecondary;

  // Mark active preset button
  const presetName = Object.entries(COLOR_PRESETS).find(([, v]) =>
    v.accentPrimary === accentPrimary &&
    v.accentSecondary === accentSecondary &&
    v.bgPrimary === bgPrimary &&
    v.bgSecondary === bgSecondary
  )?.[0];

  document.querySelectorAll('.color-preset-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.preset === (presetName || ''));
  });
}

// ==========================================================================
// Notification Manager
// ==========================================================================
function showNotification(message, type = 'success') {
  const banner = document.getElementById('notification');
  banner.querySelector('.notification-text').textContent = message;

  if (type === 'error') {
    banner.classList.add('error');
    banner.style.borderColor = 'var(--danger)';
  } else {
    banner.classList.remove('error');
    banner.style.borderColor = 'var(--success)';
  }

  banner.classList.add('show');
  setTimeout(() => {
    banner.classList.remove('show');
  }, 3500);
}

// ==========================================================================
// Modal Controllers
// ==========================================================================
function openModal(modalId) {
  document.getElementById(modalId).classList.add('open');
}

function closeModal(modalId) {
  document.getElementById(modalId).classList.remove('open');
}

// ==========================================================================
// UI Rendering Operations
// ==========================================================================
function updateUI() {
  applyBranding();
  applyColorScheme();
  renderActiveUserSelectors();
  renderDashboardStats();
  renderCharts();
  renderFilamentsGrid();
  renderLogsTable();
  populateDropdowns();
  updateWeighCalculatorSelection();
}

function populateDropdowns() {
  const formOwnerSelect = document.getElementById('form-owner');
  const printUserSelect = document.getElementById('form-print-user');
  const modalUsersSelect = document.getElementById('sidebar-owner-filter');
  const inventoryOwnerSelect = document.getElementById('filter-owner');

  formOwnerSelect.innerHTML = '';
  printUserSelect.innerHTML = '';
  modalUsersSelect.innerHTML = '<option value="all">🌐 All Owners</option>';
  if (inventoryOwnerSelect) {
    inventoryOwnerSelect.innerHTML = '<option value="all">All Owners</option>';
  }

  state.users.forEach(user => {
    const opt = document.createElement('option');
    opt.value = user.id;
    opt.textContent = `${user.avatar} ${user.name}`;
    formOwnerSelect.appendChild(opt.cloneNode(true));
    printUserSelect.appendChild(opt.cloneNode(true));

    const optFilter = document.createElement('option');
    optFilter.value = user.id;
    optFilter.textContent = `${user.avatar} ${user.name}`;
    modalUsersSelect.appendChild(optFilter);

    if (inventoryOwnerSelect) {
      const optFilterInv = document.createElement('option');
      optFilterInv.value = user.id;
      optFilterInv.textContent = `${user.avatar} ${user.name}`;
      inventoryOwnerSelect.appendChild(optFilterInv);
    }
  });

  modalUsersSelect.value = state.activeOwner;
  if (inventoryOwnerSelect) {
    inventoryOwnerSelect.value = state.activeOwner;
  }

  const printFilamentSelect = document.getElementById('form-print-filament');
  printFilamentSelect.innerHTML = '<option value="" disabled selected>-- Select a spool --</option>';

  const activeFilaments = state.filaments.filter(f => f.status !== 'Empty');
  activeFilaments.forEach(f => {
    const opt = document.createElement('option');
    opt.value = f.id;
    opt.textContent = `${f.brand} ${f.material} - ${f.colorName} (${f.currentWeight}g left)`;
    printFilamentSelect.appendChild(opt);
  });
}

function renderActiveUserSelectors() {
  const container = document.getElementById('modal-users-list');
  if (!container) return;

  container.innerHTML = '';

  state.users.forEach(user => {
    const card = document.createElement('div');
    card.className = 'user-manager-card';
    card.style.setProperty('--user-color', user.color);
    card.style.setProperty('--user-color-glow', user.color + '20');

    const canDelete = state.users.length > 2 && user.id !== 'shared';

    card.innerHTML = `
      <div class="user-manager-avatar">${user.avatar}</div>
      <div class="user-manager-name">${user.name}</div>
      ${canDelete ? `<button type="button" class="user-manager-delete" data-id="${user.id}">&times;</button>` : ''}
    `;

    if (canDelete) {
      card.querySelector('.user-manager-delete').addEventListener('click', (e) => {
        e.stopPropagation();
        deleteUser(user.id);
      });
    }

    container.appendChild(card);
  });
}

function deleteUser(userId) {
  state.filaments.forEach(f => {
    if (f.ownerId === userId) f.ownerId = 'shared';
  });
  state.logs.forEach(l => {
    if (l.userId === userId) l.userId = 'shared';
  });

  state.users = state.users.filter(u => u.id !== userId);
  if (state.activeOwner === userId) state.activeOwner = 'all';

  saveState().then(() => {
    showNotification('User deleted. Filaments & logs reassigned to Shared Lab.', 'error');
    updateUI();
  });
}

function renderDashboardStats() {
  const activeFilaments = getFilteredFilaments();
  const activeLogs = getFilteredLogs();

  const totalValue = activeFilaments.reduce((acc, curr) => {
    if (curr.status === 'Empty') return acc;
    const cost = curr.cost || 0;
    const netWeight = curr.spoolWeight || 1000;
    const remaining = curr.currentWeight || 0;
    return acc + (cost * (remaining / netWeight));
  }, 0);
  document.getElementById('stat-total-value').textContent = `$${totalValue.toFixed(2)}`;

  const totalWeightGrams = activeFilaments.reduce((acc, curr) => acc + (curr.currentWeight || 0), 0);
  document.getElementById('stat-total-weight').textContent = `${(totalWeightGrams / 1000).toFixed(2)} kg`;

  const activeSpoolsCount = activeFilaments.filter(f => f.status === 'In Use').length;
  document.getElementById('stat-active-spools').textContent = activeSpoolsCount;

  const lowStockCount = activeFilaments.filter(f => f.status !== 'Empty' && f.currentWeight < 100).length;
  document.getElementById('stat-low-stock').textContent = lowStockCount;

  const lowStockCard = document.getElementById('stat-low-stock-card');
  if (lowStockCount > 0) {
    lowStockCard.style.borderColor = 'var(--danger)';
    lowStockCard.querySelector('.metric-icon').classList.add('val-icon');
  } else {
    lowStockCard.style.borderColor = 'var(--card-border)';
  }

  const activeOwnerObj = state.users.find(u => u.id === state.activeOwner);
  const ind = document.getElementById('dashboard-filter-indicator');
  if (state.activeOwner === 'all') {
    ind.textContent = '🌐 Showing All Owners';
    ind.className = 'badge badge-info';
  } else if (activeOwnerObj) {
    ind.textContent = `${activeOwnerObj.avatar} ${activeOwnerObj.name}'s Stock`;
    ind.className = 'badge';
    ind.style.backgroundColor = activeOwnerObj.color + '25';
    ind.style.color = activeOwnerObj.color;
  }
}

function renderFilamentsGrid() {
  const container = document.getElementById('filaments-container');
  const emptyState = document.getElementById('inventory-empty-state');
  container.innerHTML = '';

  const filtered = getFilteredFilaments();

  const searchVal = document.getElementById('global-search').value.toLowerCase().trim();
  const searched = filtered.filter(f => {
    if (!searchVal) return true;
    const owner = state.users.find(u => u.id === f.ownerId);
    const ownerName = owner ? owner.name.toLowerCase() : '';
    return f.brand.toLowerCase().includes(searchVal) ||
           f.material.toLowerCase().includes(searchVal) ||
           f.colorName.toLowerCase().includes(searchVal) ||
           ownerName.includes(searchVal) ||
           (f.location && f.location.toLowerCase().includes(searchVal)) ||
           (f.notes && f.notes.toLowerCase().includes(searchVal));
  });

  const matFilter = document.getElementById('filter-material').value;
  const statFilter = document.getElementById('filter-status').value;

  let finalFilaments = searched;
  if (matFilter !== 'all') finalFilaments = finalFilaments.filter(f => f.material === matFilter);
  if (statFilter !== 'all') finalFilaments = finalFilaments.filter(f => f.status === statFilter);

  const sortBy = document.getElementById('sort-by').value;
  finalFilaments.sort((a, b) => {
    if (sortBy === 'remaining-desc') return b.currentWeight - a.currentWeight;
    if (sortBy === 'remaining-asc') return a.currentWeight - b.currentWeight;
    if (sortBy === 'brand') return a.brand.localeCompare(b.brand);
    if (sortBy === 'purchaseDate-desc') {
      const dateA = a.purchaseDate ? new Date(a.purchaseDate) : new Date(0);
      const dateB = b.purchaseDate ? new Date(b.purchaseDate) : new Date(0);
      return dateB - dateA;
    }
    if (sortBy === 'cost-desc') return (b.cost || 0) - (a.cost || 0);
    return 0;
  });

  if (finalFilaments.length === 0) {
    emptyState.style.display = 'flex';
    container.style.display = 'none';
    return;
  } else {
    emptyState.style.display = 'none';
    container.style.display = 'grid';
  }

  finalFilaments.forEach(fil => {
    const owner = state.users.find(u => u.id === fil.ownerId) || { name: 'Unknown', color: '#ccc', avatar: '👤' };
    const pct = Math.min(100, Math.max(0, (fil.currentWeight / fil.spoolWeight) * 100));
    const isLow = fil.currentWeight < 100 && fil.status !== 'Empty';

    const card = document.createElement('div');
    card.className = `filament-card ${fil.status === 'Empty' ? 'empty-spool' : ''}`;
    card.style.setProperty('--accent-color', fil.colorHex);

    card.innerHTML = `
      <div>
        <div class="filament-card-header">
          <div class="filament-brand-material">
            <span class="filament-brand">${fil.brand}</span>
            <span class="filament-material-name">${fil.material}</span>
          </div>
          <div class="filament-color-indicator">
            <span class="color-dot" style="background-color: ${fil.colorHex}"></span>
            <span>${fil.colorName}</span>
          </div>
        </div>

        <div class="filament-stats">
          <div class="filament-weight-labels">
            <span class="weight-percentage">${pct.toFixed(0)}% left</span>
            <span class="weight-fraction">${fil.currentWeight}g / ${fil.spoolWeight}g</span>
          </div>
          <div class="filament-progress-wrapper">
            <div class="filament-progress-bar ${isLow ? 'low-stock' : ''}" style="width: ${pct}%; background-color: ${fil.colorHex}"></div>
          </div>
        </div>

        <div class="filament-meta-grid">
          <div class="meta-item">
            <span class="meta-label">Owner</span>
            <span class="owner-pill" style="--owner-color: ${owner.color}; --owner-color-glow: ${owner.color}15">
              <span>${owner.avatar}</span> <span>${owner.name}</span>
            </span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Location</span>
            <span class="meta-value">${fil.location || 'Not Specified'}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Specs</span>
            <span class="meta-value">${fil.diameter.toFixed(2)}mm • $${(fil.cost || 0).toFixed(2)}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Status</span>
            <span class="meta-value">
              <span class="badge ${getStatusBadgeClass(fil.status)}">${fil.status}</span>
            </span>
          </div>
        </div>

        ${fil.notes ? `
          <div class="form-group" style="margin-top: 10px; margin-bottom: 0;">
            <span class="meta-label">Notes</span>
            <span class="meta-value" style="font-size: 0.72rem; line-height: 1.3; color: var(--text-muted);">${fil.notes}</span>
          </div>
        ` : ''}
      </div>

      <div class="filament-card-footer">
        ${fil.status !== 'Empty' ? `
          <button class="btn btn-primary btn-sm btn-log-quick" data-id="${fil.id}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            Print
          </button>
        ` : ''}
        <button class="btn btn-outline btn-sm btn-weigh-quick" data-id="${fil.id}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/><path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3"/></svg>
          Weigh
        </button>
        <button class="btn btn-outline btn-sm btn-edit-spool" data-id="${fil.id}" style="max-width: 40px; padding: 6px; flex-shrink: 0;" title="Edit Spool">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
        </button>
        <button class="btn btn-outline btn-sm btn-delete-spool" data-id="${fil.id}" style="max-width: 40px; padding: 6px; flex-shrink: 0; color: var(--danger); border-color: rgba(244, 63, 94, 0.2);" title="Delete Spool">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px;"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
      </div>
    `;

    const logBtn = card.querySelector('.btn-log-quick');
    if (logBtn) {
      logBtn.addEventListener('click', () => {
        document.getElementById('form-print-filament').value = fil.id;
        document.getElementById('form-print-filament').dispatchEvent(new Event('change'));
        openModal('modal-print');
      });
    }

    card.querySelector('.btn-weigh-quick').addEventListener('click', () => {
      document.getElementById('weigh-filament-select').value = fil.id;
      document.getElementById('weigh-filament-select').dispatchEvent(new Event('change'));
      document.querySelector('button[data-tab="calculators"]').click();
    });

    card.querySelector('.btn-edit-spool').addEventListener('click', () => {
      populateFilamentForm(fil);
      openModal('modal-filament');
    });

    card.querySelector('.btn-delete-spool').addEventListener('click', () => {
      if (confirm(`Are you sure you want to delete the spool: ${fil.brand} ${fil.material} - ${fil.colorName}? Historical logs will be preserved.`)) {
        state.filaments = state.filaments.filter(f => f.id !== fil.id);
        saveState().then(() => {
          showNotification('Filament spool deleted.', 'error');
          populateMaterialFilter();
          updateUI();
        });
      }
    });

    container.appendChild(card);
  });
}

function getStatusBadgeClass(status) {
  if (status === 'In Use') return 'badge-info';
  if (status === 'Sealed') return 'badge-success';
  if (status === 'Stowed') return 'badge-warning';
  return 'badge-danger';
}

function renderMobileLogCards(sortedLogs) {
  const container = document.getElementById('logs-mobile-cards');
  if (!container) return;
  container.innerHTML = '';

  if (sortedLogs.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="empty-icon"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
        <h3>No prints logged yet</h3>
        <p>Tap the button below to start tracking usage.</p>
      </div>`;
    return;
  }

  sortedLogs.forEach(log => {
    const fil = state.filaments.find(f => f.id === log.filamentId) || { brand: 'Unknown', material: 'Filament', colorName: 'Deleted', colorHex: '#777' };
    const user = state.users.find(u => u.id === log.userId) || { name: 'Unknown', color: '#777', avatar: '👤' };
    const formattedDate = new Date(log.date).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

    const card = document.createElement('div');
    card.className = 'log-card-mobile';
    card.innerHTML = `
      <div class="log-card-mobile-header">
        <span class="log-card-mobile-title">${log.printName}</span>
        <span class="badge ${log.status === 'success' ? 'badge-success' : 'badge-danger'}">${log.status === 'success' ? '✓ Success' : '✗ Failed'}</span>
      </div>
      <div class="log-card-mobile-meta">
        <div class="log-card-mobile-meta-item">
          <span class="log-card-mobile-meta-label">Spool</span>
          <span class="log-card-mobile-meta-value" style="display:flex;align-items:center;gap:5px;">
            <span style="width:9px;height:9px;border-radius:50%;background:${fil.colorHex};flex-shrink:0;display:inline-block;"></span>
            ${fil.brand} ${fil.material}
          </span>
        </div>
        <div class="log-card-mobile-meta-item">
          <span class="log-card-mobile-meta-label">Printed By</span>
          <span class="log-card-mobile-meta-value" style="color:${user.color}">${user.avatar} ${user.name}</span>
        </div>
        <div class="log-card-mobile-meta-item">
          <span class="log-card-mobile-meta-label">Used</span>
          <span class="log-card-mobile-meta-value">${log.weightUsed}g</span>
        </div>
        <div class="log-card-mobile-meta-item">
          <span class="log-card-mobile-meta-label">Date</span>
          <span class="log-card-mobile-meta-value">${formattedDate}</span>
        </div>
        ${log.durationMinutes ? `
        <div class="log-card-mobile-meta-item">
          <span class="log-card-mobile-meta-label">Duration</span>
          <span class="log-card-mobile-meta-value">${formatDuration(log.durationMinutes)}</span>
        </div>` : ''}
        ${log.notes ? `
        <div class="log-card-mobile-meta-item" style="grid-column:1/-1;">
          <span class="log-card-mobile-meta-label">Notes</span>
          <span class="log-card-mobile-meta-value" style="color:var(--text-muted);font-size:0.72rem;">${log.notes}</span>
        </div>` : ''}
      </div>
      <div class="log-card-mobile-footer">
        <button class="btn btn-outline btn-sm btn-delete-log-mobile" data-id="${log.id}" style="color:var(--danger);border-color:transparent;padding:4px 10px;font-size:0.75rem;">Delete</button>
      </div>
    `;

    card.querySelector('.btn-delete-log-mobile').addEventListener('click', () => {
      if (confirm('Delete this print log? The used weight will be restored to the spool.')) {
        deletePrintLog(log.id);
      }
    });

    container.appendChild(card);
  });
}

function renderLogsTable() {
  const body = document.getElementById('logs-table-body');
  const emptyState = document.getElementById('logs-empty-state');
  const table = document.getElementById('logs-table');
  body.innerHTML = '';

  const filteredLogs = getFilteredLogs();

  const sortedLogs = [...filteredLogs].sort((a, b) => new Date(b.date) - new Date(a.date));

  // Render mobile card view (CSS controls which is visible per breakpoint)
  renderMobileLogCards(sortedLogs);

  if (filteredLogs.length === 0) {
    emptyState.style.display = 'flex';
    table.style.display = 'none';
    return;
  } else {
    emptyState.style.display = 'none';
    table.style.display = 'table';
  }

  sortedLogs.forEach(log => {
    const fil = state.filaments.find(f => f.id === log.filamentId) || { brand: 'Unknown', material: 'Filament', colorName: 'Deleted', colorHex: '#777' };
    const user = state.users.find(u => u.id === log.userId) || { name: 'Unknown', color: '#777', avatar: '👤' };

    const formattedDate = new Date(log.date).toLocaleString(undefined, {
      month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${formattedDate}</td>
      <td>
        <span class="table-user-badge" style="color: ${user.color}">
          <span class="table-user-dot" style="background-color: ${user.color}"></span>
          <span>${user.name}</span>
        </span>
      </td>
      <td style="font-weight: 600; color: white;">${log.printName}</td>
      <td>
        <span class="table-spool-badge">
          <span class="color-dot" style="background-color: ${fil.colorHex}; width: 12px; height: 12px;"></span>
          <span>${fil.brand} ${fil.material} (${fil.colorName})</span>
        </span>
      </td>
      <td>${log.weightUsed}g</td>
      <td>${formatDuration(log.durationMinutes)}</td>
      <td>
        <span class="badge ${log.status === 'success' ? 'badge-success' : 'badge-danger'}">
          ${log.status === 'success' ? 'Success' : 'Failed'}
        </span>
      </td>
      <td style="font-size: 0.8rem; color: var(--text-muted); max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${log.notes || ''}">
        ${log.notes || ''}
      </td>
      <td>
        <button class="btn btn-outline btn-sm btn-delete-log" data-id="${log.id}" style="color: var(--danger); border-color: transparent; padding: 4px 8px;">
          Delete
        </button>
      </td>
    `;

    tr.querySelector('.btn-delete-log').addEventListener('click', () => {
      if (confirm('Are you sure you want to delete this print log? The used weight will be restored to the spool.')) {
        deletePrintLog(log.id);
      }
    });

    body.appendChild(tr);
  });
}

function formatDuration(minutes) {
  if (!minutes) return '0m';
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
}

function deletePrintLog(logId) {
  const log = state.logs.find(l => l.id === logId);
  if (!log) return;

  const fil = state.filaments.find(f => f.id === log.filamentId);
  if (fil) {
    fil.currentWeight = Math.min(fil.spoolWeight, fil.currentWeight + log.weightUsed);
    if (fil.status === 'Empty' && fil.currentWeight > 0) {
      fil.status = 'In Use';
    }
  }

  state.logs = state.logs.filter(l => l.id !== logId);
  saveState().then(() => {
    showNotification('Print log deleted. Filament weight restored to spool.');
    updateUI();
  });
}

function populateMaterialFilter() {
  const select = document.getElementById('filter-material');
  const selectedVal = select.value;
  select.innerHTML = '<option value="all">All Materials</option>';

  const materials = [...new Set(state.filaments.map(f => f.material))];
  materials.forEach(mat => {
    const opt = document.createElement('option');
    opt.value = mat;
    opt.textContent = mat;
    select.appendChild(opt);
  });

  if (materials.includes(selectedVal)) {
    select.value = selectedVal;
  }
}

function updateWeighCalculatorSelection() {
  const select = document.getElementById('weigh-filament-select');
  const selectedVal = select.value;
  select.innerHTML = '<option value="" disabled selected>-- Select a spool --</option>';

  const activeFilaments = state.filaments.filter(f => f.status !== 'Empty');
  activeFilaments.forEach(f => {
    const opt = document.createElement('option');
    opt.value = f.id;
    opt.textContent = `${f.brand} ${f.material} - ${f.colorName} (${f.currentWeight}g left)`;
    select.appendChild(opt);
  });

  if (state.filaments.some(f => f.id === selectedVal)) {
    select.value = selectedVal;
  }
}

// ==========================================================================
// Chart.js Manager
// ==========================================================================
function renderCharts() {
  const activeFilaments = getFilteredFilaments();
  const activeLogs = getFilteredLogs();

  Object.keys(charts).forEach(key => {
    if (charts[key]) { charts[key].destroy(); charts[key] = null; }
  });

  Chart.defaults.color = 'var(--text-muted)';
  Chart.defaults.font.family = 'var(--font-main)';
  Chart.defaults.font.size = 11;

  // 1. Material Distribution
  const matCounts = {};
  activeFilaments.forEach(f => {
    if (f.status !== 'Empty') {
      matCounts[f.material] = (matCounts[f.material] || 0) + f.currentWeight;
    }
  });

  const matLabels = Object.keys(matCounts);
  const matValues = Object.values(matCounts).map(v => (v / 1000).toFixed(2));

  const ctxMaterials = document.getElementById('chart-materials').getContext('2d');
  charts.materials = new Chart(ctxMaterials, {
    type: 'doughnut',
    data: {
      labels: matLabels,
      datasets: [{
        data: matValues,
        backgroundColor: ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#06b6d4', '#a855f7', '#84cc16', '#f43f5e'],
        borderWidth: 1, borderColor: 'var(--bg-secondary)'
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'right' }, tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.raw} kg` } } },
      cutout: '65%'
    }
  });

  // 2. Spool Status
  const statusCounts = { 'In Use': 0, 'Sealed': 0, 'Stowed': 0, 'Empty': 0 };
  activeFilaments.forEach(f => { statusCounts[f.status] = (statusCounts[f.status] || 0) + 1; });

  const ctxStatus = document.getElementById('chart-status').getContext('2d');
  charts.status = new Chart(ctxStatus, {
    type: 'pie',
    data: {
      labels: Object.keys(statusCounts),
      datasets: [{ data: Object.values(statusCounts), backgroundColor: ['#06b6d4', '#10b981', '#f59e0b', '#f43f5e'], borderWidth: 1, borderColor: 'var(--bg-secondary)' }]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' } } }
  });

  // 3. Usage by Owner
  const usageOwnerCounts = {};
  state.users.forEach(u => { usageOwnerCounts[u.name] = 0; });
  activeLogs.forEach(log => {
    const user = state.users.find(u => u.id === log.userId);
    if (user) usageOwnerCounts[user.name] += log.weightUsed;
  });

  const userLabels = Object.keys(usageOwnerCounts);
  const userColors = userLabels.map(name => {
    const user = state.users.find(u => u.name === name);
    return user ? user.color : '#6366f1';
  });

  const ctxUsage = document.getElementById('chart-usage-owner').getContext('2d');
  charts.usageOwner = new Chart(ctxUsage, {
    type: 'bar',
    data: { labels: userLabels, datasets: [{ label: 'Grams Used', data: Object.values(usageOwnerCounts), backgroundColor: userColors, borderRadius: 6 }] },
    options: {
      indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { x: { grid: { color: 'rgba(255,255,255,0.05)' } }, y: { grid: { display: false } } }
    }
  });

  // 4. Print Success Rate
  let successCount = 0, failedCount = 0;
  activeLogs.forEach(l => { if (l.status === 'success') successCount++; else failedCount++; });

  const ctxSuccess = document.getElementById('chart-success-rate').getContext('2d');
  charts.successRate = new Chart(ctxSuccess, {
    type: 'doughnut',
    data: {
      labels: ['Success', 'Failed'],
      datasets: [{ data: [successCount, failedCount], backgroundColor: ['#10b981', '#f43f5e'], borderWidth: 1, borderColor: 'var(--bg-secondary)' }]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' } }, cutout: '65%' }
  });
}

// ==========================================================================
// Filter and State Helpers
// ==========================================================================
function getFilteredFilaments() {
  if (state.activeOwner === 'all') return state.filaments;
  return state.filaments.filter(f => f.ownerId === state.activeOwner);
}

function getFilteredLogs() {
  if (state.activeOwner === 'all') return state.logs;
  return state.logs.filter(l => l.userId === state.activeOwner);
}

function populateFilamentForm(filament) {
  document.getElementById('modal-filament-title').textContent = 'Edit Filament Spool';
  document.getElementById('form-filament-id').value = filament.id;
  document.getElementById('form-brand').value = filament.brand;
  document.getElementById('form-material').value = filament.material;
  document.getElementById('form-color-name').value = filament.colorName;
  document.getElementById('form-color-hex').value = filament.colorHex;
  document.getElementById('form-color-hex-text').value = filament.colorHex;
  document.getElementById('form-diameter').value = filament.diameter;
  document.getElementById('form-owner').value = filament.ownerId;
  document.getElementById('form-spool-weight').value = filament.spoolWeight;
  document.getElementById('form-empty-spool-weight').value = filament.emptySpoolWeight || '';
  document.getElementById('form-current-weight').value = filament.currentWeight;
  document.getElementById('form-status').value = filament.status;
  document.getElementById('form-cost').value = filament.cost || '';
  document.getElementById('form-purchase-date').value = filament.purchaseDate || '';
  document.getElementById('form-location').value = filament.location || '';
  document.getElementById('form-notes').value = filament.notes || '';
  document.getElementById('form-filament-submit-btn').textContent = 'Save Changes';
  document.getElementById('form-filament-delete-btn').style.display = 'inline-block';
  document.getElementById('form-filament-qty-row').style.display = 'none';
  document.getElementById('form-bulk-price-group').style.display = 'none';
  document.getElementById('form-cost-helper').style.display = 'none';
}

function resetFilamentForm() {
  document.getElementById('modal-filament-title').textContent = 'Add New Filament Spool';
  document.getElementById('form-filament-id').value = '';
  document.getElementById('form-filament').reset();
  document.getElementById('form-color-hex').value = '#6366f1';
  document.getElementById('form-color-hex-text').value = '#6366f1';
  document.getElementById('form-diameter').value = '1.75';
  document.getElementById('form-spool-weight').value = '1000';
  document.getElementById('form-current-weight').value = '1000';
  document.getElementById('form-status').value = 'In Use';
  document.getElementById('form-filament-submit-btn').textContent = 'Save Filament';
  document.getElementById('form-filament-delete-btn').style.display = 'none';
  document.getElementById('form-filament-qty-row').style.display = 'block';
  document.getElementById('form-filament-qty').value = '1';
  document.getElementById('form-bulk-price-group').style.display = 'block';
  document.getElementById('form-bulk-total-price').value = '';
  document.getElementById('form-cost-helper').style.display = 'none';
  document.getElementById('form-cost-helper').textContent = '';
}

function resetPrintForm() {
  document.getElementById('form-print').reset();
  const printDateInput = document.getElementById('form-print-date');
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  printDateInput.value = now.toISOString().slice(0, 16);
  document.getElementById('form-print-hours').value = 0;
  document.getElementById('form-print-minutes').value = 0;
  document.getElementById('form-print-status').value = 'success';
}

function generateId(prefix = 'id') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 5)}`;
}

// ==========================================================================
// Event Listeners & Interactions
// ==========================================================================
document.addEventListener('DOMContentLoaded', async () => {
  // Load state from the API server first, then render
  await loadStateFromServer();
  populateMaterialFilter();
  updateUI();

  // 1. Sidebar tab switching
  const navItems = document.querySelectorAll('.nav-item');
  const tabViews = document.querySelectorAll('.tab-view');

  navItems.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.getAttribute('data-tab');
      navItems.forEach(n => n.classList.remove('active'));
      btn.classList.add('active');
      tabViews.forEach(v => v.classList.remove('active'));
      const activeTab = document.getElementById(`view-${tabId}`);
      if (activeTab) activeTab.classList.add('active');
      if (tabId === 'dashboard') renderCharts();
    });
  });

  // 1b. JS-driven layout mode — avoids media query issues inside HA iframe
  const sidebar = document.getElementById('app-sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  const hamburger = document.getElementById('hamburger-btn');
  const sidebarCloseBtn = document.getElementById('sidebar-close-btn');
  const MOBILE_BREAKPOINT = 768;

  function isMobile() {
    return window.innerWidth < MOBILE_BREAKPOINT;
  }

  function applyLayoutMode() {
    if (isMobile()) {
      document.body.classList.add('mobile-mode');
      document.body.classList.remove('desktop-mode');
    } else {
      document.body.classList.add('desktop-mode');
      document.body.classList.remove('mobile-mode');
      // Make sure sidebar is always visible on desktop
      if (sidebar) {
        sidebar.classList.remove('mobile-open');
      }
      if (overlay) overlay.classList.remove('visible');
      document.body.style.overflow = '';
    }
  }

  function openSidebar() {
    if (sidebar) sidebar.classList.add('mobile-open');
    if (overlay) overlay.classList.add('visible');
    document.body.style.overflow = 'hidden';
  }
  function closeSidebar() {
    if (sidebar) sidebar.classList.remove('mobile-open');
    if (overlay) overlay.classList.remove('visible');
    document.body.style.overflow = '';
  }

  // Run on load and on resize
  applyLayoutMode();
  window.addEventListener('resize', applyLayoutMode);

  if (hamburger) hamburger.addEventListener('click', openSidebar);
  if (sidebarCloseBtn) sidebarCloseBtn.addEventListener('click', closeSidebar);
  if (overlay) overlay.addEventListener('click', closeSidebar);

  // Close sidebar when a nav item is tapped on mobile
  navItems.forEach(btn => {
    btn.addEventListener('click', () => {
      if (isMobile()) closeSidebar();
    });
  });

  // 1c. Mobile filter toggle (Inventory page)
  const filterToggleBtn = document.getElementById('btn-toggle-filters');
  const filterPanel = document.getElementById('filter-controls-panel');
  if (filterToggleBtn && filterPanel) {
    filterToggleBtn.addEventListener('click', () => {
      const isOpen = filterPanel.classList.toggle('filters-open');
      filterToggleBtn.textContent = '';
      filterToggleBtn.insertAdjacentHTML('afterbegin', `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px;margin-right:6px;flex-shrink:0"><line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/></svg>
        ${isOpen ? 'Hide Filters' : 'Filters &amp; Sort'}
      `);
    });
  }

  // 2. Owner filter (sidebar)
  document.getElementById('sidebar-owner-filter').addEventListener('change', (e) => {
    state.activeOwner = e.target.value;
    saveState();
    updateUI();
  });

  if (document.getElementById('filter-owner')) {
    document.getElementById('filter-owner').addEventListener('change', (e) => {
      state.activeOwner = e.target.value;
      saveState();
      updateUI();
    });
  }

  // 3. Search & filter triggers
  document.getElementById('global-search').addEventListener('input', renderFilamentsGrid);
  document.getElementById('filter-material').addEventListener('change', renderFilamentsGrid);
  document.getElementById('filter-status').addEventListener('change', renderFilamentsGrid);
  if (document.getElementById('filter-owner')) {
    document.getElementById('filter-owner').addEventListener('change', renderFilamentsGrid);
  }
  document.getElementById('sort-by').addEventListener('change', renderFilamentsGrid);
  document.getElementById('btn-clear-filters').addEventListener('click', () => {
    document.getElementById('filter-material').value = 'all';
    document.getElementById('filter-status').value = 'all';
    if (document.getElementById('filter-owner')) document.getElementById('filter-owner').value = 'all';
    state.activeOwner = 'all';
    document.getElementById('sidebar-owner-filter').value = 'all';
    document.getElementById('sort-by').value = 'remaining-desc';
    document.getElementById('global-search').value = '';
    saveState();
    updateUI();
  });

  // 4. Modal triggers
  document.getElementById('btn-add-filament').addEventListener('click', () => {
    resetFilamentForm();
    if (state.activeOwner !== 'all') {
      document.getElementById('form-owner').value = state.activeOwner;
    }
    openModal('modal-filament');
  });

  document.getElementById('btn-log-print').addEventListener('click', () => {
    resetPrintForm();
    if (state.activeOwner !== 'all') {
      document.getElementById('form-print-user').value = state.activeOwner;
    }
    openModal('modal-print');
  });

  document.getElementById('btn-manage-users').addEventListener('click', () => {
    openModal('modal-users');
  });

  document.getElementById('form-filament-delete-btn').addEventListener('click', () => {
    const id = document.getElementById('form-filament-id').value;
    if (id && confirm('Are you sure you want to delete this filament spool? Historical print logs will be preserved.')) {
      state.filaments = state.filaments.filter(f => f.id !== id);
      saveState().then(() => {
        closeModal('modal-filament');
        showNotification('Filament spool deleted.', 'error');
        populateMaterialFilter();
        updateUI();
      });
    }
  });

  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      closeModal(btn.getAttribute('data-close'));
    });
  });

  window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
      e.target.classList.remove('open');
    }
  });

  // 5. Color hex linkage
  const hexInput = document.getElementById('form-color-hex');
  const hexTextInput = document.getElementById('form-color-hex-text');

  hexInput.addEventListener('input', (e) => { hexTextInput.value = e.target.value; });
  hexTextInput.addEventListener('change', (e) => {
    let val = e.target.value.trim();
    if (!val.startsWith('#')) val = '#' + val;
    if (/^#[0-9A-F]{6}$/i.test(val)) {
      hexInput.value = val;
    } else {
      hexTextInput.value = hexInput.value;
    }
  });

  // 5b. Bulk price auto-divider
  function recalcBulkPrice() {
    const bulkInput = document.getElementById('form-bulk-total-price');
    const costInput = document.getElementById('form-cost');
    const qtyInput = document.getElementById('form-filament-qty');
    const helper = document.getElementById('form-cost-helper');

    const bulkTotal = parseFloat(bulkInput.value);
    const qty = Math.max(1, parseInt(qtyInput.value) || 1);

    if (bulkInput.value && !isNaN(bulkTotal) && bulkTotal > 0) {
      const perSpool = (bulkTotal / qty).toFixed(2);
      costInput.value = perSpool;
      helper.textContent = `$${bulkTotal.toFixed(2)} ÷ ${qty} spool${qty > 1 ? 's' : ''} = $${perSpool} each`;
      helper.style.display = 'block';
    } else {
      helper.style.display = 'none';
      helper.textContent = '';
    }
  }

  document.getElementById('form-bulk-total-price').addEventListener('input', recalcBulkPrice);
  document.getElementById('form-filament-qty').addEventListener('input', recalcBulkPrice);

  // Print filament helper
  const printFilSelect = document.getElementById('form-print-filament');
  const printWeightHelper = document.getElementById('form-print-weight-helper');
  const printWeightInput = document.getElementById('form-print-weight');

  printFilSelect.addEventListener('change', () => {
    const fil = state.filaments.find(f => f.id === printFilSelect.value);
    if (fil) {
      printWeightHelper.textContent = `Available filament: ${fil.currentWeight}g`;
      printWeightInput.max = fil.currentWeight;
    } else {
      printWeightHelper.textContent = 'Available: 0g';
      printWeightInput.removeAttribute('max');
    }
  });

  // 6. Add/Edit Filament form submission
  document.getElementById('form-filament').addEventListener('submit', (e) => {
    e.preventDefault();

    const id = document.getElementById('form-filament-id').value;
    const brand = document.getElementById('form-brand').value.trim();
    const material = document.getElementById('form-material').value.trim().toUpperCase();
    const colorName = document.getElementById('form-color-name').value.trim();
    const colorHex = document.getElementById('form-color-hex').value;
    const diameter = parseFloat(document.getElementById('form-diameter').value);
    const ownerId = document.getElementById('form-owner').value;
    const spoolWeight = parseInt(document.getElementById('form-spool-weight').value);
    const emptyWeightVal = document.getElementById('form-empty-spool-weight').value;
    const emptySpoolWeight = emptyWeightVal ? parseInt(emptyWeightVal) : 220;
    const currentWeight = Math.min(spoolWeight, parseInt(document.getElementById('form-current-weight').value));
    const status = document.getElementById('form-status').value;
    const costVal = document.getElementById('form-cost').value;
    const cost = costVal ? parseFloat(costVal) : null;
    const purchaseDate = document.getElementById('form-purchase-date').value || null;
    const location = document.getElementById('form-location').value.trim() || null;
    const notes = document.getElementById('form-notes').value.trim() || null;

    if (id) {
      const index = state.filaments.findIndex(f => f.id === id);
      if (index !== -1) {
        state.filaments[index] = { id, brand, material, colorName, colorHex, diameter, ownerId, spoolWeight, emptySpoolWeight, currentWeight, status, cost, purchaseDate, location, notes };
        saveState().then(() => { showNotification('Filament updated successfully.'); });
      }
    } else {
      const qtyInput = document.getElementById('form-filament-qty');
      const qty = qtyInput ? Math.max(1, parseInt(qtyInput.value) || 1) : 1;

      for (let i = 0; i < qty; i++) {
        let spoolLocation = location;
        if (qty > 1) {
          spoolLocation = location ? `${location} (#${i + 1})` : `Copy #${i + 1}`;
        }
        state.filaments.push({ id: generateId('f'), brand, material, colorName, colorHex, diameter, ownerId, spoolWeight, emptySpoolWeight, currentWeight, status, cost, purchaseDate, location: spoolLocation, notes });
      }

      saveState().then(() => {
        showNotification(qty > 1 ? `Bulk added ${qty} identical filament spools.` : 'New filament spool added.');
      });
    }

    closeModal('modal-filament');
    populateMaterialFilter();
    updateUI();
  });


  // 7. Log Print form submission
  document.getElementById('form-print').addEventListener('submit', (e) => {
    e.preventDefault();

    const filId = document.getElementById('form-print-filament').value;
    const printName = document.getElementById('form-print-name').value.trim();
    const weightUsed = parseFloat(document.getElementById('form-print-weight').value);
    const userId = document.getElementById('form-print-user').value;
    const hrs = parseInt(document.getElementById('form-print-hours').value) || 0;
    const mins = parseInt(document.getElementById('form-print-minutes').value) || 0;
    const durationMinutes = (hrs * 60) + mins;
    const status = document.getElementById('form-print-status').value;
    const dateInput = document.getElementById('form-print-date').value;
    const date = dateInput ? new Date(dateInput).toISOString() : new Date().toISOString();
    const notes = document.getElementById('form-print-notes').value.trim() || null;

    const fil = state.filaments.find(f => f.id === filId);
    if (!fil) return;

    if (weightUsed > fil.currentWeight) {
      alert(`Error: Spool only has ${fil.currentWeight}g remaining. You cannot print ${weightUsed}g.`);
      return;
    }

    fil.currentWeight = Math.max(0, fil.currentWeight - weightUsed);
    if (fil.currentWeight === 0) fil.status = 'Empty';

    state.logs.push({ id: generateId('l'), filamentId: filId, printName, weightUsed, durationMinutes, userId, date, status, notes });

    saveState().then(() => {
      closeModal('modal-print');
      showNotification('Print logged successfully! Filament stock updated.');
      updateUI();
    });
  });

  // 8. Add User form submission
  document.getElementById('form-add-user').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('form-user-name').value.trim();
    const color = document.getElementById('form-user-color').value;
    if (state.users.some(u => u.name.toLowerCase() === name.toLowerCase())) {
      alert('A user with that name already exists!');
      return;
    }
    state.users.push({ id: generateId('u'), name, color, avatar: '\u{1F464}' });
    saveState().then(() => {
      document.getElementById('form-user-name').value = '';
      showNotification(`User '${name}' created.`);
      updateUI();
    });
  });

  // ==========================================================================
  // Calculators
  // ==========================================================================
  const calcWeight   = document.getElementById('calc-weight');
  const calcLength   = document.getElementById('calc-length');
  const calcMaterial = document.getElementById('calc-material');
  const calcDiameter = document.getElementById('calc-diameter');
  const densities = { PLA: 1.24, PETG: 1.27, ABS: 1.04, TPU: 1.20, ASA: 1.07, Nylon: 1.08 };

  function getCalcSpecs() {
    const density = densities[calcMaterial.value] || 1.24;
    const diam = parseFloat(calcDiameter.value) || 1.75;
    return { density, diam };
  }

  calcWeight.addEventListener('input', () => {
    const weight = parseFloat(calcWeight.value);
    if (isNaN(weight) || weight <= 0) { calcLength.value = ''; return; }
    const { density, diam } = getCalcSpecs();
    const r = diam / 20;
    calcLength.value = (weight / (100 * Math.PI * r * r * density)).toFixed(2);
  });

  calcLength.addEventListener('input', () => {
    const length = parseFloat(calcLength.value);
    if (isNaN(length) || length <= 0) { calcWeight.value = ''; return; }
    const { density, diam } = getCalcSpecs();
    const r = diam / 20;
    calcWeight.value = (length * 100 * Math.PI * r * r * density).toFixed(1);
  });

  calcMaterial.addEventListener('change', () => calcWeight.dispatchEvent(new Event('input')));
  calcDiameter.addEventListener('change', () => calcWeight.dispatchEvent(new Event('input')));

  // Weigh-in tool
  const weighFilSelect = document.getElementById('weigh-filament-select');
  const weighGross     = document.getElementById('weigh-gross-weight');
  const weighEmpty     = document.getElementById('weigh-empty-weight');
  const weighResult    = document.getElementById('weigh-calculated-value');
  const weighApplyBtn  = document.getElementById('btn-apply-weigh');

  weighFilSelect.addEventListener('change', () => {
    const fil = state.filaments.find(f => f.id === weighFilSelect.value);
    if (fil) { weighEmpty.value = fil.emptySpoolWeight || 220; calculateWeigh(); }
  });

  function calculateWeigh() {
    const gross = parseFloat(weighGross.value);
    const tare  = parseFloat(weighEmpty.value);
    if (isNaN(gross) || isNaN(tare)) {
      weighResult.textContent = '0 g';
      weighApplyBtn.disabled = true;
      return;
    }
    weighResult.textContent = `${Math.max(0, gross - tare).toFixed(0)} g`;
    weighApplyBtn.disabled = false;
  }
  weighGross.addEventListener('input', calculateWeigh);
  weighEmpty.addEventListener('input', calculateWeigh);

  weighApplyBtn.addEventListener('click', () => {
    const filId  = weighFilSelect.value;
    const fil    = state.filaments.find(f => f.id === filId);
    if (!fil) return;
    const gross  = parseFloat(weighGross.value);
    const tare   = parseFloat(weighEmpty.value);
    const result = Math.max(0, gross - tare);
    if (result > fil.spoolWeight) {
      alert(`Calculated weight (${result}g) exceeds spool max (${fil.spoolWeight}g). Check measurements.`);
      return;
    }
    fil.currentWeight    = result;
    fil.emptySpoolWeight = tare;
    if (result === 0)              fil.status = 'Empty';
    else if (fil.status === 'Empty') fil.status = 'In Use';
    saveState().then(() => {
      showNotification(`Stock of ${fil.brand} (${fil.colorName}) updated to ${result}g.`);
      weighGross.value = '';
      updateUI();
    });
  });

  // ==========================================================================
  // Data Backup / Restore
  // ==========================================================================
  document.getElementById('btn-export-data').addEventListener('click', () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(state, null, 2));
    const a = document.createElement('a');
    a.setAttribute('href', dataStr);
    a.setAttribute('download', `spoolcontrol_backup_${new Date().toISOString().slice(0, 10)}.json`);
    a.click();
    showNotification('JSON database backup downloaded.');
  });

  const importBtn       = document.getElementById('btn-trigger-import');
  const importFileInput = document.getElementById('import-file-input');
  importBtn.addEventListener('click', () => importFileInput.click());

  importFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(evt) {
      try {
        const parsed = JSON.parse(evt.target.result);
        if (parsed.filaments && Array.isArray(parsed.filaments) &&
            parsed.logs     && Array.isArray(parsed.logs) &&
            parsed.users    && Array.isArray(parsed.users)) {
          state = parsed;
          delete state.githubSettings;
          if (!state.settings) state.settings = {};
          if (!state.settings.colorScheme) state.settings.colorScheme = { ...COLOR_PRESETS.default };
          saveState().then(() => {
            showNotification('Database restored from backup!');
            populateMaterialFilter();
            updateUI();
          });
        } else {
          alert('Invalid backup file: missing filaments/logs/users tables.');
        }
      } catch (err) {
        alert('Failed to parse JSON: ' + err.message);
      }
    };
    reader.readAsText(file);
    importFileInput.value = '';
  });

  document.getElementById('btn-reset-db').addEventListener('click', () => {
    if (confirm('WARNING: This permanently wipes all inventory and print history. Are you sure?')) {
      clearDatabase();
    }
  });

  document.getElementById('btn-load-samples').addEventListener('click', () => {
    if (confirm('This will overwrite current data with sample data. Continue?')) {
      loadSampleData();
    }
  });

  // Save branding (preserve colorScheme)
  const saveBrandingBtn = document.getElementById('btn-save-branding');
  if (saveBrandingBtn) {
    saveBrandingBtn.addEventListener('click', () => {
      state.settings = {
        ...state.settings,
        appName:      document.getElementById('settings-app-name').value.trim()     || 'SpoolControl',
        appSubtitle:  document.getElementById('settings-app-subtitle').value.trim() || 'Filament Manager',
        appLogoEmoji: document.getElementById('settings-app-logo').value.trim()     || '\u{1F3A8}'
      };
      saveState().then(() => {
        showNotification('App branding updated!');
        applyBranding();
      });
    });
  }

  // Auto-open native date pickers
  document.querySelectorAll('input[type="date"], input[type="datetime-local"]').forEach(input => {
    input.addEventListener('click', (e) => { try { e.target.showPicker(); } catch (_) {} });
  });

  // ==========================================================================
  // Color Scheme Controls
  // ==========================================================================

  // Live preview while dragging pickers
  ['color-accent-primary','color-accent-secondary','color-bg-primary','color-bg-secondary'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', () => {
      const root = document.documentElement;
      const ap = document.getElementById('color-accent-primary').value;
      const as2 = document.getElementById('color-accent-secondary').value;
      const bp = document.getElementById('color-bg-primary').value;
      const bs = document.getElementById('color-bg-secondary').value;
      root.style.setProperty('--accent-primary',        ap);
      root.style.setProperty('--accent-primary-glow',   hexToRgba(ap,  0.15));
      root.style.setProperty('--accent-secondary',      as2);
      root.style.setProperty('--accent-secondary-glow', hexToRgba(as2, 0.15));
      root.style.setProperty('--bg-primary',  bp);
      root.style.setProperty('--bg-secondary', bs);
      root.style.setProperty('--bg-tertiary',  lightenHex(bs, 18));
      root.style.setProperty('--card-bg',      hexToRgba(bs, 0.6));
      document.querySelectorAll('.color-preset-btn').forEach(b => b.classList.remove('active'));
    });
  });

  const saveColorsBtn  = document.getElementById('btn-save-colors');
  const resetColorsBtn = document.getElementById('btn-reset-colors');

  if (saveColorsBtn) {
    saveColorsBtn.addEventListener('click', () => {
      if (!state.settings) state.settings = {};
      state.settings.colorScheme = {
        accentPrimary:   document.getElementById('color-accent-primary').value,
        accentSecondary: document.getElementById('color-accent-secondary').value,
        bgPrimary:       document.getElementById('color-bg-primary').value,
        bgSecondary:     document.getElementById('color-bg-secondary').value
      };
      saveState().then(() => { showNotification('Color scheme saved!'); applyColorScheme(); });
    });
  }

  if (resetColorsBtn) {
    resetColorsBtn.addEventListener('click', () => {
      if (!state.settings) state.settings = {};
      state.settings.colorScheme = { ...COLOR_PRESETS.default };
      saveState().then(() => { showNotification('Color scheme reset to default.'); applyColorScheme(); });
    });
  }

  document.querySelectorAll('.color-preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const preset = COLOR_PRESETS[btn.dataset.preset];
      if (!preset) return;
      if (!state.settings) state.settings = {};
      state.settings.colorScheme = { ...preset };
      saveState().then(() => {
        showNotification(`Theme "${btn.dataset.preset}" applied!`);
        applyColorScheme();
      });
    });
  });



  // ==========================================================================
  // Mobile FABs — show/hide per active tab
  // ==========================================================================
  const fabInventory = document.getElementById('fab-add-roll');
  const fabLogs      = document.getElementById('fab-log-print');

  function updateFABs(tabId) {
    if (fabInventory) fabInventory.style.display = (tabId === 'inventory') ? 'flex' : 'none';
    if (fabLogs)      fabLogs.style.display      = (tabId === 'logs')      ? 'flex' : 'none';
  }
  updateFABs('dashboard');

  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => updateFABs(btn.getAttribute('data-tab')));
  });

  if (fabInventory) {
    fabInventory.addEventListener('click', () => {
      resetFilamentForm();
      if (state.activeOwner !== 'all') document.getElementById('form-owner').value = state.activeOwner;
      openModal('modal-filament');
    });
  }
  if (fabLogs) {
    fabLogs.addEventListener('click', () => {
      resetPrintForm();
      if (state.activeOwner !== 'all') document.getElementById('form-print-user').value = state.activeOwner;
      openModal('modal-print');
    });
  }

});
