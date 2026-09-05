/**
 * Industrial Production & OEE Tracker - Main Application Controller
 * Handles 3-Page Navigation, 11 Machines, 13-Loss Calculations, and Chart.js Analytics
 */

import { MACHINES, LOSS_FIELDS } from './machines.js';
import {
  initStorage,
  getMachines,
  getProductionEntries,
  saveProductionEntry,
  deleteProductionEntry,
  clearAllProductionEntries,
  calculateOEE,
  getDashboardAnalytics,
  getSupabaseConfig,
  saveSupabaseConfig,
  testSupabaseConnection,
  isConnectedToSupabase
} from './storage.js';
import { exportEntriesToCSV } from './export.js';

// Global Application State
const state = {
  currentView: 'view-machines',
  currentMachine: MACHINES[0],
  dashFilterMachine: 'ALL',
  chartLossesPareto: null,
  chartLossesDonut: null,
  chartMachinesOee: null
};

// DOM Cache
const dom = {
  // Navigation
  tabMachines: document.getElementById('tab-machines'),
  tabFillup: document.getElementById('tab-fillup'),
  tabAnalytics: document.getElementById('tab-analytics'),
  viewMachines: document.getElementById('view-machines'),
  viewFillup: document.getElementById('view-fillup'),
  viewAnalytics: document.getElementById('view-analytics'),
  liveClock: document.getElementById('live-clock'),
  shiftName: document.getElementById('shift-name'),
  btnBackToMachines: document.getElementById('btn-back-to-machines'),
  btnCancelEntry: document.getElementById('btn-cancel-entry'),

  // Page 1: Minimalist Machine Grid
  minimalMachinesGrid: document.getElementById('minimal-machines-grid'),

  // Page 2: Production Form Elements
  activeMachineName: document.getElementById('active-machine-name'),
  activeMachineType: document.getElementById('active-machine-type'),
  selectQuickMachine: document.getElementById('select-quick-machine'),
  form: document.getElementById('production-detail-form'),
  inputDate: document.getElementById('input-date'),
  inputShift: document.getElementById('input-shift'),
  inputShiftHours: document.getElementById('input-shift-hours'),
  inputOperator: document.getElementById('input-operator'),

  // Parts
  inputPart1Name: document.getElementById('input-part1-name'),
  inputPart1Cycle: document.getElementById('input-part1-cycle'),
  inputPart1Qty: document.getElementById('input-part1-qty'),
  inputPart2Name: document.getElementById('input-part2-name'),
  inputPart2Cycle: document.getElementById('input-part2-cycle'),
  inputPart2Qty: document.getElementById('input-part2-qty'),
  inputPart3Name: document.getElementById('input-part3-name'),
  inputPart3Cycle: document.getElementById('input-part3-cycle'),
  inputPart3Qty: document.getElementById('input-part3-qty'),
  inputRejectedQty: document.getElementById('input-rejected-qty'),
  inputRemarks: document.getElementById('input-remarks'),

  // Ribbon Calculations
  liveCalcPlannedTime: document.getElementById('live-calc-planned-time'),
  liveCalcTotalLoss: document.getElementById('live-calc-total-loss'),
  liveCalcOperatingTime: document.getElementById('live-calc-operating-time'),
  liveCalcAvailability: document.getElementById('live-calc-availability'),
  liveCalcPerformance: document.getElementById('live-calc-performance'),
  liveCalcQuality: document.getElementById('live-calc-quality'),
  liveCalcOee: document.getElementById('live-calc-oee'),

  // Page 3: Dashboard Elements
  dashFilterMachine: document.getElementById('dash-filter-machine'),
  dashMetricOee: document.getElementById('dash-metric-oee'),
  oeeRatingBadge: document.getElementById('oee-rating-badge'),
  dashMetricAvail: document.getElementById('dash-metric-avail'),
  dashTotalLosses: document.getElementById('dash-total-losses'),
  dashMetricPerf: document.getElementById('dash-metric-perf'),
  dashTotalOutput: document.getElementById('dash-total-output'),
  dashMetricQual: document.getElementById('dash-metric-qual'),
  dashGoodOutput: document.getElementById('dash-good-output'),
  dashScrapOutput: document.getElementById('dash-scrap-output'),
  rootCauseTbody: document.getElementById('root-cause-tbody'),

  // Global & Modal
  btnGlobalExport: document.getElementById('btn-global-export'),
  btnClearData: document.getElementById('btn-clear-data'),
  btnOpenMobileQr: document.getElementById('btn-open-mobile-qr'),
  modalMobileQr: document.getElementById('modal-mobile-qr'),
  btnCloseQrModal: document.getElementById('btn-close-qr-modal'),
  btnDismissQrModal: document.getElementById('btn-dismiss-qr-modal'),
  btnOpenDbSettings: document.getElementById('btn-open-db-settings'),
  dbStatusDot: document.getElementById('db-status-dot'),
  dbStatusText: document.getElementById('db-status-text'),
  modalSupabase: document.getElementById('modal-supabase'),
  btnCloseModal: document.getElementById('btn-close-modal'),
  cfgSupabaseUrl: document.getElementById('cfg-supabase-url'),
  cfgSupabaseKey: document.getElementById('cfg-supabase-key'),
  btnTestSupabase: document.getElementById('btn-test-supabase'),
  btnSaveSupabase: document.getElementById('btn-save-supabase'),
  btnDisconnectSupabase: document.getElementById('btn-disconnect-supabase'),
  supabaseTestResult: document.getElementById('supabase-test-result'),
  toastContainer: document.getElementById('toast-container')
};

