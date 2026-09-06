// js/storage.js - Production & Machine Storage with Supabase Integration

export const MACHINES = [
  { id: '1', name: 'CNC DX 200-1', code: 'CNC-DX-200-1', type: 'CNC', idealCycleTime: 45 },
  { id: '2', name: 'CNC 200-2', code: 'CNC-200-2', type: 'CNC', idealCycleTime: 50 },
  { id: '3', name: 'CNC DX 250', code: 'CNC-DX-250', type: 'CNC', idealCycleTime: 60 },
  { id: '4', name: 'CNC DX12B', code: 'CNC-DX-12B', type: 'CNC', idealCycleTime: 40 },
  { id: '5', name: 'VMC 1050', code: 'VMC-1050', type: 'VMC', idealCycleTime: 90 },
  { id: '6', name: 'VMC 1880', code: 'VMC-1880', type: 'VMC', idealCycleTime: 120 },
  { id: '7', name: 'VMC 850', code: 'VMC-850', type: 'VMC', idealCycleTime: 85 },
  { id: '8', name: 'VMC HAAS', code: 'VMC-HAAS', type: 'VMC', idealCycleTime: 75 },
  { id: '9', name: 'VMC PX 20', code: 'VMC-PX-20', type: 'VMC', idealCycleTime: 95 },
  { id: '10', name: 'HMC 1', code: 'HMC-1', type: 'HMC', idealCycleTime: 110 },
  { id: '11', name: 'HMC 2', code: 'HMC-2', type: 'HMC', idealCycleTime: 115 }
];

export const LOSS_CATEGORIES = [
  'Equipment Failure',
  'Setup & Adjustment',
  'Tooling Change',
  'Startup Warmup',
  'Minor Stoppages (<5m)',
  'Reduced Speed',
  'Process Defects',
  'Rework Loss',
  'Operator Shortage',
  'Material Shortage',
  'Measurement & Gauging',
  'Power / Facility Failure',
  'Planned Cleaning / Inspection'
];

let supabaseClient = null;

export function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export async function getSupabaseConfig() {
  try {
    const res = await fetch('/api/config');
    if (!res.ok) throw new Error('API config route unavailable');
    return await res.json();
  } catch (err) {
    console.warn('Unable to retrieve Supabase config:', err);
    return { url: '', anonKey: '' };
  }
}

export async function loadRuntimeSupabase() {
  if (supabaseClient) return supabaseClient;
  try {
    const config = await getSupabaseConfig();
    if (config.url && config.anonKey && window.supabase) {
      supabaseClient = window.supabase.createClient(config.url, config.anonKey);
      return supabaseClient;
    }
  } catch (err) {
    console.warn('Fallback to local storage / memory mode:', err.message);
  }
  return null;
}

export async function initStorage() {
  await loadRuntimeSupabase();
  if (!localStorage.getItem('prod_entries')) {
    localStorage.setItem('prod_entries', JSON.stringify([]));
  }
  return true;
}

export async function isConnectedToSupabase() {
  const client = await loadRuntimeSupabase();
  return !!client;
}

export async function testSupabaseConnection() {
  const client = await loadRuntimeSupabase();
  if (!client) return { connected: false, message: 'Supabase client credentials unconfigured.' };
  try {
    const { error } = await client.from('production_logs').select('id').limit(1);
    if (error) throw error;
    return { connected: true, message: 'Database Connected' };
  } catch (err) {
    return { connected: false, message: err.message };
  }
}

export function getMachines() {
  return MACHINES;
}

export async function getProductionEntries(filterMachine = null) {
  const client = await loadRuntimeSupabase();
  if (client) {
    try {
      let query = client.from('production_logs').select('*').order('created_at', { ascending: false });
      if (filterMachine && filterMachine !== 'ALL') {
        query = query.eq('machine_name', filterMachine);
      }
      const { data, error } = await query;
      if (!error && data) return data;
    } catch (e) {
      console.warn('Error fetching from Supabase, loading local:', e);
    }
  }

  const raw = localStorage.getItem('prod_entries') || '[]';
  let entries = JSON.parse(raw);
  if (filterMachine && filterMachine !== 'ALL') {
    entries = entries.filter(e => e.machine_name === filterMachine);
  }
  return entries;
}

