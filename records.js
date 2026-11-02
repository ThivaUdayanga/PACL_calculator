/**
 * PACL Records Management Logic
 * Completely connected to MariaDB / MySQL database via api_records.php
 * Handles real-time CRUD operations, statistics dashboard, server-side pagination,
 * filtering, sorting, and CSV export.
 */

const API_BASE = 'api_records.php';
const THEME_KEY = 'pacl_theme_pref';
const PAGE_SIZE = 10;

const state = {
  records: [],         // records on the current page
  allRecords: [],      // full list — used for CSV export & series dropdown
  stats: null,
  tableSort: { key: 'ph', asc: true },
  tableFilter: '',
  seriesFilter: 'all',
  pendingDeleteRecord: null,
  pendingDuplicate: null,
  theme: 'dark',
  isLoading: false,
  pagination: {
    page: 1,
    total: 0,
    totalPages: 1,
    limit: PAGE_SIZE
  }
};

const elements = {
  dbStatusPill: document.getElementById('dbStatusPill'),
  dbStatusText: document.getElementById('dbStatusText'),
  themeToggleBtn: document.getElementById('themeToggleBtn'),
  tableCountBadge: document.getElementById('tableCountBadge'),
  tableBody: document.getElementById('tableBody'),
  tableSearch: document.getElementById('tableSearch'),
  clearSearchBtn: document.getElementById('clearSearchBtn'),
  seriesFilter: document.getElementById('seriesFilter'),
  jarTestTable: document.getElementById('jarTestTable'),
  addNewRecordBtn: document.getElementById('addNewRecordBtn'),
  restoreBenchmarkBtn: document.getElementById('restoreBenchmarkBtn'),
  refreshBtn: document.getElementById('refreshBtn'),
  exportCsvBtn: document.getElementById('exportCsvBtn'),
  paginationBar: document.getElementById('paginationBar'),

  // Stats elements
  statTotalRecords: document.getElementById('statTotalRecords'),
  statPhSeries: document.getElementById('statPhSeries'),
  statPhRange: document.getElementById('statPhRange'),
  statTurbRange: document.getElementById('statTurbRange'),
  statPaclRange: document.getElementById('statPaclRange'),
  statAvgPacl: document.getElementById('statAvgPacl'),

  // Add/Edit Modal elements
  recordModal: document.getElementById('recordModal'),
  modalTitle: document.getElementById('modalTitle'),
  closeModalBtn: document.getElementById('closeModalBtn'),
  cancelModalBtn: document.getElementById('cancelModalBtn'),
  recordForm: document.getElementById('recordForm'),
  recordId: document.getElementById('recordId'),
  modalPhInput: document.getElementById('modalPhInput'),
  modalTurbidityInput: document.getElementById('modalTurbidityInput'),
  modalPaclInput: document.getElementById('modalPaclInput'),
  modalDuplicateNotice: document.getElementById('modalDuplicateNotice'),
  modalDuplicateNoticeText: document.getElementById('modalDuplicateNoticeText'),
  modalDateInput: document.getElementById('modalDateInput'),
  modalStatusInput: document.getElementById('modalStatusInput'),
  saveRecordBtn: document.getElementById('saveRecordBtn'),
  saveBtnText: document.getElementById('saveBtnText'),

  // Delete Modal elements
  deleteModal: document.getElementById('deleteModal'),
  closeDeleteModalBtn: document.getElementById('closeDeleteModalBtn'),
  cancelDeleteBtn: document.getElementById('cancelDeleteBtn'),
  confirmDeleteBtn: document.getElementById('confirmDeleteBtn'),
  deleteRecordDetails: document.getElementById('deleteRecordDetails'),

  // Duplicate Confirmation Modal elements
  duplicateModal: document.getElementById('duplicateModal'),
  closeDuplicateModalBtn: document.getElementById('closeDuplicateModalBtn'),
  cancelDuplicateBtn: document.getElementById('cancelDuplicateBtn'),
  confirmDuplicateBtn: document.getElementById('confirmDuplicateBtn'),
  dupExistingId: document.getElementById('dupExistingId'),
  dupExistingPh: document.getElementById('dupExistingPh'),
  dupExistingTurb: document.getElementById('dupExistingTurb'),
  dupExistingPacl: document.getElementById('dupExistingPacl'),
  dupExistingDate: document.getElementById('dupExistingDate'),
  dupExistingStatus: document.getElementById('dupExistingStatus'),
  dupNewPaclInput: document.getElementById('dupNewPaclInput'),

  toastContainer: document.getElementById('toastContainer')
};

