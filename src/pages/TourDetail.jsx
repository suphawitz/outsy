import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { supabase } from '../client';

// กำหนด Palette สีหลักของ Outsy
const COLORS = {
  red: '#e7191f',
  yellow: '#fdd501',
  cyan: '#2bcdd1',
  brown: '#573e33',
  bg: '#f6f8fb',
  card: '#ffffff',
  border: '#e6ebf1',
  textMain: '#2d3748',
  textMuted: '#738096'
};

export default function TourDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  // ดึงวันที่ที่ส่งมาจากหน้ารวมแพ็กเกจ
  const queryDate = searchParams.get('date') || location.state?.travelDate || '';

  const [tour, setTour] = useState(null);
  const [itineraries, setItineraries] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [selectedScheduleId, setSelectedScheduleId] = useState('');
  const [loading, setLoading] = useState(true);
  const [mainImage, setMainImage] = useState('');

  // State สำหรับเปิด/ปิด Custom Modal แจ้งเตือนเมื่อยังไม่ได้ Login
  const [loginModal, setLoginModal] = useState(false);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);

      // 1. ดึงข้อมูลแพ็กเกจ
      const { data: tourData } = await supabase
        .from('Tour_Packages')
        .select('*')
        .eq('package_id', id)
        .single();

      if (tourData) {
        setTour(tourData);
        const images = tourData.image_path
          ? tourData.image_path.split(',').map((s) => s.trim()).filter(Boolean)
          : [];
        setMainImage(images[0] || '');
      }

      // 2. ดึงตารางกำหนดการเดินทาง (Itinerary)
      const { data: itiData } = await supabase
        .from('Package_Itineraries')
        .select('*')
        .eq('package_id', id)
        .order('order_index', { ascending: true });

      if (itiData) setItineraries(itiData);

      // 3. ดึงรอบวันเดินทาง (Schedules)
      const todayStr = new Date().toISOString().split('T')[0];
      const { data: schData } = await supabase
        .from('Tour_Schedules')
        .select('*')
        .eq('package_id', id)
        .gte('travel_date', todayStr)
        .order('travel_date', { ascending: true });

      if (schData && schData.length > 0) {
        setSchedules(schData);

        const matchedByDate = queryDate
          ? schData.find((s) => s.travel_date === queryDate)
          : null;

        if (matchedByDate) {
          setSelectedScheduleId(matchedByDate.schedule_id);
        } else {
          const firstAvailable = schData.find((s) => (Number(s.booked_count) || 0) < (Number(s.max_capacity) || 10));
          setSelectedScheduleId(firstAvailable ? firstAvailable.schedule_id : schData[0].schedule_id);
        }
      }
      setLoading(false);
    }

    fetchData();
  }, [id, queryDate]);

  if (loading) {
    return (
      <div style={{ backgroundColor: COLORS.bg, minHeight: '100vh', padding: '140px 24px', textAlign: 'center', color: COLORS.textMuted, fontFamily: "'Prompt', sans-serif" }}>
        <div style={{ fontSize: '36px', marginBottom: '12px' }}>🧭</div>
        <div>กำลังเตรียมข้อมูลการเดินทาง...</div>
      </div>
    );
  }

  if (!tour) {
    return (
      <div style={{ backgroundColor: COLORS.bg, minHeight: '100vh', padding: '140px 24px', textAlign: 'center', fontFamily: "'Prompt', sans-serif" }}>
        <h2 style={{ color: COLORS.brown }}>ไม่พบข้อมูลแพ็กเกจนี้</h2>
        <button
          onClick={() => navigate('/packages')}
          style={{
            backgroundColor: COLORS.red,
            color: '#fff',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '12px',
            fontWeight: 'bold',
            cursor: 'pointer',
            marginTop: '12px'
          }}
        >
          ← กลับไปหน้ารวมแพ็กเกจ
        </button>
      </div>
    );
  }

  const allImages = tour.image_path
    ? tour.image_path.split(',').map((img) => img.trim()).filter(Boolean)
    : [];

  const selectedSchedule = schedules.find((s) => String(s.schedule_id) === String(selectedScheduleId)) || schedules[0];
  const bookedCount = Number(selectedSchedule?.booked_count || 0);
  const maxCapacity = Number(selectedSchedule?.max_capacity || tour.max_people || 10);
  const minCapacity = Number(selectedSchedule?.min_capacity || 4);
  const remainingSeats = Math.max(0, maxCapacity - bookedCount);
  const isFull = remainingSeats <= 0;
  const progressPercent = Math.min(100, Math.round((bookedCount / maxCapacity) * 100));

  // ฟังก์ชันตรวจสอบการจองแพ็กเกจ
  const handleBookingAction = async () => {
    // ตรวจสอบ Session จาก Supabase ว่าผู้ใช้เข้าสู่ระบบหรือยัง
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      setLoginModal(true); // เปิด Modal แจ้งเตือนสวยๆ ทันที
      return;
    }

    // ถ้าล็อกอินแล้ว ไปหน้าจองต่อได้เลย
    if (!isFull && selectedSchedule) {
      navigate(`/booking/${tour.package_id}`, {
        state: {
          tourPackage: tour,
          package_id: tour.package_id,
          travelDate: selectedSchedule.travel_date
        }
      });
    }
  };

  return (
    <div style={{
      backgroundColor: COLORS.bg,
      minHeight: '100vh',
      padding: '110px 24px 80px 24px',
      fontFamily: "'Prompt', -apple-system, sans-serif",
      color: COLORS.textMain
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        
        {/* ปุ่มย้อนกลับ */}
        <button
          onClick={() => navigate('/packages')}
          style={{
            background: 'none',
            border: 'none',
            color: COLORS.textMuted,
            fontSize: '13px',
            cursor: 'pointer',
            marginBottom: '18px',
            fontWeight: 'bold',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <span>←</span> ย้อนกลับไปหน้ารวมแพ็กเกจ
        </button>

        <div style={{ display: 'grid', gridTemplateColumns: '440px 1fr', gap: '36px', alignItems: 'start' }}>
          
          {/* ================= ฝั่งซ้าย: รูปภาพและกล่องจองทริป ================= */}
          <div style={{ position: 'sticky', top: '100px' }}>
            <div style={{
              position: 'relative',
              borderRadius: '24px',
              overflow: 'hidden',
              height: '320px',
              backgroundColor: '#e2e8f0',
              border: `1.5px solid ${COLORS.border}`,
              boxShadow: '0 4px 18px rgba(0,0,0,0.04)'
            }}>
              {mainImage && (
                <img src={mainImage} alt={tour.package_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              )}
              <div style={{
                position: 'absolute',
                top: '14px',
                left: '14px',
                backgroundColor: COLORS.yellow,
                color: COLORS.brown,
                padding: '4px 12px',
                borderRadius: '14px',
                fontSize: '11px',
                fontWeight: '900',
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
              }}>
                📍 {tour.package_id}
              </div>
            </div>

            {/* แกลเลอรีรูปย่อ */}
            {allImages.length > 1 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginTop: '12px' }}>
                {allImages.map((imgUrl, i) => (
                  <div
                    key={i}
                    onClick={() => setMainImage(imgUrl)}
                    style={{
                      height: '60px',
                      borderRadius: '12px',
                      overflow: 'hidden',
                      cursor: 'pointer',
                      border: mainImage === imgUrl ? `2px solid ${COLORS.cyan}` : `1px solid ${COLORS.border}`
                    }}
                  >
                    <img src={imgUrl} alt={`Thumb ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                ))}
              </div>
            )}

            {/* การ์ดราคา เลือกรอบวัน และแสดงจำนวนคนจอง */}
            <div style={{
              backgroundColor: COLORS.card,
              borderRadius: '24px',
              padding: '22px 24px',
              marginTop: '16px',
              boxShadow: '0 4px 18px rgba(0,0,0,0.03)',
              border: `1.5px solid ${COLORS.border}`
            }}>
              <div style={{ fontSize: '11px', color: COLORS.textMuted, fontWeight: 'bold', marginBottom: '2px' }}>
                ราคาเริ่มต้น
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                  <span style={{ fontSize: '32px', fontWeight: '900', color: COLORS.red, lineHeight: 1 }}>
                    ฿{Number(tour.price).toLocaleString()}
                  </span>
                  <span style={{ fontSize: '13px', color: COLORS.textMuted, fontWeight: '500' }}>/ ท่าน</span>
                </div>

                <div style={{ color: COLORS.cyan, fontSize: '12px', fontWeight: 'bold' }}>
                  👥 รับสูงสุด {maxCapacity} ท่าน
                </div>
              </div>

              {/* ส่วนเลือกรอบวันเดินทาง */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: COLORS.brown, marginBottom: '6px' }}>
                  📅 เลือกรอบวันเดินทาง:
                </label>
                {schedules.length === 0 ? (
                  <div style={{ fontSize: '12px', color: COLORS.textMuted }}>ยังไม่มีรอบเดินทางที่เปิดรับ</div>
                ) : (
                  <select
                    value={selectedScheduleId}
                    onChange={(e) => setSelectedScheduleId(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '12px',
                      border: `1.5px solid ${COLORS.border}`,
                      backgroundColor: '#ffffff',
                      fontSize: '13px',
                      color: COLORS.brown,
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    {schedules.map((sch) => {
                      const schBooked = Number(sch.booked_count) || 0;
                      const schMax = Number(sch.max_capacity) || 10;
                      const schRemaining = schMax - schBooked;
                      const full = schRemaining <= 0;
                      const dateObj = new Date(sch.travel_date);
                      const formattedDate = dateObj.toLocaleDateString('th-TH', {
                        weekday: 'short',
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      });
                      return (
                        <option key={sch.schedule_id} value={sch.schedule_id}>
                          {formattedDate} {full ? '(เต็มแล้ว ✕)' : `(ว่าง ${schRemaining} ที่)`}
                        </option>
                      );
                    })}
                  </select>
                )}
              </div>

              {/* แถบสรุปจำนวนคนที่จองรอบนั้น (Progress bar) */}
              {selectedSchedule && (
                <div style={{
                  backgroundColor: '#f8fafc',
                  borderRadius: '16px',
                  padding: '14px 16px',
                  marginBottom: '18px',
                  border: `1px solid ${COLORS.border}`
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '8px', alignItems: 'center' }}>
                    <span style={{ color: '#475569', fontWeight: 'bold' }}>ยอดผู้จองปัจจุบัน:</span>
                    <strong style={{ color: isFull ? COLORS.red : COLORS.brown, fontSize: '14px' }}>
                      {bookedCount} / {maxCapacity} ท่าน
                    </strong>
                  </div>

                  <div style={{ height: '7px', backgroundColor: '#e2e8f0', borderRadius: '999px', overflow: 'hidden', marginBottom: '8px' }}>
                    <div style={{
                      width: `${progressPercent}%`,
                      height: '100%',
                      backgroundColor: isFull ? COLORS.red : COLORS.cyan,
                      borderRadius: '999px',
                      transition: 'width 0.4s ease'
                    }} />
                  </div>

                  <div style={{ fontSize: '11px', fontWeight: 'bold', color: isFull ? COLORS.red : (bookedCount >= minCapacity ? '#059669' : '#d97706') }}>
                    {isFull
                      ? '❌ ขออภัย รอบนี้เต็มจำนวนแล้ว'
                      : bookedCount >= minCapacity
                        ? '✅ ทริปนี้การันตีออกเดินทางแน่นอน (ครบ 4 ท่านแล้ว)'
                        : `⏳ ต้องการอีก ${minCapacity - bookedCount} ท่านเพื่อยืนยันการเดินทาง`}
                  </div>
                </div>
              )}

              {/* ปุ่มจองแพ็กเกจ */}
              <button
                type="button"
                disabled={isFull || !selectedSchedule}
                onClick={handleBookingAction}
                style={{
                  width: '100%',
                  backgroundColor: isFull ? '#94a3b8' : COLORS.red,
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '16px',
                  padding: '15px',
                  fontSize: '16px',
                  fontWeight: '900',
                  cursor: isFull ? 'not-allowed' : 'pointer',
                  boxShadow: isFull ? 'none' : '0 6px 18px rgba(231, 25, 31, 0.35)',
                  transition: 'all 0.2s ease',
                  opacity: isFull ? 0.75 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
                onMouseEnter={(e) => {
                  if (!isFull) e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  if (!isFull) e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                {isFull ? (
                  <>
                    <span>รอบนี้เต็มแล้ว</span>
                    <span>✕</span>
                  </>
                ) : (
                  <>
                    <span>จองแพ็กเกจทัวร์นี้</span>
                    <span>➔</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* ================= ฝั่งขวา: รายละเอียด & ไทม์ไลน์ ================= */}
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: '900', margin: '0 0 10px 0', color: COLORS.brown, lineHeight: 1.35 }}>
              {tour.package_name}
            </h1>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', fontSize: '12px', color: COLORS.textMuted, marginBottom: '14px' }}>
              <span>⏱️ {tour.duration || '1 วัน (One-Day Trip)'}</span>
              <span>⛩️ ไป-กลับ 1 วัน</span>
              <span>🚐 รวมรถตู้รับ-ส่งตลอดทริป</span>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
              {(tour.category_name ? tour.category_name.split(/[,&]/) : ['สายมู & เสริมดวง']).map((cat, idx) => (
                <span
                  key={idx}
                  style={{
                    backgroundColor: '#fffdf0',
                    color: COLORS.brown,
                    border: `1.5px solid ${COLORS.yellow}`,
                    fontSize: '12px',
                    fontWeight: 'bold',
                    padding: '6px 14px',
                    borderRadius: '9999px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    boxShadow: '0 2px 6px rgba(253, 213, 1, 0.25)'
                  }}
                >
                  ✨ {cat.trim()}
                </span>
              ))}
            </div>

            {tour.description && (
              <div style={{
                backgroundColor: COLORS.card,
                padding: '16px 20px',
                borderRadius: '16px',
                border: `1.5px solid ${COLORS.border}`,
                color: COLORS.textMain,
                fontSize: '13px',
                lineHeight: '1.6',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
              }}>
                <span style={{ fontSize: '18px' }}>🚩</span>
                <div>{tour.description}</div>
              </div>
            )}

            {/* ตารางกำหนดการเดินทาง (Itinerary) */}
            <div style={{
              backgroundColor: COLORS.card,
              borderRadius: '26px',
              padding: '26px 28px',
              boxShadow: '0 4px 18px rgba(0,0,0,0.03)',
              border: `1.5px solid ${COLORS.border}`
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '26px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '18px' }}>🧭</span>
                  <h2 style={{ fontSize: '17px', fontWeight: '900', margin: 0, color: COLORS.brown }}>
                    ตารางกำหนดการเดินทาง (Itinerary)
                  </h2>
                </div>
                <span style={{
                  color: '#013a3d',
                  backgroundColor: COLORS.cyan,
                  fontSize: '11px',
                  fontWeight: 'bold',
                  padding: '4px 12px',
                  borderRadius: '9999px'
                }}>
                  เที่ยวครบจบในวันเดียว
                </span>
              </div>

              {/* ไทม์ไลน์แต่ละช่วง */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {itineraries.map((item, idx) => {
                  const isTransport = item.activity_type === 'transport';
                  const isMeal = item.activity_type === 'meal';
                  const directPhoto = item.image_url || item.image_path || '';

                  return (
                    <div key={item.itinerary_id || idx} style={{ display: 'flex', gap: '16px', position: 'relative' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '38px', flexShrink: 0 }}>
                        <div style={{
                          width: '38px',
                          height: '38px',
                          borderRadius: '50%',
                          backgroundColor: isTransport ? '#f1f5f9' : isMeal ? COLORS.cyan : COLORS.yellow,
                          color: isTransport ? COLORS.textMuted : isMeal ? '#013a3d' : COLORS.brown,
                          border: isTransport ? `1.5px solid ${COLORS.border}` : 'none',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '18px',
                          zIndex: 2
                        }}>
                          {isTransport ? '🚐' : isMeal ? '🍲' : '🛕'}
                        </div>
                        {idx !== itineraries.length - 1 && (
                          <div style={{ width: '2px', flexGrow: 1, borderLeft: `2px dashed ${COLORS.border}`, margin: '6px 0' }} />
                        )}
                      </div>

                      <div style={{
                        flex: 1,
                        backgroundColor: COLORS.card,
                        border: `1.5px solid ${COLORS.border}`,
                        borderRadius: '18px',
                        padding: '16px 20px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <span style={{ fontSize: '13px', fontWeight: '900', color: COLORS.red }}>
                            ⏰ {item.time_start} - {item.time_end}
                          </span>
                          {item.duration_text && (
                            <span style={{ fontSize: '11px', color: COLORS.textMuted, backgroundColor: '#f8fafc', border: `1px solid ${COLORS.border}`, padding: '3px 10px', borderRadius: '9999px', fontWeight: '600' }}>
                              ⏱️ {item.duration_text}
                            </span>
                          )}
                        </div>

                        <h3 style={{ fontSize: '15px', fontWeight: '800', margin: '0 0 8px 0', color: COLORS.brown }}>
                          {item.title}
                        </h3>

                        <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                          {directPhoto && (
                            <div style={{
                              width: '84px',
                              height: '64px',
                              borderRadius: '12px',
                              overflow: 'hidden',
                              flexShrink: 0,
                              backgroundColor: '#f1f5f9',
                              border: `1px solid ${COLORS.border}`,
                              boxShadow: '0 2px 6px rgba(0,0,0,0.05)'
                            }}>
                              <img
                                src={directPhoto}
                                alt={item.title}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                onError={(e) => { e.target.parentElement.style.display = 'none'; }}
                              />
                            </div>
                          )}

                          <div style={{ fontSize: '12px', color: COLORS.textMain, lineHeight: '1.65', flex: 1 }}>
                            {item.location && <div><strong style={{ color: COLORS.red }}>📍 ที่ตั้ง:</strong> {item.location}</div>}
                            {item.blessing_aspect && <div style={{ color: '#d97706', fontWeight: 'bold' }}>✨ <strong>มูเรื่อง:</strong> {item.blessing_aspect}</div>}
                            {item.highlight && <div style={{ color: COLORS.textMuted }}>🎯 <strong>ไฮไลต์:</strong> {item.highlight}</div>}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

            </div>
          </div>

        </div>
      </div>

      {/* ======================================================== */}
      {/* Custom Modal เตือนเมื่อยังไม่ได้ Login ก่อนจองทัวร์             */}
      {/* ======================================================== */}
      {loginModal && (
        <div onClick={() => setLoginModal(false)} style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(5px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div onClick={(e) => e.stopPropagation()} style={{
            backgroundColor: '#ffffff',
            borderRadius: '24px',
            padding: '36px 30px',
            maxWidth: '400px',
            width: '100%',
            textAlign: 'center',
            boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
            border: `1.5px solid ${COLORS.border}`
          }}>
            <div style={{ fontSize: '42px', marginBottom: '12px' }}>🔒</div>
            <h3 style={{ fontSize: '18px', fontWeight: '900', color: COLORS.brown, margin: '0 0 8px 0' }}>
              กรุณาเข้าสู่ระบบก่อนจองทัวร์
            </h3>
            <p style={{ fontSize: '13px', color: COLORS.textMuted, margin: '0 0 24px 0', lineHeight: '1.5' }}>
              คุณต้องเข้าสู่ระบบสมาชิก OUTSY! ก่อนจึงจะสามารถจองแพ็กเกจทัวร์ได้
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setLoginModal(false)}
                style={{
                  flex: 1,
                  backgroundColor: '#f1f5f9',
                  color: '#475569',
                  border: 'none',
                  padding: '12px',
                  borderRadius: '14px',
                  fontWeight: 'bold',
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={() => navigate('/login')}
                style={{
                  flex: 1,
                  backgroundColor: COLORS.red,
                  color: '#ffffff',
                  border: 'none',
                  padding: '12px',
                  borderRadius: '14px',
                  fontWeight: '900',
                  fontSize: '13px',
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(231,25,31,0.3)'
                }}
              >
                ไปหน้าเข้าสู่ระบบ ➔
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}