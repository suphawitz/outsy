import test from 'node:test';
import assert from 'node:assert/strict';
import * as dashboard from '../src/lib/dashboard.js';

const bookings = [
 { booking_id: 1, package_id: 'A', user_id: 'u1', created_at: '2026-10-01T18:00:00Z', travel_date: '2026-10-15', booking_status: 'ชำระเงินแล้ว', total_price: 2000, number_people: 2 },
 { booking_id: 2, package_id: 'A', user_id: 'u1', created_at: '2026-10-03T00:00:00Z', travel_date: '2026-10-15', booking_status: 'รอชำระเงิน', total_price: 1000, number_people: 1 },
 { booking_id: 3, package_id: 'A', user_id: 'u2', created_at: '2026-10-04T00:00:00Z', travel_date: '2026-10-15', booking_status: 'ยกเลิก (คืนเงินเต็มจำนวน)', total_price: 3000, number_people: 3 },
 { booking_id: 4, package_id: 'B', user_id: 'u3', created_at: '2026-09-01T00:00:00Z', travel_date: '2026-10-15', booking_status: 'ทริปเสร็จสิ้น', total_price: 4000, number_people: 4 },
 { booking_id: 5, package_id: 'A', user_id: 'u2', created_at: '2026-10-05T00:00:00Z', travel_date: '2026-10-15', booking_status: 'คืนเงินเรียบร้อยแล้ว', total_price: 500, number_people: 1 },
];
const input = {bookings, packages:[{package_id:'A',package_name:'ทัวร์ A'},{package_id:'B',package_name:'ทัวร์ B'}], schedules:[{schedule_id:1,package_id:'A',travel_date:'2026-10-15',booked_count:7,max_capacity:10,min_capacity:4,status:'open'}],refunds:[{id:1,booking_id:3,status:'รอดำเนินการ'},{id:2,booking_id:3,status:'รอดำเนินการ'},{id:3,booking_id:5,status:'คืนเงินแล้ว'}]};
const options = {from:'2026-10-01',to:'2026-10-12',today:'2026-10-12',packageId:'ALL'};

