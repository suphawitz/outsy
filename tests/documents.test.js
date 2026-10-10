import test from 'node:test';
import assert from 'node:assert/strict';
const module = await import('../src/lib/privateDocuments.js').catch(() => ({}));
const origin = 'https://sihfjdpefsozabdhwucd.supabase.co';
test('old public receipt reference becomes a private path without its token', () => {
  assert.equal(module.privatePath?.(`${origin}/storage/v1/object/public/slips/slips/slip_12_123.png?token=old`, origin), 'slips/slip_12_123.png');
});
test('signed bankbook reference becomes a private path', () => {
  assert.equal(module.privatePath?.(`${origin}/storage/v1/object/sign/slips/bookbank/bb_12_123.jpg?token=old`, origin), 'bookbank/bb_12_123.jpg');
});
for (const value of ['https://evil.example/x.png', '../x.png', 'a/../x.png', '%2e%2e/x.png', 'a\\b.png','/x.png','x.png?token=secret']) {
  test(`reject unsafe reference ${value}`, () => {
    assert.equal(typeof module.privatePath, 'function');
    assert.throws(() => module.privatePath(value, origin));
  });
}
test('valid PNG accepted, disguised SVG and oversized upload rejected', async () => {
  assert.equal(typeof module.validateImage, 'function');
  const png = new Blob([new Uint8Array([137,80,78,71,13,10,26,10])], {type:'image/png'});
  await module.validateImage(png);
  await assert.rejects(module.validateImage(new Blob(['<svg/>'],{type:'image/png'})));
  await assert.rejects(module.validateImage(new Blob([new Uint8Array(5242881)],{type:'image/png'})));
});
test('private download propagates denied access and never returns a URL', async () => {
  assert.equal(typeof module.loadPrivateImage, 'function');
  const client = {auth:{getUser:async()=>({data:{user:{id:'A'}},error:null})},storage:{from:bucket=>{
    assert.equal(bucket,'slips'); return {download:async path=>{
      assert.equal(path,'slip_12_123.png'); return {data:null,error:new Error('denied')};
    }};
  }}};
  await assert.rejects(module.loadPrivateImage(client,'slip_12_123.png',origin), /denied/);
});
test('zero-row update cannot report mutation success', () => {
  assert.equal(typeof module.requireChangedRow, 'function');
  assert.throws(()=>module.requireChangedRow({data:null,error:null},'denied'));
});
test('successful row returned, database failure propagated', () => {
  assert.equal(typeof module.requireChangedRow, 'function');
  assert.deepEqual(module.requireChangedRow({data:{booking_id:12},error:null},'denied'),{booking_id:12});
  assert.throws(()=>module.requireChangedRow({data:null,error:new Error('failed')},'denied'),/failed/);
});
