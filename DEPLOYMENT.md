# เตรียม deploy OUTSY บน Vercel

## สถานะและขอบเขต

เว็บนี้ใช้ React + Vite และเชื่อม Supabase โดยตรง คง QR จำลองตามคำขอของเจ้าของโปรเจกต์
การ deploy ครั้งนี้เป็นเว็บสาธิต ยังไม่ถือเป็นการรับรองระบบรับเงินจริง

## ตั้งค่า Vercel

เปิด https://vercel.com/su-phawit/outsy แล้วตรวจ Settings:

1. Git: เชื่อม repository `suphawitz/outsy` และเลือก branch ที่มีการแก้ไขครั้งนี้
2. Build and Deployment: preset Vite, root directory root ของ repo, Node.js 22.x
3. Install command `npm ci`, build command `npm run build`, output `dist`
4. Environment Variables: เพิ่ม `VITE_SUPABASE_URL` และ `VITE_SUPABASE_ANON_KEY`
   คัดลอกค่าจาก `.env.local` ของเครื่องนี้ หรือ Supabase Project Settings > API / API Keys
   เลือก Production และ Preview ตามที่ใช้ ห้ามใช้ service_role/secret key
5. หลัง push โค้ดและตั้ง env แล้วจึง deploy/redeploy (ค่า env ถูกฝังตอน build)
6. เปิด URL จริงและ refresh `/packages`, `/login`, `/update-password` ต้องไม่เจอ Vercel 404
   หน้า `/update-password` ที่เปิดเองโดยไม่มี session ควรแจ้งว่าลิงก์ไม่ถูกต้อง/หมดอายุ
7. ตรวจโลโก้ พื้นหลัง login รายการทัวร์ และ Console/Network ไม่ควรมีไฟล์ JS/รูปสำคัญ 404

## ตรวจ Supabase ด้วยตัวเอง

### 1. ตรวจ URL และอีเมล

Authentication > URL Configuration:
- Site URL = URL เว็บ production จริงจาก Vercel
- Redirect URLs ต้องมี `https://<โดเมน>/login` และ `https://<โดเมน>/update-password`
- เพิ่ม `http://localhost:5173/login` และ `/update-password` ถ้าทดสอบในเครื่อง
- ถ้าใช้ Preview ให้เพิ่ม URL Preview ที่ต้องการทดสอบด้วย

Authentication > Sign In / Providers > Email:
- ตรวจว่าเปิด Email provider และตั้ง Confirm email ตามที่ต้องการ
- API ที่ตรวจครั้งนี้รายงาน email autoconfirm เปิดอยู่ (สมัครแล้วไม่ต้องยืนยันอีเมล)
- ถ้าเปิดยืนยันอีเมลภายหลัง ต้องตรวจ trigger สร้าง public.users เพราะ frontend insert
  ขณะสมัครอาจไม่มี session และถูก RLS ปฏิเสธ
- ใช้บัญชีทดสอบสมัคร/เข้าสู่ระบบ/ออกจากระบบ/ลืมรหัสผ่าน และเปิดอีเมลจริงเพื่อเปลี่ยนรหัสผ่าน
- ตรวจการส่งอีเมลและข้อจำกัด SMTP ก่อนให้ผู้ใช้หลายคนทดลอง

### 2. ตรวจตารางและ RLS

เปิด SQL Editor แล้ววางเนื้อหา `supabase/deployment-audit.sql` และ Run
ไฟล์นี้อ่านการตั้งค่าอย่างเดียว ไม่เปลี่ยนข้อมูลหรือ policy

- ตารางที่แอปใช้ต้องมีครบ: users, Tour_Packages, Tour_Schedules, Package_Itineraries,
  bookings, booking_travelers, refund_requests
- ตารางข้อมูลลูกค้าต้องเปิด RLS (`rowsecurity = true`) และมี policy ตามสิทธิ์
- ลูกค้าต้องอ่าน/แก้ไขเฉพาะข้อมูลของตัวเอง โดยผูกกับ `auth.uid()`
- users ต้องไม่เปิดให้ลูกค้าแก้ role เป็น admin หรือสร้างโปรไฟล์ admin เอง
- bookings/booking_travelers/refund_requests ต้องไม่เปิด SELECT/UPDATE ทั้งตารางให้ทุกคน
- Tour_Packages/Package_Itineraries เปิดอ่านสาธารณะได้ แต่การแก้ไขต้องจำกัด admin
- Tour_Schedules ต้องจำกัดการแก้จำนวนที่นั่งให้กระบวนการที่เชื่อถือได้
- ตรวจ policies ทั้ง `USING` และ `WITH CHECK`; RLS เปิดอย่างเดียวไม่ได้ยืนยันว่าปลอดภัย
- อย่าแก้เป็น `USING (true)` ทุกตารางหรือปิด RLS เพื่อแก้ error

