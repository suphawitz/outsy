# OUTSY — เตรียม deploy Vercel

## สถานะ 10 ตุลาคม 2026

Frontend เปลี่ยนการจองและการเงินไปใช้ trusted RPC แล้ว เอกสารใช้ private Storage download และ QR ระบุว่าเป็นตัวอย่าง ไม่ใช้รับเงินจริง
ยังไม่พร้อมเปิด flow จองครบวงจรจนกว่าจะ review/อนุมัติและติดตั้ง SQL พร้อมทดสอบบน staging ไม่มีการรัน migration, commit, push หรือ deploy ในงานนี้

## ขั้นตอนก่อน deploy

1. อ่าน [schema review](docs/SCHEMA_REVIEW.md) และ [SQL review package](supabase/migrations/README.md) เทียบกับฐานข้อมูลล่าสุด
2. อนุมัติ migration แยกต่างหาก แล้วทดสอบบน staging ตามลำดับ 001 → 002 → 003 ห้ามข้าม preflight ที่แจ้งข้อมูลเก่าไม่สอดคล้อง
3. ตรวจและจัดการข้อมูลเก่า: สถานะค้าง, generator ของ ID, จำนวนที่นั่ง, หลักฐานชำระเงิน และภาพประชาสัมพันธ์ที่เคยเก็บใน slips ตามคู่มือ migration
4. รัน [acceptance tests](docs/SECURITY_TESTS.md) ด้วยลูกค้า A/B/admin ก่อนอนุมัติใช้ฐานข้อมูล production
5. เมื่อตรวจผ่านแล้วจึงติดตั้ง SQL ที่อนุมัติบน production และ deploy frontend เวอร์ชันนี้ในช่วง maintenance เพื่อไม่ให้ frontend เก่าเขียนข้อมูลระหว่างเปลี่ยนระบบ

## Vercel

เปิด [โปรเจกต์ outsy](https://vercel.com/su-phawit/outsy) ตรวจด้วยบัญชีเจ้าของ:

- Git repository `suphawitz/outsy` และ branch ที่มีการแก้ไขนี้
- Preset Vite, root directory ราก repo, Node 22.x
- Install `npm ci`, build `npm run build`, output `dist`
- ตั้ง `VITE_SUPABASE_URL` และ `VITE_SUPABASE_ANON_KEY` ตาม `.env.example` สำหรับ Production/Preview ที่ใช้ ห้ามใส่ service_role หรือ secret key ใน VITE variables
- ค่า environment ถูกฝังตอน build เมื่อเปลี่ยนต้อง redeploy
- Dashboard ยังไม่ได้ยืนยันจากบัญชีที่ล็อกอิน และยังไม่ได้ deploy

## Supabase ตรวจเอง

Authentication → URL Configuration:

- Site URL เป็นโดเมน production จริง
- Redirect URLs เพิ่ม `https://<โดเมน>/login` และ `https://<โดเมน>/update-password`
- เพิ่ม localhost/Preview เฉพาะที่ต้องใช้ทดสอบ

Authentication → Email:

- ตรวจ Email provider, Confirm email และ SMTP/ข้อจำกัดการส่งอีเมลตามการใช้งานจริง
- สมัครต้องสร้าง public.users ผ่าน `handle_new_user` โดย role เป็น customer ไม่อาศัย frontend insert
- ทดสอบทั้งกรณียืนยันอีเมลและมี session ทันที รวมถึง duplicate signup และ recovery หมดอายุ

SQL Editor:

- รัน `supabase/deployment-audit.sql` เพื่ออ่านสถานะหลัง migration (ไม่มีการแก้ข้อมูล)
- ตรวจ RLS, grants, RPC execution rights และ trigger ตาม acceptance tests ไม่ถือว่าเปิด RLS อย่างเดียวเพียงพอ
- users ต้องแก้ได้เฉพาะ username; การเปลี่ยน role ต้องไม่ทำได้ด้วย customer JWT

Storage:

- slips ต้อง private, JPEG/PNG/WebP ไม่เกิน 5 MB และ owner/admin อ่านได้ตาม booking
- tourist_images เป็น public สำหรับภาพประชาสัมพันธ์เท่านั้น เขียนโดย admin
- ภาพเก่าใน slips ต้องตรวจประเภทก่อนย้าย ห้ามย้ายสลิปหรือสมุดบัญชีไป public

## ตรวจหลัง deploy

เปิด/refresh `/packages`, `/login`, `/update-password` ต้องไม่เจอ Vercel 404 ตรวจ assets และ Console/Network รวมถึงมือถือ ใช้บัญชี A/B/admin ทดสอบ flow และ ownership ตามเอกสาร tests อีกครั้ง

## ผลตรวจและข้อจำกัด

ผลตรวจโค้ดและคำสั่งล่าสุดอยู่ใน [รายงาน remediation](docs/REMEDIATION.md) SQL ตรวจ grammar เท่านั้น ไม่ได้ execute และยังไม่ยืนยัน concurrency/สิทธิ์บนฐานข้อมูลจริง
QR และสถานะคืนเงินเป็น flow สาธิต ไม่มีการโอนเงินจริง ไม่มีระบบหมดอายุการกันที่นั่งอัตโนมัติ ผู้ดูแลต้องยกเลิกรายการค้าง