// Initialize Application
document.addEventListener('DOMContentLoaded', async () => {
  startLiveClock();
  await initStorage();
  updateSupabaseStatusIndicator();
  renderMinimalMachines();
  populateMachineSelectors();
  setupEventListeners();
  setDefaultFormValues();
  updateLiveOeeCalculations();

  // Zero-Click Live Database Auto-Sync (polls every 5s for hands-free monitoring)
  setInterval(async () => {
    if (state.currentView === 'view-analytics') {
      await renderAnalyticsDashboard();
    }
  }, 5000);
});

/**
 * Live Clock and Shift Detection
 */
function getCurrentShift() {
  const hours = new Date().getHours();
  if (hours >= 6 && hours < 14) return 'Shift A';
  if (hours >= 14 && hours < 22) return 'Shift B';
  return 'Shift C';
}

function startLiveClock() {
  const update = () => {
    const now = new Date();
    dom.liveClock.textContent = now.toLocaleTimeString('en-US', { hour12: false });
    dom.shiftName.textContent = getCurrentShift();
  };
  update();
  setInterval(update, 1000);
}

/**
 * Supabase Connection Badge Status
 */
function updateSupabaseStatusIndicator() {
  const isConnected = isConnectedToSupabase();
  if (isConnected) {
    dom.dbStatusDot.className = 'status-dot';
    dom.dbStatusText.textContent = 'Supabase: Connected';
    dom.dbStatusText.style.color = 'var(--emerald-400)';
  } else {
    dom.dbStatusDot.className = 'status-dot offline';
    dom.dbStatusText.textContent = 'Supabase: Offline (Click to Link)';
    dom.dbStatusText.style.color = 'var(--text-secondary)';
  }
}

/**
 * 3-Page Tab View Navigation
 */
function switchView(targetViewId) {
  // Update view containers
  [dom.viewMachines, dom.viewFillup, dom.viewAnalytics].forEach(view => {
    if (view.id === targetViewId) {
      view.classList.remove('hidden');
    } else {
      view.classList.add('hidden');
    }
  });

  // Update navbar tab buttons
  [dom.tabMachines, dom.tabFillup, dom.tabAnalytics].forEach(btn => {
    if (btn.dataset.target === targetViewId) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  state.currentView = targetViewId;
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // If navigating to analytics dashboard, render Chart.js graphs
  if (targetViewId === 'view-analytics') {
    renderAnalyticsDashboard();
  }
}

/**
 * PAGE 1: Render Only the 11 Machine Names
 */
function renderMinimalMachines() {
  dom.minimalMachinesGrid.innerHTML = '';

  MACHINES.forEach(machine => {
    const card = document.createElement('div');
    card.className = `minimal-machine-card card-${machine.category.toLowerCase()}`;
    card.dataset.code = machine.code;

    card.innerHTML = `
      <div class="card-name-wrap">
        <span class="card-machine-type">${machine.category} Center</span>
        <h3 class="card-machine-name">${machine.name}</h3>
      </div>
      <div class="card-launch-icon" title="Open Fill-up Page">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <line x1="5" y1="12" x2="19" y2="12"></line>
          <polyline points="12 5 19 12 12 19"></polyline>
        </svg>
      </div>
    `;

    // Clicking opens the dedicated fillup page for that machine
    card.addEventListener('click', () => {
      openMachineFillup(machine.code);
    });

    dom.minimalMachinesGrid.appendChild(card);
  });
}

/**
 * Populate machine dropdowns on Page 2 and Page 3
 */
function populateMachineSelectors() {
  // Quick Switcher on Page 2
  dom.selectQuickMachine.innerHTML = '';
  MACHINES.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m.code;
    opt.textContent = `${m.name} (${m.category})`;
    dom.selectQuickMachine.appendChild(opt);
  });

  // Filter on Page 3
  dom.dashFilterMachine.innerHTML = '<option value="ALL">All 11 Machines (Combined Plant)</option>';
  MACHINES.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m.code;
    opt.textContent = m.name;
    dom.dashFilterMachine.appendChild(opt);
  });
}