/* ==========================================================================
   Initialization
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  loadThemePreference();
  initEventListeners();
  fetchAllForDropdown();
  fetchRecords();

  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('action') === 'add') {
    openAddModal();
  }
});

/* ==========================================================================
   Theme Management
   ========================================================================== */

function loadThemePreference() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === 'light') {
    state.theme = 'light';
    document.body.classList.remove('dark-theme');
    document.body.classList.add('light-theme');
    if (elements.themeToggleBtn) elements.themeToggleBtn.innerHTML = '<i class="fa-solid fa-sun"></i>';
  } else {
    state.theme = 'dark';
    document.body.classList.add('dark-theme');
    document.body.classList.remove('light-theme');
    if (elements.themeToggleBtn) elements.themeToggleBtn.innerHTML = '<i class="fa-solid fa-moon"></i>';
  }
}

function toggleTheme() {
  if (state.theme === 'dark') {
    state.theme = 'light';
    document.body.classList.remove('dark-theme');
    document.body.classList.add('light-theme');
    if (elements.themeToggleBtn) elements.themeToggleBtn.innerHTML = '<i class="fa-solid fa-sun"></i>';
  } else {
    state.theme = 'dark';
    document.body.classList.add('dark-theme');
    document.body.classList.remove('light-theme');
    if (elements.themeToggleBtn) elements.themeToggleBtn.innerHTML = '<i class="fa-solid fa-moon"></i>';
  }
  localStorage.setItem(THEME_KEY, state.theme);
}

/* ==========================================================================
   Database Operations — Server-Side Paginated Fetch
   ========================================================================== */

function buildPageUrl(page) {
  const params = new URLSearchParams({
    page: page,
    limit: state.pagination.limit
  });
  if (state.tableFilter) params.set('search', state.tableFilter);
  if (state.seriesFilter !== 'all') params.set('series', state.seriesFilter);
  return `${API_BASE}?${params.toString()}`;
}

async function fetchAllForDropdown() {
  try {
    const res = await fetch(API_BASE);
    if (!res.ok) return;
    const json = await res.json();
    if (json.success && Array.isArray(json.data)) {
      state.allRecords = json.data;
      populateSeriesDropdown();
      fetchStats();
    }
  } catch (err) {
    console.warn('Could not pre-load all records for dropdown:', err);
  }
}

