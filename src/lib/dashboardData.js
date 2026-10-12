// Uses the existing admin session and SELECT policies. No mutations or RPCs.
export async function readAllRows(client, table, columns, primaryKey, signal) {
  const rows = [];
  const ids = new Set();
  let expected = null;
  do {
    if (signal?.aborted) throw new Error('ยกเลิกการโหลดข้อมูล');
    let query = client.from(table).select(columns, { count: 'exact' }).order(primaryKey, { ascending: true }).range(rows.length, rows.length + 499);
    if (signal) query = query.abortSignal(signal);
    const { data, error, count } = await query;
    if (error) throw new Error(`${table}: ${error.message}`);
    if (!Number.isInteger(count) || count < 0) throw new Error(`${table}: ไม่สามารถตรวจสอบจำนวนข้อมูลทั้งหมดได้`);
    if (expected !== null && expected !== count) throw new Error(`${table}: ข้อมูลเปลี่ยนระหว่างโหลด กรุณารีเฟรชอีกครั้ง`);
    expected = count;
    if (!Array.isArray(data) || (!data.length && rows.length < expected)) throw new Error(`${table}: โหลดข้อมูลไม่ครบ กรุณารีเฟรชอีกครั้ง`);
    for (const row of data) {
      if (row[primaryKey] == null || ids.has(String(row[primaryKey]))) throw new Error(`${table}: ข้อมูลเปลี่ยนระหว่างโหลด กรุณารีเฟรชอีกครั้ง`);
      ids.add(String(row[primaryKey]));
      rows.push(row);
    }
    if (rows.length > expected) throw new Error(`${table}: จำนวนข้อมูลไม่ตรง กรุณารีเฟรชอีกครั้ง`);
  } while (rows.length < expected);
  return rows;
}
export async function loadDashboardData(client, signal) {
  const sources = [
    ['bookings', 'booking_id,package_id,travel_date,number_people,total_price,booking_status,created_at'],
    ['Tour_Packages', 'package_id,package_name,province_id,price,status,category_name'],
    ['refund_requests', 'id,booking_id,status,created_at'],
    ['provinces', 'province_id,provincename'],
  ];
  const results = await Promise.allSettled(sources.map(([table, fields]) => readAllRows(client, table, fields, fields.split(',')[0], signal)));
  const errors = results.filter(r => r.status === 'rejected').map(r => r.reason.message);
  if (errors.length) throw new Error(errors.join(' · '));
  const [bookings, packages, refunds, provinces] = results.map(r => r.value);
  return { bookings, packages, schedules: [], refunds, provinces };
}
