const dayFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' });
export function bangkokDay(value = new Date()) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const parts = Object.fromEntries(dayFormatter.formatToParts(date).map(p => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
export function validDay(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
function shiftDay(day, offset) {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}
export function periodDates(preset, today = bangkokDay()) {
  if (!validDay(today)) throw new Error('วันที่ปัจจุบันไม่ถูกต้อง');
  return { from: preset === 'all' ? '' : preset === 'month' ? `${today.slice(0, 7)}-01` : shiftDay(today, preset === '7' ? -6 : -29), to: today };
}
export const STATUS_GROUPS = [
  { key: 'pending', label: 'รอชำระเงิน', color: '#d97706' },
  { key: 'review', label: 'รอตรวจสอบยอด', color: '#0891b2' },
  { key: 'paid', label: 'ชำระเงินแล้ว', color: '#059669' },
  { key: 'completed', label: 'ทริปเสร็จสิ้น', color: '#573e33' },
  { key: 'reschedule', label: 'ขอเปลี่ยนวัน', color: '#6366f1' },
  { key: 'cancelled', label: 'ยกเลิก', color: '#e7191f' },
  { key: 'refundPending', label: 'ขอคืนเงิน', color: '#db2777' },
  { key: 'refunded', label: 'คืนเงินแล้ว', color: '#94a3b8' },
  { key: 'other', label: 'สถานะอื่น / ไม่ระบุ', color: '#64748b' },
];
export function statusGroup(status) {
  const s = String(status || '').trim();
  if (s === 'คืนเงินเรียบร้อยแล้ว' || s === 'คืนเงินแล้ว') return 'refunded';
  if (s.includes('ยกเลิก')) return 'cancelled';
  if (s.includes('ขอคืนเงิน')) return 'refundPending';
  if (s === 'ทริปเสร็จสิ้น' || s === 'เสร็จสิ้น') return 'completed';
  if (s === 'ชำระเงินแล้ว') return 'paid';
  if (s === 'รอตรวจสอบยอด') return 'review';
  if (s === 'รอชำระเงิน') return 'pending';
  if (s === 'ขอเปลี่ยนวันเดินทาง') return 'reschedule';
  return 'other';
}
const amount = value => Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : 0;
const people = value => Number.isInteger(Number(value)) && Number(value) > 0 ? Number(value) : 0;
const active = group => ['pending', 'review', 'paid', 'completed', 'reschedule'].includes(group);
const confirmed = group => ['paid', 'completed'].includes(group);
const sum = (rows, field) => rows.reduce((total, row) => total + row[field], 0);
const customerKey = b => b.user_id ? `id:${b.user_id}` : b.customer_email?.trim() ? `email:${b.customer_email.trim().toLowerCase()}` : '';

export function summarizeDashboard(data, { from = '', to, today = bangkokDay(), packageId = 'ALL' }) {
  if ((from && !validDay(from)) || !validDay(to) || (from && from > to)) throw new Error('ช่วงวันที่ไม่ถูกต้อง กรุณาเลือกวันเริ่มต้นก่อนวันสิ้นสุด');
  const packageMap = new Map(data.packages.map(p => [String(p.package_id), p]));
  const refundMap = new Map();
  let duplicateRefunds = 0;
  for (const r of data.refunds) {
    const key = r.booking_id == null ? `orphan:${r.id}` : String(r.booking_id);
    if (refundMap.has(key)) duplicateRefunds++;
    const previous = refundMap.get(key);
    if (!previous || (previous.status !== 'คืนเงินแล้ว' && (r.status === 'คืนเงินแล้ว' || Number(r.id) > Number(previous.id)))) refundMap.set(key, r);
  }
  const scoped = data.bookings.filter(b => packageId === 'ALL' || String(b.package_id) === String(packageId)).map(b => {
    const refund = refundMap.get(String(b.booking_id));
    const group = refund?.status === 'คืนเงินแล้ว' ? 'refunded' : refund ? 'refundPending' : statusGroup(b.booking_status);
    return { ...b, day: b.created_at ? bangkokDay(b.created_at) : '', group, value: amount(b.total_price), people: people(b.number_people), packageName: packageMap.get(String(b.package_id))?.package_name || b.package_id || 'ไม่ระบุแพ็กเกจ' };
  });
  const rows = scoped.filter(b => b.day && (!from || b.day >= from) && b.day <= to);
  const knownCustomers = new Map();
  rows.forEach(b => { const key = customerKey(b); if (key) knownCustomers.set(key, (knownCustomers.get(key) || 0) + 1); });
  const confirmedRows = rows.filter(b => confirmed(b.group));
  const activeRows = rows.filter(b => active(b.group));
  const groups = STATUS_GROUPS.map(g => ({ ...g, count: rows.filter(b => b.group === g.key).length, value: sum(rows.filter(b => b.group === g.key), 'value') }));
  const work = {
    review: scoped.filter(b => b.group === 'review').length,
    pending: scoped.filter(b => b.group === 'pending').length,
    reschedule: scoped.filter(b => b.group === 'reschedule').length,
    pendingRefunds: 0, pendingRefundValue: 0, completedRefunds: 0, completedRefundValue: 0, unknownRefunds: 0,
  };
  const bookingMap = new Map(data.bookings.map(b => [String(b.booking_id), b]));
  for (const r of refundMap.values()) {
    const b = bookingMap.get(String(r.booking_id));
    if (packageId !== 'ALL' && String(b?.package_id) !== String(packageId)) continue;
    if (r.status === 'คืนเงินแล้ว') { work.completedRefunds++; work.completedRefundValue += amount(b?.total_price); }
    else if (r.status === 'รอดำเนินการ') { work.pendingRefunds++; work.pendingRefundValue += amount(b?.total_price); }
    else work.unknownRefunds++;
  }
  const byRound = new Map();
  for (const b of scoped) {
    if (!active(b.group) || !validDay(b.travel_date)) continue;
    const key = `${b.package_id}|${b.travel_date}`;
    const row = byRound.get(key) || { reserved: 0, confirmed: 0 };
    row.reserved += b.people;
    if (confirmed(b.group)) row.confirmed += b.people;
    byRound.set(key, row);
  }
  const upcoming = data.schedules.filter(s => validDay(s.travel_date) && s.travel_date >= today && (packageId === 'ALL' || String(s.package_id) === String(packageId))).map(s => {
    const seats = byRound.get(`${s.package_id}|${s.travel_date}`) || { reserved: 0, confirmed: 0 };
    const capacity = people(s.max_capacity);
    const minimum = people(s.min_capacity);
    const closed = /cancel|closed|ยกเลิก|ปิด/i.test(s.status || '');
    return { ...s, ...seats, capacity, minimum, closed, remaining: Math.max(0, capacity - seats.reserved), belowMinimum: !closed && seats.confirmed < minimum, counterMismatch: s.booked_count == null || !Number.isFinite(Number(s.booked_count)) || Number(s.booked_count) !== seats.reserved, overCapacity: seats.reserved > capacity, packageName: packageMap.get(String(s.package_id))?.package_name || s.package_id };
  }).sort((a, b) => a.travel_date.localeCompare(b.travel_date) || String(a.schedule_id).localeCompare(String(b.schedule_id)));
  const rankingMap = new Map();
  for (const b of rows) {
    const item = rankingMap.get(String(b.package_id)) || { id: b.package_id, name: b.packageName, count: 0, activeCount: 0, people: 0, confirmedValue: 0 };
    item.count++;
    if (active(b.group)) { item.activeCount++; item.people += b.people; }
    if (confirmed(b.group)) item.confirmedValue += b.value;
    rankingMap.set(String(b.package_id), item);
  }
  const ranking = [...rankingMap.values()].sort((a, b) => b.activeCount - a.activeCount || b.confirmedValue - a.confirmedValue);
  const start = from || rows.reduce((earliest, b) => b.day < earliest ? b.day : earliest, to);
  const monthly = (new Date(`${to}T00:00:00Z`) - new Date(`${start}T00:00:00Z`)) / 86400000 > 62;
  const buckets = new Map();
  if (monthly) {
    let month = `${start.slice(0, 7)}-01`;
    while (month <= to) { buckets.set(month.slice(0, 7), { date: month.slice(0, 7), count: 0, confirmedValue: 0 }); const d = new Date(`${month}T00:00:00Z`); d.setUTCMonth(d.getUTCMonth() + 1); month = d.toISOString().slice(0, 10); }
  } else for (let day = start; day <= to; day = shiftDay(day, 1)) buckets.set(day, { date: day, count: 0, confirmedValue: 0 });
  for (const b of rows) { const bucket = buckets.get(monthly ? b.day.slice(0, 7) : b.day); if (bucket) { bucket.count++; if (confirmed(b.group)) bucket.confirmedValue += b.value; } }
  const knownIds = new Set(data.schedules.map(s => `${s.package_id}|${s.travel_date}`));
  const quality = {
    invalidDates: scoped.filter(b => !b.day || !validDay(b.travel_date)).length,
    invalidAmounts: scoped.filter(b => b.total_price == null || !Number.isFinite(Number(b.total_price)) || Number(b.total_price) < 0).length,
    invalidTravelers: scoped.filter(b => !people(b.number_people)).length,
    unknownStatuses: scoped.filter(b => statusGroup(b.booking_status) === 'other').length,
    missingPackages: scoped.filter(b => !packageMap.has(String(b.package_id))).length,
    missingSchedules: scoped.filter(b => active(b.group) && validDay(b.travel_date) && !knownIds.has(`${b.package_id}|${b.travel_date}`)).length,
    duplicateRefunds: packageId === 'ALL' ? duplicateRefunds : data.refunds.filter(r => String(bookingMap.get(String(r.booking_id))?.package_id) === String(packageId)).length - [...refundMap.values()].filter(r => String(bookingMap.get(String(r.booking_id))?.package_id) === String(packageId)).length,
    orphanRefunds: packageId === 'ALL' ? [...refundMap.values()].filter(r => !bookingMap.has(String(r.booking_id))).length : 0,
    counters: upcoming.filter(s => s.counterMismatch).length,
    invalidCapacity: upcoming.filter(s => !s.capacity || !s.minimum || s.minimum > s.capacity).length,
    overCapacity: upcoming.filter(s => s.overCapacity).length,
  };
  const categories = new Map();
  for (const b of activeRows) { const name = packageMap.get(String(b.package_id))?.category_name || 'ไม่ระบุหมวดหมู่'; categories.set(name, (categories.get(name) || 0) + 1); }
  return {
    rows: [...rows].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))), groups, work, upcoming, ranking, quality,
    trend: [...buckets.values()], monthly,
    categories: [...categories].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
    metrics: { bookings: rows.length, totalValue: sum(rows, 'value'), confirmedValue: sum(confirmedRows, 'value'), pendingValue: sum(rows.filter(b => b.group === 'pending'), 'value'), reviewValue: sum(rows.filter(b => b.group === 'review'), 'value'), activeTravelers: sum(activeRows, 'people'), confirmedTravelers: sum(confirmedRows, 'people'), uniqueCustomers: knownCustomers.size, repeatCustomers: [...knownCustomers.values()].filter(count => count > 1).length, anonymousBookings: rows.filter(b => !customerKey(b)).length, cancelled: rows.filter(b => statusGroup(b.booking_status) === 'cancelled').length, refunded: rows.filter(b => b.group === 'refunded').length, averageValue: activeRows.length ? sum(activeRows, 'value') / activeRows.length : 0, confirmedRate: rows.length ? confirmedRows.length / rows.length * 100 : 0, packages: data.packages.filter(p => packageId === 'ALL' || String(p.package_id) === String(packageId)).length },
  };
}