async function fetchRecords(silent = false) {
  state.isLoading = true;
  if (!silent && elements.tableBody) {
    elements.tableBody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 3rem 1.5rem; color: var(--text-muted);">
          <span class="btn-spinner"></span> Loading test records from database...
        </td>
      </tr>
    `;
    if (elements.paginationBar) elements.paginationBar.innerHTML = '';
  }

  try {
    const url = buildPageUrl(state.pagination.page);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to reach database`);
    const json = await res.json();

    if (json.success && json.data) {
      const data = json.data;
      if (data.records !== undefined) {
        state.records = data.records;
        state.pagination.total = data.total;
        state.pagination.page = data.page;
        state.pagination.totalPages = data.total_pages;
        state.pagination.limit = data.limit;

        const start = (state.pagination.page - 1) * state.pagination.limit + 1;
        const end = start + state.records.length - 1;
        updateDbStatus(true, `${data.total} Records Connected`);
        if (elements.tableCountBadge) {
          elements.tableCountBadge.textContent =
            data.total === 0 ? '0 records' : `${start}–${end} of ${data.total} records`;
        }
      } else if (Array.isArray(data)) {
        state.records = data;
        state.pagination.total = data.length;
        state.pagination.totalPages = 1;
        updateDbStatus(true, `${data.length} Records Connected`);
        if (elements.tableCountBadge) {
          elements.tableCountBadge.textContent = `${data.length} records`;
        }
      }

      renderTable();
      renderPagination();
    } else {
      throw new Error(json.message || 'Unknown database error');
    }
  } catch (err) {
    console.error('Database connection failed:', err);
    updateDbStatus(false, 'Database Disconnected');
    if (elements.tableBody) {
      elements.tableBody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 3rem 1.5rem; color: var(--accent-rose);">
            <i class="fa-solid fa-triangle-exclamation" style="font-size: 2rem; margin-bottom: 0.75rem; display: block;"></i>
            <strong>Unable to connect to the database.</strong><br>
            <span style="font-size: 0.85rem; color: var(--text-muted);">${err.message}</span>
            <div style="margin-top: 1rem;">
              <button class="btn btn-sm btn-outline" onclick="fetchRecords()">
                <i class="fa-solid fa-rotate"></i> Retry Connection
              </button>
            </div>
          </td>
        </tr>
      `;
    }
    showToast(`Database error: ${err.message}`, 'error');
  } finally {
    state.isLoading = false;
  }
}

async function fetchStats() {
  try {
    const res = await fetch(`${API_BASE}?action=stats`);
    if (!res.ok) return;
    const json = await res.json();
    if (json.success && json.data) {
      const stats = json.data;
      state.stats = stats;

      if (elements.statTotalRecords) elements.statTotalRecords.textContent = stats.total_records;
      if (elements.statPhSeries) elements.statPhSeries.textContent = `${stats.ph_series_count} Series`;
      if (elements.statTurbRange) elements.statTurbRange.textContent = `${stats.min_turbidity} - ${stats.max_turbidity} NTU`;
      if (elements.statPaclRange) elements.statPaclRange.textContent = `${stats.min_pacl.toFixed(2)} - ${stats.max_pacl.toFixed(2)} mg/L`;
      if (elements.statAvgPacl) elements.statAvgPacl.textContent = `Average: ${stats.avg_pacl.toFixed(2)} mg/L`;

      if (elements.statPhRange && state.allRecords.length > 0) {
        const phs = state.allRecords.map(r => r.ph);
        const minPh = Math.min(...phs);
        const maxPh = Math.max(...phs);
        elements.statPhRange.textContent = `pH ${minPh.toFixed(1)} to pH ${maxPh.toFixed(1)}`;
      }
    }
  } catch (err) {
    console.warn('Could not fetch dataset stats:', err);
  }
}

function updateDbStatus(isConnected, text) {
  if (!elements.dbStatusPill) return;
  if (isConnected) {
    elements.dbStatusPill.className = 'db-status-pill';
    elements.dbStatusPill.innerHTML = `
      <span class="status-dot online"></span>
      <span id="dbStatusText">${text || 'Connected to Database'}</span>
    `;
  } else {
    elements.dbStatusPill.className = 'db-status-pill disconnected';
    elements.dbStatusPill.innerHTML = `
      <span class="status-dot offline"></span>
      <span id="dbStatusText">${text || 'Database Offline'}</span>
    `;
  }
}

function populateSeriesDropdown() {
  if (!elements.seriesFilter) return;
  const currentVal = elements.seriesFilter.value;
  const uniquePhs = Array.from(new Set(state.allRecords.map(r => Number(r.ph)))).sort((a, b) => a - b);

  elements.seriesFilter.innerHTML = '<option value="all">All pH Series</option>';
  uniquePhs.forEach(ph => {
    const count = state.allRecords.filter(r => Math.abs(r.ph - ph) < 0.001).length;
    const opt = document.createElement('option');
    opt.value = ph;
    opt.textContent = `pH ${ph.toFixed(ph % 1 === 0 ? 1 : 2)} (${count} records)`;
    elements.seriesFilter.appendChild(opt);
  });

  if (currentVal && Array.from(elements.seriesFilter.options).some(o => o.value === currentVal)) {
    elements.seriesFilter.value = currentVal;
  }
}

/* ==========================================================================
   Table Rendering (client-side sort on current page slice)
   ========================================================================== */

function renderTable() {
  if (!elements.tableBody) return;

  const { key, asc } = state.tableSort;
  const sorted = [...state.records].sort((a, b) => {
    let valA = a[key];
    let valB = b[key];
    if (['id', 'ph', 'turbidity', 'pacl'].includes(key)) {
      valA = Number(valA);
      valB = Number(valB);
    } else {
      valA = String(valA || '').toLowerCase();
      valB = String(valB || '').toLowerCase();
    }
    if (valA < valB) return asc ? -1 : 1;
    if (valA > valB) return asc ? 1 : -1;
    return 0;
  });

  elements.tableBody.innerHTML = '';

  if (sorted.length === 0) {
    elements.tableBody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 3rem 1.5rem; color: var(--text-muted);">
          <i class="fa-solid fa-circle-question" style="font-size: 2rem; margin-bottom: 0.75rem; display: block; opacity: 0.5;"></i>
          No jar test records matched your filter.
        </td>
      </tr>
    `;
    return;
  }

  sorted.forEach(rec => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="color: var(--text-muted); font-family: var(--font-mono); font-size: 0.8rem;">#${rec.id}</td>
      <td><strong>pH ${Number(rec.ph).toFixed(rec.ph % 1 === 0 ? 1 : 2)}</strong></td>
      <td><span style="font-family: var(--font-mono); color: var(--accent-emerald); font-weight: 600;">${Number(rec.turbidity).toFixed(2)} NTU</span></td>
      <td><span style="font-family: var(--font-mono); color: var(--accent-cyan); font-weight: 700;">${Number(rec.pacl).toFixed(2)} mg/L</span></td>
      <td><span style="color: var(--text-secondary); font-family: var(--font-mono); font-size: 0.85rem;">${escapeHtml(formatDateOnly(rec.created_at || rec.test_date))}</span></td>
      <td class="text-right">
        <button type="button" class="btn-table-action" title="Apply to Calculator" onclick="applyRecordToCalculator(${rec.ph}, ${rec.turbidity})">
          <i class="fa-solid fa-calculator"></i>
        </button>
        <button type="button" class="btn-table-action edit" title="Edit this record" onclick="openEditModal(${rec.id})">
          <i class="fa-solid fa-pen-to-square"></i>
        </button>
        <button type="button" class="btn-table-action delete" title="Delete record" onclick="openDeleteModal(${rec.id})">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </td>
    `;
    elements.tableBody.appendChild(tr);
  });
}

/* ==========================================================================
   Pagination Rendering
   ========================================================================== */

function renderPagination() {
  const bar = elements.paginationBar;
  if (!bar) return;

  const { page, totalPages, total, limit } = state.pagination;

  if (totalPages <= 1 && total <= limit) {
    bar.innerHTML = '';
    return;
  }

  const WINDOW = 2;
  const pages = [];
  for (let p = 1; p <= totalPages; p++) {
    if (p === 1 || p === totalPages || (p >= page - WINDOW && p <= page + WINDOW)) {
      pages.push(p);
    }
  }

  const pagesWithGaps = [];
  let prev = 0;
  for (const p of pages) {
    if (prev && p - prev > 1) pagesWithGaps.push('...');
    pagesWithGaps.push(p);
    prev = p;
  }

  const makeBtn = (label, targetPage, isActive = false, isDisabled = false, title = '') => {
    const cls = ['page-btn', isActive ? 'active' : '', isDisabled ? 'disabled' : ''].filter(Boolean).join(' ');
    const click = (!isDisabled && targetPage) ? `onclick="goToPage(${targetPage})"` : '';
    return `<button class="${cls}" ${click} ${isDisabled ? 'disabled' : ''} title="${title}">${label}</button>`;
  };

  const start = (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);

  let html = '<div class="pagination-controls">';
  html += `<span class="pagination-info">Showing ${start}–${end} of <strong>${total}</strong> records</span>`;
  html += '<div class="page-buttons">';
  html += makeBtn('<i class="fa-solid fa-angles-left"></i>', 1, false, page === 1, 'First page');
  html += makeBtn('<i class="fa-solid fa-angle-left"></i>', page - 1, false, page === 1, 'Previous page');

  pagesWithGaps.forEach(p => {
    if (p === '...') {
      html += `<span class="page-ellipsis">…</span>`;
    } else {
      html += makeBtn(p, p, p === page, false, `Page ${p}`);
    }
  });

  html += makeBtn('<i class="fa-solid fa-angle-right"></i>', page + 1, false, page === totalPages, 'Next page');
  html += makeBtn('<i class="fa-solid fa-angles-right"></i>', totalPages, false, page === totalPages, 'Last page');
  html += '</div></div>';

  bar.innerHTML = html;
}

window.goToPage = function (p) {
  const { totalPages } = state.pagination;
  p = Math.max(1, Math.min(p, totalPages));
  if (p === state.pagination.page) return;
  state.pagination.page = p;
  fetchRecords(true);
  const tableCard = document.querySelector('.table-card');
  if (tableCard) tableCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

function formatDateOnly(dateStr) {
  if (!dateStr) return '—';
  const datePart = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr.split(' ')[0];
  if (datePart && /^\d{4}-\d{2}-\d{2}$/.test(datePart)) return datePart;
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  return dateStr;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ==========================================================================
   Calculator Integration
   ========================================================================== */

window.applyRecordToCalculator = function (phVal, turbVal) {
  window.location.href = `index.html?ph=${encodeURIComponent(phVal)}&turbidity=${encodeURIComponent(turbVal)}`;
};

/* ==========================================================================
   Add / Edit Modal Operations
   ========================================================================== */

function checkInputDuplicateNotice() {
  if (!elements.modalPhInput || !elements.modalTurbidityInput || !elements.modalDuplicateNotice) return;
  const ph = parseFloat(elements.modalPhInput.value);
  const turb = parseFloat(elements.modalTurbidityInput.value);
  const currentId = elements.recordId && elements.recordId.value ? parseInt(elements.recordId.value, 10) : null;

  if (isNaN(ph) || isNaN(turb)) {
    elements.modalDuplicateNotice.classList.add('hidden');
    return;
  }

  const dup = state.allRecords.find(r =>
    Math.abs(Number(r.ph) - ph) < 0.001 &&
    Math.abs(Number(r.turbidity) - turb) < 0.001 &&
    (!currentId || Number(r.id) !== currentId)
  );

  if (dup) {
    if (elements.modalDuplicateNoticeText) {
      elements.modalDuplicateNoticeText.innerHTML = `Notice: Already has this record.`;
    }
    elements.modalDuplicateNotice.classList.remove('hidden');
  } else {
    elements.modalDuplicateNotice.classList.add('hidden');
  }
}

function openAddModal() {
  if (elements.modalTitle) elements.modalTitle.textContent = 'Add Jar Test Calibration Record';
  if (elements.recordId) elements.recordId.value = '';
  if (elements.modalPhInput) elements.modalPhInput.value = '6.60';
  if (elements.modalTurbidityInput) elements.modalTurbidityInput.value = '';
  if (elements.modalPaclInput) elements.modalPaclInput.value = '';
  if (elements.modalDateInput) elements.modalDateInput.value = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  if (elements.modalStatusInput) elements.modalStatusInput.value = 'Verified';
  if (elements.modalDuplicateNotice) elements.modalDuplicateNotice.classList.add('hidden');
  if (elements.saveBtnText) elements.saveBtnText.textContent = 'Save Record';
  if (elements.recordModal) elements.recordModal.classList.remove('hidden');
  checkInputDuplicateNotice();
}

window.openEditModal = function (id) {
  const rec = state.records.find(r => r.id === id);
  if (!rec) {
    showToast('Record not found', 'error');
    return;
  }

  if (elements.modalTitle) elements.modalTitle.textContent = `Edit Jar Test Record #${rec.id}`;
  if (elements.recordId) elements.recordId.value = rec.id;
  if (elements.modalPhInput) elements.modalPhInput.value = rec.ph;
  if (elements.modalTurbidityInput) elements.modalTurbidityInput.value = rec.turbidity;
  if (elements.modalPaclInput) elements.modalPaclInput.value = rec.pacl;
  if (elements.modalDateInput) elements.modalDateInput.value = rec.test_date || '';
  if (elements.modalStatusInput) elements.modalStatusInput.value = rec.status || 'Verified';
  if (elements.modalDuplicateNotice) elements.modalDuplicateNotice.classList.add('hidden');
  if (elements.saveBtnText) elements.saveBtnText.textContent = 'Update Record';
  if (elements.recordModal) elements.recordModal.classList.remove('hidden');
};

function closeRecordModal() {
  if (elements.modalDuplicateNotice) elements.modalDuplicateNotice.classList.add('hidden');
  if (elements.recordModal) elements.recordModal.classList.add('hidden');
}

/* ==========================================================================
   Duplicate Confirmation Modal Operations
   ========================================================================== */

function openDuplicateModal(existingRecord, newPayload) {
  state.pendingDuplicate = { existingRecord, newPayload };

  if (elements.dupExistingId) elements.dupExistingId.textContent = existingRecord.id;
  if (elements.dupExistingPh) elements.dupExistingPh.textContent = Number(existingRecord.ph).toFixed(2);
  if (elements.dupExistingTurb) elements.dupExistingTurb.textContent = `${Number(existingRecord.turbidity).toFixed(2)} NTU`;
  if (elements.dupExistingPacl) elements.dupExistingPacl.textContent = `${Number(existingRecord.pacl).toFixed(2)} mg/L`;
  if (elements.dupExistingDate) elements.dupExistingDate.textContent = formatDateOnly(existingRecord.created_at || existingRecord.test_date);
  if (elements.dupExistingStatus) elements.dupExistingStatus.textContent = existingRecord.status || 'Verified';

  // Pre-fill editable result with the new PACL dosage value entered by the user
  if (elements.dupNewPaclInput) {
    elements.dupNewPaclInput.value = newPayload.pacl;
    setTimeout(() => {
      elements.dupNewPaclInput.focus();
      elements.dupNewPaclInput.select();
    }, 120);
  }

  if (elements.duplicateModal) {
    elements.duplicateModal.classList.remove('hidden');
  }
}

function closeDuplicateModal() {
  state.pendingDuplicate = null;
  if (elements.duplicateModal) {
    elements.duplicateModal.classList.add('hidden');
  }
}

async function handleConfirmDuplicate() {
  if (!state.pendingDuplicate) return;
  const { existingRecord, newPayload } = state.pendingDuplicate;

  const editedPacl = parseFloat(elements.dupNewPaclInput.value);
  if (isNaN(editedPacl) || editedPacl <= 0) {
    showToast('Please enter a valid PACL dosage result.', 'error');
    if (elements.dupNewPaclInput) elements.dupNewPaclInput.focus();
    return;
  }

  if (elements.confirmDuplicateBtn) elements.confirmDuplicateBtn.disabled = true;

  try {
    const updatePayload = {
      id: existingRecord.id,
      ph: existingRecord.ph,
      turbidity: existingRecord.turbidity,
      pacl: editedPacl,
      test_date: newPayload.test_date || existingRecord.test_date || 'Manual Entry',
      status: newPayload.status || existingRecord.status || 'Verified',
      overwrite: true
    };

    const res = await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatePayload)
    });

    const result = await res.json();
    if (!res.ok || !result.success) {
      throw new Error(result.message || 'Failed to update existing record.');
    }

    closeDuplicateModal();
    closeRecordModal();

    showToast(`Record #${existingRecord.id} (pH ${Number(existingRecord.ph).toFixed(2)}, ${Number(existingRecord.turbidity).toFixed(2)} NTU) updated with PACL dosage: ${editedPacl.toFixed(2)} mg/L.`, 'success');
    await fetchAllForDropdown();
    await fetchRecords(true);
  } catch (err) {
    console.error('Failed to update duplicate record:', err);
    showToast(`Update failed: ${err.message}`, 'error');
  } finally {
    if (elements.confirmDuplicateBtn) elements.confirmDuplicateBtn.disabled = false;
  }
}

