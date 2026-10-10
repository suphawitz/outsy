import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../client';

export default function BookingDetail() {
  const navigate = useNavigate();
  const { bookingId } = useParams();

  const [booking, setBooking] = useState(null);
  const [packageData, setPackageData] = useState(null);
  const [travelers, setTravelers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const theme = {
    red: '#e7191f',
    yellow: '#fdd501',
    cyan: '#2bcdd1',
    brown: '#573e33',
    bg: '#f6f8fb',
    border: '#e6ebf1',
    textMuted: '#738096',
  };

  useEffect(() => {
    if (bookingId) {
      loadBooking();
    }
  }, [bookingId]);

  async function loadBooking() {
    try {
      setLoading(true);
      setError('');
      setTravelers([]);
      setPackageData(null);

      const {
        data: bookingData,
        error: bookingError,
      } = await supabase
        .from('bookings')
        .select('*')
        .eq('booking_id', bookingId)
        .single();

      if (bookingError) {
        console.error('Booking error:', bookingError);
        throw bookingError;
      }

      if (!bookingData) {
        throw new Error('ไม่พบข้อมูลการจอง');
      }

      setBooking(bookingData);

      const {
        data: travelerData,
        error: travelerError,
      } = await supabase
        .from('booking_travelers')
        .select(
          'traveler_id, booking_id, full_name, phone, created_at'
        )
        .eq('booking_id', bookingData.booking_id)
        .order('traveler_id', {
          ascending: true,
        });

      if (travelerError) {
        console.error('ไม่สามารถโหลด booking_travelers:', travelerError);
        setTravelers([]);
      } else {
        setTravelers(travelerData || []);
      }

      if (bookingData.package_id) {
        const {
          data: packageDataResult,
          error: packageError,
        } = await supabase
          .from('Tour_Packages')
          .select('*')
          .eq('package_id', bookingData.package_id)
          .single();

        if (packageError) {
          console.error('Package error:', packageError);
          setPackageData(null);
        } else {
          setPackageData(packageDataResult);
        }
      }
    } catch (err) {
      console.error('Booking detail error:', err);
      setError(
        err?.message ||
          'ไม่สามารถโหลดรายละเอียดการจองได้'
      );
    } finally {
      setLoading(false);
    }
  }

  // =====================================================
  // BOOKING STATUS (อัปเดตให้รองรับ ทริปเสร็จสิ้น และ คืนเงินเรียบร้อยแล้ว)
  // =====================================================

  const bookingStatus =
    booking?.booking_status || 'รอชำระเงิน';

  const statusMap = {
    'รอชำระเงิน': {
      text: 'รอชำระเงิน',
      color: '#d97706',
      bg: '#fffbeb',
      step: 1,
    },
    'รอตรวจสอบยอด': {
      text: 'รอตรวจสอบยอด',
      color: '#2563eb',
      bg: '#eff6ff',
      step: 2,
    },
    'ชำระเงินแล้ว': {
      text: 'ยืนยันการจองแล้ว',
      color: '#059669',
      bg: '#ecfdf5',
      step: 3,
    },
    'สำเร็จ': {
      text: 'ยืนยันการจองแล้ว',
      color: '#059669',
      bg: '#ecfdf5',
      step: 3,
    },
    'ยืนยันแล้ว': {
      text: 'ยืนยันการจองแล้ว',
      color: '#059669',
      bg: '#ecfdf5',
      step: 3,
    },
    'เสร็จสิ้น': {
      text: 'ทริปเสร็จสิ้น',
      color: '#15803d',
      bg: '#f0fdf4',
      step: 4,
    },
    'ทริปเสร็จสิ้น': {
      text: 'ทริปเสร็จสิ้น',
      color: '#15803d',
      bg: '#f0fdf4',
      step: 4,
    },
    'ส่งเรื่องขอคืนเงินแล้ว': {
      text: 'ส่งเรื่องขอคืนเงินแล้ว',
      color: '#c2410c',
      bg: '#fff7ed',
      step: 2,
    },
    'คืนเงินเรียบร้อยแล้ว': {
      text: 'คืนเงินเรียบร้อยแล้ว',
      color: '#15803d',
      bg: '#f0fdf4',
      step: 4,
    },
    'ยกเลิก': {
      text: 'ยกเลิกการจอง',
      color: '#dc2626',
      bg: '#fef2f2',
      step: 0,
    },
    'ยกเลิกการจอง': {
      text: 'ยกเลิกการจอง',
      color: '#dc2626',
      bg: '#fef2f2',
      step: 0,
    },
  };

  const currentStatus =
    statusMap[bookingStatus] ||
    statusMap['รอชำระเงิน'];

  const statusText = currentStatus.text;
  const statusColor = currentStatus.color;
  const statusBg = currentStatus.bg;
  const currentStep = currentStatus.step;

  const statusSteps = [
    'รอชำระเงิน',
    'รอตรวจสอบยอด',
    'ยืนยันการจอง',
    'ทริปเสร็จสิ้น',
  ];

  const imageSrc = packageData?.image_path
    ? packageData.image_path
        .split(',')[0]
        .trim()
    : 'https://images.unsplash.com/photo-1528181304800-259b08848526?w=800';

  const additionalTravelers = travelers || [];
  const totalPeople = Number(booking?.number_people ?? 1);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: theme.bg, display: 'flex', justifyContent: 'center', alignItems: 'center', fontFamily: "'Prompt', sans-serif" }}>
        <h3 style={{ color: theme.brown }}>กำลังโหลดรายละเอียดการจอง...</h3>
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: theme.bg, padding: '120px 20px', textAlign: 'center', fontFamily: "'Prompt', sans-serif" }}>
        <div style={{ maxWidth: '500px', margin: '0 auto', backgroundColor: '#fff', padding: '40px', borderRadius: '20px', border: `1px solid ${theme.border}` }}>
          <h2 style={{ color: theme.brown, marginBottom: '10px' }}>ไม่พบรายการจอง</h2>
          <p style={{ color: theme.textMuted, lineHeight: 1.7 }}>{error || `ไม่พบรายการจอง #${bookingId}`}</p>
          <button onClick={() => navigate(-1)} style={{ backgroundColor: theme.brown, color: '#fff', border: 'none', padding: '12px 22px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold' }}>← กลับ</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: theme.bg, padding: '100px 24px 60px', fontFamily: "'Prompt', sans-serif", color: '#2d3748' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>

        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: theme.brown, fontWeight: 'bold', cursor: 'pointer', fontSize: '14px', marginBottom: '20px', padding: 0 }}>
          ← กลับ
        </button>

        <div style={{ marginBottom: '25px' }}>
          <h1 style={{ margin: '8px 0 3px', color: theme.brown, fontSize: '26px' }}>รายละเอียดการจอง</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px', flexWrap: 'wrap' }}>
            <span style={{ color: theme.textMuted, fontSize: '14px' }}>หมายเลขการจอง:</span>
            <span style={{ backgroundColor: theme.yellow, color: theme.brown, padding: '2px 10px', borderRadius: '8px', fontSize: '15px', fontWeight: '900' }}>#{booking.booking_id}</span>
          </div>
        </div>

        {/* PACKAGE DETAIL */}
        <div style={{ backgroundColor: '#fff', borderRadius: '20px', border: `1px solid ${theme.border}`, overflow: 'hidden', marginBottom: '20px' }}>
          <img
            src={imageSrc}
            alt={packageData?.package_name || 'Tour Package'}
            onClick={() => { if (booking.package_id) navigate(`/package/${booking.package_id}`); }}
            style={{ width: '100%', height: '300px', objectFit: 'cover', cursor: booking.package_id ? 'pointer' : 'default' }}
            title={booking.package_id ? 'คลิกเพื่อดูหน้าแพ็กเกจทัวร์' : ''}
            onError={(e) => { e.currentTarget.src = 'https://images.unsplash.com/photo-1528181304800-259b08848526?w=800'; }}
          />

          <div style={{ padding: '25px' }}>
            <div style={{ color: theme.textMuted, fontSize: '12px', marginBottom: '5px' }}>แพ็กเกจทัวร์ที่จอง</div>
            <div onClick={() => { if (booking.package_id) navigate(`/package/${booking.package_id}`); }} style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', cursor: booking.package_id ? 'pointer' : 'default', marginBottom: '15px' }}>
              <span style={{ backgroundColor: '#fffdf0', color: theme.brown, border: `1.5px solid ${theme.yellow}`, padding: '3px 10px', borderRadius: '8px', fontSize: '13px', fontWeight: '900' }}>📍 {booking.package_id}</span>
              <h2 style={{ margin: 0, color: theme.brown, fontSize: '22px', fontWeight: '800' }}>{packageData?.package_name || `แพ็กเกจ ${booking.package_id}`}</h2>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ fontSize: '15px', color: theme.brown, marginBottom: '8px' }}>รายละเอียดแพ็กเกจ</h3>
              <p style={{ margin: 0, color: theme.textMuted, fontSize: '14px', lineHeight: 1.8, whiteSpace: 'pre-line' }}>{packageData?.description || 'ไม่มีรายละเอียดแพ็กเกจ'}</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
              <PackageInfo title="ระยะเวลา" value={packageData?.duration || '-'} />
              <PackageInfo title="ราคาแพ็กเกจ" value={packageData?.price != null ? `฿${Number(packageData.price).toLocaleString()} / คน` : '-'} />
              <PackageInfo title="จำนวนสูงสุด" value={packageData?.max_people != null ? `${packageData.max_people} คน` : '-'} />
              <PackageInfo title="สถานะแพ็กเกจ" value={packageData?.status === 'available' ? 'เปิดให้บริการ' : (packageData?.status || 'เปิดให้บริการ')} />
            </div>
          </div>
        </div>

        {/* BOOKING INFORMATION */}
        <div style={{ backgroundColor: '#fff', borderRadius: '20px', border: `1px solid ${theme.border}`, padding: '25px', marginBottom: '20px' }}>
          <h2 style={{ margin: '0 0 20px', color: theme.brown, fontSize: '20px' }}>ข้อมูลการจอง</h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '25px' }}>
            <Info label="เลขที่การจอง" value={`#${booking.booking_id}`} />
            <Info label="วันที่ทำรายการ" value={formatDate(booking.created_at)} />
            <Info label="รอบเดินทาง" value={booking.travel_date || '-'} />
            <Info label="จำนวนผู้เดินทาง" value={`${totalPeople} คน`} />
            <Info label="ชื่อผู้จอง" value={booking.customer_name || '-'} />
            <Info label="อีเมล" value={booking.customer_email || '-'} />
            <Info label="เบอร์โทรศัพท์" value={booking.customer_phone || '-'} />
          </div>

          <div style={{ borderTop: `1px solid ${theme.border}`, paddingTop: '22px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', flexWrap: 'wrap', gap: '8px' }}>
              <h3 style={{ margin: 0, color: theme.brown, fontSize: '17px' }}>ผู้เดินทางในออเดอร์นี้</h3>
              <span style={{ backgroundColor: '#2bcdd1', color: theme.brown, borderRadius: '20px', padding: '5px 14px', fontSize: '12px', fontWeight: '800' }}>{totalPeople} คน</span>
            </div>

            <div style={{ backgroundColor: '#fffdf0', border: `2px solid ${theme.yellow}`, borderRadius: '14px', padding: '18px', marginBottom: additionalTravelers.length > 0 ? '15px' : '0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <div style={{ width: '30px', height: '30px', borderRadius: '50%', backgroundColor: '#2bcdd1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: '800', color: '#573e33', flexShrink: 0 }}>1</div>
                <div style={{ color: '#573e33', fontSize: '14px', fontWeight: '800' }}>ผู้เดินทางคนที่ 1 (ผู้จอง)</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                <TravelerInfo label="ชื่อ-นามสกุล" value={booking.customer_name || '-'} />
                <TravelerInfo label="เบอร์โทรศัพท์" value={booking.customer_phone || '-'} />
                <TravelerInfo label="อีเมล" value={booking.customer_email || '-'} />
              </div>
            </div>

            {additionalTravelers.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {additionalTravelers.map((traveler, index) => (
                  <TravelerCard key={traveler.traveler_id || `${traveler.full_name}-${index}`} traveler={traveler} index={index + 2} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* PAYMENT */}
        <div style={{ backgroundColor: '#fff', borderRadius: '20px', border: `1px solid ${theme.border}`, padding: '25px', marginBottom: '20px' }}>
          <h2 style={{ margin: '0 0 20px', color: theme.brown, fontSize: '20px' }}>การชำระเงิน</h2>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
            <div>
              <div style={{ color: theme.textMuted, fontSize: '12px' }}>สถานะการชำระเงิน</div>
              <div style={{ color: statusColor, fontWeight: 'bold', marginTop: '5px' }}>{statusText}</div>
              {booking.slip && <div style={{ color: '#059669', fontSize: '13px', marginTop: '8px' }}>✓ แนบหลักฐานการโอนเงินแล้ว</div>}
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '12px', color: theme.textMuted }}>ยอดชำระทั้งหมด</div>
              <div style={{ fontSize: '30px', fontWeight: '900', color: theme.red }}>฿{Number(booking.total_price || 0).toLocaleString()}</div>
            </div>
          </div>
        </div>

        {/* BOOKING STATUS */}
        <div style={{ backgroundColor: '#fff', borderRadius: '20px', border: `1px solid ${theme.border}`, padding: '25px', marginBottom: '20px' }}>
          <h2 style={{ margin: '0 0 28px', color: theme.brown, fontSize: '20px' }}>สถานะการจอง</h2>

          {currentStep === 0 ? (
            <div style={{ backgroundColor: '#fef2f2', color: '#dc2626', padding: '15px', borderRadius: '10px', fontWeight: 'bold', textAlign: 'center' }}>
              การจองนี้ถูกยกเลิก
            </div>
          ) : (
            <div style={{ width: '100%', overflowX: 'auto', padding: '5px 0 8px' }}>
              <div style={{ minWidth: '600px', position: 'relative', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', alignItems: 'start' }}>
                <div style={{ position: 'absolute', top: '9px', left: '12.5%', right: '12.5%', height: '2px', backgroundColor: '#e5e7eb', zIndex: 0 }} />
                <div style={{ position: 'absolute', top: '9px', left: '12.5%', width: currentStep === 1 ? '0%' : currentStep === 2 ? '25%' : currentStep === 3 ? '50%' : '75%', height: '2px', backgroundColor: theme.red, zIndex: 1, transition: 'width 0.3s ease' }} />

                {statusSteps.map((step, index) => {
                  const stepNumber = index + 1;
                  const active = currentStep >= stepNumber;
                  return (
                    <div key={step} style={{ position: 'relative', zIndex: 2, textAlign: 'center' }}>
                      <div style={{ width: '18px', height: '18px', margin: '0 auto 12px', borderRadius: '50%', backgroundColor: active ? theme.red : '#e5e7eb', border: active ? `2.5px solid ${theme.red}` : '2px solid #d1d5db', boxSizing: 'border-box', transition: 'all 0.3s ease' }} />
                      <div style={{ fontSize: '13px', color: active ? theme.brown : '#9ca3af', fontWeight: active ? 'bold' : 'normal', whiteSpace: 'nowrap' }}>{step}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {currentStep !== 0 && (
            <div style={{ marginTop: '25px', padding: '12px 15px', backgroundColor: statusBg, color: statusColor, borderRadius: '10px', textAlign: 'center', fontWeight: 'bold', fontSize: '14px' }}>
              สถานะปัจจุบัน: {statusText}
            </div>
          )}
        </div>

        <div style={{ textAlign: 'center', marginTop: '25px' }}>
          <button onClick={() => navigate(-1)} style={{ backgroundColor: theme.brown, color: '#fff', border: 'none', padding: '12px 25px', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
            ← กลับ
          </button>
        </div>

      </div>
    </div>
  );
}

function PackageInfo({ title, value }) {
  return (
    <div style={{ backgroundColor: '#f8fafc', borderRadius: '12px', padding: '14px' }}>
      <div style={{ fontSize: '11px', color: '#738096', marginBottom: '5px' }}>{title}</div>
      <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#573e33' }}>{value}</div>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <div style={{ color: '#738096', fontSize: '12px', marginBottom: '5px' }}>{label}</div>
      <div style={{ color: '#573e33', fontWeight: '600', fontSize: '14px', wordBreak: 'break-word' }}>{value}</div>
    </div>
  );
}

function TravelerInfo({ label, value }) {
  return (
    <div>
      <div style={{ color: '#738096', fontSize: '11px', marginBottom: '4px' }}>{label}</div>
      <div style={{ color: '#573e33', fontWeight: '600', fontSize: '14px', wordBreak: 'break-word' }}>{value || '-'}</div>
    </div>
  );
}

function TravelerCard({ traveler, index }) {
  return (
    <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e6ebf1', borderRadius: '14px', padding: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <div style={{ width: '30px', height: '30px', borderRadius: '50%', backgroundColor: '#2bcdd1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: '800', color: '#573e33', flexShrink: 0 }}>{index}</div>
        <div style={{ color: '#573e33', fontSize: '14px', fontWeight: '800' }}>ผู้เดินทางคนที่ {index}</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
        <TravelerInfo label="ชื่อ-นามสกุล" value={traveler.full_name || '-'} />
        <TravelerInfo label="เบอร์โทรศัพท์" value={traveler.phone || '-'} />
        <div style={{ display: 'none' }} />
      </div>
    </div>
  );
}

function formatDate(date) {
  if (!date) return '-';
  const d = new Date(date);
  if (isNaN(d.getTime())) return date;
  return d.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}