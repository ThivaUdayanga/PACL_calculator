/**
 * PACL Coagulant Dosage Calculator
 * Precision Engineering Application Logic
 * Completely connected to MariaDB / MySQL database via api_records.php
 */

const API_BASE = 'api_records.php';
const THEME_KEY = 'pacl_theme_pref';

// Global Application State
const state = {
  records: [],
  selectedPh: 6.60,
  turbidity: 6.10,
  chart: null,
  isLogScale: false,
  theme: 'dark',
  isLoading: true
};

// DOM Elements
const elements = {
  dbStatusPill: document.getElementById('dbStatusPill'),
  dbStatusText: document.getElementById('dbStatusText'),
  themeToggleBtn: document.getElementById('themeToggleBtn'),

  phSelector: document.getElementById('phSelector'),
  phChipGroup: document.getElementById('phChipGroup'),
  customPhWrap: document.getElementById('customPhWrap'),
  customPhInput: document.getElementById('customPhInput'),
  selectedPhHint: document.getElementById('selectedPhHint'),
  phCalibrationNote: document.getElementById('phCalibrationNote'),

  turbidityInput: document.getElementById('turbidityInput'),
  turbiditySlider: document.getElementById('turbiditySlider'),
  turbidityBadge: document.getElementById('turbidityBadge'),

  paclValueDisplay: document.getElementById('paclValueDisplay'),
  paclUnitDisplay: document.getElementById('paclUnitDisplay'),
  paclRangeDisplay: document.getElementById('paclRangeDisplay'),
  closestPointDisplay: document.getElementById('closestPointDisplay'),
  calibrationStatus: document.getElementById('calibrationStatus'),
  calcMethodBadge: document.getElementById('calcMethodBadge'),

  lowerBenchmarkCard: document.getElementById('lowerBenchmarkCard'),
  upperBenchmarkCard: document.getElementById('upperBenchmarkCard'),
  lowerTurb: document.getElementById('lowerTurb'),
  lowerPacl: document.getElementById('lowerPacl'),
  upperTurb: document.getElementById('upperTurb'),
  upperPacl: document.getElementById('upperPacl'),
  calcExplanation: document.getElementById('calcExplanation'),
  plantGuidanceText: document.getElementById('plantGuidanceText'),

  flowRateInput: document.getElementById('flowRateInput'),
  paclDensityInput: document.getElementById('paclDensityInput'),
  dailyKgResult: document.getElementById('dailyKgResult'),
  pumpLphResult: document.getElementById('pumpLphResult'),
  togglePlantCalc: document.getElementById('togglePlantCalc'),
  plantCalcAccordion: document.getElementById('plantCalcAccordion'),
  plantCalcBody: document.getElementById('plantCalcBody'),

  chartPhBadge: document.getElementById('chartPhBadge'),
  toggleLogScale: document.getElementById('toggleLogScale'),
  paclChart: document.getElementById('paclChart'),

  toastContainer: document.getElementById('toastContainer')
};

/* ==========================================================================
   Initialization
   ========================================================================== */