export async function saveProductionEntry(entry) {
  const id = entry.id || generateUUID();
  const oeeCalculated = calculateOEE(entry);

  const fullEntry = {
    ...entry,
    id,
    oee_rate: oeeCalculated.oee,
    availability: oeeCalculated.availability,
    performance: oeeCalculated.performance,
    quality: oeeCalculated.quality,
    created_at: entry.created_at || new Date().toISOString()
  };

  const client = await loadRuntimeSupabase();
  if (client) {
    try {
      await client.from('production_logs').upsert([fullEntry]);
    } catch (err) {
      console.error('Supabase write error:', err);
    }
  }

  const entries = await getProductionEntries();
  const index = entries.findIndex(e => e.id === id);
  if (index >= 0) {
    entries[index] = fullEntry;
  } else {
    entries.unshift(fullEntry);
  }
  localStorage.setItem('prod_entries', JSON.stringify(entries));
  return fullEntry;
}

export async function deleteProductionEntry(id) {
  const client = await loadRuntimeSupabase();
  if (client) {
    try {
      await client.from('production_logs').delete().eq('id', id);
    } catch (err) {
      console.error('Supabase delete error:', err);
    }
  }

  let entries = JSON.parse(localStorage.getItem('prod_entries') || '[]');
  entries = entries.filter(e => e.id !== id);
  localStorage.setItem('prod_entries', JSON.stringify(entries));
  return true;
}

