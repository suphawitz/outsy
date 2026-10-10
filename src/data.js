// ==========================================================================
// Helper กลาง: rating placeholder + ไอคอนหมวดหมู่
//
// หมายเหตุ: ตาราง `places` ใน Supabase ไม่มีคอลัมน์ rating จริง (ดูจาก schema)
// ตามที่ตกลงกันไว้ ตอนนี้ยังไม่สร้างระบบ reviews จริง เลยใช้ค่า rating แบบ
// "คงที่ตามตัวสถานที่" (deterministic) คำนวณจาก placeid แทนของสุ่มไปเรื่อยๆ
// ทุกครั้งที่ re-render เพื่อไม่ให้ตัวเลขกระพริบเปลี่ยนไปมา
// ถ้าจะทำระบบรีวิวจริงในอนาคต ค่อยสร้างตาราง reviews แล้วมาแทนที่ฟังก์ชันนี้
// ==========================================================================
export function getPlaceholderRating(placeId) {
  const seed = Number(placeId) || 0
  const pseudo = (seed * 9301 + 49297) % 233280
  const rand = pseudo / 233280 // 0..1
  const rating = 4.3 + rand * 0.7 // ช่วง 4.3 - 5.0
  return rating.toFixed(1)
}

// แมปไอคอน Font Awesome ตามชื่อหมวดหมู่ที่พบบ่อย ถ้าไม่ตรงจะ fallback เป็นไอคอนกลาง
const CATEGORY_ICON_MAP = {
  all: 'fa-solid fa-border-all',
  Tourism: 'fa-solid fa-mountain-sun',
  ท่องเที่ยว: 'fa-solid fa-mountain-sun',
  Food: 'fa-solid fa-utensils',
  ร้านอาหาร: 'fa-solid fa-utensils',
  Cafe: 'fa-solid fa-mug-hot',
  คาเฟ่: 'fa-solid fa-mug-hot',
  Temple: 'fa-solid fa-gopuram',
  วัด: 'fa-solid fa-gopuram',
  Nature: 'fa-solid fa-tree',
  ธรรมชาติ: 'fa-solid fa-tree',
}

export function getCategoryIcon(categoryName) {
  return CATEGORY_ICON_MAP[categoryName] || 'fa-solid fa-tag'
}

export const WEEKDAY_LABELS_TH = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส']

export const MONTH_LABELS_TH = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
]
