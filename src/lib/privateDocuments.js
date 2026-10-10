export function privatePath(value, origin) {
  let path = String(value || '');
  if (path.startsWith('https://')) {
    const url = new URL(path);
    if (url.origin !== new URL(origin).origin || url.username || url.password) throw new Error('เอกสารไม่ใช่ของโปรเจกต์นี้');
    const match = url.pathname.match(/^\/storage\/v1\/object\/(?:public|sign|authenticated)\/slips\/(.+)$/);
    if (!match) throw new Error('พาธเอกสารไม่ถูกต้อง');
    path = match[1];
  }
  if (!path || /[\\%?#:\x00-\x1f]/.test(path) || path.split('/').some(part => !part || part === '.' || part === '..')) throw new Error('พาธเอกสารไม่ถูกต้อง');
  return path;
}
export async function validateImage(file) {
  if (!file || !file.size || file.size > 5 * 1024 * 1024) throw new Error('กรุณาเลือกรูปภาพไม่เกิน 5 MB');
  const bytes = new Uint8Array(await file.slice(0,12).arrayBuffer());
  const png = [137,80,78,71,13,10,26,10].every((n,i)=>bytes[i]===n);
  const jpg = bytes[0]===255 && bytes[1]===216 && bytes[2]===255;
  const webp = String.fromCharCode(...bytes.slice(0,4))==='RIFF' && String.fromCharCode(...bytes.slice(8,12))==='WEBP';
  if (!((file.type==='image/png'&&png)||(file.type==='image/jpeg'&&jpg)||(file.type==='image/webp'&&webp))) throw new Error('รองรับเฉพาะไฟล์ภาพ JPEG, PNG และ WebP ที่ถูกต้อง');
}
export async function loadPrivateImage(client, value, origin) {
  const {data,error} = await client.auth.getUser();
  if (error || !data?.user) throw new Error('กรุณาเข้าสู่ระบบเพื่อดูเอกสาร');
  const result = await client.storage.from('slips').download(privatePath(value,origin));
  if (result.error) throw result.error;
  if (!result.data) throw new Error('ไม่พบเอกสาร');
  await validateImage(result.data);
  return {blob:result.data,userId:data.user.id};
}
// Supabase can return no error and zero updated rows when RLS hides the target.
export function requireChangedRow({ data, error }, message) {
  if (error) throw error;
  if (!data) throw new Error(message);
  return data;
}
