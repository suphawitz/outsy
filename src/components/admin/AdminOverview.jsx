import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../client';
import { loadDashboardData } from '../../lib/dashboardData';
import { bangkokDay, monthDates, summarizeDashboard, dashboardMonths, reportCharts, dateRange } from '../../lib/dashboard';
import './dashboard.css';
import DashboardReports, { exportReport } from './DashboardReports';

const number = value => Number(value || 0).toLocaleString('th-TH', { maximumFractionDigits: 1 });
const money = value => `฿${Number(value || 0).toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
const dateLabel = day => day ? new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Bangkok' }).format(new Date(`${day.length === 7 ? `${day}-01` : day}T00:00:00Z`)) : 'ไม่ระบุ';
const timeLabel = value => new Intl.DateTimeFormat('th-TH', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Bangkok' }).format(new Date(value));
function Panel({ title, subtitle, children, className = '' }) {
  return <section className={`dashboard-panel ${className}`}><div className="dashboard-panel-heading"><h3>{title}</h3>{subtitle && <p>{subtitle}</p>}</div>{children}</section>;
}
function Metric({ label, value, note, tone = '' }) {
  return <article className={`dashboard-metric ${tone}`}><span>{label}</span><strong>{value}</strong><small>{note}</small></article>;
}
function Empty({ children = 'ยังไม่มีข้อมูลในช่วงที่เลือก' }) { return <p className="dashboard-empty">{children}</p>; }
export default function AdminOverview({ onNavigate }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatedAt, setUpdatedAt] = useState(null);
  const [refresh, setRefresh] = useState(0);
  const [period, setPeriod] = useState(() => bangkokDay().slice(0, 7));
  const [rangeOpen, setRangeOpen] = useState(false);
  const [customRange, setCustomRange] = useState(() => ({ from: bangkokDay(), to: bangkokDay() }));
  const [reportYear, setReportYear] = useState(() => Number(bangkokDay().slice(0, 4)));
  const [showAllPackages, setShowAllPackages] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    let disposed = false;
    setLoading(true); setError('');
    loadDashboardData(supabase, controller.signal).then(value => {
      if (!disposed) { setData(value); setUpdatedAt(new Date()); }
    }).catch(err => { if (!disposed) setError(err.message); }).finally(() => { if (!disposed) setLoading(false); });
    return () => { disposed = true; controller.abort(); };
  }, [refresh]);
  const today = bangkokDay();
  const dates = useMemo(() => {
    try { return period === 'range' ? dateRange(customRange.from, customRange.to) : monthDates(period, today); }
    catch { return null; }
  }, [period, today, customRange.from, customRange.to]);
  const result = useMemo(() => {
    if (!data) return {};
    if (!dates) return { validation: 'กรุณาเลือกช่วงวันที่ให้ครบถ้วน โดยวันที่เริ่มต้นต้องไม่เกินวันที่สิ้นสุด' };
    try { return { summary: summarizeDashboard(data, {...dates, today, packageId: 'ALL'}) }; }
    catch (err) { return { validation: err.message }; }
  }, [data, dates, today]);
  const months = useMemo(() => dashboardMonths(data?.bookings || [], today), [data, today]);
  const year = period === 'all' || period === 'range' ? reportYear : Number(period.slice(0, 4));
  const report = useMemo(() => data && dates ? reportCharts(data, {...dates, year, limitToRange: period === 'range'}) : null, [data, dates, year, period]);
  const summary = result.summary;
  const m = summary?.metrics;
  const ranked = summary?.ranking.slice(0,showAllPackages ? undefined : 5) || [];
  const navigate = (tab, status) => onNavigate(tab, status);
  return <div className="admin-overview">
    <header className="dashboard-header">
      <div><h2>ภาพรวมระบบ</h2></div>
      <div className="dashboard-header-actions">
        <select aria-label="ช่วงเวลาการจอง" value={period} onChange={e => { setPeriod(e.target.value); setRangeOpen(false); }}>
          <option value="all">ทั้งหมด</option>
          {period === 'range' && <option value="range" disabled>ช่วงวันที่กำหนดเอง</option>}
          {months.map(month => <option key={month} value={month}>{new Intl.DateTimeFormat('th-TH', {month:'long',year:'numeric',timeZone:'Asia/Bangkok'}).format(new Date(`${month}-01T00:00:00Z`))}</option>)}
        </select>
        <button type="button" className="dashboard-range-toggle" aria-expanded={rangeOpen} aria-pressed={period === 'range'} aria-controls="dashboard-date-range" onClick={() => {
          if (!rangeOpen && period !== 'range') {
            const initial = dates?.from ? dates : { from: today, to: today };
            setCustomRange(initial);
            setReportYear(Number(initial.from.slice(0, 4)));
            setPeriod('range');
          }
          setRangeOpen(open => !open);
        }}>📅 เลือกช่วงวันที่</button>
        <button className="dashboard-export" type="button" disabled={loading || !!error || !report} onClick={() => exportReport(report, year, dates)}>↓ Export CSV</button>
        <button type="button" disabled={loading} onClick={() => setRefresh(n=>n+1)}>{loading ? 'กำลังโหลด…' : 'รีเฟรชข้อมูล'}</button>
      </div>
        {rangeOpen && <div className="dashboard-date-range dashboard-date-range-panel" id="dashboard-date-range">
          <label>ตั้งแต่วันที่<input type="date" value={customRange.from} max={customRange.to || undefined} onChange={e => { setCustomRange({...customRange, from: e.target.value}); if (e.target.value) setReportYear(Number(e.target.value.slice(0, 4))); }} /></label>
          <span aria-hidden="true">–</span>
          <label>ถึงวันที่<input type="date" value={customRange.to} min={customRange.from || undefined} onChange={e => setCustomRange({...customRange, to: e.target.value})} /></label>
        </div>}
    </header>
    {updatedAt && <p className="dashboard-caption">ข้อมูล ณ {timeLabel(updatedAt)} · เวลาไทย · กดรีเฟรชเพื่อรับข้อมูลล่าสุด</p>}
    {loading ? <div role="status" className="dashboard-message">กำลังรวบรวมข้อมูลการจอง แพ็กเกจ และคำขอคืนเงิน…</div> : error ? <div role="alert" className="dashboard-message dashboard-error"><strong>โหลดข้อมูลภาพรวมไม่สำเร็จ</strong><p>{error}</p><p>ยังไม่แสดงยอดรวม เพราะข้อมูลอาจไม่ครบ กรุณารีเฟรชอีกครั้ง</p></div> : result.validation ? <div role="alert" className="dashboard-message dashboard-error">{result.validation}</div> : summary && <>
      <p className="dashboard-scope">สรุปการจอง: {dates.from ? dateLabel(dates.from) : 'ตั้งแต่เริ่มใช้งาน'} – {dateLabel(dates.to)}</p>
      <div className="dashboard-metrics">
        <Metric label="การจองทั้งหมด" value={number(m.bookings)} note="รวมทุกสถานะในช่วงที่เลือก" />
        <Metric label="ยอดจองที่ยืนยันแล้ว" value={money(m.confirmedValue)} note="ชำระเงินแล้ว + ทริปเสร็จสิ้น" tone="cyan" />
        <Metric label="ยอดรอชำระเงิน" value={money(m.pendingValue)} note="ยังไม่รวมเป็นยอดยืนยัน" tone="yellow" />
        <Metric label="ยอดรอตรวจสอบ" value={money(m.reviewValue)} note="แนบสลิปแล้ว รอ admin ยืนยัน" tone="pink" />
      </div>
      <DashboardReports data={data} dates={dates} report={report} year={year} onYearChange={setReportYear} rangeMode={period === 'range'} />
      <header className="dashboard-header dashboard-work-heading"><div><h2>งานที่ต้องจัดการตอนนี้</h2><p>นับงานค้างทั้งหมด ไม่จำกัดเดือนที่เลือก</p></div></header>
      <section className="dashboard-panel" aria-label="รายการงานที่ต้องจัดการ">
        <div className="dashboard-work">{[['bookings','รอตรวจสอบยอด','ตรวจสอบสลิป',summary.work.review,'cyan'],['bookings','รอชำระเงิน','ติดตามการชำระเงิน',summary.work.pending,'yellow'],['reschedule',null,'คำขอเปลี่ยนวัน',summary.work.reschedule,'mint'],['refund',null,'คำขอคืนเงิน',summary.work.pendingRefunds,'pink']].map(([tab,status,label,count,tone])=><button className={tone} key={label} type="button" onClick={()=>navigate(tab,status)}><span>{label}</span><strong>{number(count)} <small>รายการ</small></strong><span>ไปจัดการ →</span></button>)}</div>
        <p className="dashboard-caption">กดเพื่อเปิดแท็บจัดการและสถานะที่เกี่ยวข้อง</p>
      </section>
      <div className="dashboard-columns">
        <Panel title="ติดตามการคืนเงิน" subtitle="คำขอทั้งหมด นับหนึ่งครั้งต่อการจอง"><div className="dashboard-refunds"><Metric label="รอดำเนินการ" value={money(summary.work.pendingRefundValue)} note={`${number(summary.work.pendingRefunds)} การจอง`} tone="pink" /><Metric label="ดำเนินการคืนเงินแล้ว" value={money(summary.work.completedRefundValue)} note={`${number(summary.work.completedRefunds)} การจอง`} tone="cyan" /></div><p className="dashboard-caption">ประมาณยอดคืนจากมูลค่าการจองที่บันทึกไว้ เนื่องจากไม่มีฟิลด์ยอดโอนคืนจริงและวันที่คืนเงิน ไม่สามารถสรุปยอดคืนเงินรายเดือนได้</p>{summary.work.unknownRefunds>0 && <p className="dashboard-warning">คำขอที่มีสถานะอื่น {number(summary.work.unknownRefunds)} รายการ กรุณาตรวจสอบ</p>}<button type="button" onClick={()=>navigate('refund')}>ดูคำขอคืนเงิน →</button></Panel>
        <Panel title="แพ็กเกจที่มีการจอง" subtitle="เรียงตามจำนวนการจองที่ยังมีผล แล้วตามยอดยืนยัน"><p className="dashboard-caption">แพ็กเกจในระบบ {number(m.packages)} · มีการจองในช่วงนี้ {number(summary.ranking.length)}</p>{ranked.length ? <div className="dashboard-ranking">{ranked.map((p,index)=><article key={p.id}><span className="dashboard-rank">{index+1}</span><div><b>{p.name}</b><small>{p.id} · {number(p.activeCount)} การจองที่ยังมีผล / ทั้งหมด {number(p.count)} · {number(p.people)} ผู้เดินทาง</small><meter min="0" max={Math.max(1,summary.ranking[0].activeCount)} value={p.activeCount} aria-label={`${p.name}: ${p.activeCount} การจองที่ยังมีผล`} /></div><strong>{money(p.confirmedValue)}<small>ยอดยืนยัน</small></strong></article>)}</div> : <Empty />}{summary.ranking.length>5 && <button className="dashboard-more" type="button" onClick={()=>setShowAllPackages(!showAllPackages)}>{showAllPackages ? 'แสดง 5 อันดับแรก' : `แสดงทั้งหมด ${number(summary.ranking.length)} แพ็กเกจ`}</button>}</Panel>
      </div>
      <p className="dashboard-caption">ยอดยืนยันอิงสถานะปัจจุบันของการจอง ไม่ใช่รายได้ทางบัญชีหรือกำไร ส่วนงานค้างและคำขอคืนเงินแสดงข้อมูลทั้งหมดโดยไม่จำกัดเดือนที่เลือก</p>
    </>}
  </div>;
}