async function handleRecordFormSubmit(e) {
  e.preventDefault();

  const id = elements.recordId ? elements.recordId.value.trim() : '';
  const ph = parseFloat(elements.modalPhInput.value);
  const turbidity = parseFloat(elements.modalTurbidityInput.value);
  const pacl = parseFloat(elements.modalPaclInput.value);
  const test_date = elements.modalDateInput ? elements.modalDateInput.value.trim() || 'Manual Entry' : 'Manual Entry';
  const status = elements.modalStatusInput ? elements.modalStatusInput.value : 'Verified';

  if (isNaN(ph) || isNaN(turbidity) || isNaN(pacl)) {
    showToast('Please provide valid numbers for pH, Turbidity, and PACL.', 'error');
    return;
  }

  const payload = { ph, turbidity, pacl, test_date, status };
  const isEdit = Boolean(id);
  const method = isEdit ? 'PUT' : 'POST';
  if (isEdit) payload.id = parseInt(id, 10);

  // Validate duplicate record: each pH value should have a single turbidity value
  const existingDup = state.allRecords.find(r =>
    Math.abs(Number(r.ph) - ph) < 0.001 &&
    Math.abs(Number(r.turbidity) - turbidity) < 0.001 &&
    (!isEdit || Number(r.id) !== payload.id)
  );

  if (existingDup) {
    // Popup confirmation box to allow editing the result and confirming update
    openDuplicateModal(existingDup, payload);
    return;
  }

  if (elements.saveRecordBtn) elements.saveRecordBtn.disabled = true;

  try {
    const res = await fetch(API_BASE, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await res.json();

    // Check if server detected duplicate not present in local state
    if (!res.ok && res.status === 409 && result.data && result.data.duplicate) {
      openDuplicateModal(result.data.existing, payload);
      return;
    }

    if (!res.ok || !result.success) throw new Error(result.message || 'Operation failed on server.');

    closeRecordModal();
    showToast(isEdit ? `Record #${id} updated successfully.` : `New record (pH ${ph}, ${turbidity} NTU) added.`, 'success');
    await fetchAllForDropdown();
    await fetchRecords(true);
  } catch (err) {
    console.error('Failed to save record:', err);
    showToast(`Error: ${err.message}`, 'error');
  } finally {
    if (elements.saveRecordBtn) elements.saveRecordBtn.disabled = false;
  }
}

/* ==========================================================================
   Delete Modal Operations
   ========================================================================== */

window.openDeleteModal = function (id) {
  const rec = state.records.find(r => r.id === id);
  if (!rec) return;

  state.pendingDeleteRecord = rec;
  if (elements.deleteRecordDetails) {
    elements.deleteRecordDetails.innerHTML = `
      <div><strong>Record ID:</strong> #${rec.id}</div>
      <div><strong>pH:</strong> ${rec.ph} | <strong>Turbidity:</strong> ${rec.turbidity} NTU</div>
      <div><strong>PACL Dose:</strong> ${rec.pacl} mg/L | <strong>Date:</strong> ${rec.test_date || 'N/A'}</div>
    `;
  }
  if (elements.deleteModal) elements.deleteModal.classList.remove('hidden');
};

function closeDeleteModal() {
  state.pendingDeleteRecord = null;
  if (elements.deleteModal) elements.deleteModal.classList.add('hidden');
}

async function handleConfirmDelete() {
  if (!state.pendingDeleteRecord) return;
  const { id, ph, turbidity } = state.pendingDeleteRecord;

  if (elements.confirmDeleteBtn) elements.confirmDeleteBtn.disabled = true;

  try {
    const res = await fetch(API_BASE, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
    const result = await res.json();
    if (!res.ok || !result.success) throw new Error(result.message || 'Failed to delete record.');

    closeDeleteModal();
    showToast(`Record #${id} (pH ${ph}, ${turbidity} NTU) deleted.`, 'info');

    if (state.records.length === 1 && state.pagination.page > 1) {
      state.pagination.page--;
    }
    await fetchAllForDropdown();
    await fetchRecords(true);
  } catch (err) {
    console.error('Failed to delete record:', err);
    showToast(`Delete failed: ${err.message}`, 'error');
  } finally {
    if (elements.confirmDeleteBtn) elements.confirmDeleteBtn.disabled = false;
  }
}

/* ==========================================================================
   Restore / Seed Default Data
   ========================================================================== */

window.restoreBenchmarkData = async function () {
  const confirmMsg = state.allRecords.length > 0
    ? 'Are you sure you want to restore the original 90 calibrated jar test records into the database?'
    : 'Populate the database with the original 90 calibrated jar test records?';
  if (!confirm(confirmMsg)) return;

  try {
    showToast('Restoring benchmark jar test records into database...', 'info');
    const res = await fetch(`${API_BASE}?action=seed&force=1`, { method: 'POST' });
    const result = await res.json();
    if (result.success) {
      showToast('Successfully restored 90 jar test calibration records!', 'success');
      state.pagination.page = 1;
      await fetchAllForDropdown();
      await fetchRecords();
    } else {
      throw new Error(result.message || 'Seed operation failed');
    }
  } catch (err) {
    console.error('Seeding failed:', err);
    showToast(`Failed to restore records: ${err.message}`, 'error');
  }
};

/* ==========================================================================
   CSV Export (uses full allRecords, not just the current page)
   ========================================================================== */

function exportDatasetToCsv() {
  const source = state.allRecords.length > 0 ? state.allRecords : state.records;
  if (source.length === 0) {
    showToast('No records available to export.', 'error');
    return;
  }

  const headers = ['ID', 'pH', 'Turbidity_NTU', 'PACL_mgL', 'Test_Date'];
  const rows = source.map(r => [
    r.id, r.ph, r.turbidity, r.pacl,
    `"${formatDateOnly(r.created_at || r.test_date)}"`
  ]);

  const csvContent = 'data:text/csv;charset=utf-8,'
    + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');

  const link = document.createElement('a');
  link.setAttribute('href', encodeURI(csvContent));
  link.setAttribute('download', `PACL_Jar_Test_Database_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast(`Exported ${source.length} database records to CSV.`, 'success');
}

/* ==========================================================================
   Event Listeners
   ========================================================================== */

function initEventListeners() {
  if (elements.themeToggleBtn) elements.themeToggleBtn.addEventListener('click', toggleTheme);

  if (elements.tableSearch) {
    elements.tableSearch.addEventListener('input', (e) => {
      state.tableFilter = e.target.value;
      if (elements.clearSearchBtn) {
        elements.clearSearchBtn.classList.toggle('hidden', !e.target.value);
      }
      state.pagination.page = 1;
      fetchRecords(true);
    });
  }

  if (elements.clearSearchBtn) {
    elements.clearSearchBtn.addEventListener('click', () => {
      if (elements.tableSearch) {
        elements.tableSearch.value = '';
        elements.tableSearch.focus();
      }
      elements.clearSearchBtn.classList.add('hidden');
      state.tableFilter = '';
      state.pagination.page = 1;
      fetchRecords(true);
    });
  }

  if (elements.seriesFilter) {
    elements.seriesFilter.addEventListener('change', (e) => {
      state.seriesFilter = e.target.value;
      state.pagination.page = 1;
      fetchRecords(true);
    });
  }

  if (elements.jarTestTable) {
    elements.jarTestTable.querySelectorAll('th[data-sort]').forEach(th => {
      th.addEventListener('click', () => {
        const sortKey = th.dataset.sort;
        if (state.tableSort.key === sortKey) {
          state.tableSort.asc = !state.tableSort.asc;
        } else {
          state.tableSort.key = sortKey;
          state.tableSort.asc = true;
        }
        renderTable();
      });
    });
  }

  if (elements.addNewRecordBtn) elements.addNewRecordBtn.addEventListener('click', openAddModal);
  if (elements.closeModalBtn) elements.closeModalBtn.addEventListener('click', closeRecordModal);
  if (elements.cancelModalBtn) elements.cancelModalBtn.addEventListener('click', closeRecordModal);
  if (elements.recordForm) elements.recordForm.addEventListener('submit', handleRecordFormSubmit);

  if (elements.modalPhInput) elements.modalPhInput.addEventListener('input', checkInputDuplicateNotice);
  if (elements.modalTurbidityInput) elements.modalTurbidityInput.addEventListener('input', checkInputDuplicateNotice);

  if (elements.closeDeleteModalBtn) elements.closeDeleteModalBtn.addEventListener('click', closeDeleteModal);
  if (elements.cancelDeleteBtn) elements.cancelDeleteBtn.addEventListener('click', closeDeleteModal);
  if (elements.confirmDeleteBtn) elements.confirmDeleteBtn.addEventListener('click', handleConfirmDelete);

  // Duplicate Confirmation Modal listeners
  if (elements.closeDuplicateModalBtn) elements.closeDuplicateModalBtn.addEventListener('click', closeDuplicateModal);
  if (elements.cancelDuplicateBtn) elements.cancelDuplicateBtn.addEventListener('click', closeDuplicateModal);
  if (elements.confirmDuplicateBtn) elements.confirmDuplicateBtn.addEventListener('click', handleConfirmDuplicate);
  if (elements.dupNewPaclInput) {
    elements.dupNewPaclInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleConfirmDuplicate();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        closeDuplicateModal();
      }
    });
  }

  if (elements.restoreBenchmarkBtn) elements.restoreBenchmarkBtn.addEventListener('click', window.restoreBenchmarkData);
  if (elements.refreshBtn) elements.refreshBtn.addEventListener('click', () => {
    state.pagination.page = 1;
    fetchAllForDropdown();
    fetchRecords();
    showToast('Refreshing records from database...', 'info');
  });
  if (elements.exportCsvBtn) elements.exportCsvBtn.addEventListener('click', exportDatasetToCsv);
}

/* ==========================================================================
   Toast Notifications
   ========================================================================== */

function showToast(message, type = 'info') {
  if (!elements.toastContainer) return;
  const toast = document.createElement('div');
  toast.className = 'toast';

  let icon = 'fa-circle-info text-cyan';
  if (type === 'success') icon = 'fa-circle-check text-emerald';
  if (type === 'error') icon = 'fa-circle-exclamation text-amber';

  toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${escapeHtml(message)}</span>`;
  elements.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}