/**
 * PAGE 2: Open Dedicated Machine Fill-Up View
 */
function openMachineFillup(machineCode) {
  const machine = MACHINES.find(m => m.code === machineCode) || MACHINES[0];
  state.currentMachine = machine;

  dom.activeMachineName.textContent = machine.name;
  dom.activeMachineType.textContent = machine.category;
  dom.selectQuickMachine.value = machine.code;

  switchView('view-fillup');
  updateLiveOeeCalculations();
}

/**
 * Set Form Default Values
 */
function setDefaultFormValues() {
  dom.inputDate.value = new Date().toISOString().split('T')[0];
  dom.inputShift.value = getCurrentShift();
  dom.inputShiftHours.value = '8.5';
  if (dom.inputOperator) dom.inputOperator.value = '';
  if (dom.inputPart1Name) dom.inputPart1Name.value = '';
  if (dom.inputPart1Cycle) dom.inputPart1Cycle.value = '0';
  if (dom.inputPart1Qty) dom.inputPart1Qty.value = '0';
  if (dom.inputPart2Name) dom.inputPart2Name.value = '';
  if (dom.inputPart2Cycle) dom.inputPart2Cycle.value = '0';
  if (dom.inputPart2Qty) dom.inputPart2Qty.value = '0';
  if (dom.inputPart3Name) dom.inputPart3Name.value = '';
  if (dom.inputPart3Cycle) dom.inputPart3Cycle.value = '0';
  if (dom.inputPart3Qty) dom.inputPart3Qty.value = '0';
  if (dom.inputRejectedQty) dom.inputRejectedQty.value = '0';
  LOSS_FIELDS.forEach(f => {
    const el = document.getElementById(f.key);
    if (el) el.value = 0;
  });
  if (dom.inputRemarks) dom.inputRemarks.value = '';
}

/**
 * Gather current form data for live OEE calculation
 */
function getFormValues() {
  const shiftHours = Number(dom.inputShiftHours.value) || 8.5;

  const parts = [
    {
      name: dom.inputPart1Name.value.trim(),
      cycleTime: Number(dom.inputPart1Cycle.value) || 0,
      qty: Number(dom.inputPart1Qty.value) || 0
    },
    {
      name: dom.inputPart2Name.value.trim(),
      cycleTime: Number(dom.inputPart2Cycle.value) || 0,
      qty: Number(dom.inputPart2Qty.value) || 0
    },
    {
      name: dom.inputPart3Name.value.trim(),
      cycleTime: Number(dom.inputPart3Cycle.value) || 0,
      qty: Number(dom.inputPart3Qty.value) || 0
    }
  ];

  const lossesObj = {};
  LOSS_FIELDS.forEach(field => {
    const input = document.getElementById(field.key);
    lossesObj[field.key] = input ? (Number(input.value) || 0) : 0;
  });

  const rejectedQty = Number(dom.inputRejectedQty.value) || 0;

  return { shiftHours, parts, lossesObj, rejectedQty };
}

/**
 * Update Live Auto-Calculated OEE Ribbon
 */
function updateLiveOeeCalculations() {
  const { shiftHours, parts, lossesObj, rejectedQty } = getFormValues();
  const oeeData = calculateOEE(shiftHours, parts, lossesObj, rejectedQty);

  dom.liveCalcPlannedTime.textContent = `${oeeData.plannedTimeMins}m`;
  dom.liveCalcTotalLoss.textContent = `${oeeData.totalLossesMins}m`;
  dom.liveCalcOperatingTime.textContent = `${oeeData.operatingTimeMins}m`;
  dom.liveCalcAvailability.textContent = `${oeeData.availabilityRate}%`;
  dom.liveCalcPerformance.textContent = `${oeeData.performanceRate}%`;
  dom.liveCalcQuality.textContent = `${oeeData.qualityRate}%`;
  dom.liveCalcOee.textContent = `${oeeData.oeeRate}%`;

  // Color dynamic feedback
  if (oeeData.oeeRate >= 85) {
    dom.liveCalcOee.style.color = 'var(--emerald-400)';
  } else if (oeeData.oeeRate >= 70) {
    dom.liveCalcOee.style.color = 'var(--cyan-400)';
  } else {
    dom.liveCalcOee.style.color = 'var(--rose-400)';
  }
}

/**
 * Handle Production Form Submission
 */