test('confirmed totals exclude cancelled/refunded bookings and respect creation period',()=>{
 const result=dashboard.summarizeDashboard(input,options);
 assert.equal(result.metrics.bookings,4);
 assert.equal(result.metrics.confirmedValue,2000);
 assert.equal(result.metrics.pendingValue,1000);
 assert.equal(result.metrics.activeTravelers,3);
 assert.equal(result.metrics.uniqueCustomers,2);
 assert.equal(result.metrics.repeatCustomers,2);
 assert.equal(result.metrics.cancelled,1);
 assert.equal(result.metrics.refunded,1);
});
test('Bangkok day boundary places late UTC booking on the following local day',()=>{
 const result=dashboard.summarizeDashboard(input,{...options,from:'2026-10-02',to:'2026-10-02'});
 assert.equal(result.metrics.bookings,1);
 assert.equal(result.trend[0].date,'2026-10-02');
 assert.equal(result.trend[0].count,1);
});
test('work queues deduplicate refund bookings and use current workload independent of date filter',()=>{
 const result=dashboard.summarizeDashboard(input,{...options,from:'2026-10-10'});
 assert.equal(result.metrics.bookings,0);
 assert.equal(result.work.pendingRefunds,1);
 assert.equal(result.work.pendingRefundValue,3000);
 assert.equal(result.work.completedRefundValue,500);
 assert.equal(result.quality.duplicateRefunds,1);
});
test('schedule seats use all active bookings, detect counter mismatch and exclude refunds',()=>{
 const result=dashboard.summarizeDashboard(input,options);
 assert.equal(result.upcoming[0].reserved,3);
 assert.equal(result.upcoming[0].confirmed,2);
 assert.equal(result.upcoming[0].remaining,7);
 assert.equal(result.upcoming[0].belowMinimum,true);
 assert.equal(result.upcoming[0].counterMismatch,true);
});
test('package filter and empty data produce finite values without invented customers',()=>{
 const result=dashboard.summarizeDashboard(input,{...options,packageId:'B'});
 assert.equal(result.metrics.bookings,0);
 assert.equal(result.ranking.length,0);
 const empty=dashboard.summarizeDashboard({bookings:[],packages:[],schedules:[],refunds:[]},options);
 assert.equal(empty.metrics.averageValue,0);
 assert.equal(empty.metrics.confirmedRate,0);
 assert.equal(empty.metrics.uniqueCustomers,0);
});
test('invalid booking fields and unknown status are surfaced as data quality issues',()=>{
 const result=dashboard.summarizeDashboard({...input,bookings:[{booking_id:9,package_id:'MISSING',created_at:'bad',travel_date:'bad',booking_status:'ไม่รู้จัก',total_price:-1,number_people:0}]},options);
 assert.equal(result.quality.invalidDates,1);
 assert.equal(result.quality.invalidAmounts,1);
 assert.equal(result.quality.invalidTravelers,1);
 assert.equal(result.quality.unknownStatuses,1);
 assert.equal(result.quality.missingPackages,1);
});
test('refund inconsistencies prefer a completed refund over a duplicate pending request',()=>{
 const result=dashboard.summarizeDashboard({...input,refunds:[{id:1,booking_id:3,status:'รอดำเนินการ'},{id:2,booking_id:3,status:'คืนเงินแล้ว'}]},options);
 assert.equal(result.work.pendingRefunds,0);
 assert.equal(result.work.completedRefundValue,3000);
});
test('period presets include today and reject reversed custom dates',()=>{
 assert.deepEqual(dashboard.periodDates('7','2026-10-12'),{from:'2026-10-06',to:'2026-10-12'});
 assert.deepEqual(dashboard.periodDates('month','2026-10-12'),{from:'2026-10-01',to:'2026-10-12'});
 assert.throws(()=>dashboard.summarizeDashboard(input,{...options,from:'2026-10-13'}),/ช่วงวันที่/);
});
test('unlinked refund requests remain separate rather than collapsing into one null booking',()=>{
 const result=dashboard.summarizeDashboard({...input,refunds:[{id:1,booking_id:null,status:'รอดำเนินการ'},{id:2,booking_id:null,status:'รอดำเนินการ'}]},options);
 assert.equal(result.work.pendingRefunds,2);
 assert.equal(result.quality.orphanRefunds,2);
 assert.equal(result.quality.duplicateRefunds,0);
});
test('missing stored seat counter is flagged even when there are no reservations',()=>{
 const result=dashboard.summarizeDashboard({...input,bookings:[],schedules:[{...input.schedules[0],booked_count:null}]},options);
 assert.equal(result.upcoming[0].counterMismatch,true);
});
test('calendar month filters cover complete months including leap years',()=>{
 assert.deepEqual(dashboard.monthDates('2024-02','2026-10-12'),{from:'2024-02-01',to:'2024-02-29'});
 assert.deepEqual(dashboard.monthDates('2026-10','2026-10-12'),{from:'2026-10-01',to:'2026-10-31'});
 assert.deepEqual(dashboard.monthDates('all','2026-10-12'),{from:'',to:'2026-10-12'});
 assert.throws(()=>dashboard.monthDates('2026-13','2026-10-12'),/เดือน/);
});
test('report charts rank active bookings, join primary provinces and fill empty months',()=>{
 const result=dashboard.reportCharts({...input,packages:[{package_id:'A',package_name:'ทัวร์ A',province_id:1},{package_id:'B',package_name:'ทัวร์ B',province_id:2}],provinces:[{province_id:1,provincename:'เชียงใหม่'},{province_id:2,provincename:'ลำพูน'}]},{from:'2026-09-01',to:'2026-10-31',year:2026});
 assert.equal(result.topPackages[0].activeCount,2);
 assert.equal(result.provinces.find(p=>p.name==='เชียงใหม่').people,3);
 assert.equal(result.provinces.find(p=>p.name==='ลำพูน').people,4);
 assert.equal(result.months.length,12);
 assert.equal(result.months[8].count,1);
 assert.equal(result.months[8].value,4000);
 assert.equal(result.months[9].count,4);
 assert.equal(result.months[9].value,2000);
 assert.equal(result.months[0].count,0);
});
test('month dropdown contains the latest twelve months and older booking months in Bangkok order',()=>{
 const months=dashboard.dashboardMonths([{created_at:'2024-01-31T18:00:00Z'}],'2026-10-12');
 assert.equal(months[0],'2026-10');
 assert.ok(months.includes('2025-11'));
 assert.ok(months.includes('2024-02'));
 assert.ok(!months.includes('2024-01'));
 assert.equal(new Set(months).size,months.length);
});
test('custom date ranges include both Bangkok boundary days and reject missing or reversed bounds',()=>{
 assert.deepEqual(dashboard.dateRange('2026-10-19','2026-10-23'),{from:'2026-10-19',to:'2026-10-23'});
 assert.throws(()=>dashboard.dateRange('2026-10-23','2026-10-19'),/วันที่/);
 assert.throws(()=>dashboard.dateRange('','2026-10-23'),/วันที่/);
 const result=dashboard.summarizeDashboard(input,dashboard.dateRange('2026-10-02','2026-10-03'));
 assert.equal(result.metrics.bookings,2);
});
test('custom range also limits monthly chart totals while retaining twelve labelled months',()=>{
 const result=dashboard.reportCharts({...input,provinces:[]},{from:'2026-10-02',to:'2026-10-03',year:2026,limitToRange:true});
 assert.equal(result.months[8].count,0);
 assert.equal(result.months[9].count,2);
 assert.equal(result.months[9].value,2000);
});
