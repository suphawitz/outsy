import { userError } from './errors.js';

export const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;
export const DOCUMENT_MIMES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
export function documentPath(value, supabaseUrl) {
  if (typeof value !== 'string' || !value.trim()) throw userError('ไม่พบเอกสาร');
  let path = value.trim();
  if (/^https?:/i.test(path)) {
    const url = new URL(path);
    const expected = new URL(supabaseUrl);
    if (url.origin !== expected.origin || url.username || url.password) throw userError('ไม่สามารถเปิดเอกสารจากแหล่งภายนอกได้');
    const match = url.pathname.match(/^\/storage\/v1\/object\/(?:public|authenticated|sign)\/slips\/(.+)$/);
    if (!match) throw userError('รูปแบบลิงก์เอกสารเดิมไม่ถูกต้อง');
    path = decodeURIComponent(match[1]);
  }
  if (path.includes(':') || path.startsWith('/') || path.includes('\\') || /[%?#]/.test(path) || [...path].some(char => char.charCodeAt(0) < 32) || path.split('/').some(part => !part || part === '.' || part === '..')) throw userError('ตำแหน่งเอกสารไม่ถูกต้อง');
  return path;
}
export async function validateDocument(file) {
  if (!file || !DOCUMENT_MIMES[file.type]) throw userError('รองรับเฉพาะรูป JPEG, PNG และ WebP');
  if (!file.size || file.size > MAX_DOCUMENT_BYTES) throw userError('ขนาดเอกสารต้องไม่เกิน 5 MB');
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const match = file.type === 'image/jpeg' ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
    : file.type === 'image/png' ? [137,80,78,71,13,10,26,10].every((b,i) => bytes[i] === b)
    : String.fromCharCode(...bytes.slice(0,4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8,12)) === 'WEBP';
  if (!match) throw userError('เนื้อหาไฟล์ไม่ตรงกับชนิดรูปภาพ');
  return DOCUMENT_MIMES[file.type];
}
export function newDocumentPath(userId, bookingId, kind, uuid) {
  if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(userId) || !/^[1-9][0-9]{0,18}$/.test(String(bookingId)) || !['slip','bookbank'].includes(kind) || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}\.(jpg|png|webp)$/i.test(uuid)) throw userError('ข้อมูลเจ้าของเอกสารไม่ถูกต้อง');
  return `${userId}/${bookingId}/${kind}/${uuid}`;
}