ทดสอบด้วยบัญชีลูกค้า A, ลูกค้า B และ admin: ลูกค้า A ต้องดู/แก้การจองของ B ไม่ได้
รวมถึงการเปิด `/booking-detail/<id ของ B>` โดยตรง และการดูสลิป/สมุดบัญชีของ B
การซ่อนหน้า admin ใน React ไม่ได้แทนการตรวจสิทธิ์ในฐานข้อมูล

### 3. ตรวจ Storage

Storage > Buckets:
- `tourist_images`: มีภาพทัวร์และอ่านได้ตามที่เว็บต้องใช้
- `slips`: ตรวจ upload/read/update policies, ขนาดไฟล์และชนิดไฟล์ที่อนุญาต
- โค้ดปัจจุบันใช้ public URL สำหรับสลิปและรูปสมุดบัญชี จึงควรใช้ข้อมูลจำลองในการสาธิต
- ก่อนเก็บเอกสารจริง ควรย้ายไป private bucket + signed URL และตรวจเจ้าของ/admin
  ให้ครบทุกหน้าที่ดูไฟล์ การเปลี่ยน bucket เป็น private อย่างเดียวจะทำให้ viewer เดิมใช้ไม่ได้

### 4. ทดสอบ flow หลัก

- หน้าแรก/แพ็กเกจ/รายละเอียด/รอบเดินทางแสดงข้อมูลจริงได้
- สมัครสมาชิกแล้วมี public.users ที่ผูก auth_id ถูกต้อง
- จองด้วยข้อมูลทดสอบ แล้วพบรายการในประวัติและหน้า admin
- อัปโหลดสลิปจำลอง ตรวจยอด เปลี่ยนวัน ยกเลิกและขอคืนเงินได้ตามสิทธิ์
- ออกจากระบบแล้วเข้า admin ต้องถูกส่งไป login; ลูกค้าปกติต้องเข้า admin ไม่ได้
- ใช้มือถือทดสอบ login และขั้นตอนจอง

## ข้อจำกัดก่อนใช้เป็นระบบจริง

ราคา จำนวนที่นั่ง และรายการจองยังถูกบันทึกหลายคำสั่งจาก browser ต้องออกแบบ transaction/RPC
ฝั่งฐานข้อมูลเพื่อกันการแก้ราคา การจองเกินที่นั่ง และการบันทึกสำเร็จเพียงบางส่วน
ต้องเห็น schema/constraints/policies จริงก่อนทำ migration ที่เหมาะสม จึงไม่ได้เดาและแก้ฐานข้อมูล
ในรอบเตรียม deploy นี้ QR เดิมเป็นข้อความจำลอง ไม่ใช่ payload รับชำระ PromptPay จริง

## ผลตรวจรอบนี้ (10 ตุลาคม 2026)

- Clean install จาก final lockfile ผ่านด้วย Node.js 22.18.0
- Production build ด้วย Vite 6.4.4 ผ่าน และแยก chunk แต่ละหน้าแล้ว
- npm audit บน final lockfile: 0 vulnerabilities ณ เวลาตรวจ
- Browser smoke check: หน้า login แสดงได้, โลโก้โหลดสำเร็จ,
  หน้า update-password เมื่อไม่มี session แสดงข้อความให้ขอลิงก์ใหม่
- Supabase REST ตรวจทั้ง 7 ตารางด้วย limit=0 ได้ HTTP 200
  ไม่ได้ดึงข้อมูลลูกค้า และไม่ได้ทดสอบ ownership/RLS จากการตรวจนี้
- Supabase Auth settings ตอบ HTTP 200: เปิด email, เปิด signup, email autoconfirm เปิด
- Vercel Dashboard ต้องล็อกอิน จึงยังไม่ได้ยืนยันการตั้งค่าหรือทำ deployment
- ยังไม่ได้ทดสอบอีเมล recovery จริง, สิทธิ์หลายบัญชี หรือ flow จองครบวงจร
- เอา node_modules ออกจาก Git index แล้ว แต่เก็บ dependency ในเครื่องไว้
  การลบไฟล์เหล่านี้จาก repository ถูก stage ไว้สำหรับ commit ครั้งถัดไป
