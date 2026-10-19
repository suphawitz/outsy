import { validateImage } from './privateDocuments.js';

export async function confirmPayment({ file, progress, createBooking, uploadSlip, markPaid }) {
  if (progress.inFlight) throw new Error('กำลังบันทึกการจอง กรุณารอสักครู่');
  progress.inFlight = true;
  try {
    if (!file) throw new Error('กรุณาแนบหลักฐานการโอนเงิน (สลิป) ก่อนดำเนินการต่อ');
    await validateImage(file);
    if (!progress.bookingId) {
      const id = await createBooking();
      if (!id) throw new Error('ไม่สามารถสร้างรายการจองได้');
      progress.bookingId = String(id);
    }
    if (progress.file !== file) { progress.file = file; progress.slipPath = ''; }
    if (!progress.slipPath) progress.slipPath = await uploadSlip(progress.bookingId, file);
    await markPaid(progress.bookingId, progress.slipPath);
    return progress.bookingId;
  } finally { progress.inFlight = false; }
}