export async function clearAllProductionEntries() {
  const client = await loadRuntimeSupabase();
  if (client) {
    try {
      await client.from('production_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    } catch (e) {
      console.warn(e);
    }
  }
  localStorage.setItem('prod_entries', JSON.stringify([]));
  return true;
}

export function calculateOEE(data) {
  const plannedTime = Number(data.planned_time || data.plannedTimeMinutes || 480);
  const downtime = Number(data.downtime || data.downtimeMinutes || 0);
  const operatingTime = Math.max(0, plannedTime - downtime);
  const totalProduced = Number(data.total_output || data.totalProduced || 0);
  const defectiveUnits = Number(data.scrap_qty || data.defectiveUnits || 0);
  const idealCycleTime = Number(data.ideal_cycle_time || data.idealCycleTimeSeconds || 60);

  if (plannedTime <= 0 || totalProduced <= 0 || operatingTime <= 0) {
    return { availability: 0, performance: 0, quality: 0, oee: 0 };
  }

  const availability = operatingTime / plannedTime;
  const performance = Math.min(1.0, (totalProduced * idealCycleTime) / (operatingTime * 60));
  const quality = Math.max(0, (totalProduced - defectiveUnits) / totalProduced);
  const oee = availability * performance * quality;

  return {
    availability: Number((availability * 100).toFixed(1)),
    performance: Number((performance * 100).toFixed(1)),
    quality: Number((quality * 100).toFixed(1)),
    oee: Number((oee * 100).toFixed(1))
  };
}

export async function getDashboardAnalytics(machineName = null) {
  const entries = await getProductionEntries(machineName);

  let sumOee = 0;
  let sumAvail = 0;
  let sumPerf = 0;
  let sumQual = 0;
  let totalPlannedTimeMins = 0;
  let totalOperatingTimeMins = 0;
  let totalLossesMins = 0;
  let totalIdealRunTimeMins = 0;
  let totalOutput = 0;
  let totalGood = 0;
  let totalScrap = 0;
  let totalLossIncidents = 0;

  const lossTally = {};
  const lossCounts = {};
  LOSS_CATEGORIES.forEach(cat => {
    lossTally[cat] = 0;
    lossCounts[cat] = 0;
  });

  const lossOccurrences = [];

  entries.forEach(e => {
    const oeeData = calculateOEE(e);
    sumOee += oeeData.oee;
    sumAvail += oeeData.availability;
    sumPerf += oeeData.performance;
    sumQual += oeeData.quality;

    const planned = Number(e.planned_time || 480);
    const down = Number(e.downtime || 0);
    const output = Number(e.total_output || 0);
    const scrap = Number(e.scrap_qty || 0);
    const cycle = Number(e.ideal_cycle_time || 60);

    totalPlannedTimeMins += planned;
    totalOperatingTimeMins += Math.max(0, planned - down);
    totalLossesMins += down;
    totalIdealRunTimeMins += (output * cycle) / 60;
    totalOutput += output;
    totalGood += Math.max(0, output - scrap);
    totalScrap += scrap;

    if (e.loss_category && lossTally[e.loss_category] !== undefined) {
      lossTally[e.loss_category] += down;
      lossCounts[e.loss_category] += 1;
      totalLossIncidents += 1;
    }

    if (down > 0) {
      lossOccurrences.push({
        machineName: e.machine_name || 'Machine',
        lossCategory: e.loss_category || 'Unspecified Loss',
        durationMins: down,
        howItOccurred: e.remarks || 'Production disturbance reported during shift'
      });
    }
  });

  const count = entries.length || 1;

  const machineOeeMap = {};
  MACHINES.forEach(m => {
    machineOeeMap[m.name] = { totalOee: 0, count: 0 };
  });

  entries.forEach(e => {
    if (machineOeeMap[e.machine_name]) {
      machineOeeMap[e.machine_name].totalOee += Number(e.oee_rate || 0);
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

export function calculateTimeWeightedOEE(logs = []) {
  if (!logs || logs.length === 0) {
    return {
      avgOEE: '0.0',
      avgAvailability: '0.0',
      avgPerformance: '0.0',
      avgQuality: '0.0',
      totalPlannedTimeMins: 0,
      totalOperatingTimeMins: 0,
      totalLossesMins: 0,
      totalOutput: 0,
      totalGood: 0,
      totalScrap: 0
    };
  }

  let sumOee = 0;
  let sumAvail = 0;
  let sumPerf = 0;
  let sumQual = 0;
  let totalPlanned = 0;
  let totalOp = 0;
  let totalDowntime = 0;
  let totalOut = 0;
  let totalGoodQty = 0;
  let totalScrapQty = 0;

  logs.forEach(entry => {
    const planned = Number(entry.planned_time || entry.plannedTimeMinutes || 480);
    const down = Number(entry.downtime || entry.downtimeMinutes || 0);
    const op = Math.max(0, planned - down);
    const out = Number(entry.total_output || entry.totalProduced || 0);
    const scrap = Number(entry.scrap_qty || entry.defectiveUnits || 0);
    const good = Math.max(0, out - scrap);

    totalPlanned += planned;
    totalOp += op;
    totalDowntime += down;
    totalOut += out;
    totalGoodQty += good;
    totalScrapQty += scrap;

    const oeeData = calculateOEE(entry);
    sumOee += Number(oeeData.oee || 0);
    sumAvail += Number(oeeData.availability || 0);
    sumPerf += Number(oeeData.performance || 0);
    sumQual += Number(oeeData.quality || 0);
  });

  const count = logs.length;

  return {
    avgOEE: (sumOee / count).toFixed(1),
    avgAvailability: (sumAvail / count).toFixed(1),
    avgPerformance: (sumPerf / count).toFixed(1),
    avgQuality: (sumQual / count).toFixed(1),
    totalPlannedTimeMins: totalPlanned,
    totalOperatingTimeMins: totalOp,
    totalLossesMins: totalDowntime,
    totalOutput: totalOut,
    totalGood: totalGoodQty,
    totalScrap: totalScrapQty
  };
}

export async function getPeriodicAnalytics(periodType = 'daily', specificDate = null, machineCode = null) {
  const allLogs = await getProductionEntries(machineCode);
  const baseAnalytics = await getDashboardAnalytics(machineCode);

  let filteredLogs = allLogs;
  const now = new Date();

  if (periodType === 'daily') {
    const targetDate = specificDate || now.toISOString().split('T')[0];
    filteredLogs = allLogs.filter(log => {
      const logDate = (log.created_at || log.shift_date || '').split('T')[0];
      return logDate === targetDate;
    });
  } else if (periodType === 'weekly') {
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    filteredLogs = allLogs.filter(log => new Date(log.created_at || log.shift_date) >= sevenDaysAgo);
  } else if (periodType === 'monthly') {
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    filteredLogs = allLogs.filter(log => new Date(log.created_at || log.shift_date) >= thirtyDaysAgo);
  }

  const oeeMetrics = calculateTimeWeightedOEE(filteredLogs);

  return {
    ...baseAnalytics,
    ...oeeMetrics,
    periodType,
    entriesCount: filteredLogs.length,
    logs: filteredLogs
  };
}
