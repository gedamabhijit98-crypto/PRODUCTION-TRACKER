/**
 * Storage Layer with Supabase Integration and LocalStorage Fallback
 * Handles Production Entries, 13-Loss Breakdowns, and OEE Computations
 */
import { MACHINES, LOSS_FIELDS } from './machines.js';
import { SUPABASE_CONFIG } from './config.js';

const STORAGE_KEY_CONFIG = 'prodtracker_supabase_config';
const STORAGE_KEY_MACHINES = 'prodtracker_machines_11';
const STORAGE_KEY_ENTRIES = 'prodtracker_oee_entries';

let supabaseClient = null;
let isSupabaseActive = false;

/**
 * Generate a RFC-4122 compliant UUID v4 string
 */
function generateUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return '10000000-1000-4000-8000-' + Math.random().toString(16).substring(2, 14);
}

/**
 * Initialize Storage and Supabase Cloud Client
 * Fresh start: Mock sample data is eliminated for clean real-world entries.
 */
export async function initStorage() {
  if (!localStorage.getItem(STORAGE_KEY_MACHINES)) {
    localStorage.setItem(STORAGE_KEY_MACHINES, JSON.stringify(MACHINES));
  }

  // Ensure entries storage is initialized without mock data
  const existingRaw = localStorage.getItem(STORAGE_KEY_ENTRIES);
  if (!existingRaw) {
    localStorage.setItem(STORAGE_KEY_ENTRIES, JSON.stringify([]));
  } else {
    // Purge old mock sample entries if they exist
    try {
      const parsed = JSON.parse(existingRaw);
      const containsMock = parsed.some(e => e.id === 'entry-101' || e.id === 'entry-102' || e.id === 'entry-103' || e.id === 'entry-104');
      if (containsMock) {
        localStorage.setItem(STORAGE_KEY_ENTRIES, JSON.stringify([]));
      }
    } catch (e) {
      localStorage.setItem(STORAGE_KEY_ENTRIES, JSON.stringify([]));
    }
  }

  // Connect Supabase
  const config = getSupabaseConfig();
  if (config.url && config.key && window.supabase) {
    try {
      supabaseClient = window.supabase.createClient(config.url, config.key);
      const test = await testSupabaseConnection(config.url, config.key);
      isSupabaseActive = test.success;
      if (isSupabaseActive) {
        console.log('⚡ Supabase Cloud Database Connected & Active');
      }
    } catch (err) {
      console.warn('Supabase initialization failed:', err);
      isSupabaseActive = false;
    }
  }

  return { isSupabaseActive };
}

/**
 * Retrieve Supabase Configuration from config.js or localStorage
 */
export function getSupabaseConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CONFIG);
    const localCfg = raw ? JSON.parse(raw) : null;
    
    // Priority: config.js first if specified, otherwise localStorage
    const url = (SUPABASE_CONFIG && SUPABASE_CONFIG.url && SUPABASE_CONFIG.url.trim())
      ? SUPABASE_CONFIG.url.trim()
      : (localCfg && localCfg.url ? localCfg.url.trim() : '');

    const key = (SUPABASE_CONFIG && SUPABASE_CONFIG.anonKey && SUPABASE_CONFIG.anonKey.trim())
      ? SUPABASE_CONFIG.anonKey.trim()
      : (localCfg && localCfg.key ? localCfg.key.trim() : '');

    return { url, key };
  } catch (e) {
    return { url: '', key: '' };
  }
}

/**
 * Save Supabase Configuration to localStorage and re-initialize client
 */
export function saveSupabaseConfig(url, key) {
  const cleanUrl = (url || '').trim();
  const cleanKey = (key || '').trim();
  localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify({ url: cleanUrl, key: cleanKey }));
  
  if (cleanUrl && cleanKey && window.supabase) {
    try {
      supabaseClient = window.supabase.createClient(cleanUrl, cleanKey);
      isSupabaseActive = true;
    } catch (e) {
      supabaseClient = null;
      isSupabaseActive = false;
    }
  } else {
    supabaseClient = null;
    isSupabaseActive = false;
  }
}

