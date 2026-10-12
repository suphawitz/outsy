import { useMemo, useState } from 'react';
import { bangkokDay, reportCharts } from '../../lib/dashboard';
const COLORS = ['#163247', '#367350', '#2c625b', '#84a564', '#be9447', '#ea9f3e'];
const MONTHS = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
const num = value => Number(value).toLocaleString('th-TH', { maximumFractionDigits: 0 });
const compact = value => new Intl.NumberFormat('th-TH', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
function ReportPanel({ title, note, children }) {
  return <section className="dashboard-panel"><div className="dashboard-panel-heading"><h3>{title}</h3><p>{note}</p></div>{children}</section>;
}
function DataTable({ title, columns, rows }) {
  return <details className="dashboard-details"><summary>{title}</summary><div className="dashboard-table-scroll" role="region" aria-label={title} tabIndex={0}><table><thead><tr>{columns.map(c => <th key={c} scope="col">{c}</th>)}</tr></thead><tbody>{rows.map((row, i) => <tr key={i}>{row.map((value, j) => <td key={j}>{value}</td>)}</tr>)}</tbody></table></div></details>;
}
function PackageBars({ rows }) {
  if (!rows.length) return <p className="dashboard-empty">ไม่มีการจองที่ยังมีผลในช่วงที่เลือก</p>;
  const max = Math.max(1, ...rows.map(r => r.activeCount));
  return <><div className="report-bars">{rows.map((p, i) => <div className="report-bar-row" key={p.id}><div className="report-bar-label"><b>{p.name}</b><small>{p.id}</small></div><div className="report-bar-track"><div style={{width:`${p.activeCount/max*100}%`,background:COLORS[i]}} /><strong>{num(p.activeCount)}</strong></div></div>)}</div><DataTable title="ดูรายละเอียด Top 5" columns={['แพ็กเกจ','การจองที่ยังมีผล','ผู้เดินทาง','ยอดยืนยัน (บาท)']} rows={rows.map(p=>[p.name,num(p.activeCount),num(p.people),num(p.confirmedValue)])} /></>;
}
function ProvinceDonut({ rows }) {
  const total = rows.reduce((n,p)=>n+p.people,0);
  if (!total) return <p className="dashboard-empty">ไม่มีข้อมูลผู้เดินทางในช่วงที่เลือก</p>;
  const slices = rows.length > 5 ? [...rows.slice(0,5),{name:'จังหวัดอื่น ๆ',people:rows.slice(5).reduce((n,p)=>n+p.people,0)}] : rows;
  let offset = 0;
  return <><div className="dashboard-status"><svg viewBox="0 0 180 180" role="img" aria-label={`สัดส่วนผู้เดินทางตามจังหวัดหลัก รวม ${num(total)} คน`}><title>จังหวัดหลักของแพ็กเกจที่จอง</title><circle cx="90" cy="90" r="65" fill="none" stroke="#edf2f7" strokeWidth="25" />{slices.map((p,i)=>{const length=p.people/total*100,start=offset;offset+=length;return <circle key={p.name} cx="90" cy="90" r="65" pathLength="100" fill="none" stroke={COLORS[i]} strokeWidth="25" strokeDasharray={`${length} ${100-length}`} strokeDashoffset={-start} transform="rotate(-90 90 90)"><title>{p.name}: {num(p.people)} คน ({(p.people/total*100).toFixed(1)}%)</title></circle>;})}<text x="90" y="88" textAnchor="middle" fontSize="27" fontWeight="800" fill="#163247">{num(total)}</text><text x="90" y="112" textAnchor="middle" fontSize="12" fill="#738096">ผู้เดินทาง</text></svg><ul className="dashboard-legend">{slices.map((p,i)=><li key={p.name}><span className="dashboard-dot" style={{background:COLORS[i]}} /><span>{p.name}</span><b>{num(p.people)}</b><small>{(p.people/total*100).toFixed(1)}%</small></li>)}</ul></div><DataTable title="ดูข้อมูลทุกจังหวัด" columns={['จังหวัดหลัก','ผู้เดินทาง (คน)','สัดส่วน']} rows={rows.map(p=>[p.name,num(p.people),`${(p.people/total*100).toFixed(1)}%`])} /></>;
}
function MonthlyLines({ rows }) {
  const width=840,height=280,left=65,right=55,top=20,bottom=45;
  const plotHeight=height-top-bottom;
  const maxMoney=Math.max(1,...rows.map(r=>r.value)),maxCount=Math.max(1,...rows.map(r=>r.count));
  const x=i=>left+i*(width-left-right)/11;
  const y=(value,max)=>top+plotHeight*(1-value/max);
  const path=(key,max)=>rows.map((r,i)=>`${i?'L':'M'}${x(i)},${y(r[key],max)}`).join(' ');
  return <><div className="report-line-legend"><span><i style={{background:COLORS[0]}} />ยอดยืนยัน (บาท)</span><span><i style={{background:COLORS[1]}} />การจอง (รายการ)</span></div><svg className="dashboard-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="ยอดจองยืนยันและจำนวนการจองรายเดือน ใช้แกนยอดเงินทางซ้ายและแกนจำนวนทางขวา"><title>ยอดจองยืนยันและจำนวนการจอง 12 เดือน</title>{[0,.25,.5,.75,1].map(r=><g key={r}><line x1={left} x2={width-right} y1={y(r,1)} y2={y(r,1)} stroke="#e6ebf1" /><text x={left-10} y={y(r,1)+4} textAnchor="end" fontSize="11" fill={COLORS[0]}>฿{compact(maxMoney*r)}</text><text x={width-right+10} y={y(r,1)+4} fontSize="11" fill={COLORS[1]}>{compact(maxCount*r)}</text></g>)}<path d={`${path('value',maxMoney)} L${x(11)},${top+plotHeight} L${x(0)},${top+plotHeight} Z`} fill={COLORS[0]} fillOpacity=".06" /><path d={path('value',maxMoney)} fill="none" stroke={COLORS[0]} strokeWidth="3" /><path d={path('count',maxCount)} fill="none" stroke={COLORS[1]} strokeWidth="3" />{rows.map((r,i)=><g key={r.month}><circle cx={x(i)} cy={y(r.value,maxMoney)} r="4" fill={COLORS[0]} stroke="#fff" tabIndex={0}><title>{MONTHS[i]}: ยอดยืนยัน ฿{num(r.value)}</title></circle><circle cx={x(i)} cy={y(r.count,maxCount)} r="4" fill={COLORS[1]} stroke="#fff" tabIndex={0}><title>{MONTHS[i]}: การจอง {num(r.count)} รายการ</title></circle><text x={x(i)} y={height-18} textAnchor="middle" fontSize="11" fill="#738096">{MONTHS[i]}</text></g>)}</svg><DataTable title="ดูตัวเลขรายเดือน" columns={['เดือน','ยอดยืนยัน (บาท)','การจองทุกสถานะ (รายการ)']} rows={rows.map((r,i)=>[MONTHS[i],num(r.value),num(r.count)])} /></>;
}
function exportReport(report, year, dates) {
  const cell = value => `"${String(value).replace(/^[=+\-@\t\r]/,"'$&").replaceAll('"','""')}"`;
  const rows=[['รายงาน OUTSY',dates.from||'ทั้งหมด',dates.to],[],['Top 5 แพ็กเกจ','การจองที่ยังมีผล','ผู้เดินทาง','ยอดยืนยัน (บาท)'],...report.topPackages.map(p=>[p.name,p.activeCount,p.people,p.confirmedValue]),[],['จังหวัดหลัก','ผู้เดินทาง'],...report.provinces.map(p=>[p.name,p.people]),[],[`รายเดือน ปี ${year+543}`,'ยอดยืนยัน (บาท)','จำนวนการจอง'],...report.months.map(r=>[r.month,r.value,r.count])];
  const blob=new Blob(['\uFEFF'+rows.map(row=>row.map(cell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`outsy-report-${year}-${dates.from||'all'}-${dates.to}.csv`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export default function DashboardReports({ data, dates }) {
  const [allYear,setAllYear]=useState(()=>Number(bangkokDay().slice(0,4)));
  const year=dates.from?Number(dates.from.slice(0,4)):allYear;
  const years=[...new Set([Number(bangkokDay().slice(0,4)),...data.bookings.map(b=>Number(bangkokDay(b.created_at).slice(0,4))).filter(y=>y>=1000)])].sort((a,b)=>b-a);
  const report=useMemo(()=>reportCharts(data,{...dates,year}),[data,dates.from,dates.to,year]);
  return <div className="dashboard-reports"><div className="report-toolbar"><h3>รายงานการจอง</h3><button type="button" onClick={()=>exportReport(report,year,dates)}>↓ Export CSV</button></div><div className="dashboard-columns"><ReportPanel title="Top 5 แพ็กเกจขายดีที่สุด" note="จำนวนการจองที่ยังมีผลในช่วงที่เลือก ไม่รวมยกเลิกและคืนเงิน"><PackageBars rows={report.topPackages} /></ReportPanel><ReportPanel title="จังหวัดยอดนิยมที่คนชอบไป" note="ผู้เดินทางจากการจองที่ยังมีผล แยกตามจังหวัดหลักของแพ็กเกจ"><ProvinceDonut rows={report.provinces} /></ReportPanel></div><ReportPanel title={`สรุปยอดยืนยันและการจองรายเดือน · ${year+543}`} note="แสดงทั้งปีของเดือนที่เลือก อิงวันที่สร้างการจองและสถานะปัจจุบัน ยอดยืนยันไม่ใช่รายได้ทางบัญชี">{!dates.from && <label className="report-year">ปีที่ต้องการดู<select value={allYear} onChange={e=>setAllYear(Number(e.target.value))}>{years.map(y=><option key={y} value={y}>{y+543}</option>)}</select></label>}<MonthlyLines rows={report.months} /></ReportPanel></div>;
}