async function handleFormSubmit(e) {
  e.preventDefault();

  const { shiftHours, parts, lossesObj, rejectedQty } = getFormValues();
  const oee = calculateOEE(shiftHours, parts, lossesObj, rejectedQty);

  const entryData = {
    machine_code: state.currentMachine.code,
    machine_name: state.currentMachine.name,
    log_date: dom.inputDate.value,
    shift: dom.inputShift.value,
    shift_hours: shiftHours,
    operator_name: dom.inputOperator.value.trim(),
    
    // Parts
    part1_name: parts[0].name,
    part1_cycle_time: parts[0].cycleTime,
    part1_qty: parts[0].qty,

    part2_name: parts[1].name,
    part2_cycle_time: parts[1].cycleTime,
    part2_qty: parts[1].qty,

    part3_name: parts[2].name,
    part3_cycle_time: parts[2].cycleTime,
    part3_qty: parts[2].qty,

    total_qty: oee.totalQty,
    rejected_qty: oee.rejectedQty,
    good_qty: oee.goodQty,

    // 13 Losses
    ...lossesObj,
    remarks: dom.inputRemarks.value.trim(),

    // OEE Metrics
    total_losses_mins: oee.totalLossesMins,
    planned_time_mins: oee.plannedTimeMins,
    operating_time_mins: oee.operatingTimeMins,
    ideal_run_time_mins: oee.idealRunTimeMins,
    availability_rate: oee.availabilityRate,
    performance_rate: oee.performanceRate,
    quality_rate: oee.qualityRate,
    oee_rate: oee.oeeRate
  };

  const btnSubmit = document.getElementById('btn-submit-entry');
  btnSubmit.disabled = true;
  btnSubmit.textContent = 'Saving...';

  try {
    const res = await saveProductionEntry(entryData);
    if (res.supabaseSynced) {
      showToast('Shift Production & Losses synchronized to Supabase Cloud!', 'success');
    } else {
      showToast('Shift record saved locally! (Supabase offline mode)', 'success');
    }

    // Reset all form fields to clean state
    setDefaultFormValues();
    updateLiveOeeCalculations();

    // Smoothly transition to Page 3 Analytics Dashboard
    switchView('view-analytics');

  } catch (err) {
    console.error('Error saving entry:', err);
    showToast('Failed to save record.', 'error');
  } finally {
    btnSubmit.disabled = false;
    btnSubmit.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
        <polyline points="17 21 17 13 7 13 7 21"></polyline>
        <polyline points="7 3 7 8 15 8"></polyline>
      </svg>
      Save Record & View Dashboard
    `;
  }
}

/**
 * PAGE 3: Render Executive OEE & Loss Occurrence Dashboard with Chart.js
 */
async function renderAnalyticsDashboard() {
  const selectedCode = dom.dashFilterMachine.value === 'ALL' ? null : dom.dashFilterMachine.value;
  const data = await getDashboardAnalytics(selectedCode);

  // 1. Update 4 Key OEE Metric Tiles
  dom.dashMetricOee.textContent = data.avgOEE;
  dom.dashMetricAvail.textContent = data.avgAvailability;
  dom.dashMetricPerf.textContent = data.avgPerformance;
  dom.dashMetricQual.textContent = data.avgQuality;

  dom.dashTotalLosses.textContent = data.totalLossesMins;
  dom.dashTotalOutput.textContent = data.totalOutput.toLocaleString();
  dom.dashGoodOutput.textContent = data.totalGood.toLocaleString();
  dom.dashScrapOutput.textContent = data.totalScrap.toLocaleString();

  // OEE Rating Badge
  const oeeNum = Number(data.avgOEE) || 0;
  const isZeroState = (data.totalOutput === 0 && data.totalLossesMins === 0);

  if (isZeroState) {
    dom.oeeRatingBadge.textContent = 'Ready for Shift Data';
    dom.oeeRatingBadge.style.color = 'var(--text-secondary)';
    dom.oeeRatingBadge.style.background = 'rgba(255, 255, 255, 0.06)';
  } else if (oeeNum >= 85) {
    dom.oeeRatingBadge.textContent = 'World Class (≥ 85%)';
    dom.oeeRatingBadge.style.color = 'var(--emerald-400)';
    dom.oeeRatingBadge.style.background = 'rgba(16, 185, 129, 0.15)';
  } else if (oeeNum >= 70) {
    dom.oeeRatingBadge.textContent = 'Acceptable (≥ 70%)';
    dom.oeeRatingBadge.style.color = 'var(--cyan-400)';
    dom.oeeRatingBadge.style.background = 'rgba(6, 182, 212, 0.15)';
  } else {
    dom.oeeRatingBadge.textContent = 'Needs Improvement (< 70%)';
    dom.oeeRatingBadge.style.color = 'var(--rose-400)';
    dom.oeeRatingBadge.style.background = 'rgba(244, 63, 94, 0.15)';
  }

  // Update Executive OEE Circular Radial Gauge (SVG)
  const radialRing = document.getElementById('oee-radial-ring');
  if (radialRing) {
    const circumference = 351.86; // 2 * pi * 56
    const pct = isZeroState ? 0 : Math.min(100, Math.max(0, oeeNum));
    const offset = circumference * (1 - pct / 100);
    radialRing.style.strokeDashoffset = offset;
    radialRing.style.stroke = isZeroState ? 'var(--border-subtle)' : (pct >= 85 ? 'var(--emerald-400)' : pct >= 70 ? 'var(--cyan-400)' : 'var(--rose-400)');
  }

  // Update 3 Core Pillar Progress Bars
  const barAvail = document.getElementById('bar-avail');
  const barPerf = document.getElementById('bar-perf');
  const barQual = document.getElementById('bar-qual');
  if (barAvail) barAvail.style.width = isZeroState ? '0%' : `${Math.min(100, Math.max(0, Number(data.avgAvailability)))}%`;
  if (barPerf) barPerf.style.width = isZeroState ? '0%' : `${Math.min(100, Math.max(0, Number(data.avgPerformance)))}%`;
  if (barQual) barQual.style.width = isZeroState ? '0%' : `${Math.min(100, Math.max(0, Number(data.avgQuality)))}%`;

  // Update Operating Time & Status Indicator
  const elOpTimeDisplay = document.getElementById('dash-op-time-display');
  if (elOpTimeDisplay) elOpTimeDisplay.textContent = `${(data.totalOperatingTimeMins || 0).toLocaleString()}m`;

  const elOeeStatus = document.getElementById('oee-status-indicator');
  if (elOeeStatus) {
    if (isZeroState) {
      elOeeStatus.textContent = '⚪ Ready for New Production Data';
      elOeeStatus.style.color = 'var(--text-secondary)';
    } else if (oeeNum >= 85) {
      elOeeStatus.textContent = '🟢 World-Class Production Pace';
      elOeeStatus.style.color = 'var(--emerald-400)';
    } else if (oeeNum >= 70) {
      elOeeStatus.textContent = '🟢 Operating Within Normal Range';
      elOeeStatus.style.color = 'var(--cyan-400)';
    } else {
      elOeeStatus.textContent = '🔴 High Downtime / Action Required';
      elOeeStatus.style.color = 'var(--rose-400)';
    }
  }

  // Update Deep-Dive Loss Ribbon (Why, How, How Many Times)
  let topLossName = 'None';
  let maxLossMins = 0;
  let mostFreqName = 'None';
  let maxFreqCount = 0;

  LOSS_FIELDS.forEach(f => {
    const mins = data.lossBreakdown[f.key] || 0;
    const count = (data.lossCounts && data.lossCounts[f.key]) || 0;
    if (mins > maxLossMins) {
      maxLossMins = mins;
      topLossName = f.label;
    }
    if (count > maxFreqCount) {
      maxFreqCount = count;
      mostFreqName = f.label;
    }
  });

  const elTotalIncidents = document.getElementById('dash-total-incidents');
  const elTopLossName = document.getElementById('dash-top-loss-name');
  const elAvgStoppage = document.getElementById('dash-avg-stoppage');
  const elMostFreq = document.getElementById('dash-most-frequent-loss');

  if (elTotalIncidents) elTotalIncidents.textContent = data.totalLossIncidents || 0;
  if (elTopLossName) elTopLossName.textContent = topLossName;
  if (elAvgStoppage) {
    const avg = data.totalLossIncidents > 0 ? (data.totalLossesMins / data.totalLossIncidents).toFixed(1) : 0;
    elAvgStoppage.textContent = `${avg}m`;
  }
  if (elMostFreq) elMostFreq.textContent = mostFreqName;

  // 2. Render Chart 1: Dual Bar/Line Chart for 13 Losses (Duration vs Frequency)
  renderLossesParetoChart(data.lossBreakdown, data.lossCounts);

  // 3. Render Chart 2: Loss Classification Donut Chart (Why Losses Occur)
  renderLossClassificationDonut(data.lossBreakdown);

  // 4. Render Chart 3: OEE % Across All 11 Machines
  renderMachinesOeeChart(data.machineOeeList);

  // 5. Render "Why & How Loss Occurs" Root-Cause Log Table
  renderRootCauseTable(data.lossOccurrenceList);
}

/**
 * Chart.js: 13 Losses Dual Chart (Duration in Mins & Frequency Count)
 */
function renderLossesParetoChart(lossBreakdown, lossCounts = {}) {
  const ctx = document.getElementById('chart-losses-pareto');
  if (!ctx || !window.Chart) return;

  // Build sorted array of losses by total duration
  const items = LOSS_FIELDS.map(f => ({
    label: f.label,
    mins: lossBreakdown[f.key] || 0,
    count: lossCounts[f.key] || 0
  })).sort((a, b) => b.mins - a.mins);

  const labels = items.map(i => i.label);
  const dataMins = items.map(i => i.mins);
  const dataCounts = items.map(i => i.count);

  if (state.chartLossesPareto) {
    state.chartLossesPareto.destroy();
  }

  state.chartLossesPareto = new Chart(ctx, {
    data: {
      labels,
      datasets: [
        {
          type: 'bar',
          label: 'Total Downtime (Mins)',
          data: dataMins,
          backgroundColor: 'rgba(244, 63, 94, 0.65)',
          borderColor: '#f43f5e',
          borderWidth: 1.5,
          borderRadius: 4,
          yAxisID: 'y'
        },
        {
          type: 'line',
          label: 'Frequency (Times Occurred)',
          data: dataCounts,
          borderColor: '#06b6d4',
          backgroundColor: '#06b6d4',
          borderWidth: 2.5,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: '#ffffff',
          yAxisID: 'y1'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: {
            color: '#94a3b8',
            font: { size: 11, family: 'Plus Jakarta Sans' },
            boxWidth: 14
          }
        },
        tooltip: {
          callbacks: {
            label: (context) => {
              if (context.datasetIndex === 0) {
                return ` ${context.parsed.y} mins lost`;
              }
              return ` Occurred ${context.parsed.y} times`;
            }
          }
        }
      },
      scales: {
        x: {
          ticks: {
            color: '#94a3b8',
            font: { size: 9.5, family: 'Plus Jakarta Sans' },
            maxRotation: 45,
            minRotation: 30
          },
          grid: { display: false }
        },
        y: {
          type: 'linear',
          position: 'left',
          title: {
            display: true,
            text: 'Minutes Lost',
            color: '#94a3b8',
            font: { size: 10 }
          },
          ticks: {
            color: '#94a3b8',
            font: { family: 'JetBrains Mono' }
          },
          grid: { color: 'rgba(255, 255, 255, 0.06)' }
        },
        y1: {
          type: 'linear',
          position: 'right',
          title: {
            display: true,
            text: 'Times Occurred',
            color: '#06b6d4',
            font: { size: 10 }
          },
          ticks: {
            color: '#06b6d4',
            font: { family: 'JetBrains Mono' },
            stepSize: 1
          },
          grid: { drawOnChartArea: false }
        }
      }
    }
  });
}

/**
 * Chart.js: Loss Classification Donut
 */
function renderLossClassificationDonut(lossBreakdown) {
  const ctx = document.getElementById('chart-losses-donut');
  if (!ctx || !window.Chart) return;

  // Group into major classifications
  const groups = {
    'Equipment Breakdown': (lossBreakdown.loss_breakdown || 0),
    'Process & Setup': (lossBreakdown.loss_setup || 0) + (lossBreakdown.loss_startup || 0) + (lossBreakdown.loss_programming || 0),
    'Logistics & Planning': (lossBreakdown.loss_no_material || 0) + (lossBreakdown.loss_no_plan || 0) + (lossBreakdown.loss_document || 0),
    'Tooling & Speed': (lossBreakdown.loss_jig_fixture || 0) + (lossBreakdown.loss_speed || 0),
    'Quality & Inspection': (lossBreakdown.loss_quality_insp || 0) + (lossBreakdown.loss_measurement || 0),
    'Maintenance & Misc': (lossBreakdown.loss_cleaning || 0) + (lossBreakdown.loss_no_operator || 0)
  };

  const labels = Object.keys(groups);
  const values = Object.values(groups);

  if (state.chartLossesDonut) {
    state.chartLossesDonut.destroy();
  }

  state.chartLossesDonut = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: [
          '#f43f5e', // Equipment Breakdown
          '#6366f1', // Process & Setup
          '#06b6d4', // Logistics
          '#f59e0b', // Tooling
          '#10b981', // Quality
          '#64748b'  // Maintenance
        ],
        borderWidth: 2,
        borderColor: '#111a2e'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: '#94a3b8',
            font: { size: 10, family: 'Plus Jakarta Sans' },
            boxWidth: 12,
            padding: 8
          }
        }
      },
      cutout: '62%'
    }
  });
}

/**
 * Chart.js: OEE Comparison Across All 11 Machines
 */
function renderMachinesOeeChart(machineOeeList) {
  const ctx = document.getElementById('chart-machines-oee');
  if (!ctx || !window.Chart) return;

  const labels = machineOeeList.map(m => m.name);
  const oeeValues = machineOeeList.map(m => m.oee);

  // Dynamic colors: emerald for >=85, cyan for >=70, rose for <70
  const bgColors = oeeValues.map(v => {
    if (v >= 85) return 'rgba(16, 185, 129, 0.7)';
    if (v >= 70) return 'rgba(6, 182, 212, 0.7)';
    return 'rgba(244, 63, 94, 0.7)';
  });

  if (state.chartMachinesOee) {
    state.chartMachinesOee.destroy();
  }

  state.chartMachinesOee = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'OEE %',
        data: oeeValues,
        backgroundColor: bgColors,
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => ` OEE: ${ctx.parsed.y}%`
          }
        }
      },
      scales: {
        x: {
          ticks: {
            color: '#94a3b8',
            font: { size: 11, family: 'Plus Jakarta Sans' }
          },
          grid: { display: false }
        },
        y: {
          min: 0,
          max: 100,
          ticks: {
            color: '#94a3b8',
            font: { family: 'JetBrains Mono' },
            callback: (v) => `${v}%`
          },
          grid: { color: 'rgba(255, 255, 255, 0.06)' }
        }
      }
    }
  });
}

/**
 * Render "Why & How Loss Occurred" Root-Cause Log Table
 */
function renderRootCauseTable(occurrences) {
  dom.rootCauseTbody.innerHTML = '';

  if (!occurrences || occurrences.length === 0) {
    dom.rootCauseTbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align:center; padding: 36px 20px; color: var(--text-secondary);">
          <div style="display:flex; flex-direction:column; align-items:center; gap:8px;">
            <span style="font-size: 1.05rem; font-weight: 700; color: var(--cyan-400);">Ready for New Production Records</span>
            <span style="font-size: 0.85rem; color: var(--text-muted);">No production logs recorded yet. Choose any of the 11 machines to enter shift data, or connect Supabase to stream cloud records.</span>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  occurrences.forEach(item => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="font-family: var(--font-mono); font-size: 0.8rem;">${item.date}</td>
      <td><span class="shift-badge">${item.shift}</span></td>
      <td><strong>${item.machineName}</strong></td>
      <td>${item.operator}</td>
      <td><span class="loss-pill-badge">${item.primaryLoss}</span></td>
      <td><span class="why-category-badge">${item.whyCategory || 'Technical'}</span></td>
      <td class="remarks-text">${item.howItOccurred || item.remarks || 'Standard Stoppage'}</td>
      <td style="font-family: var(--font-mono); font-weight: 700; color: var(--rose-400);">${item.totalLossMins}m</td>
    `;
    dom.rootCauseTbody.appendChild(tr);
  });
}