/**
 * Test Connection to Supabase
 */
export async function testSupabaseConnection(url, key) {
  if (!window.supabase) {
    return { success: false, message: 'Supabase JS library not loaded in browser.' };
  }
  const cleanUrl = (url || '').trim();
  const cleanKey = (key || '').trim();
  if (!cleanUrl || !cleanKey) {
    return { success: false, message: 'Please provide both Project URL and Public Anon Key.' };
  }

  try {
    const client = window.supabase.createClient(cleanUrl, cleanKey);
    // Test query on production_entries table
    const { data, error } = await client.from('production_entries').select('count', { count: 'exact', head: true });
    if (error) {
      return { 
        success: false, 
        message: `Connected, but table check failed: ${error.message}. Ensure supabase/schema.sql has run in your Supabase SQL Editor.` 
      };
    }
    isSupabaseActive = true;
    supabaseClient = client;
    return { success: true, message: 'Connected to Supabase Database successfully! Ready for live streaming.' };
  } catch (err) {
    return { success: false, message: err.message || 'Connection failed.' };
  }
}

export function isConnectedToSupabase() {
  return isSupabaseActive && supabaseClient !== null;
}

export function getMachines() {
  return MACHINES;
}

/**
 * Clear All Production Records (Both LocalStorage and Supabase Cloud if active)
 */
export async function clearAllProductionEntries() {
  localStorage.setItem(STORAGE_KEY_ENTRIES, JSON.stringify([]));

  if (isSupabaseActive && supabaseClient) {
    try {
      // In Supabase, delete all rows from production_entries
      const { error } = await supabaseClient.from('production_entries').delete().neq('machine_code', '___non_existent___');
      if (error) {
        console.warn('Supabase delete all error:', error.message);
      }
    } catch (e) {
      console.warn('Supabase delete all failed:', e);
    }
  }

  return true;
}

/**
 * Fetch Production Entries (Supabase primary source, LocalStorage fallback)
 */
export async function getProductionEntries(machineCode = null) {
  if (isSupabaseActive && supabaseClient) {
    try {
      let query = supabaseClient.from('production_entries').select('*').order('created_at', { ascending: false });
      if (machineCode) {
        query = query.eq('machine_code', machineCode);
      }
      const { data, error } = await query;
      if (!error && Array.isArray(data)) {
        // Return database records directly (even if 0 records, do not fallback to dummy data)
        return data;
      }
      if (error) {
        console.warn('Supabase query error:', error.message);
      }
    } catch (e) {
      console.warn('Supabase fetch failed, falling back to local:', e);
    }
  }

  // Local storage fallback
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ENTRIES);
    const entries = raw ? JSON.parse(raw) : [];
    if (machineCode) {
      return entries.filter(e => e.machine_code === machineCode);
    }
    return entries;
  } catch (e) {
    return [];
  }
}

/**
 * Calculates Availability, Performance, Quality, and OEE
 * Formula Execution:
 *   Availability = (Operating Time / Planned Time) * 100
 *   Performance = (Ideal Run Time / Operating Time) * 100
 *   Quality = (Good Parts / Total Parts) * 100
 *   OEE = (A * P * Q) / 10000
 */
