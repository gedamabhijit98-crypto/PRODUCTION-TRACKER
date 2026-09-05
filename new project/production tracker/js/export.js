/**
 * CSV / Data Export Utilities for Production & OEE Tracker
 */
import { LOSS_FIELDS } from './machines.js';

export function exportEntriesToCSV(entries, filenamePrefix = 'Shopfloor_Report') {
  if (!entries || entries.length === 0) {
    alert('No production & OEE records available to export.');
    return;
  }

  const baseHeaders = [
    'Log ID',
    'Date',
    'Shift',
    'Shift Hours',
    'Machine Code',
    'Machine Name',
    'Operator Name',
    'Part 1 Name',
    'Part 1 Cycle (min)',
    'Part 1 Qty',
    'Part 2 Name',
    'Part 2 Cycle (min)',
    'Part 2 Qty',
    'Part 3 Name',
    'Part 3 Cycle (min)',
    'Part 3 Qty',
    'Total Produced',
    'Rejected Qty',
    'Good Qty',
    'Planned Time (min)',
    'Total Loss (min)',
    'Operating Time (min)',
    'Ideal Run Time (min)',
    'Availability %',
    'Performance %',
    'Quality %',
    'OEE %'
  ];

  // Append 13 loss column headers
  const lossHeaders = LOSS_FIELDS.map(f => f.label + ' (min)');
  const allHeaders = [...baseHeaders, ...lossHeaders, 'Remarks / Root Cause', 'Created At'];

  const escapeField = (val) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = entries.map(e => {
    const baseRow = [
      escapeField(e.id),
      escapeField(e.log_date),
      escapeField(e.shift),
      e.shift_hours,
      escapeField(e.machine_code),
      escapeField(e.machine_name),
      escapeField(e.operator_name),
      escapeField(e.part1_name),
      e.part1_cycle_time,
      e.part1_qty,
      escapeField(e.part2_name),
      e.part2_cycle_time,
      e.part2_qty,
      escapeField(e.part3_name),
      e.part3_cycle_time,
      e.part3_qty,
      e.total_qty,
      e.rejected_qty,
      e.good_qty,
      e.planned_time_mins,
      e.total_losses_mins,
      e.operating_time_mins,
      e.ideal_run_time_mins,
      e.availability_rate,
      e.performance_rate,
      e.quality_rate,
      e.oee_rate
    ];

    const lossRow = LOSS_FIELDS.map(f => Number(e[f.key]) || 0);

    return [
      ...baseRow,
      ...lossRow,
      escapeField(e.remarks),
      escapeField(e.created_at)
    ];
  });

  const csvContent = [allHeaders.join(','), ...rows.map(r => r.join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  const todayStr = new Date().toISOString().split('T')[0];
  link.setAttribute('href', url);
  link.setAttribute('download', `${filenamePrefix}_${todayStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
