import { useState, useEffect, useRef } from 'react';
import { useParams, useLocation, useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../client';
import { requireChangedRow } from '../lib/privateDocuments';
import { confirmPayment } from '../lib/bookingPayment';

export default function Booking() {
  const { id } = useParams();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const theme = { red: '#e7191f', yellow: '#fdd501', cyan: '#2bcdd1', brown: '#573e33', bg: '#f6f8fb', card: '#ffffff', border: '#e6ebf1', textMuted: '#738096' };

  const packageId = id || location.state?.package_id || searchParams.get('package_id');
  const initialDate = location.state?.travelDate || searchParams.get('date') || '';

  const [tourPackage, setTourPackage] = useState(location.state?.tourPackage || null);
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState(2);
  const [submitting, setSubmitting] = useState(false);
  const [bookingRefId, setBookingRefId] = useState('');
  const [slipFile, setSlipFile] = useState(null);
  const [formError, setFormError] = useState('');

  const paymentProgressRef = useRef({});
  const createdBookingIdRef = useRef(null);

  const firstNameRef = useRef(null);
  const lastNameRef = useRef(null);
  const emailRef = useRef(null);
  const phoneRef = useRef(null);

  const [missingFields, setMissingFields] = useState({ firstName: false, lastName: false, email: false, phone: false });
  const [customer, setCustomer] = useState({ firstName: '', lastName: '', email: '', phone: '', paymentMethod: 'promptpay', specialDiet: 'none', specialNotes: '' });
  const [additionalTravelers, setAdditionalTravelers] = useState([]);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          alert('กรุณาเข้าสู่ระบบก่อนทำการจองทัวร์');
          navigate('/login', { state: { returnUrl: location.pathname + location.search } });
          return;
        }

        if (session.user?.email) {
          setCustomer((prev) => ({
            ...prev,
            email: prev.email || session.user.email,
            firstName: prev.firstName || session.user.user_metadata?.first_name || '',
            lastName: prev.lastName || session.user.user_metadata?.last_name || '',
          }));
        }

        if (!packageId) { setLoading(false); return; }

        const { data: pkgData } = await supabase.from('Tour_Packages').select('*').eq('package_id', packageId).maybeSingle();
        if (pkgData) setTourPackage(pkgData);

        const { data: schData } = await supabase.from('Tour_Schedules').select('*').eq('package_id', packageId).order('travel_date', { ascending: true });
        if (schData && schData.length > 0) {
          setSchedules(schData);
          if (!initialDate) setSelectedDate(schData[0].travel_date);
        }
      } catch (err) {
        console.error('Error fetching booking data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [packageId, initialDate, navigate, location.pathname, location.search]);

  const totalPassengers = 1 + additionalTravelers.length;

  const handleAddTraveler = () => {
    if (totalPassengers >= 10) { setFormError('สามารถจองได้สูงสุด 10 ท่านต่อ 1 รายการ'); return; }
    setFormError('');
    setAdditionalTravelers((prev) => [...prev, { id: `${Date.now()}-${Math.random()}`, firstName: '', lastName: '', phone: '' }]);
  };

  const handleRemoveTraveler = (travelerId) => {
    setAdditionalTravelers((prev) => prev.filter((traveler) => traveler.id !== travelerId));
    setFormError('');
  };

  const handleTravelerChange = (travelerId, field, value) => {
    if (field === 'phone') {
      const numericValue = value.replace(/\D/g, '');
      setAdditionalTravelers((prev) => prev.map((traveler) => traveler.id === travelerId ? { ...traveler, [field]: numericValue } : traveler));
    } else {
      setAdditionalTravelers((prev) => prev.map((traveler) => traveler.id === travelerId ? { ...traveler, [field]: value } : traveler));
    }
    if (formError) setFormError('');
  };

  const pricePerPerson = Number(tourPackage?.price || 0);
  const netTotal = pricePerPerson * totalPassengers;

  const handleProceedToPayment = async (e) => {
    e.preventDefault();
    if (bookingRefId) { setFormError(`มีรายการจอง #${bookingRefId} แล้ว กรุณาตรวจประวัติหรือติดต่อผู้ดูแลก่อนจองซ้ำ`); return; }
    setFormError('');

    const missing = {
      firstName: !customer.firstName.trim(),
      lastName: !customer.lastName.trim(),
      email: !customer.email.trim(),
      phone: !customer.phone.trim(),
    };
    setMissingFields(missing);

    if (missing.firstName) {
      setFormError('กรุณากรอกชื่อของผู้จอง');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      firstNameRef.current?.focus();
      return;
    }
    if (missing.lastName) {
      setFormError('กรุณากรอกนามสกุลของผู้จอง');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      lastNameRef.current?.focus();
      return;
    }
    if (missing.email) {
      setFormError('กรุณากรอกอีเมลของผู้จอง');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      emailRef.current?.focus();
      return;
    }
    if (missing.phone) {
      setFormError('กรุณากรอกหมายเลขโทรศัพท์ของผู้จอง');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      phoneRef.current?.focus();
      return;
    }

    const phoneRegex = /^[0-9]+$/;
    if (!phoneRegex.test(customer.phone.trim())) {
      setFormError('กรุณากรอกหมายเลขโทรศัพท์เป็นตัวเลขเท่านั้น');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      phoneRef.current?.focus();
      return;
    }

    for (let i = 0; i < additionalTravelers.length; i++) {
      const tPhone = additionalTravelers[i].phone;
      if (tPhone && tPhone.trim() && !phoneRegex.test(tPhone.trim())) {
        setFormError(`กรุณากรอกเบอร์โทรศัพท์ของผู้เดินทางคนที่ ${i + 2} เป็นตัวเลขเท่านั้น`);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
    }

    const matchedSchedule = schedules.find(schedule => schedule.travel_date === selectedDate);
    if (!matchedSchedule || !selectedDate) { setFormError('กรุณาเลือกรอบเดินทางก่อนดำเนินการต่อ'); return; }
    const remaining = Number(matchedSchedule.max_capacity || 10) - Number(matchedSchedule.booked_count || 0);
    if (totalPassengers > remaining) { setFormError(`รอบนี้เหลือที่ว่าง ${Math.max(0, remaining)} ที่นั่ง`); return; }
    setSlipFile(null);
    setCurrentStep(3);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const persistBooking = async () => {
    if (createdBookingIdRef.current) throw new Error(`มีรายการจอง #${createdBookingIdRef.current} ที่บันทึกยังไม่ครบ กรุณาติดต่อผู้ดูแลก่อนทำรายการซ้ำ`);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/login');
        throw new Error('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่อีกครั้ง');
      }

      const { data: matchedSchedule, error: latestScheduleError } = await supabase.from('Tour_Schedules').select('*').eq('package_id', tourPackage?.package_id || packageId).eq('travel_date', selectedDate).maybeSingle();
      if (latestScheduleError || !matchedSchedule) throw new Error('ตรวจสอบรอบเดินทางล่าสุดไม่ได้ กรุณาลองใหม่');
      if (/cancel|closed|ยกเลิก|ปิด/i.test(matchedSchedule.status || '')) throw new Error('รอบเดินทางนี้ปิดรับการจองแล้ว');
      const scheduleId = matchedSchedule?.tour_date_id || matchedSchedule?.schedule_id;

      if (matchedSchedule) {
        const booked = Number(matchedSchedule.booked_count || 0);
        const max = Number(matchedSchedule.max_capacity || 10);
        const remaining = max - booked;

        if (totalPassengers > remaining) {
          throw new Error(`ขออภัย รอบวันที่ ${selectedDate} เหลือที่ว่างเพียง ${Math.max(0, remaining)} ที่นั่ง ไม่เพียงพอสำหรับ ${totalPassengers} ท่าน`);
        }
      }

      const insertRecord = {
        package_id: String(tourPackage?.package_id || packageId),
        customer_name: `${customer.firstName.trim()} ${customer.lastName.trim()}`,
        customer_email: customer.email.trim(),
        customer_phone: customer.phone.trim(),
        travel_date: selectedDate || new Date().toISOString().split('T')[0],
        number_people: Number(totalPassengers),
        total_price: Number(netTotal),
        booking_status: 'รอชำระเงิน',
        special_diet: customer.specialDiet || 'none',
        special_notes: customer.specialNotes || '',
        user_id: user.id,
      };

      if (scheduleId !== undefined && scheduleId !== null && !isNaN(scheduleId)) {
        insertRecord.tour_date_id = Number(scheduleId);
      }

      const { data: bookingData, error: bookingError } = await supabase.from('bookings').insert([insertRecord]).select().single();
      if (bookingError) throw new Error(bookingError.code === '42501' ? 'ระบบยังไม่อนุญาตให้บัญชีนี้สร้างการจอง กรุณาติดต่อผู้ดูแลเพื่อตรวจสิทธิ์ Supabase' : `บันทึกการจองไม่สำเร็จ: ${bookingError.message}`);
      if (!bookingData) throw new Error('ไม่สามารถสร้างรายการจองได้');

      const generatedBookingId = bookingData.booking_id;
      createdBookingIdRef.current = generatedBookingId;
      setBookingRefId(String(generatedBookingId));
      const validTravelers = additionalTravelers.filter((t) => t.firstName.trim() || t.lastName.trim() || t.phone.trim());

      if (validTravelers.length > 0) {
        const travelerRecords = validTravelers.map((traveler) => ({
          booking_id: generatedBookingId,
          full_name: `${traveler.firstName.trim()} ${traveler.lastName.trim()}`.trim() || 'ผู้เดินทาง',
          phone: traveler.phone.trim() || null,
        }));

        const { error: travelerInsertError } = await supabase.from('booking_travelers').insert(travelerRecords);
        if (travelerInsertError) {
          const { data: removed, error: rollbackError } = await supabase.from('bookings').delete().eq('booking_id', generatedBookingId).select('booking_id').maybeSingle();
          if (rollbackError || !removed) throw new Error(`มีรายการจอง #${generatedBookingId} แล้ว แต่บันทึกผู้เดินทางไม่ครบ กรุณาติดต่อผู้ดูแลก่อนจองซ้ำ`);
          setBookingRefId('');
          createdBookingIdRef.current = null;
          throw new Error('บันทึกผู้เดินทางไม่สำเร็จ และยกเลิกรายการที่เพิ่งสร้างแล้ว กรุณาตรวจสอบข้อมูลก่อนลองใหม่');
        }
      }

      if (selectedDate && (tourPackage?.package_id || packageId)) {
        const currentPkgId = tourPackage?.package_id || packageId;
        const { data: schCurrent, error: scheduleError } = await supabase.from('Tour_Schedules').select('schedule_id, booked_count').eq('package_id', currentPkgId).eq('travel_date', selectedDate).maybeSingle();

        if (scheduleError || !schCurrent) throw new Error(`มีรายการจอง #${generatedBookingId} แล้ว แต่ตรวจรอบเดินทางไม่ได้ กรุณาติดต่อผู้ดูแลก่อนจองซ้ำ`);
        if (schCurrent) {
          const currentBooked = Number(schCurrent.booked_count || 0);
          const newBooked = currentBooked + Number(totalPassengers);
          const { data: changedSchedule, error: capacityError } = await supabase.from('Tour_Schedules').update({ booked_count: newBooked }).eq('schedule_id', schCurrent.schedule_id).select('schedule_id').maybeSingle();
          if (capacityError || !changedSchedule) {
            throw new Error(`สร้างการจอง #${generatedBookingId} แล้ว แต่บันทึกจำนวนที่นั่งไม่ได้ กรุณาติดต่อผู้ดูแลก่อนจองซ้ำ`);
          }
        }
      }

      const generatedId = String(generatedBookingId);
      setBookingRefId(generatedId);
      localStorage.setItem('outsy_last_booking_email', customer.email.trim());
      localStorage.setItem('outsy_last_booking_id', generatedId);
      return generatedId;
    } catch (err) {
      console.error('Booking insertion error:', err);
      throw err;
    }
  };

  const handleFinishPayment = async () => {
    if (paymentProgressRef.current.inFlight) return;
    setFormError('');
    setSubmitting(true);
    try {
      await confirmPayment({
        file: slipFile,
        progress: paymentProgressRef.current,
        createBooking: persistBooking,
        uploadSlip: async (bookingId, file) => {
          const ext = ({'image/jpeg':'jpg','image/png':'png','image/webp':'webp'})[file.type];
          const path = `slip_${bookingId}_${Date.now()}.${ext}`;
          const { error } = await supabase.storage.from('slips').upload(path, file, { upsert: false, contentType: file.type });
          if (error) throw new Error(`อัปโหลดสลิปไม่สำเร็จ: ${error.message}`);
          return path;
        },
        markPaid: async (bookingId, path) => {
          const { data, error } = await supabase.from('bookings').update({ booking_status: 'รอตรวจสอบยอด', slip: path }).eq('booking_id', bookingId).select('booking_id').maybeSingle();
          requireChangedRow({ data, error }, 'อัปเดตสถานะการจองไม่ได้ กรุณาตรวจสอบสิทธิ์กับผู้ดูแล');
        },
      });
      setCurrentStep(4);
    } catch (err) {
      setFormError(err.message || 'ไม่สามารถบันทึกการจองและการชำระเงินได้');
    } finally { setSubmitting(false); }
  };

  const handleGoToHistory = () => {
    navigate('/history', { state: { email: customer.email.trim(), bookingId: bookingRefId } });
  };

  if (loading) {
    return (
      <div style={{ padding: '140px 20px', textAlign: 'center', color: theme.brown, fontFamily: "'Prompt', sans-serif" }}>
        <div style={{ fontSize: '36px', marginBottom: '10px' }}>🧭</div>
        <h2>กำลังเตรียมหน้าการจอง Outsy...</h2>
      </div>
    );
  }

  if (!tourPackage) {
    return (
      <div style={{ padding: '140px 20px', textAlign: 'center', color: theme.brown, fontFamily: "'Prompt', sans-serif" }}>
        <h2>ไม่พบข้อมูลแพ็กเกจทัวร์</h2>
        <button onClick={() => navigate('/packages')} style={{ backgroundColor: theme.red, color: '#fff', border: 'none', padding: '10px 22px', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold', marginTop: '16px' }}>กลับไปหน้ารวมแพ็กเกจ</button>
      </div>
    );
  }

  return (
    <div className="outsy-page page-booking" style={{ backgroundColor: theme.bg, minHeight: '100vh', padding: '100px 24px 80px', fontFamily: "'Prompt', -apple-system, BlinkMacSystemFont, sans-serif", color: '#2d3748' }}>
      <div style={{ maxWidth: '1180px', margin: '0 auto' }}>

        {/* STEP INDICATOR */}
        <div className="responsive-row" style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px', fontSize: '14px', flexWrap: 'wrap' }}>
          <div className="responsive-row" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: theme.cyan, fontWeight: 'bold', cursor: 'pointer' }} onClick={() => navigate('/packages')}>
            <span style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: theme.cyan, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}>✓</span>เลือกแพ็กเกจทัวร์
          </div>
          <span style={{ color: '#cbd5e1' }}>›</span>
          <div className="responsive-row" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: currentStep === 2 ? theme.red : currentStep > 2 ? theme.cyan : theme.brown, fontWeight: 'bold' }}>
            <span style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: currentStep === 2 ? theme.red : currentStep > 2 ? theme.cyan : '#94a3b8', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}>{currentStep > 2 ? '✓' : '2'}</span>กรอกรายละเอียด
          </div>
          <span style={{ color: '#cbd5e1' }}>›</span>
          <div className="responsive-row" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: currentStep >= 3 ? theme.red : '#94a3b8', fontWeight: currentStep >= 3 ? 'bold' : 'normal' }}>
            <span style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: currentStep >= 3 ? theme.red : '#cbd5e1', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}>{currentStep === 4 ? '✓' : '3'}</span>ยืนยันการจอง & ชำระเงิน
          </div>
        </div>

        {/* STEP 2 */}
        {currentStep === 2 && (
          <div className="responsive-grid page-columns" style={{ display: 'grid', gridTemplateColumns: '1.45fr 1fr', gap: '28px', alignItems: 'start' }}>
            
            {/* LEFT */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {formError && (
                <div className="responsive-panel" style={{ backgroundColor: '#fff1f2', border: `1.5px solid ${theme.red}`, borderRadius: '14px', padding: '14px 18px', color: theme.red, fontSize: '13px', fontWeight: 'bold' }}>⚠️ {formError}</div>
              )}

              <div className="responsive-panel" style={{ backgroundColor: theme.card, borderRadius: '20px', padding: '28px', border: `1px solid ${theme.border}`, boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
                <div className="responsive-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px', gap: '15px' }}>
                  <div>
                    <h2 style={{ fontSize: '20px', fontWeight: 'bold', margin: '0 0 4px', color: theme.brown }}>ข้อมูลผู้เดินทาง</h2>
                    <p style={{ margin: 0, fontSize: '12px', color: theme.textMuted }}>กรุณากรอกข้อมูลผู้จอง และรายชื่อผู้เดินทางเพิ่มเติม</p>
                  </div>
                  <button type="button" onClick={handleAddTraveler} style={{ background: 'none', border: 'none', color: theme.red, fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', padding: '4px 8px', textDecoration: 'underline', whiteSpace: 'nowrap' }}>
                    + เพิ่มผู้เดินทางใหม่ ({totalPassengers}/10)
                  </button>
                </div>

                {/* BOOKER */}
                <div style={{ marginTop: '20px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 'bold', color: theme.brown, marginBottom: '12px' }}>ผู้จองหลัก</div>
                  
                  <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                    <div>
                      <label style={labelStyle}>ชื่อ *</label>
                      <input ref={firstNameRef} type="text" placeholder="กรอกชื่อจริง" value={customer.firstName} onChange={(e) => { setCustomer({ ...customer, firstName: e.target.value }); if (formError) setFormError(''); if (missingFields.firstName) setMissingFields({ ...missingFields, firstName: false }); }} style={{ ...inputStyle, borderColor: missingFields.firstName ? theme.red : '#e2e8f0' }} />
                    </div>
                    <div>
                      <label style={labelStyle}>นามสกุล *</label>
                      <input ref={lastNameRef} type="text" placeholder="กรอกนามสกุล" value={customer.lastName} onChange={(e) => { setCustomer({ ...customer, lastName: e.target.value }); if (formError) setFormError(''); if (missingFields.lastName) setMissingFields({ ...missingFields, lastName: false }); }} style={{ ...inputStyle, borderColor: missingFields.lastName ? theme.red : '#e2e8f0' }} />
                    </div>
                  </div>

                  <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1.1fr', gap: '16px', marginBottom: '6px' }}>
                    <div>
                      <label style={labelStyle}>อีเมล *</label>
                      <input ref={emailRef} type="email" placeholder="yourname@email.com" value={customer.email} onChange={(e) => { setCustomer({ ...customer, email: e.target.value }); if (formError) setFormError(''); if (missingFields.email) setMissingFields({ ...missingFields, email: false }); }} style={{ ...inputStyle, borderColor: missingFields.email ? theme.red : '#e2e8f0' }} />
                    </div>
                    <div>
                      <label style={labelStyle}>หมายเลขโทรศัพท์ * (เฉพาะตัวเลข)</label>
                      <div className="responsive-row" style={{ display: 'flex', gap: '8px' }}>
                        <div className="responsive-panel" style={{ padding: '11px 12px', backgroundColor: '#f8fafc', border: `1px solid ${theme.border}`, borderRadius: '12px', fontSize: '13px', fontWeight: 'bold', color: '#64748b' }}>(+66)</div>
                        <input ref={phoneRef} type="tel" inputMode="numeric" placeholder="08X-XXX-XXXX" value={customer.phone} onChange={(e) => { const val = e.target.value.replace(/\D/g, ''); setCustomer({ ...customer, phone: val }); if (formError) setFormError(''); if (missingFields.phone) setMissingFields({ ...missingFields, phone: false }); }} style={{ ...inputStyle, flex: 1, borderColor: missingFields.phone ? theme.red : '#e2e8f0' }} />
                      </div>
                    </div>
                  </div>
                  <span style={{ fontSize: '11px', color: theme.textMuted }}>เราจะส่งอีเมลยืนยันการจองไปที่อีเมลนี้</span>
                </div>

                {/* ADDITIONAL TRAVELERS */}
                {additionalTravelers.length > 0 && (
                  <div style={{ marginTop: '24px', borderTop: `1px dashed ${theme.border}`, paddingTop: '18px' }}>
                    <div style={{ fontSize: '14px', fontWeight: 'bold', color: theme.brown, marginBottom: '5px' }}>รายชื่อผู้เดินทางเพิ่มเติม (ไม่บังคับ)</div>
                    <div style={{ fontSize: '11px', color: theme.textMuted, marginBottom: '12px' }}>กรอกชื่อ-นามสกุล และเบอร์โทรศัพท์ (เฉพาะตัวเลข ถ้ามี)</div>

                    {additionalTravelers.map((traveler, index) => (
                      <div className="responsive-grid traveler-fields" key={traveler.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.1fr 40px', gap: '10px', alignItems: 'center', marginBottom: '10px' }}>
                        <input type="text" placeholder="ชื่อ" value={traveler.firstName} onChange={(e) => handleTravelerChange(traveler.id, 'firstName', e.target.value)} style={inputStyle} />
                        <input type="text" placeholder="นามสกุล" value={traveler.lastName} onChange={(e) => handleTravelerChange(traveler.id, 'lastName', e.target.value)} style={inputStyle} />
                        <input type="tel" inputMode="numeric" placeholder="เบอร์โทร (เฉพาะตัวเลข)" value={traveler.phone || ''} onChange={(e) => handleTravelerChange(traveler.id, 'phone', e.target.value)} style={inputStyle} />
                        <button type="button" onClick={() => handleRemoveTraveler(traveler.id)} style={{ backgroundColor: '#fff1f2', color: theme.red, border: `1px solid ${theme.red}`, borderRadius: '10px', height: '42px', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* SPECIAL REQUEST */}
              <div className="responsive-panel" style={{ backgroundColor: theme.card, borderRadius: '20px', padding: '26px', border: `1px solid ${theme.border}` }}>
                <h3 style={{ fontSize: '17px', fontWeight: 'bold', margin: '0 0 4px', color: theme.brown }}>คำขอพิเศษ (หากมี)</h3>
                <p style={{ margin: '0 0 16px', fontSize: '12px', color: theme.textMuted }}>ทีมงาน Outsy จะพยายามอย่างดีที่สุดในการดูแลคำขอพิเศษของท่าน</p>

                <div style={{ marginBottom: '14px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>ข้อจำกัดด้านอาหาร</label>
                  <div className="responsive-row" style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                    <label style={radioLabelStyle}><input type="radio" checked={customer.specialDiet === 'none'} onChange={() => setCustomer({ ...customer, specialDiet: 'none' })} style={{ accentColor: theme.cyan }} />ทั่วไป</label>
                    <label style={radioLabelStyle}><input type="radio" checked={customer.specialDiet === 'vegetarian'} onChange={() => setCustomer({ ...customer, specialDiet: 'vegetarian' })} style={{ accentColor: theme.cyan }} />มังสวิรัติ</label>
                    <label style={radioLabelStyle}><input type="radio" checked={customer.specialDiet === 'vegan'} onChange={() => setCustomer({ ...customer, specialDiet: 'vegan' })} style={{ accentColor: theme.cyan }} />วีแกน</label>
                    <label style={radioLabelStyle}><input type="radio" checked={customer.specialDiet === 'halal'} onChange={() => setCustomer({ ...customer, specialDiet: 'halal' })} style={{ accentColor: theme.cyan }} />ฮาลาล</label>
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>หมายเหตุเพิ่มเติม</label>
                  <input type="text" placeholder="เช่น แพ้อาหาร, ต้องการที่นั่งพิเศษ" value={customer.specialNotes} onChange={(e) => setCustomer({ ...customer, specialNotes: e.target.value })} style={inputStyle} />
                </div>
              </div>

              {/* PAYMENT METHOD */}
              <div className="responsive-panel" style={{ backgroundColor: theme.card, borderRadius: '20px', padding: '26px', border: `1px solid ${theme.border}` }}>
                <h3 style={{ fontSize: '17px', fontWeight: 'bold', margin: '0 0 16px', color: theme.brown }}>คุณต้องการชำระเงินด้วยวิธีใด?</h3>
                <div className="responsive-panel" style={{ border: `2px solid ${theme.cyan}`, borderRadius: '14px', padding: '16px', backgroundColor: '#faffff' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 'bold', fontSize: '14px', color: theme.brown }}>
                    <input type="radio" checked readOnly style={{ accentColor: theme.cyan, width: '18px', height: '18px' }} />สแกนเพื่อชำระเงิน (PromptPay QR Code)
                  </label>
                  <p style={{ margin: '8px 0 0', fontSize: '12px', color: theme.textMuted, paddingLeft: '28px' }}>ชำระเงินในหน้าถัดไป พร้อมแนบสลิปเพื่อยืนยันยอด</p>
                </div>
              </div>

              {/* SUBMIT */}
              <div>
                <button type="button" onClick={handleProceedToPayment} disabled={submitting} style={{ width: '100%', backgroundColor: theme.red, color: '#ffffff', border: 'none', padding: '16px', borderRadius: '16px', fontSize: '18px', fontWeight: '900', cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1, boxShadow: '0 6px 18px rgba(231, 25, 31, 0.35)' }}>
                  {submitting ? 'กำลังดำเนินการ...' : 'ขั้นตอนสุดท้าย (ไปหน้าชำระเงิน) ➔'}
                </button>
              </div>
            </div>

            {/* RIGHT */}
            <div className="responsive-sticky" style={{ display: 'flex', flexDirection: 'column', gap: '20px', position: 'sticky', top: '100px' }}>
              <div className="responsive-panel" style={{ backgroundColor: theme.card, borderRadius: '20px', padding: '22px', border: `1px solid ${theme.border}` }}>
                <div className="responsive-row" style={{ display: 'flex', gap: '14px', marginBottom: '16px' }}>
                  <img src={tourPackage.image_path ? tourPackage.image_path.split(',')[0].trim() : 'https://images.unsplash.com/photo-1528181304800-259b08848526?w=600'} alt={tourPackage.package_name} style={{ width: '90px', height: '90px', borderRadius: '14px', objectFit: 'cover' }} />
                  <div>
                    <span style={{ backgroundColor: theme.yellow, color: theme.brown, padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold' }}>{tourPackage.package_id}</span>
                    <h3 style={{ margin: '6px 0 4px', fontSize: '16px', fontWeight: 'bold', color: theme.brown, lineHeight: '1.3' }}>{tourPackage.package_name}</h3>
                  </div>
                </div>

                <div style={{ borderTop: `1px solid ${theme.border}`, paddingTop: '14px', fontSize: '13px', color: '#475569', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div>⏱️ <strong>ระยะเวลา:</strong> {tourPackage.duration || '1 วัน (One-Day Trip)'}</div>
                  <div>🚐 <strong>การเดินทาง:</strong> รวมรถตู้ VIP รับ-ส่งตลอดทริป พร้อมไกด์</div>
                  <div>🛕 <strong>รายละเอียด:</strong> {tourPackage.description}</div>
                </div>

                {/* DATE */}
                <div className="responsive-panel" style={{ marginTop: '16px', padding: '14px', backgroundColor: '#f8fafc', borderRadius: '12px', border: `1px solid ${theme.border}` }}>
                  <div style={{ fontSize: '11px', color: theme.textMuted, marginBottom: '2px' }}>รอบวันที่เดินทาง:</div>
                  <div style={{ fontWeight: 'bold', fontSize: '15px', color: theme.brown, marginBottom: '8px' }}>📅 {selectedDate || 'รอบวันเดินทางพิเศษ'}</div>
                  
                  {schedules.length > 0 && (
                    <select value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} style={{ ...inputStyle, padding: '8px 10px', fontSize: '12px' }}>
                      {schedules.map((schedule) => {
                        const remaining = (Number(schedule.max_capacity) || 10) - (Number(schedule.booked_count) || 0);
                        return (
                          <option key={schedule.schedule_id || schedule.tour_date_id} value={schedule.travel_date} disabled={remaining <= 0}>
                            รอบ {schedule.travel_date} {remaining <= 0 ? '(เต็มแล้ว)' : `(ว่างอีก ${remaining} ที่)`}
                          </option>
                        );
                      })}
                    </select>
                  )}
                </div>
              </div>

              {/* PRICE */}
              <div className="responsive-panel" style={{ backgroundColor: theme.card, borderRadius: '20px', padding: '24px', border: `1px solid ${theme.border}` }}>
                <h3 style={{ fontSize: '17px', fontWeight: 'bold', margin: '0 0 16px', color: theme.brown }}>รายละเอียดราคา</h3>
                <div className="responsive-row" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px' }}>
                  <span>ราคาต่อท่าน</span><span>฿{pricePerPerson.toLocaleString()}</span>
                </div>
                <div className="responsive-row" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '14px', fontSize: '14px' }}>
                  <span>จำนวนผู้เดินทาง</span><span style={{ fontWeight: 'bold', color: theme.cyan }}>{totalPassengers} ท่าน</span>
                </div>
                <div className="responsive-row" style={{ borderTop: `1.5px dashed ${theme.border}`, paddingTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                  <span style={{ fontSize: '16px', fontWeight: 'bold', color: theme.brown }}>ยอดชำระสุทธิ</span>
                  <span style={{ fontSize: '26px', fontWeight: '900', color: theme.red }}>฿{netTotal.toLocaleString()}</span>
                </div>
              </div>

              {/* CONDITIONS */}
              <div className="responsive-panel" style={{ backgroundColor: '#fffdf4', borderRadius: '18px', padding: '20px', border: '1.5px solid #f59e0b' }}>
                <h4 style={{ margin: '0 0 10px', fontSize: '14px', fontWeight: '900', color: '#b45309' }}>⚠️ เงื่อนไขการออกเดินทาง & นโยบายการยกเลิก</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12px', color: '#78350f', lineHeight: '1.6' }}>
                  <div>🚐 <strong>การออกเดินทาง:</strong> ทริปนี้จะออกเดินทางเมื่อมีผู้ร่วมทริปตั้งแต่ <strong>4 ท่านขึ้นไป</strong> หากรอบเดินทางมีผู้จองไม่ครบ ทางบริษัทขอยกเลิกทริป โดยจะแจ้งให้ทราบล่วงหน้าและ <strong style={{ color: '#047857', backgroundColor: '#d1fae5', padding: '1px 6px', borderRadius: '4px' }}>คืนเงินให้เต็มจำนวน 100%</strong></div>
                  <div style={{ borderTop: '1px dashed #fcd34d', paddingTop: '8px' }}>🗓️ <strong>การเลื่อน/ยกเลิก:</strong> สามารถเลื่อนวันเดินทางได้ล่วงหน้า 3 วันก่อนวันเดินทาง</div>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* STEP 3 - PAYMENT */}
        {currentStep === 3 && (
          <div className="responsive-panel" style={{ maxWidth: '500px', margin: '20px auto', backgroundColor: theme.card, borderRadius: '24px', padding: '32px', border: `1px solid ${theme.border}`, textAlign: 'center', boxShadow: '0 6px 24px rgba(0,0,0,0.06)' }}>
            <div className="responsive-panel" style={{ backgroundColor: theme.cyan, color: '#024245', padding: '6px 14px', borderRadius: '8px', display: 'inline-block', fontWeight: 'bold', fontSize: '13px', marginBottom: '14px' }}>PROMPTPAY QR CODE</div>
            <h2 style={{ margin: '0 0 6px', color: theme.brown }}>สแกนเพื่อชำระเงิน</h2>
            <p style={{ margin: '0 0 16px', fontSize: '13px', color: theme.textMuted }}>{bookingRefId ? <>รหัสการจอง: <b>#{bookingRefId}</b></> : 'ยังไม่บันทึกการจอง กรุณาแนบสลิปและกดแจ้งชำระเงินเสร็จสิ้นเพื่อยืนยัน'}</p>

            <div className="responsive-panel" style={{ border: `3px solid ${theme.yellow}`, borderRadius: '18px', padding: '16px', display: 'inline-block', backgroundColor: '#fff', marginBottom: '16px' }}>
              <img src={`/QR_Payment.jpg`} alt="PromptPay QR Code" style={{ width: '220px', height: '220px', display: 'block' }} />
              {/* <img src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=OUTSY_BOOKING_${bookingRefId}_AMOUNT_${netTotal}`} alt="PromptPay QR Code" style={{ width: '220px', height: '220px', display: 'block' }} /> */}
            </div>

            <div className="responsive-panel" style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '12px', marginBottom: '18px' }}>
              <span style={{ fontSize: '13px', color: '#64748b' }}>ยอดเงินที่ต้องชำระ: </span>
              <span style={{ fontSize: '26px', fontWeight: '900', color: theme.red }}>฿{netTotal.toLocaleString()}</span>
            </div>

            {formError && (
              <div className="responsive-panel" style={{ backgroundColor: '#fff1f2', border: `1px solid ${theme.red}`, color: theme.red, padding: '10px', borderRadius: '10px', fontSize: '12px', marginBottom: '15px' }}>{formError}</div>
            )}

            <div style={{ textAlign: 'left', marginBottom: '18px' }}>
              <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>แนบสลิปการโอนเงิน (Slip):</label>
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => { setSlipFile(e.target.files?.[0] || null); if (formError) setFormError(''); }} style={{ ...inputStyle, padding: '8px' }} />
            </div>

            <div className="responsive-row" style={{ display: 'flex', gap: '12px' }}>
              <button type="button" onClick={() => { setSlipFile(null); setFormError(''); setCurrentStep(2); }} disabled={submitting || !!bookingRefId} style={{ flex: 1, backgroundColor: '#f1f5f9', color: theme.brown, border: 'none', padding: '14px', borderRadius: '14px', fontWeight: 'bold', cursor: 'pointer' }}>ย้อนกลับ</button>
              <button type="button" onClick={handleFinishPayment} disabled={submitting} style={{ flex: 2, backgroundColor: theme.cyan, color: '#013a3d', border: 'none', padding: '14px', borderRadius: '14px', fontWeight: 'bold', cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1 }}>{submitting ? 'กำลังบันทึก...' : 'แจ้งชำระเงินเสร็จสิ้น ✓'}</button>
            </div>
          </div>
        )}

        {/* STEP 4 - SUCCESS */}
        {currentStep === 4 && (
          <div className="responsive-panel" style={{ maxWidth: '580px', margin: '30px auto', backgroundColor: theme.card, borderRadius: '24px', padding: '40px 32px', textAlign: 'center', border: `2px solid ${theme.cyan}`, boxShadow: '0 8px 30px rgba(0,0,0,0.06)' }}>
            <div className="responsive-row" style={{ width: '72px', height: '72px', backgroundColor: '#e6fafb', color: theme.cyan, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '38px', margin: '0 auto 18px', border: `2px solid ${theme.cyan}` }}>✓</div>
            <h2 style={{ fontSize: '24px', fontWeight: '900', color: theme.brown, margin: '0 0 8px' }}>ทำรายการจองสำเร็จเรียบร้อย!</h2>
            <p style={{ color: theme.textMuted, fontSize: '14px', margin: '0 0 24px', lineHeight: 1.6 }}>ระบบได้รับข้อมูลการจองและบันทึกในระบบ Outsy เรียบร้อยแล้ว</p>

            <div className="responsive-panel" style={{ backgroundColor: '#f8fafc', border: `1px solid ${theme.border}`, borderRadius: '16px', padding: '18px 22px', textAlign: 'left', marginBottom: '28px' }}>
              <SuccessRow label="รหัสการจอง (Booking ID)" value={`#${bookingRefId}`} />
              <SuccessRow label="แพ็กเกจทัวร์" value={tourPackage.package_name} />
              <SuccessRow label="รอบวันเดินทาง" value={selectedDate || 'รอบวันเดินทางพิเศษ'} />
              <SuccessRow label="จำนวนผู้เดินทาง" value={`${totalPassengers} ท่าน`} />
              <div className="responsive-row" style={{ display: 'flex', justifyContent: 'space-between', borderTop: `1.5px dashed ${theme.border}`, paddingTop: '10px', fontSize: '14px' }}>
                <span style={{ fontWeight: 'bold', color: theme.brown }}>ยอดเงินสุทธิ:</span>
                <span style={{ fontWeight: '900', color: theme.red, fontSize: '18px' }}>฿{netTotal.toLocaleString()}</span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button type="button" onClick={handleGoToHistory} style={{ width: '100%', backgroundColor: theme.red, color: '#ffffff', border: 'none', padding: '14px', borderRadius: '14px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}>ดูรายการที่ทำการจอง (ประวัติการจอง)</button>
              <button type="button" onClick={() => navigate('/packages')} style={{ width: '100%', backgroundColor: '#f1f5f9', color: theme.brown, border: 'none', padding: '12px', borderRadius: '14px', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer' }}>กลับไปเลือกดูแพ็กเกจอื่นๆ</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SuccessRow({ label, value }) {
  return (
    <div className="responsive-row" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '13px', gap: '15px' }}>
      <span style={{ color: '#738096' }}>{label}:</span>
      <span style={{ fontWeight: 'bold', color: '#573e33', textAlign: 'right' }}>{value}</span>
    </div>
  );
}

const labelStyle = { fontSize: '12px', display: 'block', marginBottom: '6px', fontWeight: 'bold', color: '#475569' };
const inputStyle = { width: '100%', padding: '11px 14px', borderRadius: '12px', border: '1.5px solid #e2e8f0', fontSize: '13px', outline: 'none', boxSizing: 'border-box', backgroundColor: '#ffffff' };
const miniInputStyle = { width: '100%', padding: '8px 12px', borderRadius: '10px', border: '1.5px solid #e2e8f0', fontSize: '12px', outline: 'none', boxSizing: 'border-box', backgroundColor: '#ffffff' };
const radioLabelStyle = { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' };