export function calculateOEE(shiftHours, parts, lossesObj, rejectedQty) {
  // Standard shopfloor shift: 8.5 hrs = 465 net planned operating minutes (510m gross minus 45m planned breaks)
  const plannedTimeMins = Number(shiftHours) === 8.5 ? 465 : (Number(shiftHours) === 7.0 ? 390 : Math.round((Number(shiftHours) || 8.5) * 60));

  // Sum all 13 losses
  let totalLossesMins = 0;
  LOSS_FIELDS.forEach(f => {
    totalLossesMins += Number(lossesObj[f.key]) || 0;
  });

  const operatingTimeMins = Math.max(0, plannedTimeMins - totalLossesMins);
  const availabilityRate = plannedTimeMins > 0 
    ? Math.min(100, (operatingTimeMins / plannedTimeMins) * 100) 
    : 0;

  // Parts ideal run time
  let totalQty = 0;
  let idealRunTimeMins = 0;
  parts.forEach(p => {
    const qty = Number(p.qty) || 0;
    const cycle = Number(p.cycleTime) || 0;
    totalQty += qty;
    idealRunTimeMins += (qty * cycle);
  });

  const performanceRate = operatingTimeMins > 0 
    ? Math.min(100, (idealRunTimeMins / operatingTimeMins) * 100) 
    : 0;

  const rejected = Number(rejectedQty) || 0;
  const goodQty = Math.max(0, totalQty - rejected);
  const qualityRate = totalQty > 0 
    ? Math.min(100, (goodQty / totalQty) * 100) 
    : 100;

  // OEE = (A * P * Q) / 10000
  const oeeRate = ((availabilityRate * performanceRate * qualityRate) / 10000);

  return {
    plannedTimeMins,
    totalLossesMins,
    operatingTimeMins,
    idealRunTimeMins: Number(idealRunTimeMins.toFixed(2)),
    totalQty,
    goodQty,
    rejectedQty: rejected,
    availabilityRate: Number(availabilityRate.toFixed(1)),
    performanceRate: Number(performanceRate.toFixed(1)),
    qualityRate: Number(qualityRate.toFixed(1)),
    oeeRate: Number(oeeRate.toFixed(1))
  };
}

/**
 * Save New Production Entry
 * Saves to LocalStorage and writes directly to Supabase cloud database if connected.
 */
export async function saveProductionEntry(entryData) {
  const id = generateUUID();
  const nowIso = new Date().toISOString();

  const record = {
    id,
    ...entryData,
    created_at: nowIso
  };

  // 1. Local storage save
  const existing = JSON.parse(localStorage.getItem(STORAGE_KEY_ENTRIES) || '[]');
  existing.unshift(record);
  localStorage.setItem(STORAGE_KEY_ENTRIES, JSON.stringify(existing));

  // 2. Supabase Cloud save
  let supabaseSynced = false;
  if (isSupabaseActive && supabaseClient) {
    try {
      const { data, error } = await supabaseClient.from('production_entries').insert([record]).select();
      if (!error) {
        supabaseSynced = true;
      } else {
        console.warn('Supabase insert error:', error.message);
      }
    } catch (e) {
      console.warn('Supabase insert failed:', e);
    }
  }

  return { success: true, record, supabaseSynced };
}

/**
 * Delete a Single Production Entry
 */
export async function deleteProductionEntry(entryId) {
  const existing = JSON.parse(localStorage.getItem(STORAGE_KEY_ENTRIES) || '[]');
  const filtered = existing.filter(e => e.id !== entryId);
  localStorage.setItem(STORAGE_KEY_ENTRIES, JSON.stringify(filtered));

  if (isSupabaseActive && supabaseClient) {
    try {
      await supabaseClient.from('production_entries').delete().eq('id', entryId);
    } catch (e) {
      console.warn('Supabase delete failed:', e);
    }
  }

  return true;
}

/**
 * Aggregate Analytics for Executive Dashboard
 * Handles 0 entries gracefully with clear empty-state KPIs.
 */
