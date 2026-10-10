import { userError } from './errors.js';

export function bookingApi(client) {
  async function authenticatedUser() {
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) throw userError('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่');
    return data.user;
  }
  async function rpc(name, args) {
    await authenticatedUser();
    const { data, error } = await client.rpc(name, args);
    if (error) throw error;
    if (!data) throw userError('ระบบไม่ส่งผลการทำรายการกลับมา กรุณาโหลดข้อมูลใหม่ก่อนลองอีกครั้ง');
    return data;
  }
  return {
    authenticatedUser,
    createBooking: async request => {
      const allowed = ['request_id','schedule_id','customer_name','customer_phone','special_diet','special_notes','travelers'];
      if (!request || Object.keys(request).some(key => !allowed.includes(key))) throw userError('ข้อมูลการจองไม่ถูกต้อง ห้ามกำหนดเจ้าของ ราคา หรือสถานะเอง');
      return rpc('outsy_create_booking', { p_request: request });
    },
    bookingAction: (id, action, payload = {}) => rpc('outsy_booking_action', { p_booking_id: String(id), p_action: action, p_payload: payload }),
    adminAction: (action, payload) => rpc('outsy_admin_action', { p_action: action, p_payload: payload }),
  };
}