document.addEventListener('DOMContentLoaded', async () => {
  loadThemePreference();
  initEventListeners();
  initChart();
  await fetchDataset();
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
  if (state.chart) updateChart();
}

/* ==========================================================================
   Database Loading
   ========================================================================== */

async function fetchDataset() {
  state.isLoading = true;
  updateDbStatus(false, 'Connecting to database...');

  try {
    const res = await fetch(API_BASE);
    if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to reach database API`);
    const json = await res.json();

    if (json.success && Array.isArray(json.data)) {
      state.records = json.data;
      updateDbStatus(true, `Connected (${state.records.length} records)`);

      // Read URL search params if redirected from records page
      const params = new URLSearchParams(window.location.search);
      const paramPh = parseFloat(params.get('ph'));
      const paramTurb = parseFloat(params.get('turbidity'));

      if (!isNaN(paramPh)) {
        state.selectedPh = paramPh;
      } else if (state.records.length > 0) {
        // Default to pH 6.6 or closest available pH in database
        const phs = getUniquePhList();
        if (phs.includes(6.6)) {
          state.selectedPh = 6.6;
        } else if (phs.length > 0) {
          state.selectedPh = phs[0];
        }
      }

      if (!isNaN(paramTurb)) {
        state.turbidity = paramTurb;
        if (elements.turbidityInput) elements.turbidityInput.value = paramTurb.toFixed(2);
        if (elements.turbiditySlider) elements.turbiditySlider.value = Math.min(120, paramTurb);
        if (elements.turbidityBadge) elements.turbidityBadge.textContent = `${paramTurb.toFixed(2)} NTU`;
      }

      initPhOptions();
      calculateAndRender();
    } else {
      throw new Error(json.message || 'Failed to parse database records');
    }
  } catch (err) {
    console.error('Database connection error in calculator:', err);
    updateDbStatus(false, 'Database Offline');
    if (elements.phCalibrationNote) {
      elements.phCalibrationNote.innerHTML = `<span style="color: var(--accent-rose);"><i class="fa-solid fa-circle-exclamation"></i> Database Error: ${err.message}. Please check connection in records manager.</span>`;
    }
    showToast(`Database error: ${err.message}`, 'error');
  } finally {
    state.isLoading = false;
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

/* ==========================================================================
   pH Selector & Chips (Dynamically driven by Database Records)
   ========================================================================== */

function getUniquePhList() {
  const set = new Set();
  state.records.forEach(r => set.add(Number(r.ph)));
  return Array.from(set).sort((a, b) => a - b);
}

function initPhOptions() {
  const phList = getUniquePhList();

  // 1. Build Dropdown
  if (elements.phSelector) {
    elements.phSelector.innerHTML = '';
    phList.forEach(phVal => {
      const count = state.records.filter(r => Math.abs(Number(r.ph) - phVal) < 0.001).length;
      const opt = document.createElement('option');
      opt.value = phVal;
      opt.textContent = `pH ${phVal.toFixed(phVal % 1 === 0 ? 1 : 2)} (${count} jar tests)`;
      if (Math.abs(phVal - state.selectedPh) < 0.001) opt.selected = true;
      elements.phSelector.appendChild(opt);
    });
  }

  // 2. Build Quick Chips (Strictly only pH values present in the database)
  if (elements.phChipGroup) {
    elements.phChipGroup.innerHTML = '';
    phList.forEach(phVal => {
      const count = state.records.filter(r => Math.abs(Number(r.ph) - phVal) < 0.001).length;
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = `ph-chip ${Math.abs(state.selectedPh - phVal) < 0.001 ? 'active' : ''}`;
      chip.dataset.ph = phVal;
      chip.innerHTML = `<span>pH ${phVal.toFixed(phVal % 1 === 0 ? 1 : 2)}</span> <span class="chip-count">${count}</span>`;
      chip.addEventListener('click', () => {
        setPh(phVal);
      });
      elements.phChipGroup.appendChild(chip);
    });
  }
}

function setPh(phValue) {
  state.selectedPh = Number(phValue);

  if (elements.phSelector) {
    elements.phSelector.value = phValue;
  }
  if (elements.selectedPhHint) {
    elements.selectedPhHint.textContent = 'Calibrated Benchmark';
  }

  // Highlight active chip
  if (elements.phChipGroup) {
    const chips = elements.phChipGroup.querySelectorAll('.ph-chip');
    chips.forEach(chip => {
      chip.classList.toggle('active', Math.abs(Number(chip.dataset.ph) - Number(phValue)) < 0.001);
    });
  }

  calculateAndRender();
}

/* ==========================================================================
   Core Dosage Calculation Engine (Interpolation & Extrapolation from DB)
   ========================================================================== */

function calculatePACLDosage(targetPh, targetTurbidity) {
  const phList = getUniquePhList();

  if (state.records.length === 0) {
    return {
      effectivePh: targetPh,
      targetTurbidity,
      recommendedPacl: 0.50,
      minRangePacl: 0.40,
      maxRangePacl: 0.60,
      calcMethod: 'No Database Records',
      lowerBm: null,
      upperBm: null,
      closestPoint: { turbidity: 0, pacl: 0, date: 'N/A' },
      explanation: 'No experimental jar test records found in database. Please seed or add test records.',
      phNote: 'No calibrated records in database.',
      seriesCount: 0
    };
  }

  // Find exact match series or nearest series in database
  let effectivePh = targetPh;
  let phSeries = state.records.filter(r => Math.abs(Number(r.ph) - targetPh) < 0.001);

  let phNote = '';
  if (phSeries.length === 0) {
    let closestPh = phList[0];
    let minDiff = Infinity;
    phList.forEach(p => {
      const diff = Math.abs(p - targetPh);
      if (diff < minDiff) {
        minDiff = diff;
        closestPh = p;
      }
    });
    effectivePh = closestPh;
    phSeries = state.records.filter(r => Math.abs(Number(r.ph) - effectivePh) < 0.001);
    phNote = `Using nearest calibrated series (pH ${effectivePh.toFixed(2)}) from database for calculation.`;
  } else {
    phNote = `Directly calibrated on database pH ${effectivePh.toFixed(2)} series (${phSeries.length} jar test points).`;
  }

  // Sort series ascending by turbidity
  phSeries.sort((a, b) => Number(a.turbidity) - Number(b.turbidity));

  const turbVal = Number(targetTurbidity);
  let recommendedPacl = 0.50;
  let minRangePacl = 0.40;
  let maxRangePacl = 0.60;
  let calcMethod = 'Interpolated';
  let lowerBm = null;
  let upperBm = null;
  let explanation = '';
  let closestPoint = phSeries[0] || { turbidity: turbVal, pacl: 0.50, test_date: 'Ref' };
  let minTurbDiff = Infinity;

  // Find closest point for reference
  phSeries.forEach(item => {
    const diff = Math.abs(Number(item.turbidity) - turbVal);
    if (diff < minTurbDiff) {
      minTurbDiff = diff;
      closestPoint = item;
    }
  });

  // Check exact matches
  const exactMatches = phSeries.filter(r => Math.abs(Number(r.turbidity) - turbVal) < 0.001);
  if (exactMatches.length > 0) {
    const paclValues = exactMatches.map(r => Number(r.pacl));
    minRangePacl = Math.min(...paclValues);
    maxRangePacl = Math.max(...paclValues);
    recommendedPacl = paclValues.reduce((a, b) => a + b, 0) / paclValues.length;
    calcMethod = exactMatches.length > 1 ? 'Exact Match (Range Avg)' : 'Exact Lab Match';
    lowerBm = exactMatches[0];
    upperBm = exactMatches[exactMatches.length - 1];
    explanation = `Exact turbidity match found in jar test logs (${exactMatches.length} record${exactMatches.length > 1 ? 's' : ''}). Optimal coagulation dosage: ${minRangePacl.toFixed(2)} - ${maxRangePacl.toFixed(2)} mg/L.`;
  } else if (phSeries.length > 0) {
    const minPoint = phSeries[0];
    const maxPoint = phSeries[phSeries.length - 1];

    if (turbVal <= Number(minPoint.turbidity)) {
      recommendedPacl = Number(minPoint.pacl);
      minRangePacl = Math.max(0.20, recommendedPacl - 0.05);
      maxRangePacl = recommendedPacl;
      calcMethod = 'Low Turbidity Floor';
      lowerBm = { turbidity: 0, pacl: Math.max(0.20, Number(minPoint.pacl) * 0.8) };
      upperBm = minPoint;
      explanation = `Turbidity is at or below lowest calibrated point in database (${minPoint.turbidity} NTU). Maintaining baseline dosage of ${recommendedPacl.toFixed(2)} mg/L to prevent pin-floc loss.`;
    } else if (turbVal >= Number(maxPoint.turbidity)) {
      const secondMax = phSeries.length > 1 ? phSeries[phSeries.length - 2] : minPoint;
      const slope = (Number(maxPoint.pacl) - Number(secondMax.pacl)) / (Number(maxPoint.turbidity) - Number(secondMax.turbidity) || 1);
      const extrapPacl = Number(maxPoint.pacl) + Math.max(0, slope) * (turbVal - Number(maxPoint.turbidity));
      recommendedPacl = Math.min(2.50, extrapPacl);
      minRangePacl = Number(maxPoint.pacl);
      maxRangePacl = recommendedPacl + 0.10;
      calcMethod = 'High Turbidity Extrapolation';
      lowerBm = secondMax;
      upperBm = maxPoint;
      explanation = `Turbidity exceeds lab upper test point in database (${maxPoint.turbidity} NTU). Estimated along high-turbidity gradient.`;
    } else {
      for (let i = 0; i < phSeries.length - 1; i++) {
        const p1 = phSeries[i];
        const p2 = phSeries[i + 1];
        const t1 = Number(p1.turbidity);
        const t2 = Number(p2.turbidity);

        if (turbVal >= t1 && turbVal <= t2) {
          lowerBm = p1;
          upperBm = p2;
          const pacl1 = Number(p1.pacl);
          const pacl2 = Number(p2.pacl);

          if (Math.abs(t2 - t1) < 0.0001) {
            recommendedPacl = (pacl1 + pacl2) / 2;
          } else {
            const fraction = (turbVal - t1) / (t2 - t1);
            recommendedPacl = pacl1 + fraction * (pacl2 - pacl1);
          }

          minRangePacl = Math.min(pacl1, pacl2);
          maxRangePacl = Math.max(pacl1, pacl2);
          calcMethod = 'Piecewise Linear Interpolation';
          explanation = `Interpolated precisely between database benchmark jar tests: ${t1.toFixed(2)} NTU (${pacl1.toFixed(2)} mg/L) and ${t2.toFixed(2)} NTU (${pacl2.toFixed(2)} mg/L).`;
          break;
        }
      }
    }
  }

  recommendedPacl = Math.round(recommendedPacl * 100) / 100;
  minRangePacl = Math.round(minRangePacl * 100) / 100;
  maxRangePacl = Math.round(maxRangePacl * 100) / 100;

  return {
    effectivePh,
    targetTurbidity: turbVal,
    recommendedPacl,
    minRangePacl,
    maxRangePacl,
    calcMethod,
    lowerBm,
    upperBm,
    closestPoint,
    explanation,
    phNote,
    seriesCount: phSeries.length
  };
}

/* ==========================================================================
   Render & UI Updates
   ========================================================================== */

function calculateAndRender() {
  const result = calculatePACLDosage(state.selectedPh, state.turbidity);

  // 1. Update Hero Value
  if (elements.paclValueDisplay) elements.paclValueDisplay.textContent = result.recommendedPacl.toFixed(2);
  if (elements.paclRangeDisplay) elements.paclRangeDisplay.textContent = `${result.minRangePacl.toFixed(2)} - ${result.maxRangePacl.toFixed(2)} mg/L`;
  if (elements.closestPointDisplay) {
    const ptDate = result.closestPoint.test_date || result.closestPoint.date || 'Lab';
    elements.closestPointDisplay.textContent = `${Number(result.closestPoint.turbidity).toFixed(2)} NTU → ${Number(result.closestPoint.pacl).toFixed(2)} mg/L (${ptDate})`;
  }
  if (elements.calcMethodBadge) elements.calcMethodBadge.innerHTML = `<i class="fa-solid fa-microchip"></i> ${result.calcMethod}`;

  // 2. Calibration status badge
  if (elements.calibrationStatus) {
    if (result.calcMethod.includes('Exact')) {
      elements.calibrationStatus.textContent = 'Exact Lab Calibration';
      elements.calibrationStatus.className = 'meta-val text-emerald';
    } else if (result.calcMethod.includes('High Turbidity')) {
      elements.calibrationStatus.textContent = 'Extrapolated (Elevated)';
      elements.calibrationStatus.className = 'meta-val text-amber';
    } else if (result.calcMethod.includes('No Database')) {
      elements.calibrationStatus.textContent = 'Database Empty';
      elements.calibrationStatus.className = 'meta-val text-rose';
    } else {
      elements.calibrationStatus.textContent = 'High Precision Interpolation';
      elements.calibrationStatus.className = 'meta-val text-cyan';
    }
  }

  // 3. Update Benchmarks Card
  if (result.lowerBm && elements.lowerTurb) {
    elements.lowerTurb.textContent = `${Number(result.lowerBm.turbidity).toFixed(2)} NTU`;
    if (elements.lowerPacl) elements.lowerPacl.textContent = `${Number(result.lowerBm.pacl).toFixed(2)} mg/L`;
  }
  if (result.upperBm && elements.upperTurb) {
    elements.upperTurb.textContent = `${Number(result.upperBm.turbidity).toFixed(2)} NTU`;
    if (elements.upperPacl) elements.upperPacl.textContent = `${Number(result.upperBm.pacl).toFixed(2)} mg/L`;
  }
  if (elements.calcExplanation) elements.calcExplanation.textContent = result.explanation;
  if (elements.phCalibrationNote) elements.phCalibrationNote.innerHTML = `<i class="fa-solid fa-circle-info"></i> ${result.phNote}`;

  // 4. Update Plant Engineering Calculations
  updatePlantCalculations(result.recommendedPacl);

  // 5. Update Guidance text
  updateGuidanceText(state.selectedPh, state.turbidity, result.recommendedPacl);

  // 6. Update Chart
  if (elements.chartPhBadge) elements.chartPhBadge.innerHTML = `<i class="fa-solid fa-filter"></i> Series: pH ${result.effectivePh.toFixed(1)}`;
  updateChart();
}

function updatePlantCalculations(paclDose) {
  if (!elements.flowRateInput || !elements.paclDensityInput) return;
  const flowRate = parseFloat(elements.flowRateInput.value) || 250;
  const density = parseFloat(elements.paclDensityInput.value) || 1.20;

  const dailyKg = (flowRate * 24 * paclDose) / 1000;
  const pumpLph = (flowRate * paclDose) / (density * 1000);

  if (elements.dailyKgResult) elements.dailyKgResult.textContent = `${dailyKg.toFixed(2)} kg/day`;
  if (elements.pumpLphResult) elements.pumpLphResult.textContent = `${pumpLph.toFixed(3)} L/hr`;
}

function updateGuidanceText(ph, turbidity, pacl) {
  if (!elements.plantGuidanceText) return;
  if (turbidity > 100) {
    elements.plantGuidanceText.textContent = `High turbidity / storm event detected (${turbidity.toFixed(1)} NTU). Ensure dual-stage flash mixing and monitor sludge accumulation closely.`;
  } else if (ph > 9.0) {
    elements.plantGuidanceText.textContent = `High pH raw water (pH ${ph.toFixed(1)}). PACL polymer chains resist alkaline degradation better than standard alum.`;
  } else if (turbidity < 3.0) {
    elements.plantGuidanceText.textContent = `Low turbidity raw water (${turbidity.toFixed(1)} NTU). Low collision probability between colloidal particles. Maintain ${pacl.toFixed(2)} mg/L to ensure micro-floc formation.`;
  } else {
    elements.plantGuidanceText.textContent = `Standard operating window (pH ${ph.toFixed(1)}, ${turbidity.toFixed(1)} NTU). Maintain rapid mixing gradient (G ≈ 300 s⁻¹) for 45-60 sec, followed by slow flocculation for optimal clarification.`;
  }
}

/* ==========================================================================
   Chart.js Visualization (Connected directly to database records)
   ========================================================================== */

function initChart() {
  if (!elements.paclChart || typeof Chart === 'undefined') return;
  const ctx = elements.paclChart.getContext('2d');

  state.chart = new Chart(ctx, {
    type: 'scatter',
    data: {
      datasets: [
        {
          label: 'Interpolation Curve',
          type: 'line',
          data: [],
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          borderWidth: 2.5,
          tension: 0.15,
          fill: true,
          pointRadius: 0
        },
        {
          label: 'Database Jar Test Points',
          data: [],
          backgroundColor: '#06b6d4',
          borderColor: '#ffffff',
          borderWidth: 1.5,
          pointRadius: 6,
          pointHoverRadius: 9
        },
        {
          label: 'Current Input Point',
          data: [],
          backgroundColor: '#f43f5e',
          borderColor: '#ffffff',
          borderWidth: 2,
          pointRadius: 9,
          pointHoverRadius: 12
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'nearest',
        intersect: false
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          titleColor: '#38bdf8',
          bodyColor: '#f1f5f9',
          borderColor: 'rgba(56, 189, 248, 0.3)',
          borderWidth: 1,
          padding: 10,
          displayColors: true,
          callbacks: {
            label: function(context) {
              const x = context.parsed.x;
              const y = context.parsed.y;
              if (context.datasetIndex === 2) {
                return ` Active Query: ${x.toFixed(2)} NTU → ${y.toFixed(2)} mg/L PACL`;
              }
              return ` Database Jar Test: ${x.toFixed(2)} NTU → ${y.toFixed(2)} mg/L PACL`;
            }
          }
        }
      },
      scales: {
        x: {
          type: state.isLogScale ? 'logarithmic' : 'linear',
          title: {
            display: true,
            text: 'Raw Water Turbidity (NTU)',
            color: '#94a3b8',
            font: { family: "'Plus Jakarta Sans', sans-serif", weight: '600' }
          },
          grid: { color: 'rgba(148, 163, 184, 0.1)' },
          ticks: { color: '#94a3b8', font: { family: "'JetBrains Mono', monospace" } }
        },
        y: {
          title: {
            display: true,
            text: 'Optimal PACL Dosage (mg/L)',
            color: '#94a3b8',
            font: { family: "'Plus Jakarta Sans', sans-serif", weight: '600' }
          },
          grid: { color: 'rgba(148, 163, 184, 0.1)' },
          ticks: { color: '#94a3b8', font: { family: "'JetBrains Mono', monospace" } },
          min: 0,
          suggestedMax: 1.2
        }
      }
    }
  });
}

function updateChart() {
  if (!state.chart || state.records.length === 0) return;

  const result = calculatePACLDosage(state.selectedPh, state.turbidity);
  let series = state.records.filter(r => Math.abs(Number(r.ph) - result.effectivePh) < 0.001);
  series.sort((a, b) => Number(a.turbidity) - Number(b.turbidity));

  const points = series.map(r => ({ x: Number(r.turbidity), y: Number(r.pacl) }));

  const curvePoints = [];
  if (points.length > 0) {
    const minX = Math.min(points[0].x, state.turbidity * 0.8, 0.5);
    const maxX = Math.max(points[points.length - 1].x, state.turbidity * 1.2, 10);
    const steps = 60;
    const stepSize = (maxX - minX) / steps;

    for (let i = 0; i <= steps; i++) {
      const curX = minX + i * stepSize;
      const res = calculatePACLDosage(result.effectivePh, curX);
      curvePoints.push({ x: curX, y: res.recommendedPacl });
    }
  }

  const activeMarker = [{ x: state.turbidity, y: result.recommendedPacl }];

  state.chart.data.datasets[0].data = curvePoints;
  state.chart.data.datasets[1].data = points;
  state.chart.data.datasets[2].data = activeMarker;

  state.chart.options.scales.x.type = state.isLogScale ? 'logarithmic' : 'linear';
  state.chart.update('none');
}

/* ==========================================================================
   Event Listeners
   ========================================================================== */

function initEventListeners() {
  if (elements.themeToggleBtn) elements.themeToggleBtn.addEventListener('click', toggleTheme);

  if (elements.phSelector) {
    elements.phSelector.addEventListener('change', (e) => {
      setPh(parseFloat(e.target.value));
    });
  }

  if (elements.turbidityInput) {
    elements.turbidityInput.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      if (!isNaN(val) && val >= 0) {
        state.turbidity = val;
        if (elements.turbiditySlider) elements.turbiditySlider.value = Math.min(120, val);
        if (elements.turbidityBadge) elements.turbidityBadge.textContent = `${val.toFixed(2)} NTU`;
        calculateAndRender();
      }
    });
  }

  if (elements.turbiditySlider) {
    elements.turbiditySlider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      state.turbidity = val;
      if (elements.turbidityInput) elements.turbidityInput.value = val.toFixed(2);
      if (elements.turbidityBadge) elements.turbidityBadge.textContent = `${val.toFixed(2)} NTU`;
      calculateAndRender();
    });
  }

  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const val = parseFloat(btn.dataset.turbidity);
      state.turbidity = val;
      if (elements.turbidityInput) elements.turbidityInput.value = val.toFixed(2);
      if (elements.turbiditySlider) elements.turbiditySlider.value = Math.min(120, val);
      if (elements.turbidityBadge) elements.turbidityBadge.textContent = `${val.toFixed(2)} NTU`;
      calculateAndRender();
    });
  });

  if (elements.flowRateInput) {
    elements.flowRateInput.addEventListener('input', () => {
      updatePlantCalculations(calculatePACLDosage(state.selectedPh, state.turbidity).recommendedPacl);
    });
  }

  if (elements.paclDensityInput) {
    elements.paclDensityInput.addEventListener('input', () => {
      updatePlantCalculations(calculatePACLDosage(state.selectedPh, state.turbidity).recommendedPacl);
    });
  }

  if (elements.togglePlantCalc && elements.plantCalcBody && elements.plantCalcAccordion) {
    elements.togglePlantCalc.addEventListener('click', () => {
      const isHidden = elements.plantCalcBody.classList.contains('hidden');
      if (isHidden) {
        elements.plantCalcBody.classList.remove('hidden');
        elements.plantCalcAccordion.classList.add('open');
      } else {
        elements.plantCalcBody.classList.add('hidden');
        elements.plantCalcAccordion.classList.remove('open');
      }
    });
  }

  if (elements.toggleLogScale) {
    elements.toggleLogScale.addEventListener('click', () => {
      state.isLogScale = !state.isLogScale;
      updateChart();
      showToast(`Switched chart to ${state.isLogScale ? 'Logarithmic' : 'Linear'} scale.`, 'info');
    });
  }
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

  toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;
  elements.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}
