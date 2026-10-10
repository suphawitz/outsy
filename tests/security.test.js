import test from 'node:test';
import assert from 'node:assert/strict';
import { documentPath, newDocumentPath, validateDocument, MAX_DOCUMENT_BYTES } from '../src/lib/documents.js';
import { thaiError } from '../src/lib/errors.js';
import { bookingApi } from '../src/lib/bookingApi.js';

const origin = 'https://sihfjdpefsozabdhwucd.supabase.co';
const owner = '11111111-1111-4111-8111-111111111111';
const image = '22222222-2222-4222-8222-222222222222.png';
test('legacy public URLs become bucket paths, never public URLs', () => {
  assert.equal(documentPath(`${origin}/storage/v1/object/public/slips/slips/slip_12.png`, origin), 'slips/slip_12.png');
  assert.equal(documentPath(`${origin}/storage/v1/object/sign/slips/bookbank/bb_12.png?token=not-used`, origin), 'bookbank/bb_12.png');
  assert.equal(documentPath('slip_12.png', origin), 'slip_12.png');
});
for (const path of ['https://attacker.example/a.png', 'https://attacker.example@' + origin.slice(8) + '/storage/v1/object/public/slips/x.png', '../x.png', 'folder/../x.png', '/x.png', 'foo\\x.png', 'x.png?token=secret', '%2e%2e/x.png', 'data:image/png;base64,abc', '', 'a//b.png']) {
  test(`reject unsafe document reference: ${path}`, () => assert.throws(() => documentPath(path, origin)));
}
test('upload names bind owner, booking and document purpose', () => {
  assert.equal(newDocumentPath(owner, '12', 'slip', image), `${owner}/12/slip/${image}`);
  assert.throws(() => newDocumentPath(owner, '../12', 'slip', image));
  assert.throws(() => newDocumentPath(owner, '12', 'other', image));
  assert.throws(() => newDocumentPath(owner, '12', 'slip', '../bad.png'));
});
test('valid image header passes; empty, SVG, oversized and spoofed MIME fail', async () => {
  const png = new Blob([Uint8Array.from([137,80,78,71,13,10,26,10,0,0,0,0])], { type:'image/png' });
  assert.equal(await validateDocument(png), 'png');
  await assert.rejects(validateDocument(new Blob([], {type:'image/png'})));
  await assert.rejects(validateDocument(new Blob(['<svg/>'], {type:'image/svg+xml'})));
  await assert.rejects(validateDocument(new Blob(['<script/>'], {type:'image/png'})));
  await assert.rejects(validateDocument({type:'image/png',size:MAX_DOCUMENT_BYTES+1}));
});
test('Thai auth errors do not leak backend error messages or user details', () => {
  assert.equal(thaiError({code:'invalid_credentials',message:'private-email@example.com'}), 'อีเมลหรือรหัสผ่านไม่ถูกต้อง');
  assert.match(thaiError({code:'email_not_confirmed'}), /ยืนยันอีเมล/);
  assert.match(thaiError({code:'email_exists'}), /มีบัญชีแล้ว/);
  assert.match(thaiError({code:'otp_expired'}), /หมดอายุ/);
  assert.equal(thaiError({message:'sensitive stack data'}), 'ดำเนินการไม่สำเร็จ กรุณาลองใหม่');
});
test('unauthenticated callers never reach booking RPC', async () => {
  let called = false;
  const api = bookingApi({auth:{getUser:async()=>({data:{user:null},error:null})},rpc:async()=>{called=true;}});
  await assert.rejects(api.createBooking({}));
  await assert.rejects(api.bookingAction(1,'submit_slip'));
  await assert.rejects(api.adminAction('approve_payment',{}));
  assert.equal(called,false);
});
test('missing RPC fails closed and never falls back to browser table writes', async () => {
  const error = {code:'PGRST202'};
  let tableWrites = 0;
  const api = bookingApi({auth:{getUser:async()=>({data:{user:{id:owner}},error:null})},rpc:async()=>({data:null,error}),from:()=>{tableWrites++;}});
  await assert.rejects(api.createBooking({request_id:'id'}), value=>value===error);
  assert.equal(tableWrites,0);
  assert.match(thaiError(error), /ยังไม่เปิดใช้งาน/);
});
test('booking actions preserve bigint references without Number precision loss', async () => {
  let received;
  const api=bookingApi({auth:{getUser:async()=>({data:{user:{id:owner}}})},rpc:async(name,args)=>{received={name,args};return {data:{ok:true}};}});
  await api.bookingAction('9223372036854775806','request_reschedule',{travel_date:'2026-12-01'});
  assert.deepEqual(received,{name:'outsy_booking_action',args:{p_booking_id:'9223372036854775806',p_action:'request_reschedule',p_payload:{travel_date:'2026-12-01'}}});
});
test('RPC errors and empty responses are failures, never false success', async () => {
  const api=bookingApi({auth:{getUser:async()=>({data:{user:{id:owner}}})},rpc:async()=>({data:null,error:null})});
  await assert.rejects(api.createBooking({}));
});
test('client API rejects caller-managed ownership, price and status', async () => {
  let calls = 0;
  const api=bookingApi({rpc:async()=>{calls++;}});
  for (const field of ['user_id','total_price','booking_status','booked_count']) await assert.rejects(api.createBooking({[field]:1}));
  assert.equal(calls,0);
});