export function monthDates(month, today = bangkokDay()) {
  if (month === 'all') return { from: '', to: today };
  if (!/^\d{4}-\d{2}$/.test(month) || !validDay(`${month}-01`)) throw new Error('กรุณาเลือกเดือนที่ถูกต้อง');
  const first = `${month}-01`;
  const last = new Date(`${first}T00:00:00Z`);
  last.setUTCMonth(last.getUTCMonth() + 1, 0);
  return { from: first, to: last.toISOString().slice(0, 10) };
}

export function reportCharts(data, { from = '', to, year }) {
  const selected = summarizeDashboard(data, { from, to, today: to });
  const annual = summarizeDashboard(data, { from: `${year}-01-01`, to: `${year}-12-31`, today: to });
  const packages = new Map(data.packages.map(p => [String(p.package_id), p]));
  const provinces = new Map((data.provinces || []).map(p => [String(p.province_id), p.provincename]));
  const totals = new Map();
  for (const b of selected.rows) {
    if (!active(b.group) || !b.people) continue;
    const name = provinces.get(String(packages.get(String(b.package_id))?.province_id)) || 'ไม่ระบุจังหวัด';
    totals.set(name, (totals.get(name) || 0) + b.people);
  }
  const ranked = [...totals].map(([name, people]) => ({ name, people })).sort((a, b) => b.people - a.people);
  const months = Array.from({ length: 12 }, (_, index) => ({ month: `${year}-${String(index + 1).padStart(2, '0')}`, count: 0, value: 0 }));
  for (const b of annual.rows) { const bucket = months[Number(b.day.slice(5, 7)) - 1]; bucket.count++; if (confirmed(b.group)) bucket.value += b.value; }
  return { topPackages: selected.ranking.filter(p => p.activeCount > 0).slice(0, 5), provinces: ranked, months };
}

export function dashboardMonths(bookings = [], today = bangkokDay()) {
  const months = new Set();
  const current = new Date(`${today.slice(0, 7)}-01T00:00:00Z`);
  for (let i = 0; i < 12; i++) {
    months.add(current.toISOString().slice(0, 7));
    current.setUTCMonth(current.getUTCMonth() - 1);
  }
  bookings.forEach(b => { const day = b.created_at ? bangkokDay(b.created_at) : ''; if (validDay(day)) months.add(day.slice(0, 7)); });
  return [...months].sort((a, b) => b.localeCompare(a));
}