/**
 * Toast Notifications
 */
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type === 'success' ? 'toast-success' : type === 'error' ? 'toast-error' : ''}`;
  toast.innerHTML = `
    <span style="font-weight: 700; color: ${type === 'success' ? 'var(--emerald-400)' : type === 'error' ? 'var(--rose-400)' : 'var(--cyan-400)'}">
      ${type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}
    </span>
    <span>${message}</span>
  `;
  dom.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'toastSlideOut 0.3s forwards cubic-bezier(0.16, 1, 0.3, 1)';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

/**
 * Setup All Event Listeners
 */
function setupEventListeners() {
  // Navigation Tabs
  dom.tabMachines.addEventListener('click', () => switchView('view-machines'));
  dom.tabFillup.addEventListener('click', () => switchView('view-fillup'));
  dom.tabAnalytics.addEventListener('click', () => switchView('view-analytics'));
  dom.btnBackToMachines.addEventListener('click', () => switchView('view-machines'));
  dom.btnCancelEntry.addEventListener('click', () => switchView('view-machines'));

  // Page 2 Machine Switcher
  dom.selectQuickMachine.addEventListener('change', (e) => {
    openMachineFillup(e.target.value);
  });

  // Page 3 Machine Filter
  dom.dashFilterMachine.addEventListener('change', () => {
    renderAnalyticsDashboard();
  });

  // Live OEE Calculation triggers on Page 2
  const calcInputs = [
    dom.inputShiftHours,
    dom.inputPart1Cycle, dom.inputPart1Qty,
    dom.inputPart2Cycle, dom.inputPart2Qty,
    dom.inputPart3Cycle, dom.inputPart3Qty,
    dom.inputRejectedQty,
    ...document.querySelectorAll('.loss-calc-trigger')
  ];

  calcInputs.forEach(input => {
    if (input) {
      input.addEventListener('input', updateLiveOeeCalculations);
      input.addEventListener('change', updateLiveOeeCalculations);
    }
  });

  // Form Submit
  dom.form.addEventListener('submit', handleFormSubmit);

  // Global CSV Export
  dom.btnGlobalExport.addEventListener('click', async () => {
    const entries = await getProductionEntries();
    exportEntriesToCSV(entries, 'Shopfloor_OEE_11_Machines');
  });

  // Android Mobile QR Modal Listeners
  if (dom.btnOpenMobileQr) {
    dom.btnOpenMobileQr.addEventListener('click', () => {
      dom.modalMobileQr?.classList.remove('hidden');
    });
  }
  if (dom.btnCloseQrModal) {
    dom.btnCloseQrModal.addEventListener('click', () => {
      dom.modalMobileQr?.classList.add('hidden');
    });
  }
  if (dom.btnDismissQrModal) {
    dom.btnDismissQrModal.addEventListener('click', () => {
      dom.modalMobileQr?.classList.add('hidden');
    });
  }

  // Quick Chips Stepper for Android & Shopfloor Operators (+5m, +15m)
  document.addEventListener('click', (e) => {
    const chip = e.target.closest('.btn-loss-chip');
    if (!chip) return;
    e.preventDefault();
    const targetId = chip.getAttribute('data-target');
    const addMinutes = parseInt(chip.getAttribute('data-add'), 10) || 0;
    const targetInput = document.getElementById(targetId);
    if (targetInput) {
      const currentVal = parseInt(targetInput.value, 10) || 0;
      targetInput.value = Math.max(0, currentVal + addMinutes);
      // Haptic feedback for Android devices
      if ('vibrate' in navigator) {
        try { navigator.vibrate(30); } catch (_) {}
      }
      updateLiveOeeCalculations();
    }
  });

  // Supabase Settings Modal
  dom.btnOpenDbSettings.addEventListener('click', () => {
    const cfg = getSupabaseConfig();
    dom.cfgSupabaseUrl.value = cfg.url || '';
    dom.cfgSupabaseKey.value = cfg.key || '';
    dom.supabaseTestResult.style.display = 'none';
    dom.modalSupabase.classList.remove('hidden');
  });

  dom.btnCloseModal.addEventListener('click', () => {
    dom.modalSupabase.classList.add('hidden');
  });

  dom.btnTestSupabase.addEventListener('click', async () => {
    const url = dom.cfgSupabaseUrl.value.trim();
    const key = dom.cfgSupabaseKey.value.trim();
    if (!url || !key) {
      dom.supabaseTestResult.style.display = 'block';
      dom.supabaseTestResult.style.background = 'rgba(244, 63, 94, 0.15)';
      dom.supabaseTestResult.style.color = 'var(--rose-400)';
      dom.supabaseTestResult.textContent = 'Please provide both Project URL and Public Anon Key.';
      return;
    }

    dom.btnTestSupabase.disabled = true;
    dom.btnTestSupabase.textContent = 'Testing...';

    const test = await testSupabaseConnection(url, key);
    dom.btnTestSupabase.disabled = false;
    dom.btnTestSupabase.textContent = 'Test Connection';

    dom.supabaseTestResult.style.display = 'block';
    if (test.success) {
      dom.supabaseTestResult.style.background = 'rgba(16, 185, 129, 0.15)';
      dom.supabaseTestResult.style.color = 'var(--emerald-400)';
      dom.supabaseTestResult.textContent = test.message;
    } else {
      dom.supabaseTestResult.style.background = 'rgba(244, 63, 94, 0.15)';
      dom.supabaseTestResult.style.color = 'var(--rose-400)';
      dom.supabaseTestResult.textContent = test.message;
    }
  });

  dom.btnSaveSupabase.addEventListener('click', async () => {
    const url = dom.cfgSupabaseUrl.value.trim();
    const key = dom.cfgSupabaseKey.value.trim();
    saveSupabaseConfig(url, key);
    await initStorage();
    updateSupabaseStatusIndicator();
    dom.modalSupabase.classList.add('hidden');
    const isConn = isConnectedToSupabase();
    if (isConn) {
      showToast('⚡ Supabase Database successfully connected & active!', 'success');
    } else {
      showToast('Supabase settings saved.', 'info');
    }
    if (state.currentView === 'view-analytics') {
      await renderAnalyticsDashboard();
    }
  });

  // Disconnect Supabase Cloud
  if (dom.btnDisconnectSupabase) {
    dom.btnDisconnectSupabase.addEventListener('click', async () => {
      saveSupabaseConfig('', '');
      await initStorage();
      updateSupabaseStatusIndicator();
      dom.cfgSupabaseUrl.value = '';
      dom.cfgSupabaseKey.value = '';
      dom.supabaseTestResult.style.display = 'none';
      dom.modalSupabase.classList.add('hidden');
      showToast('Supabase disconnected. Switched to local storage mode.', 'info');
      if (state.currentView === 'view-analytics') {
        await renderAnalyticsDashboard();
      }
    });
  }

  // Clear Production Data Button
  if (dom.btnClearData) {
    dom.btnClearData.addEventListener('click', async () => {
      const ok = confirm('⚠️ Clear All Production Data?\n\nThis will wipe all existing shift production records and loss occurrences so you can enter fresh data.');
      if (!ok) return;

      await clearAllProductionEntries();
      setDefaultFormValues();
      updateLiveOeeCalculations();
      if (state.currentView === 'view-analytics') {
        await renderAnalyticsDashboard();
      }
      showToast('All production records have been cleared! Ready for new entries.', 'info');
    });
  }
}
