import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../client';
import { bookingAction, authenticatedUser } from '../services/booking';
import { uploadBookingDocument } from '../services/documents';
import PrivateDocumentImage from '../components/PrivateDocumentImage';
import { thaiError } from '../lib/errors';

export default function BookingHistory() {
  const navigate = useNavigate();
  const loadGeneration = useRef(0);
  const identityRef = useRef(null);

  const theme = {
    red: '#e7191f',
    yellow: '#fdd501',
    cyan: '#2bcdd1',
    brown: '#573e33',
    bg: '#f6f8fb',
    card: '#ffffff',
    border: '#e6ebf1',
    text: '#2d3748',
    textMuted: '#738096',
    pastelYellow: '#fff8d9',
    pastelMint: '#e8f8f7',
    pastelPink: '#fff1f1',
  };

  const [currentUser, setCurrentUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('ทั้งหมด');
  const [errorMessage, setErrorMessage] = useState('');
  const [uploadingBookingId, setUploadingBookingId] = useState(null);
  const [previewSlipUrl, setPreviewSlipUrl] = useState(null);

  const [rescheduleModal, setRescheduleModal] = useState({
    show: false,
    booking: null,
    newDate: '',
  });

  const [refundModal, setRefundModal] = useState({
    show: false,
    booking: null,
    bankName: 'กสิกรไทย',
    accountNo: '',
    accountName: '', // แก้ไขให้เริ่มต้นเป็นค่าว่าง ไม่ดึงอีเมลมาใส่
    email: '',
    phone: '',
    bookBankFile: null,
    submitting: false,
  });

  const [modalAlert, setModalAlert] = useState({
    show: false,
    title: '',
    message: '',
    icon: '✨',
  });

  const showAlertModal = (title, message, icon = '✨') => {
    setModalAlert({ show: true, title, message, icon });
  };

  const closeAlertModal = () => {
    setModalAlert({ show: false, title: '', message: '', icon: '✨' });
  };

  const loadTravelersForBookings = useCallback(async (bookingList) => {
    if (!bookingList.length) return {};
    const { data, error } = await supabase.from('booking_travelers')
      .select('traveler_id,booking_id,full_name,phone,created_at')
      .in('booking_id', bookingList.map(booking => booking.booking_id));
    if (error) throw error;
    const map = {};
    for (const traveler of data || []) {
      (map[traveler.booking_id] ||= []).push({ name: traveler.full_name, phone: traveler.phone || '' });
    }
    return map;
  }, []);

  const loadBookings = useCallback(async (user) => {
    const request = ++loadGeneration.current;
    if (!user || identityRef.current !== user.id) {
      setBookings([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setErrorMessage('');

      const query = supabase.from('bookings').select('*').eq('user_id', user.id);

      const { data: bList, error: bErr } = await query.order('created_at', { ascending: false });
      if (bErr) throw bErr;

      const userBookings = bList || [];
      if (userBookings.length === 0) {
        setBookings([]);
        setLoading(false);
        return;
      }

      const packageIds = [...new Set(userBookings.map((b) => b.package_id).filter(Boolean))];
      let packageList = [];

      if (packageIds.length > 0) {
        const { data: pList } = await supabase.from('Tour_Packages').select('*').in('package_id', packageIds);
        packageList = pList || [];
      }

      const packageMap = {};
      packageList.forEach((pkg) => { packageMap[pkg.package_id] = pkg; });

      const travelerMap = await loadTravelersForBookings(userBookings);

      const formattedBookings = userBookings.map((booking) => {
        const additional = travelerMap[booking.booking_id] || [];

        const allTravelers = [
          { name: booking.customer_name || 'ผู้จองหลัก', email: booking.customer_email || '', phone: booking.customer_phone || '' },
          ...additional,
        ];

        return {
          ...booking,
          pkg: packageMap[booking.package_id] || {
            package_name: booking.package_id || 'ทัวร์สายมูภาคเหนือ Outsy',
            duration: '1 วัน',
            image_path: 'https://images.unsplash.com/photo-1528181304800-259b08848526?w=600',
          },
          travelers: allTravelers,
        };
      });

      if (request === loadGeneration.current) setBookings(formattedBookings);
    } catch (err) {
      if (request === loadGeneration.current) { setErrorMessage(thaiError(err, 'ไม่สามารถโหลดประวัติการจองได้')); setBookings([]); }
    } finally {
      if (request === loadGeneration.current) setLoading(false);
    }
  }, [loadTravelersForBookings]);

  useEffect(() => {
    let channel = null;
    let active = true;
    const setupGeneration = loadGeneration.current;

    async function setupAuthAndData() {
      let user;
      try { user = await authenticatedUser(); } catch { if (active) setLoading(false); return; }
      if (!active || setupGeneration !== loadGeneration.current) return;
      identityRef.current = user.id;
      setCurrentUser(user);

      if (user) {
        await loadBookings(user);
        if (!active || identityRef.current !== user.id) return;
        channel = supabase.channel(`public:bookings:${user.id}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings', filter: `user_id=eq.${user.id}` }, () => { if (identityRef.current === user.id) void loadBookings(user); })
          .subscribe();
      } else {
        setLoading(false);
      }
    }

    setupAuthAndData();

    const generation = loadGeneration;
    return () => {
      active = false; generation.current++; identityRef.current = null;
      if (channel) supabase.removeChannel(channel);
    };
  }, [loadBookings]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(event => {
      if (event === 'SIGNED_OUT') { identityRef.current = null; loadGeneration.current++; setLoading(false); setCurrentUser(null); setBookings([]); setPreviewSlipUrl(null); setRefundModal({ show: false, booking: null }); setRescheduleModal({ show: false, booking: null, newDate: '' }); }
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleUploadNewSlip = async (bookingId, file) => {
    if (!file || uploadingBookingId !== null) return;
    setUploadingBookingId(bookingId);

    try {
      const path = await uploadBookingDocument(bookingId, 'slip', file);
      await bookingAction(bookingId, 'submit_slip', { path });

      showAlertModal('แนบสลิปสำเร็จ! 🎉', 'ระบบส่งหลักฐานให้แอดมินตรวจสอบเรียบร้อยแล้วค่ะ', '📤');
      if (currentUser) loadBookings(currentUser);
    } catch (err) {
      showAlertModal('แนบสลิปไม่สำเร็จ ❌', thaiError(err), '⚠️');
    } finally {
      setUploadingBookingId(null);
    }
  };

  const [actionBusy, setActionBusy] = useState(false);
  async function handleRequestReschedule() {
    if (actionBusy || !rescheduleModal.newDate) return;
    setActionBusy(true);
    try {
      await bookingAction(rescheduleModal.booking.booking_id, 'request_reschedule', { travel_date: rescheduleModal.newDate });
      showAlertModal('ส่งคำขอสำเร็จ', 'รอผู้ดูแลอนุมัติ ที่นั่งและวันเดินทางเดิมยังไม่เปลี่ยน', '✅');
      setRescheduleModal({ show: false, booking: null, newDate: '' });
      await loadBookings(currentUser);
    } catch (err) { showAlertModal('ส่งคำขอไม่สำเร็จ', thaiError(err), '⚠️'); }
    finally { setActionBusy(false); }
  }
  async function handleRequestRefund() {
    if (refundModal.submitting) return;
    if (!refundModal.accountName || !refundModal.bankName || !/^[0-9]{6,30}$/.test(refundModal.accountNo) || !/^[0-9]{6,20}$/.test(refundModal.phone) || !refundModal.bookBankFile) {
      showAlertModal('แจ้งเตือน', 'กรุณากรอกชื่อ บัญชี เบอร์โทร และแนบรูปสมุดบัญชีให้ครบถ้วน', '⚠️'); return;
    }
    setRefundModal(prev => ({ ...prev, submitting: true }));
    try {
      const path = await uploadBookingDocument(refundModal.booking.booking_id, 'bookbank', refundModal.bookBankFile);
      await bookingAction(refundModal.booking.booking_id, 'request_refund', {
        bank_name: refundModal.bankName, account_no: refundModal.accountNo,
        account_name: refundModal.accountName, phone: refundModal.phone, path,
      });
      showAlertModal('ส่งเรื่องสำเร็จ', 'ผู้ดูแลได้รับคำขอคืนเงินแล้ว', '✅');
      setRefundModal({ show: false, booking: null });
      await loadBookings(currentUser);
    } catch (err) { showAlertModal('ส่งคำขอไม่สำเร็จ', thaiError(err), '⚠️'); }
    finally { setRefundModal(prev => ({ ...prev, submitting: false })); }
  }
  async function cancelBooking(bookingId) {
    if (actionBusy || !window.confirm('ยืนยันยกเลิกการจองนี้?')) return;
    setActionBusy(true);
    try { await bookingAction(bookingId, 'cancel'); await loadBookings(currentUser); }
    catch (err) { showAlertModal('ยกเลิกไม่สำเร็จ', thaiError(err), '⚠️'); }
    finally { setActionBusy(false); }
  }

  const getStatusBadge = (status) => {
    switch (status) {
      case 'ชำระเงินแล้ว':
      case 'สำเร็จ':
      case 'ยืนยันแล้ว':
        return { bg: '#ecfdf5', color: '#059669', border: '#a7f3d0', text: '✓ ยืนยันการจองแล้ว' };
      case 'เสร็จสิ้น':
      case 'ทริปเสร็จสิ้น':
        return { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0', text: '🏆 ทริปเสร็จสิ้น' };
      case 'รอตรวจสอบยอด':
        return { bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe', text: '⏳ รอตรวจสอบยอด' };
      case 'รอชำระเงิน':
        return { bg: '#fffbeb', color: '#d97706', border: '#fde68a', text: '⚠ กรุณาแนบสลิปใหม่' };
      case 'ยกเลิก (คืนเงินเต็มจำนวน)':
      case 'ยกเลิก':
        return { bg: '#fef2f2', color: '#dc2626', border: '#fecaca', text: '❌ ยกเลิกทัวร์ (คืนเงินเต็มจำนวน)' };
      case 'ขอเปลี่ยนวันเดินทาง':
        return { bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe', text: '⏳ ขอเปลี่ยนวันเดินทางแล้ว' };
      case 'ส่งเรื่องขอคืนเงินแล้ว':
        return { bg: '#fff7ed', color: '#c2410c', border: '#ffedd5', text: '⏳ ส่งเรื่องขอคืนเงินแล้ว' };
      case 'คืนเงินเรียบร้อยแล้ว':
        return { bg: '#f0fdf4', color: '#059669', border: '#a7f3d0', text: '✅ คืนเงินเรียบร้อยแล้ว' };
      default:
        return { bg: '#fffbeb', color: '#d97706', border: '#fde68a', text: status || '🕒 รอการชำระเงิน' };
    }
  };

  const filteredBookings = bookings.filter((b) => {
    const search = searchTerm.trim().toLowerCase();
    const travelerSearch = (b.travelers || []).map((t) => `${t.name || ''} ${t.email || ''} ${t.phone || ''}`).join(' ').toLowerCase();

    const matchSearch = !search || String(b.booking_id || '').toLowerCase().includes(search) || String(b.package_id || '').toLowerCase().includes(search) || String(b.pkg?.package_name || '').toLowerCase().includes(search) || travelerSearch.includes(search);

    if (!matchSearch) return false;
    if (filterStatus === 'ทั้งหมด') return true;
    if (filterStatus === 'ชำระเงินแล้ว') return b.booking_status === 'ชำระเงินแล้ว' || b.booking_status === 'สำเร็จ' || b.booking_status === 'ยืนยันแล้ว';
    if (filterStatus === 'ทริปเสร็จสิ้น') return b.booking_status === 'เสร็จสิ้น' || b.booking_status === 'ทริปเสร็จสิ้น';
    if (filterStatus === 'ยกเลิก') {
      const status = (b.booking_status || '').toLowerCase();
      return status.includes('ยกเลิก') || status.includes('คืนเงิน') || status.includes('ขอเปลี่ยนวัน');
    }

    return b.booking_status === filterStatus;
  });

  if (!loading && !currentUser) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: theme.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', fontFamily: "'Prompt', sans-serif" }}>
        <div style={{ backgroundColor: theme.card, borderRadius: '28px', padding: '50px 36px', boxShadow: '0 10px 35px rgba(0,0,0,0.05)', border: `1.5px solid ${theme.border}`, maxWidth: '420px', width: '100%', textAlign: 'center' }}>
          <div style={{ width: '70px', height: '70px', borderRadius: '50%', backgroundColor: '#fffbeb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', margin: '0 auto 18px', border: '2px solid #fde68a' }}>🔒</div>
          <h2 style={{ fontSize: '22px', fontWeight: '900', color: theme.brown, margin: '0 0 8px' }}>กรุณาเข้าสู่ระบบ</h2>
          <p style={{ fontSize: '13px', color: theme.textMuted, margin: '0 0 28px', lineHeight: '1.6' }}>โปรดเข้าสู่ระบบบัญชีของคุณก่อน เพื่อตรวจสอบประวัติรายการจอง และข้อมูลผู้เดินทาง</p>
          <Link to="/login" style={{ display: 'block', backgroundColor: theme.red, color: '#ffffff', padding: '14px 20px', borderRadius: '16px', fontSize: '14px', fontWeight: '900', textDecoration: 'none', boxShadow: '0 4px 14px rgba(231,25,31,0.3)' }}>เข้าสู่ระบบทันที ➔</Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: theme.bg, minHeight: '100vh', padding: '100px 24px 80px', fontFamily: "'Prompt', sans-serif", color: theme.text }}>
      <div style={{ maxWidth: '1080px', margin: '0 auto' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ fontSize: '26px', fontWeight: '900', margin: '0 0 4px', color: theme.brown }}>ประวัติรายการจองทัวร์</h1>
            <p style={{ margin: 0, fontSize: '13px', color: theme.textMuted }}>รายการจองของบัญชี <b>{currentUser?.email}</b></p>
          </div>
          <button type="button" onClick={() => navigate('/packages')} style={{ backgroundColor: theme.red, color: '#ffffff', border: 'none', padding: '10px 18px', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 10px rgba(231,25,31,0.15)' }}>+ จองแพ็กเกจใหม่</button>
        </div>

        {errorMessage && (
          <div style={{ backgroundColor: '#fff1f1', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '14px', padding: '12px 16px', marginBottom: '18px', fontSize: '12px' }}>⚠️ {errorMessage}</div>
        )}

        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <input type="text" placeholder="ค้นหาเลขที่จอง ชื่อแพ็กเกจ หรือชื่อผู้เดินทาง..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ flex: '1 1 320px', padding: '11px 16px', borderRadius: '14px', border: `1.5px solid ${theme.border}`, outline: 'none', fontFamily: "'Prompt', sans-serif", backgroundColor: '#ffffff' }} />
          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '2px' }}>
            {['ทั้งหมด', 'รอชำระเงิน', 'รอตรวจสอบยอด', 'ชำระเงินแล้ว', 'ทริปเสร็จสิ้น', 'ยกเลิก'].map((status) => (
              <button key={status} type="button" onClick={() => setFilterStatus(status)} style={{ backgroundColor: filterStatus === status ? theme.brown : '#ffffff', color: filterStatus === status ? '#ffffff' : theme.brown, border: `1.5px solid ${filterStatus === status ? theme.brown : theme.border}`, padding: '8px 16px', borderRadius: '20px', fontSize: '12px', fontWeight: filterStatus === status ? 'bold' : 'normal', cursor: 'pointer', whiteSpace: 'nowrap' }}>{status}</button>
            ))}
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '80px 20px', textAlign: 'center', color: theme.textMuted }}>
            <div style={{ fontSize: '36px', marginBottom: '12px' }}>⏳</div>
            <h3 style={{ margin: 0 }}>กำลังโหลดรายการจอง...</h3>
          </div>
        ) : filteredBookings.length === 0 ? (
          <div style={{ backgroundColor: theme.card, borderRadius: '24px', padding: '60px 20px', textAlign: 'center', border: `1.5px solid ${theme.border}` }}>
            <div style={{ fontSize: '46px', marginBottom: '12px' }}>📭</div>
            <h3 style={{ margin: '0 0 8px', color: theme.brown }}>ยังไม่พบรายการจองในหมวดนี้</h3>
            <p style={{ margin: 0, fontSize: '12px', color: theme.textMuted }}>ลองเปลี่ยนตัวกรองหรือค้นหาใหม่</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {filteredBookings.map((booking) => {
              const badge = getStatusBadge(booking.booking_status);
              const pkg = booking.pkg || {};
              const imageSrc = pkg.image_path ? pkg.image_path.split(',')[0].trim() : 'https://images.unsplash.com/photo-1528181304800-259b08848526?w=600';
              
              const isCancelled = (booking.booking_status || '').includes('ยกเลิก') || (booking.booking_status || '').includes('คืนเงินเต็มจำนวน');
              
              const travelers = booking.travelers || [];
              const peopleCount = Number(booking.number_people || travelers.length || 1);

              return (
                <div key={booking.booking_id} style={{ backgroundColor: theme.card, borderRadius: '20px', border: isCancelled ? '2px solid #dc2626' : `1.5px solid ${theme.border}`, padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px', boxShadow: isCancelled ? '0 4px 20px rgba(220,38,38,0.12)' : '0 2px 10px rgba(0,0,0,0.02)', transition: 'all 0.2s ease' }}>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${theme.border}`, paddingBottom: '12px', gap: '10px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '13px', color: theme.textMuted }}>หมายเลขการจอง:</span>
                      <strong style={{ fontSize: '15px', color: theme.brown }}>#{booking.booking_id}</strong>
                    </div>
                    <span style={{ backgroundColor: badge.bg, color: badge.color, border: `1px solid ${badge.border}`, padding: '4px 12px', borderRadius: '99px', fontSize: '12px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>{badge.text}</span>
                  </div>

                  {isCancelled && (
                    <div style={{ fontSize: '12px', color: '#991b1b', backgroundColor: '#fef2f2', padding: '12px 16px', borderRadius: '14px', border: '1.5px solid #fecaca', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold' }}>
                        <span>⚠️</span> เนื่องจากยอดผู้เดินทางในรอบนี้ไม่ครบตามกำหนด (ขั้นต่ำ 4 ท่าน) ทางบริษัทจึงขออภัยที่ต้องยกเลิกทัวร์ ท่านสามารถเลือกเปลี่ยนวันเดินทางหรือขอคืนเงินได้ค่ะ
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: '90px minmax(0, 1fr) auto', gap: '20px', alignItems: 'start' }}>
                    <img src={imageSrc} alt="package" style={{ width: '90px', height: '90px', borderRadius: '14px', objectFit: 'cover' }} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px', flexWrap: 'wrap' }}>
                        {booking.package_id && (
                          <span style={{ backgroundColor: theme.yellow, color: theme.brown, padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '900', whiteSpace: 'nowrap' }}>📍 {booking.package_id}</span>
                        )}
                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', color: theme.brown, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pkg.package_name || `แพ็กเกจ ${booking.package_id}`}</h3>
                      </div>

                      <div style={{ fontSize: '13px', color: theme.textMuted, marginBottom: '10px' }}>
                        รอบเดินทาง: <b style={{ color: theme.brown }}>{booking.travel_date}</b>{' | '}ผู้เดินทาง: <b style={{ color: theme.brown }}>{peopleCount} ท่าน</b>
                      </div>

                      <div style={{ background: 'linear-gradient(135deg, #fffdf4, #f0faf9)', border: '1px solid #eee5c9', borderRadius: '13px', padding: '10px 12px', marginTop: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '7px' }}>
                          <div style={{ fontSize: '12px', fontWeight: '900', color: theme.brown }}>👥 รายชื่อผู้เดินทาง</div>
                          <span style={{ backgroundColor: '#ffffff', color: '#667085', border: '1px solid #e4e7ec', borderRadius: '99px', padding: '2px 8px', fontSize: '10px', fontWeight: '700' }}>{peopleCount} คน</span>
                        </div>

                        {travelers.length > 0 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                            {travelers.slice(0, 5).map((traveler, index) => (
                              <div key={traveler.id || traveler.traveler_id || index} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: theme.text }}>
                                <span style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: index === 0 ? '#ffe8a3' : '#dff5f2', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '11px', fontWeight: 'bold' }}>{index + 1}</span>
                                <span style={{ fontWeight: '700', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{traveler.name || traveler.full_name || `ผู้เดินทางคนที่ ${index + 1}`}</span>
                              </div>
                            ))}
                            {travelers.length > 5 && (
                              <span style={{ fontSize: '11px', color: theme.textMuted, marginTop: '2px' }}>+ อีก {travelers.length - 5} คน</span>
                            )}
                          </div>
                        ) : (
                          <div style={{ fontSize: '11px', color: theme.textMuted, lineHeight: '1.6' }}>
                            {peopleCount > 1 ? 'ยังไม่มีข้อมูลรายชื่อผู้เดินทางเพิ่มเติมในรายการนี้' : 'ผู้จองหลัก: '}
                            {peopleCount <= 1 && (booking.customer_name || currentUser?.email || '-')}
                          </div>
                        )}
                      </div>

                      {isCancelled && booking.payment_approved && (
                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '12px' }}>
                          <button type="button" onClick={() => setRescheduleModal({ show: true, booking, newDate: '' })} style={{ backgroundColor: theme.cyan, color: '#013a3d', border: 'none', padding: '9px 18px', borderRadius: '10px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>🔄 เปลี่ยนวันเดินทาง</button>
                          <button type="button" onClick={() => setRefundModal({ show: true, booking, bankName: 'กสิกรไทย', accountNo: '', accountName: '', email: currentUser?.email || '', phone: '', bookBankFile: null, submitting: false })} style={{ backgroundColor: theme.red, color: '#ffffff', border: 'none', padding: '9px 18px', borderRadius: '10px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>💸 ขอคืนเงิน</button>
                        </div>
                      )}
                    </div>

                    <div style={{ textAlign: 'right', minWidth: '110px' }}>
                      <span style={{ fontSize: '22px', fontWeight: '900', color: theme.red }}>฿{Number(booking.total_price).toLocaleString()}</span>
                    </div>
                  </div>

                  {!isCancelled && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: `1px dashed ${theme.border}`, paddingTop: '12px', flexWrap: 'wrap', gap: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {booking.slip ? (
                          <button type="button" onClick={() => setPreviewSlipUrl(booking.slip)} style={{ backgroundColor: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0', padding: '6px 14px', borderRadius: '10px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>📎 ดูสลิปที่แนบไว้</button>
                        ) : (
                          <span style={{ fontSize: '12px', color: theme.textMuted }}>ยังไม่ได้แนบสลิปการโอนเงิน</span>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        {['รอชำระเงิน', 'รอตรวจสอบยอด'].includes(booking.booking_status) && <><input type="file" id={`slip-upload-${booking.booking_id}`} accept="image/jpeg,image/png,image/webp" disabled={uploadingBookingId !== null} style={{ display: 'none' }} onChange={(e) => { if (e.target.files && e.target.files[0]) { handleUploadNewSlip(booking.booking_id, e.target.files[0]); } }} />
                        <label htmlFor={`slip-upload-${booking.booking_id}`} style={{ backgroundColor: theme.yellow, color: theme.brown, padding: '7px 16px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 2px 6px rgba(253,213,1,0.3)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>{uploadingBookingId === booking.booking_id ? '⏳ กำลังอัปโหลด...' : '📤 แนบสลิปใหม่'}</label></>}
                        {['รอชำระเงิน', 'รอตรวจสอบยอด', 'ชำระเงินแล้ว'].includes(booking.booking_status) && <button type="button" disabled={actionBusy} onClick={() => cancelBooking(booking.booking_id)}>ยกเลิกการจอง</button>}
                        <button type="button" onClick={() => navigate(`/booking-detail/${booking.booking_id}`)} style={{ backgroundColor: '#f1f5f9', border: `1.5px solid ${theme.border}`, color: theme.brown, padding: '7px 14px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>ดูรายละเอียด →</button>
                      </div>
                    </div>
                  )}

                </div>
              );
            })}
          </div>
        )}
      </div>

      {rescheduleModal.show && rescheduleModal.booking && (
        <div onClick={() => setRescheduleModal({ show: false, booking: null, newDate: '' })} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '20px' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ backgroundColor: '#ffffff', borderRadius: '24px', padding: '30px', maxWidth: '460px', width: '100%', boxShadow: '0 20px 40px rgba(0,0,0,0.15)' }}>
            <h3 style={{ margin: '0 0 10px', color: theme.brown, fontSize: '18px' }}>🔄 เปลี่ยนวันเดินทาง</h3>
            <p style={{ fontSize: '12px', color: theme.textMuted, margin: '0 0 16px' }}>เลือกวันที่รอบใหม่สำหรับแพ็กเกจ <b>{rescheduleModal.booking.pkg?.package_name}</b></p>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '6px', color: theme.brown }}>เลือกวันที่ต้องการเปลี่ยนใหม่ *</label>
              <input type="date" min={new Date().toISOString().split('T')[0]} value={rescheduleModal.newDate} onChange={(e) => setRescheduleModal({ ...rescheduleModal, newDate: e.target.value })} style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: `1.5px solid ${theme.border}`, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="button" onClick={() => setRescheduleModal({ show: false, booking: null, newDate: '' })} style={{ flex: 1, backgroundColor: '#f1f5f9', border: 'none', padding: '12px', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}>ยกเลิก</button>
              <button type="button" disabled={actionBusy} onClick={handleRequestReschedule} style={{ flex: 1, backgroundColor: theme.cyan, color: '#013a3d', border: 'none', padding: '12px', borderRadius: '12px', fontWeight: '900', cursor: 'pointer' }}>ยืนยันเปลี่ยนวัน</button>
            </div>
          </div>
        </div>
      )}

      {refundModal.show && refundModal.booking && (
        <div onClick={() => setRefundModal({ show: false, booking: null })} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '20px' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ backgroundColor: '#ffffff', borderRadius: '24px', padding: '30px', maxWidth: '480px', width: '100%', boxShadow: '0 20px 40px rgba(0,0,0,0.15)', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ margin: '0 0 6px', color: theme.brown, fontSize: '18px' }}>💸 กรอกข้อมูลรับเงินคืน</h3>
            <p style={{ fontSize: '12px', color: theme.textMuted, margin: '0 0 16px' }}>ยอดที่ต้องคืนเต็มจำนวน: <b style={{ color: theme.red }}>฿{Number(refundModal.booking.total_price).toLocaleString()}</b></p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '12px' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px', color: theme.brown }}>ธนาคาร *</label>
                <select value={refundModal.bankName} onChange={(e) => setRefundModal({ ...refundModal, bankName: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '10px', border: `1.5px solid ${theme.border}` }}>
                  <option value="กสิกรไทย">ธนาคารกสิกรไทย (KBANK)</option>
                  <option value="ไทยพาณิชย์">ธนาคารไทยพาณิชย์ (SCB)</option>
                  <option value="กรุงไทย">ธนาคารกรุงไทย (KTB)</option>
                  <option value="กรุงเทพ">ธนาคารกรุงเทพ (BBL)</option>
                  <option value="ทหารไทยธนชาต">ธนาคารทีเอ็มบีธนชาต (TTB)</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px', color: theme.brown }}>เลขที่บัญชีธนาคาร * </label>
                <input type="text" inputMode="numeric" placeholder="ระบุเลขบัญชี..." value={refundModal.accountNo} onChange={(e) => setRefundModal({ ...refundModal, accountNo: e.target.value.replace(/\D/g, '') })} style={{ width: '100%', padding: '10px', borderRadius: '10px', border: `1.5px solid ${theme.border}`, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px', color: theme.brown }}>ชื่อ-นามสกุลเจ้าของบัญชี *</label>
                {/* กำหนดให้ค่าเริ่มต้นว่างเปล่า ไม่อิงอีเมลอัตโนมัติ */}
                <input type="text" placeholder="ชื่อ นามสกุล..." value={refundModal.accountName} onChange={(e) => setRefundModal({ ...refundModal, accountName: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '10px', border: `1.5px solid ${theme.border}`, boxSizing: 'border-box' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px', color: theme.brown }}>อีเมล *</label>
                  <input type="email" value={refundModal.email} onChange={(e) => setRefundModal({ ...refundModal, email: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '10px', border: `1.5px solid ${theme.border}`, boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px', color: theme.brown }}>เบอร์โทรศัพท์ * </label>
                  <input type="text" inputMode="numeric" placeholder="089..." value={refundModal.phone} onChange={(e) => setRefundModal({ ...refundModal, phone: e.target.value.replace(/\D/g, '') })} style={{ width: '100%', padding: '10px', borderRadius: '10px', border: `1.5px solid ${theme.border}`, boxSizing: 'border-box' }} />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px', color: theme.brown }}>แนบไฟล์หน้าสมุดบัญชี *</label>
                <input type="file" accept="image/*,.pdf" onChange={(e) => setRefundModal({ ...refundModal, bookBankFile: e.target.files?.[0] || null })} style={{ width: '100%', fontSize: '11px' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button type="button" onClick={() => setRefundModal({ show: false, booking: null })} style={{ flex: 1, backgroundColor: '#f1f5f9', border: 'none', padding: '12px', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}>ยกเลิก</button>
              <button type="button" disabled={refundModal.submitting} onClick={handleRequestRefund} style={{ flex: 1, backgroundColor: theme.red, color: '#ffffff', border: 'none', padding: '12px', borderRadius: '12px', fontWeight: '900', cursor: refundModal.submitting ? 'not-allowed' : 'pointer', opacity: refundModal.submitting ? 0.7 : 1 }}>{refundModal.submitting ? 'กำลังส่งข้อมูลคิว...' : 'ยืนยันส่งเรื่องขอคืนเงิน'}</button>
            </div>
          </div>
        </div>
      )}

      {previewSlipUrl && (
        <div onClick={() => setPreviewSlipUrl(null)} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ backgroundColor: '#ffffff', borderRadius: '20px', padding: '20px', maxWidth: '440px', width: '100%', textAlign: 'center', boxShadow: '0 25px 50px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 12px', color: theme.brown, fontSize: '16px' }}>หลักฐานการโอนเงิน (Slip)</h3>
            <PrivateDocumentImage value={previewSlipUrl} alt="Slip" style={{ width: '100%', maxHeight: '65vh', objectFit: 'contain', borderRadius: '12px' }} />
            <button type="button" onClick={() => setPreviewSlipUrl(null)} style={{ marginTop: '16px', backgroundColor: theme.brown, color: '#ffffff', border: 'none', padding: '8px 24px', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}>ปิดหน้าต่าง</button>
          </div>
        </div>
      )}

      {modalAlert.show && (
        <div style={{ position: 'fixed', inset: '0', backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '20px' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '24px', padding: '36px 32px', maxWidth: '380px', width: '100%', textAlign: 'center', boxShadow: '0 25px 50px rgba(0,0,0,0.2)', border: `1.5px solid ${theme.border}` }}>
            <div style={{ width: '60px', height: '60px', borderRadius: '50%', backgroundColor: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', margin: '0 auto 16px' }}>{modalAlert.icon}</div>
            <h3 style={{ fontSize: '20px', fontWeight: '900', color: theme.brown, margin: '0 0 8px' }}>{modalAlert.title}</h3>
            <p style={{ fontSize: '13px', color: theme.textMuted, margin: '0 0 24px', lineHeight: '1.5' }}>{modalAlert.message}</p>
            <button type="button" onClick={closeAlertModal} style={{ width: '100%', backgroundColor: theme.yellow, color: theme.brown, border: 'none', padding: '13px', borderRadius: '16px', fontSize: '14px', fontWeight: '900', cursor: 'pointer', boxShadow: '0 4px 14px rgba(253,213,1,0.35)' }}>ตกลง</button>
          </div>
        </div>
      )}
    </div>
  );
}