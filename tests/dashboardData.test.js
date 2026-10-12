import test from 'node:test';
import assert from 'node:assert/strict';
import * as loader from '../src/lib/dashboardData.js';

// The API can return fewer rows than requested due to a configured row cap.
function clientFor(rows, { failAt = -1, noCount = false, stopAt = -1 } = {}) {
 return {from(){return {select(){return this;},order(){return this;},abortSignal(){return this;},async range(start,end){
  if(start===failAt)return {data:null,error:{message:'denied'},count:null};
  return {data:start===stopAt?[]:rows.slice(start,Math.min(start+2,end+1)),count:noCount?null:rows.length,error:null};
 }}}};
}
test('pagination collects every row even when the server cap is smaller than the requested page',async()=>{
 const rows=Array.from({length:7},(_,i)=>({id:i}));
 assert.deepEqual(await loader.readAllRows(clientFor(rows),'example','id','id'),rows);
});
test('later page failure rejects the partial dataset instead of displaying incomplete totals',async()=>{
 await assert.rejects(()=>loader.readAllRows(clientFor([{id:1},{id:2},{id:3}],{failAt:2}),'example','id','id'),/denied/);
});
test('missing counts and empty pages before completion are reported as incomplete reads',async()=>{
 await assert.rejects(()=>loader.readAllRows(clientFor([{id:1}],{noCount:true}),'example','id','id'),/จำนวน/);
 await assert.rejects(()=>loader.readAllRows(clientFor([{id:1},{id:2},{id:3}],{stopAt:2}),'example','id','id'),/ครบ/);
});
test('compact overview loads without querying departure data it no longer displays',async()=>{
 const client={from(table){
  if(table==='Tour_Schedules') throw new Error('Departure data unavailable');
  const keys={bookings:'booking_id',Tour_Packages:'package_id',refund_requests:'id',provinces:'province_id'};
  return clientFor([{[keys[table]]:1}]).from(table);
 }};
 const data=await loader.loadDashboardData(client);
 assert.equal(data.bookings.length,1);
 assert.equal(data.packages.length,1);
 assert.equal(data.refunds.length,1);
 assert.deepEqual(data.schedules,[]);
});