export async function getDashboardAnalytics(machineCode = null) {
  const entries = await getProductionEntries(machineCode);

  if (!entries || entries.length === 0) {
    const emptyBreakdown = {};
    const emptyCounts = {};
    LOSS_FIELDS.forEach(f => {
      emptyBreakdown[f.key] = 0;
      emptyCounts[f.key] = 0;
    });

    const emptyMachineOeeList = MACHINES.map(m => ({ name: m.name, oee: 0 }));

    return {
      avgOEE: '0.0',
      avgAvailability: '0.0',
      avgPerformance: '0.0',
      avgQuality: '0.0',
      totalLossesMins: 0,
      totalLossIncidents: 0,
      totalPlannedTimeMins: 0,
      totalOperatingTimeMins: 0,
      totalIdealRunTimeMins: 0,
      totalOutput: 0,
      totalGood: 0,
      totalScrap: 0,
      lossBreakdown: emptyBreakdown,
      lossCounts: emptyCounts,
      machineOeeList: emptyMachineOeeList,
      lossOccurrenceList: []
    };
  }

  let sumOee = 0;
  let sumAvail = 0;
  let sumPerf = 0;
  let sumQual = 0;
  let totalLossesMins = 0;
  let totalPlannedTimeMins = 0;
  let totalOperatingTimeMins = 0;
  let totalIdealRunTimeMins = 0;
  let totalOutput = 0;
  let totalGood = 0;
  let totalScrap = 0;

  // Initialize loss tallies (minutes) and frequency counts (times occurred)
  const lossTally = {};
  const lossCounts = {};
  LOSS_FIELDS.forEach(f => {
    lossTally[f.key] = 0;
    lossCounts[f.key] = 0;
  });

  let totalLossIncidents = 0;
  const lossOccurrences = [];

  entries.forEach(e => {
    sumOee += Number(e.oee_rate) || 0;
    sumAvail += Number(e.availability_rate) || 0;
    sumPerf += Number(e.performance_rate) || 0;
    sumQual += Number(e.quality_rate) || 0;
    totalLossesMins += Number(e.total_losses_mins) || 0;
    totalPlannedTimeMins += Number(e.planned_time_mins) || 0;
    totalOperatingTimeMins += Number(e.operating_time_mins) || 0;
    totalIdealRunTimeMins += Number(e.ideal_run_time_mins) || 0;
    totalOutput += Number(e.total_qty) || 0;
    totalGood += Number(e.good_qty) || 0;
    totalScrap += Number(e.rejected_qty) || 0;

    // Sum 13 losses duration and count occurrences
    LOSS_FIELDS.forEach(f => {
      const val = Number(e[f.key]) || 0;
      if (val > 0) {
        lossTally[f.key] += val;
        lossCounts[f.key] += 1;
        totalLossIncidents += 1;
      }
    });

    // Record detailed "Why & How Loss Occurred" log
    if (e.remarks || e.total_losses_mins > 0) {
      let topCategory = 'Standard Stoppage';
      let topWhy = 'Operational Pause';
      let maxVal = 0;

      LOSS_FIELDS.forEach(f => {
        const val = Number(e[f.key]) || 0;
        if (val > maxVal) {
          maxVal = val;
          topCategory = f.label;
          topWhy = f.category || 'General';
        }
      });

      lossOccurrences.push({
        id: e.id,
        date: e.log_date,
        shift: e.shift,
        machineName: e.machine_name,
        operator: e.operator_name,
        primaryLoss: topCategory,
        whyCategory: topWhy,
        lossMins: maxVal,
        totalLossMins: e.total_losses_mins,
        howItOccurred: e.remarks || `${topCategory} incident reported during shift execution`
      });
    }
  });

  const count = entries.length;

  // Machine-level OEE comparison across all 11 machines
  const machineOeeMap = {};
  MACHINES.forEach(m => {
    machineOeeMap[m.name] = { totalOee: 0, count: 0 };
  });

  entries.forEach(e => {
    if (machineOeeMap[e.machine_name]) {
      machineOeeMap[e.machine_name].totalOee += (Number(e.oee_rate) || 0);
      machineOeeMap[e.machine_name].count += 1;
    }
  });

  const machineOeeList = MACHINES.map(m => {
    const item = machineOeeMap[m.name];
    const avg = item && item.count > 0 ? (item.totalOee / item.count).toFixed(1) : 0;
    return { name: m.name, oee: Number(avg) };
  });

  return {
    avgOEE: (sumOee / count).toFixed(1),
    avgAvailability: (sumAvail / count).toFixed(1),
    avgPerformance: (sumPerf / count).toFixed(1),
    avgQuality: (sumQual / count).toFixed(1),
    totalLossesMins,
    totalLossIncidents,
    totalPlannedTimeMins,
    totalOperatingTimeMins,
    totalIdealRunTimeMins: Math.round(totalIdealRunTimeMins),
    totalOutput,
    totalGood,
    totalScrap,
    lossBreakdown: lossTally,
    lossCounts,
    machineOeeList,
    lossOccurrenceList: lossOccurrences.slice(0, 25)
  };
}
