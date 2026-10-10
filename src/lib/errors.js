export function thaiError(error, fallback = 'ดำเนินการไม่สำเร็จ กรุณาลองใหม่') {
  const code = error?.code;
  const text = String(error?.message || '');
  if (code === 'invalid_credentials') return 'อีเมลหรือรหัสผ่านไม่ถูกต้อง';
  if (code === 'email_not_confirmed') return 'กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ';
  if (['user_already_exists', 'email_exists'].includes(code)) return 'อีเมลนี้มีบัญชีแล้ว กรุณาเข้าสู่ระบบหรือลืมรหัสผ่าน';
  if (code === 'weak_password') return 'รหัสผ่านไม่ผ่านเงื่อนไขความปลอดภัย กรุณาใช้รหัสผ่านที่คาดเดายาก';
  if (['over_email_send_rate_limit', 'over_request_rate_limit'].includes(code) || error?.status === 429) return 'ทำรายการบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่';
  if (['otp_expired', 'session_not_found', 'refresh_token_not_found', 'refresh_token_already_used'].includes(code)) return 'ลิงก์หรือเซสชันหมดอายุ กรุณาเข้าสู่ระบบหรือขอลิงก์ใหม่';
  if (code === 'PGRST202' || code === '42883') return 'ระบบจองที่ปลอดภัยยังไม่เปิดใช้งาน กรุณารอผู้ดูแลติดตั้ง RPC ที่ผ่านการตรวจสอบ';
  if (['42501', 'PGRST301'].includes(code) || error?.status === 403) return 'คุณไม่มีสิทธิ์ทำรายการนี้ หรือเซสชันหมดอายุ';
  const business = {
    OUTSY_CAPACITY: 'ที่นั่งไม่เพียงพอ กรุณาเลือกรอบอื่น',
    OUTSY_STATE: 'สถานะรายการเปลี่ยนไปแล้ว กรุณาโหลดข้อมูลใหม่',
    OUTSY_SCHEDULE: 'รอบเดินทางไม่พร้อมใช้งาน กรุณาเลือกรอบใหม่',
    OUTSY_DOCUMENT: 'เอกสารไม่ถูกต้องหรือคุณไม่มีสิทธิ์เข้าถึง',
    OUTSY_AUTH: 'กรุณาเข้าสู่ระบบใหม่',
  };
  for (const [tag, message] of Object.entries(business)) if (text.includes(tag)) return message;
  if (error?.userMessage) return error.userMessage;
  if (/fetch|network/i.test(text)) return 'เชื่อมต่อระบบไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ต';
  return fallback;
}
export function userError(message) { return Object.assign(new Error(message), { userMessage: message }); }
