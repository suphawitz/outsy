import test from 'node:test';
import assert from 'node:assert/strict';
import * as payment from '../src/lib/bookingPayment.js';
const file=()=>new Blob([new Uint8Array([137,80,78,71,13,10,26,10])],{type:'image/png'});
test('payment validation prevents any booking or upload writes without a valid slip',async()=>{
 let writes=0;
 await assert.rejects(()=>payment.confirmPayment({file:null,progress:{},createBooking:async()=>writes++,uploadSlip:async()=>writes++,markPaid:async()=>writes++}));
 assert.equal(writes,0);
});
test('only confirmation creates a booking, then uploads the slip and submits payment',async()=>{
 const calls=[],progress={};
 const id=await payment.confirmPayment({file:file(),progress,createBooking:async()=>{calls.push('create');return '42';},uploadSlip:async(id)=>{calls.push(`upload:${id}`);return 'slip42.png';},markPaid:async(id,path)=>calls.push(`paid:${id}:${path}`)});
 assert.equal(id,'42');
 assert.deepEqual(calls,['create','upload:42','paid:42:slip42.png']);
});
test('retry after receipt failure reuses the completed booking rather than reserving seats twice',async()=>{
 const progress={};let creates=0,uploads=0;
 const options={file:file(),progress,createBooking:async()=>{creates++;return '42';},uploadSlip:async()=>{if(++uploads===1)throw Error('upload denied');return 'slip42.png';},markPaid:async()=>{}};
 await assert.rejects(()=>payment.confirmPayment(options),/upload denied/);
 await payment.confirmPayment(options);
 assert.equal(creates,1);
});
