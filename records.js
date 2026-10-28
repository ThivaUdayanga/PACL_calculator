/**
 * PACL Records Management Logic
 * Completely connected to MariaDB / MySQL database via api_records.php
 * Handles real-time CRUD operations, statistics dashboard, filtering, sorting, and CSV export.
 */

const API_BASE = 'api_records.php';
const THEME_KEY = 'pacl_theme_pref';

const state = {
  records: [],
  stats: null,
  tableSort: { key: 'ph', asc: true },
  tableFilter: '',
  seriesFilter: 'all',
  pendingDeleteRecord: null,
  theme: 'dark',
  isLoading: false
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

  toastContainer: document.getElementById('toastContainer')
};

/* ==========================================================================
   Initialization
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  loadThemePreference();
  initEventListeners();
  fetchRecords();

  // If redirected with ?action=add, automatically open the add modal
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
   Database Operations (API Fetch, Create, Update, Delete)
   ========================================================================== */

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
  }

  try {
    const res = await fetch(API_BASE);
    if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to reach database`);
    const json = await res.json();

    if (json.success && Array.isArray(json.data)) {
      state.records = json.data;
      updateDbStatus(true, `${state.records.length} Records Connected`);
      populateSeriesDropdown();
      renderTable();
      fetchStats();
    } else {
      throw new Error(json.message || 'Unknown database error');
    }
  } catch (err) {
    console.error('Database connection failed:', err);
    updateDbStatus(false, 'Database Disconnected');
    if (elements.tableBody) {
      elements.tableBody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 3rem 1.5rem; color: var(--accent-rose);">
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

      // Update pH range subtitle
      if (elements.statPhRange && state.records.length > 0) {
        const phs = state.records.map(r => r.ph);
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
  const uniquePhs = Array.from(new Set(state.records.map(r => Number(r.ph)))).sort((a, b) => a - b);

  elements.seriesFilter.innerHTML = '<option value="all">All pH Series</option>';
  uniquePhs.forEach(ph => {
    const count = state.records.filter(r => Math.abs(r.ph - ph) < 0.001).length;
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
   Table Rendering, Filtering, Sorting
   ========================================================================== */

function renderTable() {
  if (!elements.tableBody) return;
  const searchTerm = state.tableFilter.toLowerCase().trim();
  const selectedSeries = state.seriesFilter;

  let filtered = state.records.filter(item => {
    // 1. Series dropdown filter
    if (selectedSeries !== 'all') {
      if (Math.abs(Number(item.ph) - Number(selectedSeries)) > 0.001) {
        return false;
      }
    }

    // 2. Text search filter
    if (searchTerm) {
      const phMatch = `ph ${item.ph}`.toLowerCase().includes(searchTerm) || `${item.ph}`.includes(searchTerm);
      const turbMatch = `${item.turbidity}`.includes(searchTerm);
      const paclMatch = `${item.pacl}`.includes(searchTerm);
      const dateMatch = (formatDateOnly(item.created_at || item.test_date)).toLowerCase().includes(searchTerm);
      const idMatch = `#${item.id}`.includes(searchTerm) || `${item.id}` === searchTerm;
      if (!phMatch && !turbMatch && !paclMatch && !dateMatch && !idMatch) {
        return false;
      }
    }

    return true;
  });

  // Sort
  const { key, asc } = state.tableSort;
  filtered.sort((a, b) => {
    let valA = a[key];
    let valB = b[key];
    if (key === 'id' || key === 'ph' || key === 'turbidity' || key === 'pacl') {
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

  // Update badge count
  if (elements.tableCountBadge) {
    elements.tableCountBadge.textContent = `${filtered.length} of ${state.records.length} records`;
  }

  elements.tableBody.innerHTML = '';

  if (filtered.length === 0) {
    elements.tableBody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 3rem 1.5rem; color: var(--text-muted);">
          <i class="fa-solid fa-circle-question" style="font-size: 2rem; margin-bottom: 0.75rem; display: block; opacity: 0.5;"></i>
          No jar test records matched your filter.
          ${state.records.length === 0 ? '<div style="margin-top: 1rem;"><button class="btn btn-sm btn-primary" onclick="restoreBenchmarkData()"><i class="fa-solid fa-rotate-left"></i> Restore Benchmark Dataset</button></div>' : ''}
        </td>
      </tr>
    `;
    return;
  }

  filtered.forEach(rec => {
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

function formatDateOnly(dateStr) {
  if (!dateStr) return '—';
  // If formatted as "YYYY-MM-DD HH:MM:SS" or ISO string, extract date portion
  const datePart = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr.split(' ')[0];
  if (datePart && /^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
    return datePart;
  }
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split('T')[0];
  }
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

window.applyRecordToCalculator = function(phVal, turbVal) {
  // Redirect to index.html with query parameters so the calculator opens with these values
  window.location.href = `index.html?ph=${encodeURIComponent(phVal)}&turbidity=${encodeURIComponent(turbVal)}`;
};

/* ==========================================================================
   Add / Edit Modal Operations
   ========================================================================== */

function openAddModal() {
  if (elements.modalTitle) elements.modalTitle.textContent = 'Add Jar Test Calibration Record';
  if (elements.recordId) elements.recordId.value = '';
  if (elements.modalPhInput) elements.modalPhInput.value = '6.60';
  if (elements.modalTurbidityInput) elements.modalTurbidityInput.value = '';
  if (elements.modalPaclInput) elements.modalPaclInput.value = '';
  if (elements.modalDateInput) elements.modalDateInput.value = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  if (elements.modalStatusInput) elements.modalStatusInput.value = 'Verified';
  if (elements.saveBtnText) elements.saveBtnText.textContent = 'Save Record';

  if (elements.recordModal) elements.recordModal.classList.remove('hidden');
}

window.openEditModal = function(id) {
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
  if (elements.saveBtnText) elements.saveBtnText.textContent = 'Update Record';

  if (elements.recordModal) elements.recordModal.classList.remove('hidden');
};

function closeRecordModal() {
  if (elements.recordModal) elements.recordModal.classList.add('hidden');
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

  const payload = {
    ph,
    turbidity,
    pacl,
    test_date,
    status
  };

  const isEdit = Boolean(id);
  const method = isEdit ? 'PUT' : 'POST';
  if (isEdit) payload.id = parseInt(id, 10);

  // Disable save button while submitting
  if (elements.saveRecordBtn) elements.saveRecordBtn.disabled = true;

  try {
    const res = await fetch(API_BASE, {
      method: method,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const result = await res.json();
    if (!res.ok || !result.success) {
      throw new Error(result.message || 'Operation failed on server.');
    }

    closeRecordModal();
    showToast(isEdit ? `Record #${id} updated successfully.` : `New record (pH ${ph}, ${turbidity} NTU) added to database.`, 'success');
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

window.openDeleteModal = function(id) {
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
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ id })
    });

    const result = await res.json();
    if (!res.ok || !result.success) {
      throw new Error(result.message || 'Failed to delete record.');
    }

    closeDeleteModal();
    showToast(`Record #${id} (pH ${ph}, ${turbidity} NTU) deleted.`, 'info');
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

window.restoreBenchmarkData = async function() {
  const confirmMsg = state.records.length > 0
    ? 'Are you sure you want to restore the original 90 calibrated jar test records into the database? This will overwrite / re-seed the standard dataset.'
    : 'Populate the database with the original 90 calibrated jar test records?';

  if (!confirm(confirmMsg)) return;

  try {
    showToast('Restoring benchmark jar test records into database...', 'info');
    const res = await fetch(`${API_BASE}?action=seed&force=1`, {
      method: 'POST'
    });
    const result = await res.json();
    if (result.success) {
      showToast('Successfully restored 90 jar test calibration records into database!', 'success');
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
   CSV Export
   ========================================================================== */

function exportDatasetToCsv() {
  if (state.records.length === 0) {
    showToast('No records available to export.', 'error');
    return;
  }

  const headers = ['ID', 'pH', 'Turbidity_NTU', 'PACL_mgL', 'Test_Date'];
  const rows = state.records.map(r => [
    r.id,
    r.ph,
    r.turbidity,
    r.pacl,
    `"${formatDateOnly(r.created_at || r.test_date)}"`
  ]);

  const csvContent = 'data:text/csv;charset=utf-8,' 
    + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `PACL_Jar_Test_Database_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast(`Exported ${state.records.length} database records to CSV.`, 'success');
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
      renderTable();
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
      renderTable();
    });
  }

  if (elements.seriesFilter) {
    elements.seriesFilter.addEventListener('change', (e) => {
      state.seriesFilter = e.target.value;
      renderTable();
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

  if (elements.closeDeleteModalBtn) elements.closeDeleteModalBtn.addEventListener('click', closeDeleteModal);
  if (elements.cancelDeleteBtn) elements.cancelDeleteBtn.addEventListener('click', closeDeleteModal);
  if (elements.confirmDeleteBtn) elements.confirmDeleteBtn.addEventListener('click', handleConfirmDelete);

  if (elements.restoreBenchmarkBtn) elements.restoreBenchmarkBtn.addEventListener('click', window.restoreBenchmarkData);
  if (elements.refreshBtn) elements.refreshBtn.addEventListener('click', () => {
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
