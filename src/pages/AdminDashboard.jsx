import { useState, useEffect } from 'react';
import { supabase } from '../client';
import PrivateDocumentImage from '../components/PrivateDocumentImage';
import { validateImage } from '../lib/privateDocuments';

const COLORS = {
  red: '#e7191f',
  yellow: '#fdd501',
  cyan: '#2bcdd1',
  brown: '#573e33',
  bg: '#f6f8fb',
  card: '#ffffff',
  border: '#e6ebf1',
  inputBorder: '#e2e8f0',
  textMain: '#2d3748',
  textMuted: '#738096'
};

const CATEGORIES_LIST = [
  'การเงินและโชคลาภ',
  'การงานและความสำเร็จ',
  'ความรักและเมตตา',
  'สุขภาพและความสงบ',
  'สิริมงคลรอบด้าน'
];

const ACTIVITY_TYPES = [
  { value: 'sightseeing', label: '🛕 สถานที่ท่องเที่ยว / ไหว้พระ' },
  { value: 'transport', label: '🚐 จุดนัดพบ / เดินทาง' },
  { value: 'meal', label: '🍲 รับประทานอาหาร' }
];

const calculateDurationText = (start, end) => {
  if (!start || !end) return '';
  const [startH, startM] = start.split(':').map(Number);
  const [endH, endM] = end.split(':').map(Number);

  let diffMinutes = (endH * 60 + endM) - (startH * 60 + startM);
  if (diffMinutes < 0) diffMinutes += 24 * 60;

  const hours = Math.floor(diffMinutes / 60);
  const minutes = diffMinutes % 60;

  if (hours > 0 && minutes > 0) return `${hours} ชั่วโมง ${minutes} นาที`;
  if (hours > 0) return `${hours} ชั่วโมง`;
  if (minutes > 0) return `${minutes} นาที`;
  return '0 นาที';
};

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('bookings');

  const [alertModal, setAlertModal] = useState({
    show: false,
    title: '',
    message: '',
    type: 'success'
  });

  const showAlert = (title, message, type = 'success') => {
    setAlertModal({ show: true, title, message, type });
  };

  const closeAlert = () => {
    setAlertModal({ show: false, title: '', message: '', type: 'success' });
  };

  const [confirmModal, setConfirmModal] = useState({
    show: false,
    title: '',
    message: '',
    onConfirm: null
  });

  const openConfirm = (title, message, onConfirmAction) => {
    setConfirmModal({
      show: true,
      title,
      message,
      onConfirm: onConfirmAction
    });
  };

  const closeConfirm = () => {
    setConfirmModal({ show: false, title: '', message: '', onConfirm: null });
  };

  const [bookings, setBookings] = useState([]);
  const [refundRequests, setRefundRequests] = useState([]);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [filterBookingStatus, setFilterBookingStatus] = useState('ทั้งหมด');
  const [updatingId, setUpdatingId] = useState(null);
  const [previewSlipUrl, setPreviewSlipUrl] = useState(null);
  const [previewBookBankUrl, setPreviewBookBankUrl] = useState(null);
  
  const [selectedRefundDetail, setSelectedRefundDetail] = useState(null);

  const [calendarSchedules, setCalendarSchedules] = useState([]);
  const [selectedDateBookings, setSelectedDateBookings] = useState([]);
  const [activeCalendarDate, setActiveCalendarDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedPkgFilter, setSelectedPkgFilter] = useState('ALL');
  const [selectedBookingDetail, setSelectedBookingDetail] = useState(null);
  
  const [currentYearMonth, setCurrentYearMonth] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [loadingCalendar, setLoadingCalendar] = useState(false);

  const [packagesList, setPackagesList] = useState([]);
  const [selectedPkgId, setSelectedPkgId] = useState('');
  const [editingPkg, setEditingPkg] = useState(null);
  const [pkgSchedules, setPkgSchedules] = useState([]);
  const [newTravelDate, setNewTravelDate] = useState('');
  const [newMaxCap, setNewMaxCap] = useState(10);
  const [savingPkg, setSavingPkg] = useState(false);

  const [editItineraries, setEditItineraries] = useState([]);
  const [loadingItin, setLoadingItin] = useState(false);
  const [uploadingIndex, setUploadingIndex] = useState(null);

  const [creatingPkg, setCreatingPkg] = useState(false);
  const [uploadingMainCover, setUploadingMainCover] = useState(false);
  const [newPkgForm, setNewPkgForm] = useState({
    package_id: 'PKG-MU',
    package_name: '',
    price: '',
    duration: '1 วัน',
    description: '',
    image_path: '',
    max_people: 10,
    initial_date: '',
    categories: []
  });
  const [newPkgItineraries, setNewPkgItineraries] = useState([
    {
      order_index: 1,
      time_start: '',
      time_end: '',
      duration_text: '',
      title: '',
      location: '',
      blessing_aspect: '',
      highlight: '',
      activity_type: 'sightseeing',
      image_url: ''
    }
  ]);

  const fetchBookings = async () => {
    setLoadingBookings(true);
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      const rawBookings = data || [];

      const bookingIds = rawBookings.map(b => b.booking_id).filter(Boolean);
      let travelerMap = {};

      if (bookingIds.length > 0) {
        const { data: travelerData } = await supabase
          .from('booking_travelers')
          .select('*')
          .in('booking_id', bookingIds)
          .order('traveler_id', { ascending: true });

        if (travelerData) {
          travelerData.forEach(t => {
            if (!travelerMap[t.booking_id]) {
              travelerMap[t.booking_id] = [];
            }
            travelerMap[t.booking_id].push(t);
          });
        }
      }

      const formattedBookings = rawBookings.map(b => {
        const additional = travelerMap[b.booking_id] || [];
        const allTravelers = [
          { name: b.customer_name || 'ผู้จองหลัก', phone: b.customer_phone || '' },
          ...additional.map(t => ({ name: t.full_name || t.name, phone: t.phone || '' }))
        ];
        return {
          ...b,
          travelers: allTravelers
        };
      });

      setBookings(formattedBookings);

      // ดึงข้อมูลคำขอคืนเงิน พร้อม JOIN ตาราง bookings เพื่อเอาฟิลด์ slip มาด้วยทันที
      const { data: refData } = await supabase
        .from('refund_requests')
        .select('*, bookings(slip, total_price)')
        .order('created_at', { ascending: false });
      
      setRefundRequests(refData || []);
    } catch (err) {
      console.error('Fetch bookings error:', err);
    } finally {
      setLoadingBookings(false);
    }
  };

  const fetchPackages = async () => {
    try {
      const { data, error } = await supabase
        .from('Tour_Packages')
        .select('*')
        .order('package_id', { ascending: true });

      if (error) throw error;
      setPackagesList(data || []);
      if (data && data.length > 0 && !selectedPkgId) {
        setSelectedPkgId(data[0].package_id);
      }
    } catch (err) {
      console.error('Fetch packages error:', err);
    }
  };

  const fetchCalendarData = async () => {
    setLoadingCalendar(true);
    try {
      const todayStr = new Date().toISOString().split('T')[0];

      const { data: schData, error: schErr } = await supabase
        .from('Tour_Schedules')
        .select('*, Tour_Packages(package_name, description)')
        .gte('travel_date', todayStr)
        .order('travel_date', { ascending: true });

      if (schErr) throw schErr;
      setCalendarSchedules(schData || []);

      const { data: bookData, error: bookErr } = await supabase
        .from('bookings')
        .select('*')
        .eq('travel_date', activeCalendarDate);

      if (bookErr) throw bookErr;
      setSelectedDateBookings(bookData || []);
    } catch (err) {
      console.error('Fetch calendar data error:', err);
    } finally {
      setLoadingCalendar(false);
    }
  };

  useEffect(() => {
    fetchBookings();
    fetchPackages();
    fetchCalendarData();

    const channel = supabase
      .channel('admin-bookings-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bookings' },
        () => {
          fetchBookings();
          fetchCalendarData();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'Tour_Schedules' },
        () => {
          fetchCalendarData();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'refund_requests' },
        () => {
          fetchBookings();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (activeTab === 'calendar') {
      setSelectedPkgFilter('ALL');
      fetchCalendarData();
    }
  }, [activeCalendarDate, activeTab]);

  useEffect(() => {
    if (!selectedPkgId) return;

    const targetPkg = packagesList.find((p) => p.package_id === selectedPkgId);
    if (targetPkg) {
      const rawCat = targetPkg.category_name || '';
      const matchedCats = CATEGORIES_LIST.filter((cat) => {
        const keywords = cat.split('และ');
        return keywords.some((kw) => rawCat.includes(kw.trim()));
      });

      setEditingPkg({
        ...targetPkg,
        categories: matchedCats.length > 0 ? matchedCats : [rawCat]
      });
    }

    async function loadSchedulesAndItinerary() {
      setLoadingItin(true);
      try {
        const todayStr = new Date().toISOString().split('T')[0];

        const { data: schData } = await supabase
          .from('Tour_Schedules')
          .select('*')
          .eq('package_id', selectedPkgId)
          .gte('travel_date', todayStr)
          .order('travel_date', { ascending: true });
        setPkgSchedules(schData || []);

        const { data: itinData } = await supabase
          .from('Package_Itineraries')
          .select('*')
          .eq('package_id', selectedPkgId)
          .order('order_index', { ascending: true });
        setEditItineraries(itinData || []);
      } catch (err) {
        console.error('Load Itinerary Error:', err);
      } finally {
        setLoadingItin(false);
      }
    }

    loadSchedulesAndItinerary();
  }, [selectedPkgId, packagesList]);

  const handleUpdateBookingStatus = (bookingId, newStatus) => {
    if (!bookingId) {
      showAlert('แจ้งเตือน', 'ไม่พบหมายเลขการจอง', 'error');
      return;
    }

    let actionLabel = `เปลี่ยนสถานะการจอง #${bookingId} เป็น "${newStatus}"`;
    if (newStatus === 'ชำระเงินแล้ว') actionLabel = `อนุมัติยอดชำระสำหรับการจอง #${bookingId}`;
    if (newStatus === 'ทริปเสร็จสิ้น') actionLabel = `ทำเครื่องหมายว่าทริป #${bookingId} เสร็จสิ้น`;

    openConfirm(
      'ยืนยันการทำรายการ? 🛠️',
      `คุณต้องการ${actionLabel}ใช่หรือไม่?`,
      async () => {
        setUpdatingId(bookingId);
        const targetId = Number(bookingId);

        try {
          const { data: updatedRows, error } = await supabase
            .from('bookings')
            .update({ booking_status: newStatus })
            .eq('booking_id', targetId)
            .select();

          if (error) throw error;

          if (!updatedRows || updatedRows.length === 0) {
            showAlert('อัปเดตไม่สำเร็จ', `ไม่พบรายการจอง #${targetId}`, 'error');
            return;
          }

          setBookings((prev) =>
            prev.map((b) => (Number(b.booking_id) === targetId ? { ...b, booking_status: newStatus } : b))
          );

          setSelectedBookingDetail((prev) => prev && Number(prev.booking_id) === targetId ? { ...prev, booking_status: newStatus } : prev);

          showAlert('อัปเดตสถานะสำเร็จ 🎉', `เปลี่ยนสถานะเป็น "${newStatus}" เรียบร้อยแล้ว`, 'success');
          fetchCalendarData();
        } catch (err) {
          console.error('Update booking status error:', err);
          showAlert('เกิดข้อผิดพลาด', `ไม่สามารถอัปเดตฐานข้อมูลได้: ${err.message}`, 'error');
        } finally {
          setUpdatingId(null);
        }
      }
    );
  };

  const handleCancelTourByAdmin = async (pkgId, travelDate) => {
    openConfirm(
      'ยืนยันยกเลิกทัวร์รอบนี้? ❌',
      `รอบเดินทางวันที่ ${travelDate} (แพ็กเกจ ${pkgId}) มีผู้จองไม่ครบ 4 ท่าน คุณต้องการยกเลิกและเปลี่ยนสถานะการจองทั้งหมดเป็น "ยกเลิก (คืนเงินเต็มจำนวน)" หรือไม่?`,
      async () => {
        try {
          const { data: targetBookings } = await supabase
            .from('bookings')
            .select('booking_id, travel_date')
            .eq('package_id', pkgId)
            .eq('travel_date', travelDate)
            .not('booking_status', 'ilike', '%ยกเลิก%');

          if (targetBookings && targetBookings.length > 0) {
            for (let tb of targetBookings) {
              await supabase
                .from('bookings')
                .update({ 
                  booking_status: 'ยกเลิก (คืนเงินเต็มจำนวน)', 
                  old_travel_date: tb.travel_date 
                })
                .eq('booking_id', tb.booking_id);
            }
          }

          await supabase
            .from('Tour_Schedules')
            .delete()
            .eq('package_id', pkgId)
            .eq('travel_date', travelDate);

          showAlert('ยกเลิกทัวร์สำเร็จ', 'ระบบได้เปลี่ยนสถานะการจองเป็นยกเลิกและลบรอบเดินทางนี้ออกเรียบร้อยแล้ว', 'success');
          await fetchBookings();
          await fetchCalendarData();
        } catch (err) {
          showAlert('เกิดข้อผิดพลาด', err.message, 'error');
        }
      }
    );
  };

  const handleCancelSingleBookingByAdmin = async (bookingId) => {
    openConfirm(
      'ยืนยันยกเลิกคำสั่งจองนี้? ❌',
      `คุณต้องการยกเลิกคำสั่งจอง #${bookingId} นี้ใช่หรือไม่?`,
      async () => {
        try {
          const { error } = await supabase
            .from('bookings')
            .update({ booking_status: 'ยกเลิก (คืนเงินเต็มจำนวน)' })
            .eq('booking_id', bookingId);

          if (error) throw error;

          showAlert('ยกเลิกสำเร็จ', `คำสั่งจอง #${bookingId} ถูกยกเลิกเรียบร้อยแล้ว`, 'success');
          setSelectedBookingDetail(null);
          await fetchBookings();
          await fetchCalendarData();
        } catch (err) {
          showAlert('เกิดข้อผิดพลาด', err.message, 'error');
        }
      }
    );
  };

  const handleDeleteRefundRequest = async (requestId) => {
    openConfirm(
      'ยืนยันการลบรายการขอคืนเงิน? 🗑️',
      'คุณต้องการลบคำขอคืนเงินนี้ออกจากรายการใช่หรือไม่?',
      async () => {
        try {
          const { error } = await supabase
            .from('refund_requests')
            .delete()
            .eq('id', requestId);

          if (error) throw error;
          showAlert('ลบสำเร็จ 🎉', 'ลบรายการขอคืนเงินออกจากระบบเรียบร้อยแล้ว', 'success');
          fetchBookings();
        } catch (err) {
          showAlert('เกิดข้อผิดพลาด', err.message, 'error');
        }
      }
    );
  };

  const handleMarkAsRefunded = async (reqId, bookingId) => {
    openConfirm(
      'ยืนยันการคืนเงิน? 💸',
      `คุณต้องการเปลี่ยนสถานะการขอคืนเงินรายการนี้เป็น "คืนเงินเรียบร้อยแล้ว" ใช่หรือไม่?`,
      async () => {
        try {
          await supabase.from('refund_requests').update({ status: 'คืนเงินแล้ว' }).eq('id', reqId);
          await supabase.from('bookings').update({ booking_status: 'คืนเงินเรียบร้อยแล้ว' }).eq('booking_id', bookingId);

          showAlert('สำเร็จ 🎉', 'อัปเดตสถานะการคืนเงินให้ลูกค้าเรียบร้อยแล้ว', 'success');
          fetchBookings();
        } catch (err) {
          showAlert('เกิดข้อผิดพลาด', err.message, 'error');
        }
      }
    );
  };

  const handleDeleteScheduleByAdmin = async (scheduleId) => {
    openConfirm(
      'ยืนยันการลบรอบวันเดินทาง? 📅',
      'คุณแน่ใจหรือไม่ว่าต้องการลบรอบวันเดินทางนี้ออกจากแพ็กเกจ?',
      async () => {
        try {
          const { error } = await supabase
            .from('Tour_Schedules')
            .delete()
            .eq('schedule_id', scheduleId);

          if (error) throw error;
          showAlert('ลบแพ็กเกจสำเร็จ', 'ลบรอบวันเดินทางนี้ออกจากระบบเรียบร้อยแล้ว', 'success');
          fetchCalendarData();
        } catch (err) {
          showAlert('เกิดข้อผิดพลาด', err.message, 'error');
        }
      }
    );
  };

  const uploadImageToStorage = async (file, prefix) => {
    await validateImage(file);
    const fileExt = ({'image/jpeg':'jpg','image/png':'png','image/webp':'webp'})[file.type];
    const cleanFileName = `${prefix}_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `itineraries/${cleanFileName}`;

    const { error: uploadError } = await supabase.storage
      .from('tourist_images')
      .upload(filePath, file, { cacheControl: '3600', upsert: false, contentType: file.type });

    if (uploadError) throw uploadError;

    const { data: publicUrlData } = supabase.storage.from('tourist_images').getPublicUrl(filePath);
    return publicUrlData?.publicUrl || '';
  };

  const handleCreateNewPackageSubmit = async (e) => {
    e.preventDefault();
    if (!newPkgForm.package_id || !newPkgForm.package_name || !newPkgForm.price) {
      showAlert('แจ้งเตือน', 'กรุณากรอกรหัสแพ็กเกจ, ชื่อแพ็กเกจ และราคาให้ครบถ้วน', 'error');
      return;
    }

    openConfirm(
      'ยืนยันการสร้างแพ็กเกจใหม่? ✨',
      `คุณต้องการสร้างแพ็กเกจทัวร์รหัส ${newPkgForm.package_id} นี้ใช่หรือไม่?`,
      async () => {
        setCreatingPkg(true);
        try {
          const combinedCategories = (newPkgForm.categories || []).join(' & ');

          const { error: pkgError } = await supabase
            .from('Tour_Packages')
            .insert([
              {
                package_id: newPkgForm.package_id.trim().toUpperCase(),
                package_name: newPkgForm.package_name.trim(),
                price: Number(newPkgForm.price),
                duration: newPkgForm.duration || '1 วัน',
                category_name: combinedCategories || 'สายมู & เสริมดวง',
                description: newPkgForm.description || '',
                image_path: newPkgForm.image_path || '',
                max_people: Number(newPkgForm.max_people) || 10
              }
            ]);

          if (pkgError) throw pkgError;

          if (newPkgForm.initial_date) {
            await supabase
              .from('Tour_Schedules')
              .insert([
                {
                  package_id: newPkgForm.package_id.trim().toUpperCase(),
                  travel_date: newPkgForm.initial_date,
                  booked_count: 0,
                  max_capacity: Number(newPkgForm.max_people) || 10,
                  min_capacity: 4
                }
              ]);
          }

          const validItin = newPkgItineraries
            .filter((it) => (it.title || '').trim() !== '')
            .map((it, idx) => ({
              package_id: newPkgForm.package_id.trim().toUpperCase(),
              order_index: idx + 1,
              time_start: it.time_start || '',
              time_end: it.time_end || '',
              duration_text: it.duration_text || '',
              title: it.title,
              location: it.location || '',
              blessing_aspect: it.blessing_aspect || null,
              highlight: it.highlight || '',
              activity_type: it.activity_type || 'sightseeing',
              image_url: it.image_url || null
            }));

          if (validItin.length > 0) {
            await supabase.from('Package_Itineraries').insert(validItin);
          }

          showAlert('สร้างแพ็กเกจสำเร็จ! 🎉', `แพ็กเกจ ${newPkgForm.package_id} ถูกบันทึกเรียบร้อยแล้ว`, 'success');

          setNewPkgForm({
            package_id: 'PKG-MU',
            package_name: '',
            price: '',
            duration: '1 วัน',
            description: '',
            image_path: '',
            max_people: 10,
            initial_date: '',
            categories: []
          });
          setNewPkgItineraries([
            {
              order_index: 1,
              time_start: '',
              time_end: '',
              duration_text: '',
              title: '',
              location: '',
              blessing_aspect: '',
              highlight: '',
              activity_type: 'sightseeing',
              image_url: ''
            }
          ]);

          await fetchPackages();
          setSelectedPkgId(newPkgForm.package_id.trim().toUpperCase());
          setActiveTab('schedules');
        } catch (err) {
          console.error('Create Package Error:', err);
          showAlert('เกิดข้อผิดพลาดในการสร้าง', err.message, 'error');
        } finally {
          setCreatingPkg(false);
        }
      }
    );
  };

  const handleSavePackageAndItinerary = async (e) => {
    e.preventDefault();
    if (!editingPkg) return;

    openConfirm(
      'ยืนยันการบันทึกการแก้ไข? 💾',
      `คุณต้องการบันทึกการเปลี่ยนแปลงของแพ็กเกจ ${editingPkg.package_id} นี้ใช่หรือไม่?`,
      async () => {
        setSavingPkg(true);
        try {
          const combinedCategories = (editingPkg.categories || []).join(' & ');

          const { error: pkgError } = await supabase
            .from('Tour_Packages')
            .update({
              package_name: editingPkg.package_name,
              price: Number(editingPkg.price),
              duration: editingPkg.duration,
              description: editingPkg.description,
              image_path: editingPkg.image_path,
              category_name: combinedCategories
            })
            .eq('package_id', editingPkg.package_id);

          if (pkgError) throw pkgError;

          await supabase.from('Package_Itineraries').delete().eq('package_id', editingPkg.package_id);

          const formatted = editItineraries
            .filter((item) => (item.title || '').trim() !== '')
            .map((item, idx) => ({
              package_id: editingPkg.package_id,
              order_index: idx + 1,
              time_start: item.time_start || '',
              time_end: item.time_end || '',
              duration_text: item.duration_text || '',
              title: item.title,
              location: item.location || '',
              blessing_aspect: item.blessing_aspect || null,
              highlight: item.highlight || '',
              activity_type: item.activity_type || 'sightseeing',
              image_url: item.image_url || null
            }));

          if (formatted.length > 0) {
            await supabase.from('Package_Itineraries').insert(formatted);
          }

          showAlert('บันทึกข้อมูลเรียบร้อย! 💾', `บันทึกรายละเอียดของ ${editingPkg.package_id} สำเร็จแล้ว`, 'success');
          fetchPackages();
        } catch (err) {
          showAlert('บันทึกไม่สำเร็จ', err.message, 'error');
        } finally {
          setSavingPkg(false);
        }
      }
    );
  };

  const handleAddSchedule = async (e) => {
    e.preventDefault();
    if (!newTravelDate) {
      showAlert('แจ้งเตือน', 'กรุณาเลือกวันที่ก่อนกดเพิ่มรอบ', 'error');
      return;
    }

    openConfirm(
      'ยืนยันการเปิดรอบวันเดินทาง? 📅',
      `คุณต้องการเปิดรอบเดินทางวันที่ ${newTravelDate} สำหรับแพ็กเกจ ${selectedPkgId} ใช่หรือไม่?`,
      async () => {
        try {
          const { data, error } = await supabase
            .from('Tour_Schedules')
            .insert([{ package_id: selectedPkgId, travel_date: newTravelDate, booked_count: 0, max_capacity: Number(newMaxCap), min_capacity: 4 }])
            .select()
            .single();

          if (error) throw error;
          setPkgSchedules((prev) => [...prev, data]);
          setNewTravelDate('');
          showAlert('เพิ่มรอบวันสำเร็จ! 📅', `เปิดรอบเดินทางใหม่ในวันที่ ${newTravelDate} เรียบร้อยแล้ว`, 'success');
          fetchCalendarData();
        } catch (err) {
          showAlert('เพิ่มรอบวันไม่สำเร็จ', err.message, 'error');
        }
      }
    );
  };

  const handleDeleteSchedule = (scheduleId) => {
    openConfirm(
      'ยืนยันการลบรอบวันเดินทาง? 📅',
      'คุณแน่ใจหรือไม่ว่าต้องการลบรอบวันเดินทางนี้ออกจากแพ็กเกจ?',
      async () => {
        try {
          await supabase.from('Tour_Schedules').delete().eq('schedule_id', scheduleId);
          setPkgSchedules((prev) => prev.filter((s) => s.schedule_id !== scheduleId));
          showAlert('ลบรอบวันเรียบร้อย', 'ลบรอบวันเดินทางออกแล้ว', 'success');
          fetchCalendarData();
        } catch (err) {
          showAlert('ลบไม่สำเร็จ', err.message, 'error');
        }
      }
    );
  };

  const filteredBookings = bookings.filter((b) => {
    const status = b.booking_status || '';
    if (status === 'ทริปเสร็จสิ้น' || status === 'เสร็จสิ้น') return false;
    if (status.includes('ยกเลิก')) return false;
    if (filterBookingStatus === 'ทั้งหมด') return true;
    return status === filterBookingStatus;
  });

  const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

  const monthNamesTh = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ];

  const handlePrevMonth = () => {
    setCurrentYearMonth((prev) => {
      if (prev.month === 0) return { year: prev.year - 1, month: 11 };
      return { ...prev, month: prev.month - 1 };
    });
  };

  const handleNextMonth = () => {
    setCurrentYearMonth((prev) => {
      if (prev.month === 11) return { year: prev.year + 1, month: 0 };
      return { ...prev, month: prev.month + 1 };
    });
  };

  const schedulesByDate = calendarSchedules.reduce((acc, sch) => {
    if (!acc[sch.travel_date]) acc[sch.travel_date] = [];
    acc[sch.travel_date].push(sch);
    return acc;
  }, {});

  const currentDaySchedules = schedulesByDate[activeCalendarDate] || [];

  const filteredDateBookings = (selectedPkgFilter === 'ALL'
    ? selectedDateBookings
    : selectedDateBookings.filter((b) => String(b.package_id) === String(selectedPkgFilter))
  ).filter((b) => {
    const st = b.booking_status || '';
    return !st.includes('ยกเลิก');
  });

  return (
    <div className="outsy-page page-admindashboard" style={{
      backgroundColor: COLORS.bg,
      minHeight: '100vh',
      padding: '110px 0 80px 0',
      fontFamily: "'Prompt', sans-serif",
      color: COLORS.textMain,
      boxSizing: 'border-box'
    }}>
      <div style={{ width: '100%', margin: 0, padding: 0 }}>

        {/* หัวข้อด้านบน */}
        <div style={{ padding: '0 32px 24px 32px' }}>
          <h1 style={{ fontSize: '26px', fontWeight: '900', margin: '0 0 6px 0', color: COLORS.brown, display: 'flex', alignItems: 'center', gap: '10px' }}>
            Admin Console 🛠️
          </h1>
          <p style={{ margin: 0, fontSize: '13px', color: COLORS.textMuted }}>
            ระบบจัดการข้อมูลแพ็กเกจ ตรวจสอบการจอง และสรุปยอดเดินทัวร์
          </p>
        </div>

        {/* เลย์เอาต์หลัก */}
        <div className="responsive-grid page-columns" style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '32px', alignItems: 'start', width: '100%', margin: 0 }}>
          
          {/* Sidebar */}
          <div className="responsive-sticky responsive-panel" style={{
            backgroundColor: '#ffffff',
            borderRadius: '0 24px 24px 0',
            padding: '24px 16px',
            borderRight: `1.5px solid ${COLORS.border}`,
            borderTop: `1.5px solid ${COLORS.border}`,
            borderBottom: `1.5px solid ${COLORS.border}`,
            borderLeft: 'none',
            boxShadow: '8px 4px 30px rgba(0, 0, 0, 0.03)',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
            position: 'sticky',
            top: '90px'
          }}>
            
            <div>
              <div style={{ fontSize: '11px', fontWeight: '900', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.8px', padding: '0 12px 10px' }}>
                1. การจัดการแพ็กเกจ
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => setActiveTab('schedules')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    width: '100%', padding: '12px 14px', borderRadius: '14px', border: 'none',
                    backgroundColor: activeTab === 'schedules' ? '#f0fdfe' : 'transparent',
                    color: activeTab === 'schedules' ? '#0891b2' : COLORS.brown,
                    fontWeight: activeTab === 'schedules' ? '900' : '600',
                    fontSize: '13px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s'
                  }}
                >
                  <span style={{ fontSize: '16px' }}>🗓️</span>
                  <span>จัดการรอบวัน & แพ็กเกจ</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('create_package')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    width: '100%', padding: '12px 14px', borderRadius: '14px', border: 'none',
                    backgroundColor: activeTab === 'create_package' ? '#fff1f2' : 'transparent',
                    color: activeTab === 'create_package' ? '#e11d48' : COLORS.brown,
                    fontWeight: activeTab === 'create_package' ? '900' : '600',
                    fontSize: '13px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s'
                  }}
                >
                  <span style={{ fontSize: '16px' }}>✨</span>
                  <span>สร้างแพ็กเกจใหม่</span>
                </button>
              </div>
            </div>

            <div style={{ height: '1px', backgroundColor: COLORS.border, margin: '0 8px' }} />

            <div>
              <div style={{ fontSize: '11px', fontWeight: '900', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.8px', padding: '0 12px 10px' }}>
                2. ตรวจสอบและบริการลูกค้า
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => setActiveTab('bookings')}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    width: '100%', padding: '12px 14px', borderRadius: '14px', border: 'none',
                    backgroundColor: activeTab === 'bookings' ? '#fefce8' : 'transparent',
                    color: activeTab === 'bookings' ? '#a16207' : COLORS.brown,
                    fontWeight: activeTab === 'bookings' ? '900' : '600',
                    fontSize: '13px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s'
                  }}
                >
                  <div className="responsive-row" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '16px' }}>📋</span>
                    <span>รายการจอง & สลิป</span>
                  </div>
                  <span style={{ backgroundColor: activeTab === 'bookings' ? '#f59e0b' : '#f1f5f9', color: activeTab === 'bookings' ? '#fff' : COLORS.textMuted, fontSize: '11px', padding: '2px 8px', borderRadius: '9999px', fontWeight: 'bold' }}>
                    {bookings.filter(b => b.booking_status !== 'ทริปเสร็จสิ้น' && b.booking_status !== 'เสร็จสิ้น' && !b.booking_status.includes('ยกเลิก')).length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('calendar')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    width: '100%', padding: '12px 14px', borderRadius: '14px', border: 'none',
                    backgroundColor: activeTab === 'calendar' ? '#f0fdfe' : 'transparent',
                    color: activeTab === 'calendar' ? '#0891b2' : COLORS.brown,
                    fontWeight: activeTab === 'calendar' ? '900' : '600',
                    fontSize: '13px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s'
                  }}
                >
                  <span style={{ fontSize: '16px' }}>📅</span>
                  <span>ปฏิทินสรุปยอดจอง</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('reschedule')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    width: '100%', padding: '12px 14px', borderRadius: '14px', border: 'none',
                    backgroundColor: activeTab === 'reschedule' ? '#f0fdf4' : 'transparent',
                    color: activeTab === 'reschedule' ? '#15803d' : COLORS.brown,
                    fontWeight: activeTab === 'reschedule' ? '900' : '600',
                    fontSize: '13px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s'
                  }}
                >
                  <span style={{ fontSize: '16px' }}>🔄</span>
                  <span>เปลี่ยนวันเดินทางให้ลูกค้า</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('refund')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    width: '100%', padding: '12px 14px', borderRadius: '14px', border: 'none',
                    backgroundColor: activeTab === 'refund' ? '#fef2f2' : 'transparent',
                    color: activeTab === 'refund' ? '#dc2626' : COLORS.brown,
                    fontWeight: activeTab === 'refund' ? '900' : '600',
                    fontSize: '13px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s'
                  }}
                >
                  <span style={{ fontSize: '16px' }}>💸</span>
                  <span>จัดการคืนเงิน (Refund)</span>
                </button>
              </div>
            </div>

          </div>

          {/* ส่วนเนื้อหาหลักทางด้านขวา */}
          <div className="admin-content" style={{ paddingRight: '32px' }}>

            {/* แท็บ 1: รายการจอง */}
            {activeTab === 'bookings' && (
              <div>
                <div className="responsive-row" style={{ display: 'flex', gap: '8px', marginBottom: '18px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '12px', color: COLORS.textMuted, fontWeight: 'bold' }}>สถานะ:</span>
                  {['ทั้งหมด', 'รอตรวจสอบยอด', 'รอชำระเงิน', 'ชำระเงินแล้ว'].map((st) => (
                    <button
                      key={st}
                      onClick={() => setFilterBookingStatus(st)}
                      style={{
                        padding: '6px 14px', borderRadius: '16px', fontSize: '12px',
                        border: filterBookingStatus === st ? `1.5px solid ${COLORS.brown}` : `1px solid ${COLORS.border}`,
                        backgroundColor: filterBookingStatus === st ? COLORS.brown : '#ffffff',
                        color: filterBookingStatus === st ? '#ffffff' : COLORS.brown,
                        cursor: 'pointer', fontWeight: filterBookingStatus === st ? 'bold' : 'normal'
                      }}
                    >
                      {st}
                    </button>
                  ))}
                  <button onClick={fetchBookings} style={{ marginLeft: 'auto', background: 'none', border: `1.5px solid ${COLORS.border}`, padding: '6px 12px', borderRadius: '10px', cursor: 'pointer', fontSize: '12px' }}>
                    🔄 รีเฟรช
                  </button>
                </div>

                {loadingBookings ? (
                  <div style={{ textAlign: 'center', padding: '60px', color: COLORS.textMuted }}>กำลังโหลดรายการจอง...</div>
                ) : filteredBookings.length === 0 ? (
                  <div className="responsive-panel" style={{ backgroundColor: COLORS.card, borderRadius: '20px', padding: '50px', textAlign: 'center', border: `1.5px solid ${COLORS.border}` }}>
                    <div style={{ fontSize: '40px', marginBottom: '8px' }}>📭</div>
                    <div style={{ fontWeight: 'bold', color: COLORS.brown }}>ไม่พบรายการจองในหมวดนี้</div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {filteredBookings.map((b) => {
                      const travelers = b.travelers || [];

                      return (
                        <div className="responsive-grid responsive-panel"
                          key={b.booking_id}
                          style={{
                            backgroundColor: COLORS.card, borderRadius: '18px', border: `1.5px solid ${COLORS.border}`,
                            padding: '20px', display: 'grid', gridTemplateColumns: '260px 160px 1fr auto', gap: '16px', alignItems: 'center'
                          }}
                        >
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <div className="responsive-row" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <strong style={{ fontSize: '15px', color: COLORS.brown }}>#{b.booking_id}</strong>
                              <span style={{ backgroundColor: '#f1f5f9', color: '#475569', padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold' }}>{b.package_id}</span>
                            </div>

                            <div className="responsive-panel" style={{ backgroundColor: '#f8fafc', border: `1px solid ${COLORS.border}`, borderRadius: '10px', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              {travelers.length > 0 ? (
                                travelers.map((t, idx) => (
                                  <div className="responsive-row" key={idx} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                                    <span style={{ width: '18px', height: '18px', borderRadius: '50%', backgroundColor: idx === 0 ? '#ffe8a3' : '#dff5f2', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 'bold', flexShrink: 0 }}>
                                      {idx + 1}
                                    </span>
                                    <span style={{ fontWeight: '600', color: COLORS.textMain, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                      {t.name}
                                    </span>
                                  </div>
                                ))
                              ) : (
                                <div style={{ fontSize: '12px', fontWeight: '600', color: COLORS.textMain }}>
                                  1 {b.customer_name || 'ผู้จองหลัก'}
                                </div>
                              )}
                            </div>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <div style={{ fontSize: '11px', color: COLORS.textMuted }}>รอบเดินทาง: <b style={{ color: COLORS.textMain }}>{b.travel_date || '-'}</b></div>
                            <div style={{ fontSize: '11px', color: COLORS.textMuted }}>จำนวน: <b style={{ color: COLORS.cyan }}>{b.number_people || 1} ท่าน</b></div>
                            <div style={{ fontSize: '14px', fontWeight: '900', color: COLORS.red }}>
                              ฿{Number(b.total_price || 0).toLocaleString()}
                            </div>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {b.slip ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setPreviewSlipUrl(b.slip);
                                }}
                                style={{
                                  backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', color: '#059669',
                                  padding: '5px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer',
                                  display: 'inline-flex', alignItems: 'center', gap: '4px', width: 'fit-content'
                                }}
                              >
                                <span>📎</span> ดูสลิป
                              </button>
                            ) : (
                              <span style={{ fontSize: '11px', color: COLORS.textMuted }}>ยังไม่แนบสลิป</span>
                            )}
                            <div style={{ fontSize: '11px', color: COLORS.textMuted }}>
                              สถานะ: <b style={{ color: b.booking_status === 'ชำระเงินแล้ว' ? '#059669' : '#d97706' }}>{b.booking_status}</b>
                            </div>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end' }}>
                            <div className="responsive-row" style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                              {b.booking_status !== 'ชำระเงินแล้ว' && (
                                <button
                                  type="button"
                                  disabled={updatingId === b.booking_id}
                                  onClick={() => handleUpdateBookingStatus(b.booking_id, 'ชำระเงินแล้ว')}
                                  style={{ backgroundColor: '#059669', color: '#ffffff', border: 'none', padding: '7px 12px', borderRadius: '10px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}
                                >
                                  ✓ อนุมัติ
                                </button>
                              )}

                              {b.booking_status !== 'ชำระเงินแล้ว' && (
                                <button
                                  type="button"
                                  disabled={updatingId === b.booking_id}
                                  onClick={() => handleUpdateBookingStatus(b.booking_id, 'รอชำระเงิน')}
                                  style={{ backgroundColor: '#f1f5f9', border: `1.5px solid ${COLORS.border}`, color: COLORS.textMuted, padding: '7px 10px', borderRadius: '10px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}
                                >
                                  ขอแนบใหม่
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => handleUpdateBookingStatus(b.booking_id, 'ทริปเสร็จสิ้น')}
                                style={{ backgroundColor: '#2bcdd1', color: '#ffffff', border: 'none', padding: '7px 12px', borderRadius: '10px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}
                              >
                                🏆 เสร็จสิ้น
                              </button>
                            </div>

                            <button
                              type="button"
                              onClick={() => setSelectedBookingDetail(b)}
                              style={{ backgroundColor: '#f8fafc', border: `1.5px solid ${COLORS.border}`, color: COLORS.brown, padding: '6px 14px', borderRadius: '10px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}
                            >
                              ดูรายละเอียดทั้งหมด →
                            </button>
                          </div>

                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* แท็บ: ปฏิทินสรุปยอดจองรายวัน */}
            {activeTab === 'calendar' && (
              <div className="responsive-grid page-columns" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px', alignItems: 'start' }}>
                
                {/* ฝั่งซ้าย: ปฏิทินรายเดือน */}
                <div className="responsive-panel" style={{ backgroundColor: COLORS.card, borderRadius: '24px', padding: '24px', border: `1.5px solid ${COLORS.border}`, boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
                  <div className="responsive-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: '900', margin: 0, color: COLORS.brown }}>
                      📅 ปฏิทินทัวร์ {monthNamesTh[currentYearMonth.month]} {currentYearMonth.year + 543}
                    </h3>
                    <div className="responsive-row" style={{ display: 'flex', gap: '6px' }}>
                      <button onClick={handlePrevMonth} style={{ backgroundColor: '#f1f5f9', border: 'none', padding: '5px 10px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>◀</button>
                      <button onClick={handleNextMonth} style={{ backgroundColor: '#f1f5f9', border: 'none', padding: '5px 10px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>▶</button>
                    </div>
                  </div>

                  <div className="calendar-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px', textAlign: 'center', fontSize: '12px', fontWeight: 'bold', color: COLORS.textMuted, marginBottom: '8px' }}>
                    <div>อา</div><div>จ</div><div>อ</div><div>พ</div><div>พฤ</div><div>ศ</div><div>ส</div>
                  </div>

                  <div className="calendar-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px' }}>
                    {(() => {
                      const daysInMonth = getDaysInMonth(currentYearMonth.year, currentYearMonth.month);
                      const firstDay = getFirstDayOfMonth(currentYearMonth.year, currentYearMonth.month);
                      const cells = [];

                      for (let i = 0; i < firstDay; i++) {
                        cells.push(<div key={`empty-${i}`} style={{ height: '70px', backgroundColor: 'transparent' }} />);
                      }

                      const todayStr = new Date().toISOString().split('T')[0];

                      for (let day = 1; day <= daysInMonth; day++) {
                        const mStr = String(currentYearMonth.month + 1).padStart(2, '0');
                        const dStr = String(day).padStart(2, '0');
                        const dateString = `${currentYearMonth.year}-${mStr}-${dStr}`;

                        const isPast = dateString < todayStr;
                        const daySchedules = isPast ? [] : (schedulesByDate[dateString] || []);
                        const isSelected = activeCalendarDate === dateString;
                        const hasTour = daySchedules.length > 0;

                        cells.push(
                          <div className="responsive-panel"
                            key={dateString}
                            onClick={() => {
                              if (!isPast) {
                                setActiveCalendarDate(dateString);
                                setSelectedPkgFilter('ALL');
                              }
                            }}
                            style={{
                              height: '70px',
                              borderRadius: '12px',
                              border: isSelected ? `2.5px solid ${COLORS.red}` : (hasTour ? `1.5px solid ${COLORS.cyan}` : `1px solid ${COLORS.border}`),
                              backgroundColor: isPast ? '#f8fafc' : (isSelected ? '#fff5f5' : (hasTour ? '#f0fdfe' : '#ffffff')),
                              padding: '5px',
                              cursor: isPast ? 'not-allowed' : 'pointer',
                              opacity: isPast ? 0.4 : 1,
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'space-between',
                              boxSizing: 'border-box'
                            }}
                          >
                            <div style={{ fontSize: '12px', fontWeight: '900', color: isSelected ? COLORS.red : COLORS.brown }}>
                              {day}
                            </div>
                            {hasTour && (
                              <div className="responsive-panel" style={{ backgroundColor: COLORS.cyan, color: '#013a3d', fontSize: '9px', fontWeight: 'bold', padding: '2px', borderRadius: '4px', textAlign: 'center' }}>
                                🚐 {daySchedules.length} ทริป
                              </div>
                            )}
                          </div>
                        );
                      }
                      return cells;
                    })()}
                  </div>
                </div>

                {/* ฝั่งขวา: รายละเอียดแพ็กเกจ และ รายชื่อลูกค้า */}
                <div className="responsive-panel" style={{ backgroundColor: COLORS.card, borderRadius: '24px', padding: '24px', border: `1.5px solid ${COLORS.border}`, boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
                  
                  <div className="responsive-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: `1.5px solid ${COLORS.border}`, paddingBottom: '10px' }}>
                    <div>
                      <span style={{ fontSize: '11px', color: COLORS.textMuted, fontWeight: 'bold' }}>วันที่เลือกดูข้อมูล:</span>
                      <h3 style={{ fontSize: '15px', fontWeight: '900', color: COLORS.red, margin: '2px 0 0 0' }}>
                        📅 {activeCalendarDate}
                      </h3>
                    </div>
                    <div className="responsive-panel" style={{ backgroundColor: '#f1f5f9', padding: '4px 10px', borderRadius: '10px', fontSize: '11px', fontWeight: 'bold', color: COLORS.brown }}>
                      {filteredDateBookings.length} การจอง
                    </div>
                  </div>

                  {/* เลือกดูตามเลขแพ็กเกจ */}
                  <div style={{ marginBottom: '14px' }}>
                    <div className="responsive-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 'bold', color: COLORS.brown }}>
                        ✨ เลือกดูตามรหัสแพ็กเกจทัวร์:
                      </span>
                      {selectedPkgFilter !== 'ALL' && (
                        <button type="button" onClick={() => setSelectedPkgFilter('ALL')} style={{ background: 'none', border: 'none', color: COLORS.red, fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>
                          ดูทั้งหมด ✕
                        </button>
                      )}
                    </div>

                    {currentDaySchedules.length === 0 ? (
                      <div className="responsive-panel" style={{ fontSize: '12px', color: COLORS.textMuted, backgroundColor: '#f8fafc', padding: '10px', borderRadius: '10px', border: `1.5px dashed ${COLORS.border}` }}>
                        ไม่มีรอบออกเดินทางในวันนี้
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {currentDaySchedules.map((sch) => {
                          const isPkgSelected = selectedPkgFilter === sch.package_id;
                          const actualPeopleBooked = selectedDateBookings
                            .filter(b => String(b.package_id) === String(sch.package_id) && b.booking_status !== 'ยกเลิก' && b.booking_status !== 'ยกเลิก (คืนเงินเต็มจำนวน)')
                            .reduce((sum, b) => sum + (Number(b.number_people) || 0), 0);

                          const todayObj = new Date();
                          todayObj.setHours(0, 0, 0, 0);
                          const travelObj = new Date(activeCalendarDate);
                          travelObj.setHours(0, 0, 0, 0);
                          const diffDays = Math.ceil((travelObj - todayObj) / (1000 * 60 * 60 * 24));

                          const isUnderMin = actualPeopleBooked < 4;
                          const showCancelWarning = actualPeopleBooked > 0 && isUnderMin && diffDays <= 3 && diffDays >= 0;

                          return (
                            <div className="responsive-panel"
                              key={sch.schedule_id}
                              style={{
                                backgroundColor: isPkgSelected ? '#fffdf0' : '#ffffff',
                                border: isPkgSelected ? `2.5px solid ${COLORS.yellow}` : (showCancelWarning ? '2px solid #f87171' : `1.5px solid ${COLORS.yellow}`),
                                borderRadius: '12px',
                                padding: '10px 12px',
                                boxShadow: isPkgSelected ? '0 4px 12px rgba(253,213,1,0.3)' : '0 2px 6px rgba(0,0,0,0.02)'
                              }}
                            >
                              <div onClick={() => setSelectedPkgFilter(isPkgSelected ? 'ALL' : sch.package_id)} style={{ cursor: 'pointer' }}>
                                <div className="responsive-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <span style={{ backgroundColor: COLORS.yellow, color: COLORS.brown, fontSize: '10px', fontWeight: '900', padding: '2px 6px', borderRadius: '4px' }}>
                                    {sch.package_id}
                                  </span>
                                  <span style={{ fontSize: '11px', color: showCancelWarning ? '#dc2626' : '#059669', fontWeight: 'bold' }}>
                                    {showCancelWarning ? `⚠️ ต่ำกว่า 4 ท่าน (${actualPeopleBooked}/10, เหลือ ${diffDays} วัน)` : `จองแล้ว: ${actualPeopleBooked} ท่าน`}
                                  </span>
                                </div>
                                <div style={{ fontSize: '12px', fontWeight: '900', color: COLORS.brown, marginTop: '4px' }}>
                                  {sch.Tour_Packages?.package_name || 'แพ็กเกจทัวร์ Outsy'}
                                </div>
                              </div>

                              {showCancelWarning ? (
                                <button
                                  type="button"
                                  onClick={() => handleCancelTourByAdmin(sch.package_id, activeCalendarDate)}
                                  style={{
                                    width: '100%', marginTop: '8px', backgroundColor: '#fef2f2', color: '#dc2626',
                                    border: '1px solid #fecaca', padding: '6px 10px', borderRadius: '8px',
                                    fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px'
                                  }}
                                >
                                  ❌ ยกเลิกทัวร์รอบนี้ & คืนเงินเต็มจำนวน
                                </button>
                              ) : actualPeopleBooked === 0 ? (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteScheduleByAdmin(sch.schedule_id)}
                                  style={{
                                    width: '100%', marginTop: '8px', backgroundColor: '#f1f5f9', color: '#64748b',
                                    border: '1px solid #cbd5e1', padding: '6px 10px', borderRadius: '8px',
                                    fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px'
                                  }}
                                >
                                  🗑️ ลบแพ็กเกจรอบนี้ทิ้ง (ไม่มีผู้จอง)
                                </button>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* รายชื่อลูกค้าที่จอง */}
                  <div style={{ fontSize: '12px', fontWeight: 'bold', color: COLORS.brown, marginBottom: '6px' }}>
                    📋 รายชื่อลูกค้า ({filteredDateBookings.length} รายการ):
                  </div>

                  {filteredDateBookings.length === 0 ? (
                    <div className="responsive-panel" style={{ backgroundColor: '#f8fafc', borderRadius: '12px', padding: '16px', textAlign: 'center', color: COLORS.textMuted, border: `1.5px dashed ${COLORS.border}`, fontSize: '12px' }}>
                      ยังไม่มีลูกค้าจองในวันนี้
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '240px', overflowY: 'auto' }}>
                      {filteredDateBookings.map((b) => (
                        <div className="responsive-panel"
                          key={b.booking_id}
                          onClick={() => setSelectedBookingDetail(b)}
                          style={{
                            backgroundColor: '#f8fafc', borderRadius: '12px', padding: '10px 12px',
                            border: `1.5px solid ${COLORS.border}`, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '2px'
                          }}
                        >
                          <div className="responsive-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '12px', fontWeight: 'bold', color: COLORS.brown }}>
                              #{b.booking_id} • {b.customer_name}
                            </span>
                            <span style={{ fontSize: '10px', fontWeight: '900', padding: '2px 6px', borderRadius: '4px', backgroundColor: COLORS.yellow, color: COLORS.brown }}>
                              {b.number_people} ท่าน
                            </span>
                          </div>
                          <div className="responsive-row" style={{ fontSize: '11px', color: COLORS.textMuted, display: 'flex', justifyContent: 'space-between' }}>
                            <span>{b.package_id}</span>
                            <span style={{ color: '#059669', fontWeight: 'bold' }}>{b.booking_status}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                </div>

              </div>
            )}

            {/* แท็บใหม่: หน้าเปลี่ยนวันเดินทางให้ลูกค้า */}
            {activeTab === 'reschedule' && (
              <div className="responsive-panel" style={{ backgroundColor: COLORS.card, borderRadius: '24px', padding: '28px', border: `1.5px solid ${COLORS.border}`, boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
                <h3 style={{ fontSize: '18px', fontWeight: '900', margin: '0 0 6px 0', color: COLORS.brown }}>🔄 เปลี่ยนวันเดินทางให้ลูกค้า</h3>
                <p style={{ fontSize: '13px', color: COLORS.textMuted, margin: '0 0 20px 0' }}>รายการจองที่ลูกค้ากดขอเปลี่ยนวันเข้ามาหลังจากทัวร์ถูกยกเลิก</p>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {bookings.filter(b => b.booking_status === 'ขอเปลี่ยนวันเดินทาง').length === 0 ? (
                    <div className="responsive-panel" style={{ padding: '40px', textAlign: 'center', color: COLORS.textMuted, backgroundColor: '#f8fafc', borderRadius: '16px', border: `1.5px dashed ${COLORS.border}` }}>
                      ไม่มีคำขอเปลี่ยนวันเดินทางในขณะนี้
                    </div>
                  ) : (
                    bookings.filter(b => b.booking_status === 'ขอเปลี่ยนวันเดินทาง').map(b => (
                      <div className="responsive-row responsive-panel" key={b.booking_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderRadius: '16px', border: '1.5px solid #a7f3d0', backgroundColor: '#f0fdf4', gap: '16px', flexWrap: 'wrap' }}>
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#065f46' }}>#{b.booking_id} • {b.customer_name} ({b.package_id})</div>
                          <div style={{ fontSize: '12px', color: '#047857', marginTop: '2px' }}>
                            รอบเดิม: <b style={{ color: COLORS.red }}>{b.old_travel_date || '-'}</b> | วันที่ลูกค้าเลือกใหม่: <b style={{ color: COLORS.cyan }}>{b.travel_date}</b>
                          </div>
                        </div>
                        <button 
                          type="button" 
                          onClick={async () => {
                            try {
                              const { error } = await supabase.from('bookings').update({ 
                                booking_status: 'ชำระเงินแล้ว' 
                              }).eq('booking_id', b.booking_id);
                              if (error) throw error;
                              showAlert('อนุมัติวันใหม่สำเร็จ 🎉', `ย้ายรอบการจอง #${b.booking_id} เรียบร้อยแล้ว`, 'success');
                              fetchBookings();
                            } catch (err) {
                              showAlert('เกิดข้อผิดพลาด', err.message, 'error');
                            }
                          }}
                          style={{ backgroundColor: '#059669', color: '#fff', border: 'none', padding: '9px 18px', borderRadius: '12px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }}
                        >
                          ✓ อนุมัติวันใหม่ให้ลูกค้า
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* แท็บใหม่: หน้าจัดการคืนเงิน (Refund) พร้อมปุ่ม "คืนเงินเรียบร้อยแล้ว" และปุ่มลบ */}
            {activeTab === 'refund' && (
              <div className="responsive-panel" style={{ backgroundColor: COLORS.card, borderRadius: '24px', padding: '28px', border: `1.5px solid ${COLORS.border}`, boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
                <h3 style={{ fontSize: '18px', fontWeight: '900', margin: '0 0 6px 0', color: COLORS.brown }}>💸 จัดการคืนเงิน (Refund) ให้ลูกค้า</h3>
                <p style={{ fontSize: '13px', color: COLORS.textMuted, margin: '0 0 20px 0' }}>ข้อมูลบัญชีธนาคารและหลักฐานสมุดบัญชี (Book Bank) ที่ลูกค้ากรอกเข้ามา</p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {refundRequests.length === 0 ? (
                    <div className="responsive-panel" style={{ padding: '40px', textAlign: 'center', color: COLORS.textMuted, backgroundColor: '#f8fafc', borderRadius: '16px', border: `1.5px dashed ${COLORS.border}` }}>
                      ไม่มีคำขอคืนเงินในขณะนี้
                    </div>
                  ) : (
                    refundRequests.map(req => {
                      const relatedBooking = bookings.find(b => b.booking_id === req.booking_id);
                      const isRefunded = req.status === 'คืนเงินแล้ว';

                      return (
                        <div className="responsive-row responsive-panel" key={req.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderRadius: '16px', border: '1.5px solid #fecaca', backgroundColor: '#fff5f5', gap: '16px', flexWrap: 'wrap' }}>
                          <div onClick={() => setSelectedRefundDetail(req)} style={{ flex: 1, cursor: 'pointer', minWidth: '220px' }}>
                            <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#991b1b' }}>#{req.booking_id} • {req.account_name} ({req.bank_name})</div>
                            <div style={{ fontSize: '12px', color: '#7f1d1d', marginTop: '2px' }}>เลขบัญชี: <b>{req.account_no}</b> | ยอดคืน: <b style={{ color: COLORS.red }}>฿{Number(relatedBooking?.total_price || req.bookings?.total_price || 0).toLocaleString()}</b></div>
                          </div>
                          <div className="responsive-row" style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '11px', fontWeight: 'bold', color: isRefunded ? '#059669' : '#d97706', backgroundColor: '#fff', padding: '4px 10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>{req.status}</span>
                            
                            <button type="button" onClick={() => setSelectedRefundDetail(req)} style={{ fontSize: '12px', fontWeight: 'bold', color: COLORS.brown, backgroundColor: '#fff', padding: '6px 14px', borderRadius: '10px', border: `1.5px solid ${COLORS.border}`, cursor: 'pointer' }}>คลิกดูรายละเอียด →</button>
                            
                            {!isRefunded && (
                              <button type="button" onClick={() => handleMarkAsRefunded(req.id, req.booking_id)} style={{ backgroundColor: '#059669', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: '10px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
                                ✓ คืนเงินเรียบร้อยแล้ว
                              </button>
                            )}

                            <button type="button" onClick={() => handleDeleteRefundRequest(req.id)} style={{ backgroundColor: '#e31515', color: '#efe3e3', border: '1px solid #c12121', padding: '6px 12px', borderRadius: '10px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>  ลบ  </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* แท็บ: จัดการรอบวัน & แก้ไขแพ็กเกจเดิม */}
            {activeTab === 'schedules' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                
                <div className="responsive-panel" style={{ backgroundColor: COLORS.card, borderRadius: '24px', padding: '24px', border: `1.5px solid ${COLORS.border}`, boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: 'bold', margin: '0 0 14px 0', color: COLORS.brown }}>📦 เลือกแพ็กเกจที่ต้องการจัดการ</h3>
                  <div className="responsive-grid" style={{
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 200px), 1fr))',
                    gap: '12px',
                    maxHeight: '220px',
                    overflowY: 'auto',
                    paddingRight: '4px'
                  }}>
                    {packagesList.map((pkg) => {
                      const isSelected = pkg.package_id === selectedPkgId;
                      return (
                        <div className="responsive-panel"
                          key={pkg.package_id}
                          onClick={() => setSelectedPkgId(pkg.package_id)}
                          style={{
                            padding: '12px 16px', borderRadius: '16px', cursor: 'pointer',
                            border: isSelected ? `2.5px solid ${COLORS.cyan}` : `1.5px solid ${COLORS.border}`,
                            backgroundColor: isSelected ? '#f0fdfe' : '#ffffff',
                            boxShadow: isSelected ? '0 4px 14px rgba(43,205,209,0.2)' : 'none',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <div className="responsive-row" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                            <span style={{ fontSize: '11px', fontWeight: '900', color: COLORS.brown }}>{pkg.package_id}</span>
                            <span style={{ fontSize: '12px', fontWeight: '900', color: COLORS.red }}>฿{Number(pkg.price).toLocaleString()}</span>
                          </div>
                          <div style={{ fontSize: '13px', fontWeight: 'bold', color: COLORS.brown, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {pkg.package_name}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="responsive-panel" style={{ backgroundColor: COLORS.card, borderRadius: '24px', padding: '24px', border: `1.5px solid ${COLORS.border}`, boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: 'bold', margin: '0 0 14px 0', color: COLORS.brown }}>
                    📅 จัดการรอบวันเดินทาง: <span style={{ color: COLORS.cyan }}>{selectedPkgId}</span>
                  </h3>

                  <form className="responsive-grid responsive-panel" onSubmit={handleAddSchedule} style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr auto', gap: '12px', alignItems: 'end', marginBottom: '20px', padding: '16px', backgroundColor: '#f8fafc', borderRadius: '16px', border: `1.5px solid ${COLORS.border}` }}>
                    <div>
                      <label style={subLabelStyle}>เพิ่มรอบวันที่เดินทางใหม่ *</label>
                      <input type="date" required min={new Date().toISOString().split('T')[0]} value={newTravelDate} onChange={(e) => setNewTravelDate(e.target.value)} style={miniInputStyle} />
                    </div>
                    <div>
                      <label style={subLabelStyle}>ความจุสูงสุด (ท่าน)</label>
                      <input type="number" min="1" value={newMaxCap} onChange={(e) => setNewMaxCap(e.target.value)} style={miniInputStyle} />
                    </div>
                    <button type="submit" style={{ backgroundColor: COLORS.cyan, color: '#013a3d', border: 'none', padding: '10px 18px', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>
                      + เพิ่มรอบวัน
                    </button>
                  </form>

                  <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 200px), 1fr))', gap: '10px' }}>
                    {pkgSchedules.map((sch) => (
                      <div className="responsive-row responsive-panel" key={sch.schedule_id} style={{ padding: '12px 14px', borderRadius: '12px', border: `1.5px solid ${COLORS.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff' }}>
                        <div>
                          <div style={{ fontWeight: 'bold', fontSize: '13px', color: COLORS.brown }}>📅 {sch.travel_date}</div>
                          <div style={{ fontSize: '11px', color: COLORS.textMuted }}>จองแล้ว: {sch.booked_count || 0}/{sch.max_capacity || 10} ท่าน</div>
                        </div>
                        <button type="button" onClick={() => handleDeleteSchedule(sch.schedule_id)} style={{ background: 'none', border: 'none', color: COLORS.red, cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
                      </div>
                    ))}
                  </div>
                </div>

                {editingPkg && (
                  <form className="responsive-panel" onSubmit={handleSavePackageAndItinerary} style={{ backgroundColor: COLORS.card, borderRadius: '24px', padding: '32px', border: `1.5px solid ${COLORS.border}`, display: 'flex', flexDirection: 'column', gap: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
                    <div style={{ borderBottom: `1.5px solid ${COLORS.border}`, paddingBottom: '14px' }}>
                      <h3 style={{ fontSize: '18px', fontWeight: '900', margin: 0, color: COLORS.brown }}>
                        ✏️ แก้ไขข้อมูลแพ็กเกจ & ตารางกำหนดการ: <span style={{ color: COLORS.cyan }}>{editingPkg.package_id}</span>
                      </h3>
                    </div>

                    <div>
                      <label style={labelStyle}>ชื่อแพ็กเกจ</label>
                      <input type="text" value={editingPkg.package_name || ''} onChange={(e) => setEditingPkg({ ...editingPkg, package_name: e.target.value })} style={inputStyle} />
                    </div>

                    <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <div>
                        <label style={labelStyle}>ราคาต่อท่าน (บาท)</label>
                        <input type="number" value={editingPkg.price || ''} onChange={(e) => setEditingPkg({ ...editingPkg, price: e.target.value })} style={inputStyle} />
                      </div>
                      <div>
                        <label style={labelStyle}>ระยะเวลา</label>
                        <input type="text" value={editingPkg.duration || ''} onChange={(e) => setEditingPkg({ ...editingPkg, duration: e.target.value })} style={inputStyle} />
                      </div>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '8px', color: COLORS.brown }}>
                        ✨ หมวดหมู่สายมู (เลือกได้หลายข้อ)
                      </label>
                      <div className="responsive-grid responsive-panel" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', padding: '12px', backgroundColor: '#f8fafc', borderRadius: '14px', border: `1.5px solid ${COLORS.border}` }}>
                        {CATEGORIES_LIST.map((cat) => {
                          const currentCats = editingPkg.categories || [];
                          const isChecked = currentCats.includes(cat);

                          return (
                            <label
                              key={cat}
                              style={{
                                display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px',
                                color: isChecked ? COLORS.brown : COLORS.textMuted,
                                fontWeight: isChecked ? 'bold' : 'normal',
                                cursor: 'pointer', padding: '6px 10px', borderRadius: '8px',
                                backgroundColor: isChecked ? '#fffdf0' : 'transparent',
                                border: isChecked ? `1px solid ${COLORS.yellow}` : '1.5px solid transparent'
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {
                                  const updatedCats = isChecked
                                    ? currentCats.filter((c) => c !== cat)
                                    : [...currentCats, cat];
                                  setEditingPkg({ ...editingPkg, categories: updatedCats });
                                }}
                                style={{ width: '15px', height: '15px', accentColor: COLORS.brown, cursor: 'pointer' }}
                              />
                              <span>{cat}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <label style={labelStyle}>คำอธิบายสรุปจุดเด่น</label>
                      <textarea rows={2} value={editingPkg.description || ''} onChange={(e) => setEditingPkg({ ...editingPkg, description: e.target.value })} style={{ ...inputStyle, resize: 'vertical' }} />
                    </div>

                    <div>
                      <label style={labelStyle}>รูปภาพหน้าปกแพ็กเกจ (URL หรือ อัปโหลด)</label>
                      <div className="responsive-row" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <input type="text" value={editingPkg.image_path || ''} onChange={(e) => setEditingPkg({ ...editingPkg, image_path: e.target.value })} style={{ ...inputStyle, flex: 1 }} />
                        <input type="file" id="edit-cover-upload" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={async (e) => {
                          if (e.target.files && e.target.files[0]) {
                            setSavingPkg(true);
                            try {
                              const url = await uploadImageToStorage(e.target.files[0], 'cover');
                              setEditingPkg({ ...editingPkg, image_path: url });
                            } catch (err) {
                              showAlert('อัปโหลดไม่สำเร็จ', err.message, 'error');
                            } finally {
                              setSavingPkg(false);
                            }
                          }
                        }} />
                        <label htmlFor="edit-cover-upload" style={{ backgroundColor: COLORS.cyan, color: '#013a3d', padding: '10px 16px', borderRadius: '12px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                          📁 อัปโหลดรูปหน้าปก
                        </label>
                      </div>
                    </div>

                    {/* ตาราง Itinerary */}
                    <div style={{ borderTop: `1.5px dashed ${COLORS.border}`, paddingTop: '18px' }}>
                      <div className="responsive-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                        <label style={{ ...labelStyle, margin: 0, fontSize: '15px' }}>🧭 ตารางกำหนดการเดินทาง (Itinerary)</label>
                        <button type="button" onClick={() => setEditItineraries(prev => [...prev, { order_index: prev.length + 1, time_start: '', time_end: '', duration_text: '', title: '', location: '', blessing_aspect: '', highlight: '', activity_type: 'sightseeing', image_url: '' }])} style={{ backgroundColor: COLORS.cyan, color: '#013a3d', border: 'none', padding: '8px 16px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
                          + เพิ่มจุดแวะ
                        </button>
                      </div>

                      {loadingItin ? (
                        <div style={{ color: COLORS.textMuted, fontSize: '13px' }}>กำลังโหลดตาราง...</div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                          {editItineraries.map((point, index) => (
                            <div className="responsive-panel" key={index} style={{ padding: '18px', backgroundColor: '#f8fafc', borderRadius: '16px', border: `1.5px solid ${COLORS.border}`, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                              <div className="responsive-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '13px', fontWeight: '900', color: COLORS.brown }}>จุดที่ #{index + 1}</span>
                                <button type="button" onClick={() => setEditItineraries(prev => prev.filter((_, idx) => idx !== index))} style={{ background: 'none', border: 'none', color: COLORS.red, cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>ลบจุดนี้ ✕</button>
                              </div>

                              <div>
                                <label style={subLabelStyle}>🎯 ประเภทกิจกรรม (เลือกไอคอนแสดงผล)</label>
                                <select 
                                  value={point.activity_type || 'sightseeing'} 
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setEditItineraries(prev => {
                                      const next = [...prev];
                                      next[index] = { ...next[index], activity_type: val };
                                      return next;
                                    });
                                  }} 
                                  style={miniInputStyle}
                                >
                                  {ACTIVITY_TYPES.map((act) => (
                                    <option key={act.value} value={act.value}>{act.label}</option>
                                  ))}
                                </select>
                              </div>

                              <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 2fr', gap: '10px' }}>
                                <div>
                                  <label style={subLabelStyle}>🕒 เวลาเริ่ม</label>
                                  <input type="time" value={point.time_start || ''} onChange={(e) => {
                                    const val = e.target.value;
                                    setEditItineraries(prev => {
                                      const next = [...prev];
                                      next[index] = { ...next[index], time_start: val, duration_text: calculateDurationText(val, next[index].time_end) };
                                      return next;
                                    });
                                  }} style={miniInputStyle} />
                                </div>
                                <div>
                                  <label style={subLabelStyle}>🕒 เวลาสิ้นสุด</label>
                                  <input type="time" value={point.time_end || ''} onChange={(e) => {
                                    const val = e.target.value;
                                    setEditItineraries(prev => {
                                      const next = [...prev];
                                      next[index] = { ...next[index], time_end: val, duration_text: calculateDurationText(next[index].time_start, val) };
                                      return next;
                                    });
                                  }} style={miniInputStyle} />
                                </div>
                                <div>
                                  <label style={subLabelStyle}>⏱️ ระยะเวลา</label>
                                  <input type="text" value={point.duration_text || ''} onChange={(e) => {
                                    const val = e.target.value;
                                    setEditItineraries(prev => {
                                      const next = [...prev];
                                      next[index] = { ...next[index], duration_text: val };
                                      return next;
                                    });
                                  }} style={{ ...miniInputStyle, backgroundColor: '#f1f5f9', color: '#0369a1' }} />
                                </div>
                                <div>
                                  <label style={subLabelStyle}>หัวข้อกิจกรรม *</label>
                                  <input type="text" placeholder="เช่น ไหว้พระธาตุ" value={point.title || ''} onChange={(e) => {
                                    const val = e.target.value;
                                    setEditItineraries(prev => {
                                      const next = [...prev];
                                      next[index] = { ...next[index], title: val };
                                      return next;
                                    });
                                  }} style={miniInputStyle} />
                                </div>
                              </div>

                              <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                <div>
                                  <label style={subLabelStyle}>📍 ที่ตั้ง</label>
                                  <input type="text" value={point.location || ''} onChange={(e) => {
                                    const val = e.target.value;
                                    setEditItineraries(prev => {
                                      const next = [...prev];
                                      next[index] = { ...next[index], location: val };
                                      return next;
                                    });
                                  }} style={miniInputStyle} />
                                </div>
                                <div>
                                  <label style={subLabelStyle}>✨ มูเรื่อง (ไม่เลือกก็ได้)</label>
                                  <select value={point.blessing_aspect || ''} onChange={(e) => {
                                    const val = e.target.value;
                                    setEditItineraries(prev => {
                                      const next = [...prev];
                                      next[index] = { ...next[index], blessing_aspect: val };
                                      return next;
                                    });
                                  }} style={miniInputStyle}>
                                    <option value="">-- ไม่ระบุ --</option>
                                    {CATEGORIES_LIST.map((cat) => (
                                      <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                  </select>
                                </div>
                              </div>

                              <div className="responsive-row responsive-panel" style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: `1.5px solid ${COLORS.border}`, padding: '12px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                                <div className="responsive-row" style={{ width: '65px', height: '65px', borderRadius: '10px', backgroundColor: '#f1f5f9', border: `1.5px solid ${COLORS.inputBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                                  {point.image_url ? (
                                    <img src={point.image_url} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.target.style.display = 'none'; }} />
                                  ) : (
                                    <span style={{ fontSize: '20px', opacity: 0.4 }}>📷</span>
                                  )}
                                </div>
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                  <div className="responsive-row" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <input type="file" id={`itin-f-${index}`} accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={async (e) => {
                                      if (e.target.files && e.target.files[0]) {
                                        setUploadingIndex(index);
                                        try {
                                          const url = await uploadImageToStorage(e.target.files[0], 'itin');
                                          setEditItineraries(prev => {
                                            const next = [...prev];
                                            next[index] = { ...next[index], image_url: url };
                                            return next;
                                          });
                                        } catch (err) {
                                          showAlert('อัปโหลดรูปไม่สำเร็จ', err.message, 'error');
                                        } finally {
                                          setUploadingIndex(null);
                                        }
                                      }
                                    }} />
                                    <label htmlFor={`itin-f-${index}`} style={{ backgroundColor: COLORS.cyan, color: '#013a3d', padding: '6px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>
                                      {uploadingIndex === index ? 'กำลังอัปโหลด...' : '📁 เลือกไฟล์รูปภาพ'}
                                    </label>
                                    <span style={{ fontSize: '11px', color: COLORS.textMuted }}>หรือวาง URL รูปภาพ</span>
                                  </div>
                                  <input type="text" placeholder="https://..." value={point.image_url || ''} onChange={(e) => {
                                    const val = e.target.value;
                                    setEditItineraries(prev => {
                                      const next = [...prev];
                                      next[index] = { ...next[index], image_url: val };
                                      return next;
                                    });
                                  }} style={{ ...miniInputStyle, fontSize: '11px', padding: '6px 10px' }} />
                                </div>
                                {point.image_url && (
                                  <button type="button" onClick={() => {
                                    setEditItineraries(prev => {
                                      const next = [...prev];
                                      next[index] = { ...next[index], image_url: '' };
                                      return next;
                                    });
                                  }} style={{ background: 'none', border: 'none', color: COLORS.red, fontSize: '11px', cursor: 'pointer', fontWeight: 'bold' }}>
                                    ลบรูป ✕
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <button type="submit" disabled={savingPkg} style={{ backgroundColor: COLORS.brown, color: '#ffffff', border: 'none', padding: '14px', borderRadius: '14px', fontWeight: '900', fontSize: '14px', cursor: 'pointer', boxShadow: '0 4px 14px rgba(87,62,51,0.2)' }}>
                      {savingPkg ? 'กำลังบันทึกข้อมูล...' : 'บันทึกการแก้ไขแพ็กเกจและตารางเดินทาง 💾'}
                    </button>
                  </form>
                )}
              </div>
            )}

            {/* แท็บ 3: สร้างแพ็กเกจใหม่ */}
            {activeTab === 'create_package' && (
              <form className="responsive-panel" onSubmit={handleCreateNewPackageSubmit} style={{ backgroundColor: COLORS.card, borderRadius: '24px', padding: '32px', border: `1.5px solid ${COLORS.border}`, boxShadow: '0 4px 20px rgba(0,0,0,0.03)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div className="responsive-row" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', borderBottom: `1.5px solid ${COLORS.border}`, paddingBottom: '14px' }}>
                  <span style={{ fontSize: '24px' }}>✨</span>
                  <h2 style={{ fontSize: '18px', fontWeight: '900', margin: 0, color: COLORS.brown }}>
                    สร้างแพ็กเกจทัวร์ One-Day Trip ใหม่
                  </h2>
                </div>

                <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px' }}>
                  <div>
                    <label style={labelStyle}>รหัสแพ็กเกจ (Package ID) *</label>
                    <input 
                      type="text" 
                      required 
                      placeholder="PKG-MU11" 
                      value={newPkgForm.package_id} 
                      onChange={(e) => {
                        const val = e.target.value;
                        if (!val.startsWith('PKG-MU')) {
                          setNewPkgForm({ ...newPkgForm, package_id: 'PKG-MU' });
                        } else {
                          setNewPkgForm({ ...newPkgForm, package_id: val });
                        }
                      }} 
                      style={inputStyle} 
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>ชื่อแพ็กเกจทัวร์ *</label>
                    <input type="text" required placeholder="เชียงใหม่ - เสริมดวงการเงิน..." value={newPkgForm.package_name} onChange={(e) => setNewPkgForm({ ...newPkgForm, package_name: e.target.value })} style={inputStyle} />
                  </div>
                </div>

                <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={labelStyle}>ราคาต่อท่าน (บาท) *</label>
                    <input type="number" required placeholder="1490" value={newPkgForm.price} onChange={(e) => setNewPkgForm({ ...newPkgForm, price: e.target.value })} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>ระยะเวลา</label>
                    <input type="text" value={newPkgForm.duration} onChange={(e) => setNewPkgForm({ ...newPkgForm, duration: e.target.value })} style={inputStyle} />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '8px', color: COLORS.brown }}>
                    ✨ หมวดหมู่สายมู (เลือกได้หลายข้อ)
                  </label>
                  <div className="responsive-grid responsive-panel" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', padding: '12px', backgroundColor: '#f8fafc', borderRadius: '14px', border: `1.5px solid ${COLORS.border}` }}>
                    {CATEGORIES_LIST.map((cat) => {
                      const currentCats = newPkgForm.categories || [];
                      const isChecked = currentCats.includes(cat);

                      return (
                        <label
                          key={cat}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px',
                            color: isChecked ? COLORS.brown : COLORS.textMuted,
                            fontWeight: isChecked ? 'bold' : 'normal',
                            cursor: 'pointer', padding: '6px 10px', borderRadius: '8px',
                            backgroundColor: isChecked ? '#fffdf0' : 'transparent',
                            border: isChecked ? `1px solid ${COLORS.yellow}` : '1.5px solid transparent'
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              const updatedCats = isChecked
                                ? currentCats.filter((c) => c !== cat)
                                : [...currentCats, cat];
                              setNewPkgForm({ ...newPkgForm, categories: updatedCats });
                            }}
                            style={{ width: '15px', height: '15px', accentColor: COLORS.brown, cursor: 'pointer' }}
                          />
                          <span>{cat}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>คำอธิบายสรุปจุดเด่นของแพ็กเกจ</label>
                  <textarea rows={2} placeholder="ระบุไฮไลต์หลัก..." value={newPkgForm.description} onChange={(e) => setNewPkgForm({ ...newPkgForm, description: e.target.value })} style={{ ...inputStyle, resize: 'vertical' }} />
                </div>

                <div>
                  <label style={labelStyle}>รูปภาพหน้าปกแพ็กเกจ (URL หรือ อัปโหลด)</label>
                  <div className="responsive-row" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <input type="text" placeholder="https://..." value={newPkgForm.image_path} onChange={(e) => setNewPkgForm({ ...newPkgForm, image_path: e.target.value })} style={{ ...inputStyle, flex: 1 }} />
                    <input type="file" id="main-cover-upload" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={async (e) => {
                      if (e.target.files && e.target.files[0]) {
                        setUploadingMainCover(true);
                        try {
                          const url = await uploadImageToStorage(e.target.files[0], 'cover');
                          setNewPkgForm({ ...newPkgForm, image_path: url });
                        } catch (err) {
                          showAlert('อัปโหลดไม่สำเร็จ', err.message, 'error');
                        } finally {
                          setUploadingMainCover(false);
                        }
                      }
                    }} />
                    <label htmlFor="main-cover-upload" style={{ backgroundColor: COLORS.cyan, color: '#013a3d', padding: '10px 16px', borderRadius: '12px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      {uploadingMainCover ? 'กำลังอัปโหลด...' : '📁 อัปโหลดรูปหน้าปก'}
                    </label>
                  </div>
                </div>

                {/* ส่วนเปิดรอบวันเดินทางเริ่มต้น */}
                <div className="responsive-panel" style={{ backgroundColor: '#f8fafc', padding: '16px 20px', borderRadius: '16px', border: `1.5px solid ${COLORS.border}` }}>
                  <div style={{ fontSize: '12px', fontWeight: 'bold', color: COLORS.brown, marginBottom: '10px' }}>
                    📅 เปิดรอบวันเดินทางเริ่มต้น (ไม่บังคับ)
                  </div>
                  <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '14px' }}>
                    <div>
                      <label style={subLabelStyle}>วันเดินทางรอบแรก</label>
                      <input type="date" value={newPkgForm.initial_date} onChange={(e) => setNewPkgForm({ ...newPkgForm, initial_date: e.target.value })} style={miniInputStyle} />
                    </div>
                    <div>
                      <label style={subLabelStyle}>ความจุสูงสุด (ท่าน)</label>
                      <input type="number" min="1" value={newPkgForm.max_people} onChange={(e) => setNewPkgForm({ ...newPkgForm, max_people: e.target.value })} style={miniInputStyle} />
                    </div>
                  </div>
                </div>

                {/* ตารางกำหนดการเดินทาง Itinerary */}
                <div style={{ borderTop: `1.5px dashed ${COLORS.border}`, paddingTop: '16px' }}>
                  <div className="responsive-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                    <label style={{ ...labelStyle, margin: 0, fontSize: '15px' }}>🧭 ตารางกำหนดการเดินทาง (Itinerary)</label>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {newPkgItineraries.map((point, index) => (
                      <div className="responsive-panel" key={index} style={{ padding: '16px', backgroundColor: '#f8fafc', borderRadius: '16px', border: `1.5px solid ${COLORS.border}`, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div className="responsive-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '12px', fontWeight: 'bold', color: COLORS.brown }}>จุดแวะที่ #{index + 1}</span>
                          <button type="button" onClick={() => setNewPkgItineraries(prev => prev.filter((_, idx) => idx !== index))} style={{ background: 'none', border: 'none', color: COLORS.red, cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>ลบจุดนี้ ✕</button>
                        </div>

                        <div>
                          <label style={subLabelStyle}>🎯 ประเภทกิจกรรม (เลือกไอคอนแสดงผล)</label>
                          <select 
                            value={point.activity_type || 'sightseeing'} 
                            onChange={(e) => {
                              const val = e.target.value;
                              setNewPkgItineraries(prev => {
                                const next = [...prev];
                                next[index] = { ...next[index], activity_type: val };
                                return next;
                              });
                            }} 
                            style={miniInputStyle}
                          >
                            {ACTIVITY_TYPES.map((act) => (
                              <option key={act.value} value={act.value}>{act.label}</option>
                            ))}
                          </select>
                        </div>

                        <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: '120px 120px 130px 1fr', gap: '8px' }}>
                          <div>
                            <label style={subLabelStyle}>🕒 เวลาเริ่ม</label>
                            <input type="time" value={point.time_start || ''} onChange={(e) => {
                              const val = e.target.value;
                              setNewPkgItineraries(prev => {
                                const next = [...prev];
                                next[index] = { ...next[index], time_start: val, duration_text: calculateDurationText(val, next[index].time_end) };
                                return next;
                              });
                            }} style={miniInputStyle} />
                          </div>
                          <div>
                            <label style={subLabelStyle}>🕒 เวลาสิ้นสุด</label>
                            <input type="time" value={point.time_end || ''} onChange={(e) => {
                              const val = e.target.value;
                              setNewPkgItineraries(prev => {
                                const next = [...prev];
                                next[index] = { ...next[index], time_end: val, duration_text: calculateDurationText(next[index].time_start, val) };
                                return next;
                              });
                            }} style={miniInputStyle} />
                          </div>
                          <div>
                            <label style={subLabelStyle}>⏱️ ระยะเวลา (Auto)</label>
                            <input type="text" value={point.duration_text || ''} onChange={(e) => {
                              const val = e.target.value;
                              setNewPkgItineraries(prev => {
                                const next = [...prev];
                                next[index] = { ...next[index], duration_text: val };
                                return next;
                              });
                            }} style={{ ...miniInputStyle, backgroundColor: '#f1f5f9', color: '#0369a1' }} />
                          </div>
                          <div>
                            <label style={subLabelStyle}>หัวข้อกิจกรรม *</label>
                            <input type="text" placeholder="เช่น ไหว้พระธาตุ" value={point.title || ''} onChange={(e) => {
                              const val = e.target.value;
                              setNewPkgItineraries(prev => {
                                const next = [...prev];
                                next[index] = { ...next[index], title: val };
                                return next;
                              });
                            }} style={miniInputStyle} />
                          </div>
                        </div>

                        <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                          <div>
                            <label style={subLabelStyle}>📍 ที่ตั้ง</label>
                            <input type="text" value={point.location || ''} onChange={(e) => {
                              const val = e.target.value;
                              setNewPkgItineraries(prev => {
                                const next = [...prev];
                                next[index] = { ...next[index], location: val };
                                return next;
                              });
                            }} style={miniInputStyle} />
                          </div>
                          <div>
                            <label style={subLabelStyle}>✨ มูเรื่อง (ไม่เลือกก็ได้)</label>
                            <select value={point.blessing_aspect || ''} onChange={(e) => {
                              const val = e.target.value;
                              setNewPkgItineraries(prev => {
                                const next = [...prev];
                                next[index] = { ...next[index], blessing_aspect: val };
                                return next;
                              });
                            }} style={miniInputStyle}>
                              <option value="">-- ไม่ระบุ / ไม่มูเรื่องนี้ --</option>
                              {CATEGORIES_LIST.map((cat) => (
                                <option key={cat} value={cat}>{cat}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="responsive-row responsive-panel" style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: `1.5px solid ${COLORS.border}`, padding: '10px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div className="responsive-row" style={{ width: '60px', height: '60px', borderRadius: '8px', backgroundColor: '#f1f5f9', border: `1.5px solid ${COLORS.inputBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                            {point.image_url ? (
                              <img src={point.image_url} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.target.style.display = 'none'; }} />
                            ) : (
                              <span style={{ fontSize: '18px', opacity: 0.4 }}>📷</span>
                            )}
                          </div>
                          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <div className="responsive-row" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <input type="file" id={`new-itin-f-${index}`} accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={async (e) => {
                                if (e.target.files && e.target.files[0]) {
                                  setUploadingIndex(index);
                                  try {
                                    const url = await uploadImageToStorage(e.target.files[0], 'new_itin');
                                    setNewPkgItineraries(prev => {
                                      const next = [...prev];
                                      next[index] = { ...next[index], image_url: url };
                                      return next;
                                    });
                                  } catch (err) {
                                    showAlert('อัปโหลดรูปไม่สำเร็จ', err.message, 'error');
                                  } finally {
                                    setUploadingIndex(null);
                                  }
                                }
                              }} />
                              <label htmlFor={`new-itin-f-${index}`} style={{ backgroundColor: COLORS.cyan, color: '#013a3d', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>
                                {uploadingIndex === index ? 'กำลังอัปโหลด...' : '📁 เลือกไฟล์รูปภาพ'}
                              </label>
                              <span style={{ fontSize: '11px', color: COLORS.textMuted }}>หรือวาง URL</span>
                            </div>
                            <input type="text" placeholder="https://..." value={point.image_url || ''} onChange={(e) => {
                              const val = e.target.value;
                              setNewPkgItineraries(prev => {
                                const next = [...prev];
                                next[index] = { ...next[index], image_url: val };
                                return next;
                              });
                            }} style={{ ...miniInputStyle, fontSize: '11px', padding: '5px 8px' }} />
                          </div>
                          {point.image_url && (
                            <button type="button" onClick={() => {
                              setNewPkgItineraries(prev => {
                                const next = [...prev];
                                next[index] = { ...next[index], image_url: '' };
                                return next;
                              });
                            }} style={{ background: 'none', border: 'none', color: COLORS.red, fontSize: '11px', cursor: 'pointer', fontWeight: 'bold' }}>
                              ลบรูป ✕
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* ปุ่มเพิ่มจุดแวะอยู่ด้านล่างสุด */}
                  <button
                    type="button"
                    onClick={() => setNewPkgItineraries(prev => [...prev, { order_index: prev.length + 1, time_start: '', time_end: '', duration_text: '', title: '', location: '', blessing_aspect: '', highlight: '', activity_type: 'sightseeing', image_url: '' }])}
                    style={{
                      width: '100%', marginTop: '12px', backgroundColor: COLORS.cyan, color: '#013a3d',
                      border: 'none', padding: '10px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer'
                    }}
                  >
                    + เพิ่มจุดแวะ
                  </button>
                </div>

                <div className="responsive-row" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
                  <button type="button" onClick={() => setActiveTab('schedules')} style={{ backgroundColor: 'transparent', border: `1.5px solid ${COLORS.border}`, color: COLORS.textMuted, padding: '12px 24px', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
                    ยกเลิก
                  </button>
                  <button type="submit" disabled={creatingPkg} style={{ backgroundColor: COLORS.red, color: '#ffffff', border: 'none', padding: '12px 32px', borderRadius: '12px', fontWeight: 'bold', fontSize: '14px', cursor: creatingPkg ? 'not-allowed' : 'pointer' }}>
                    {creatingPkg ? 'กำลังสร้างแพ็กเกจ...' : 'ยืนยันการสร้างแพ็กเกจใหม่ ➔'}
                  </button>
                </div>
              </form>
            )}

          </div>

        </div>

      </div>

      {/* MODAL: แสดงรายละเอียดการขอคืนเงิน (Refund Details) */}
      {selectedRefundDetail && (
        <div className="responsive-modal responsive-row" onClick={() => setSelectedRefundDetail(null)} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10003, padding: '20px' }}>
          <div className="responsive-panel" onClick={(e) => e.stopPropagation()} style={{ backgroundColor: '#ffffff', borderRadius: '24px', padding: '32px', maxWidth: '520px', width: '100%', boxShadow: '0 25px 50px rgba(0,0,0,0.15)', border: `1.5px solid ${COLORS.border}`, maxHeight: '90vh', overflowY: 'auto' }}>
            
            <div className="responsive-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: `1.5px solid ${COLORS.border}`, paddingBottom: '14px' }}>
              <div>
                <span style={{ backgroundColor: '#fee2e2', color: '#991b1b', padding: '3px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: '900' }}>
                  คำขอคืนเงิน #{selectedRefundDetail.id} (การจอง #{selectedRefundDetail.booking_id})
                </span>
                <h3 style={{ margin: '6px 0 0 0', fontSize: '20px', fontWeight: '900', color: COLORS.brown }}>
                  {selectedRefundDetail.account_name}
                </h3>
              </div>
              <button type="button" onClick={() => setSelectedRefundDetail(null)} style={{ background: '#f1f5f9', border: 'none', width: '34px', height: '34px', borderRadius: '50%', fontSize: '15px', fontWeight: 'bold', cursor: 'pointer', color: COLORS.textMuted }}>✕</button>
            </div>

            <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '20px', fontSize: '13px' }}>
              <div className="responsive-panel" style={{ backgroundColor: '#f8fafc', padding: '12px 14px', borderRadius: '12px', border: `1.5px solid ${COLORS.border}` }}>
                <div style={{ fontSize: '11px', color: COLORS.textMuted, fontWeight: 'bold', marginBottom: '2px' }}>🏦 ธนาคาร</div>
                <div style={{ fontWeight: 'bold', color: COLORS.textMain }}>{selectedRefundDetail.bank_name}</div>
              </div>

              <div className="responsive-panel" style={{ backgroundColor: '#f8fafc', padding: '12px 14px', borderRadius: '12px', border: `1.5px solid ${COLORS.border}` }}>
                <div style={{ fontSize: '11px', color: COLORS.textMuted, fontWeight: 'bold', marginBottom: '2px' }}>🔢 เลขที่บัญชี</div>
                <div style={{ fontWeight: 'bold', color: COLORS.red, fontSize: '14px' }}>{selectedRefundDetail.account_no}</div>
              </div>

              <div className="responsive-panel" style={{ backgroundColor: '#f8fafc', padding: '12px 14px', borderRadius: '12px', border: `1.5px solid ${COLORS.border}` }}>
                <div style={{ fontSize: '11px', color: COLORS.textMuted, fontWeight: 'bold', marginBottom: '2px' }}>👤 ชื่อเจ้าของบัญชี</div>
                <div style={{ fontWeight: 'bold', color: COLORS.textMain }}>{selectedRefundDetail.account_name}</div>
              </div>

              <div className="responsive-panel" style={{ backgroundColor: '#f8fafc', padding: '12px 14px', borderRadius: '12px', border: `1.5px solid ${COLORS.border}` }}>
                <div style={{ fontSize: '11px', color: COLORS.textMuted, fontWeight: 'bold', marginBottom: '2px' }}>💰 ยอดเงินที่ต้องคืน</div>
                <div style={{ fontWeight: '900', color: COLORS.red, fontSize: '15px' }}>
                  ฿{Number(bookings.find(b => Number(b.booking_id) === Number(selectedRefundDetail.booking_id))?.total_price || 0).toLocaleString()}
                </div>
              </div>

              <div className="responsive-panel" style={{ backgroundColor: '#f8fafc', padding: '12px 14px', borderRadius: '12px', border: `1.5px solid ${COLORS.border}` }}>
                <div style={{ fontSize: '11px', color: COLORS.textMuted, fontWeight: 'bold', marginBottom: '2px' }}>📞 เบอร์โทรศัพท์</div>
                <div style={{ fontWeight: 'bold', color: COLORS.textMain }}>{selectedRefundDetail.phone}</div>
              </div>

              <div className="responsive-panel" style={{ backgroundColor: '#f8fafc', padding: '12px 14px', borderRadius: '12px', border: `1.5px solid ${COLORS.border}` }}>
                <div style={{ fontSize: '11px', color: COLORS.textMuted, fontWeight: 'bold', marginBottom: '2px' }}>✉️ อีเมลติดต่อ</div>
                <div style={{ fontWeight: 'bold', color: COLORS.textMain, wordBreak: 'break-all' }}>{selectedRefundDetail.email}</div>
              </div>
            </div>

            {/* ส่วนดูหลักฐานสมุดบัญชี และ สลิปการโอนเงินเดิม */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
              
              {/* 1. หลักฐานสมุดบัญชี (Book Bank) */}
              <div className="responsive-row responsive-panel" style={{ backgroundColor: '#fdf2f8', padding: '14px 16px', borderRadius: '14px', border: '1.5px solid #fbcfe8', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 'bold', color: '#9d174d', fontSize: '13px' }}>📄 หลักฐานสมุดบัญชี (Book Bank)</div>
                  <div style={{ fontSize: '11px', color: '#db2777' }}>ตรวจสอบหน้าสมุดบัญชีของลูกค้าก่อนกดโอนเงิน</div>
                </div>
                {selectedRefundDetail.book_bank_url ? (
                  <button
                    type="button"
                    onClick={() => {
                      const url = selectedRefundDetail.book_bank_url;
                      setPreviewBookBankUrl(url);
                    }}
                    style={{ backgroundColor: '#db2777', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '10px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    ดูสมุดบัญชี
                  </button>
                ) : (
                  <span style={{ fontSize: '11px', color: COLORS.textMuted }}>ไม่พบไฟล์</span>
                )}
              </div>

              {/* 2. สลิปการโอนเงินเดิมของลูกค้า (ดึงจากออเดอร์จอง bookings โดยตรง) */}
              {(() => {
                const targetBooking = bookings.find(b => Number(b.booking_id) === Number(selectedRefundDetail.booking_id));
                const slipVal = targetBooking?.slip;

                return (
                  <div className="responsive-row responsive-panel" style={{ backgroundColor: '#ecfdf5', padding: '14px 16px', borderRadius: '14px', border: '1.5px solid #a7f3d0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 'bold', color: '#065f46', fontSize: '13px' }}>📎 สลิปการโอนเงินเดิมของลูกค้า</div>
                      <div style={{ fontSize: '11px', color: '#047857' }}>ตรวจสอบยอดเงินที่ลูกค้าเคยชำระเข้ามา</div>
                    </div>
                    {slipVal ? (
                      <button
                        type="button"
                        onClick={() => {
                          setPreviewSlipUrl(slipVal);
                        }}
                        style={{ backgroundColor: '#059669', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '10px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}
                      >
                        ดูสลิปเดิม
                      </button>
                    ) : (
                      <span style={{ fontSize: '11px', color: COLORS.textMuted }}>ไม่พบสลิปเดิม</span>
                    )}
                  </div>
                );
              })()}

            </div>

            <div className="responsive-row" style={{ display: 'flex', gap: '10px' }}>
              {selectedRefundDetail.status !== 'คืนเงินแล้ว' && (
                <button
                  type="button"
                  onClick={() => {
                    const reqId = selectedRefundDetail.id;
                    const bId = selectedRefundDetail.booking_id;
                    setSelectedRefundDetail(null);
                    handleMarkAsRefunded(reqId, bId);
                  }}
                  style={{ flex: 1, backgroundColor: '#059669', color: '#fff', border: 'none', padding: '12px', borderRadius: '12px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer' }}
                >
                  ✓ คืนเงินเรียบร้อยแล้ว
                </button>
              )}
              <button
                type="button"
                onClick={() => setSelectedRefundDetail(null)}
                style={{ flex: 1, backgroundColor: COLORS.brown, color: '#ffffff', border: 'none', padding: '12px', borderRadius: '14px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer' }}
              >
                ปิดหน้าต่าง
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Modal แสดงข้อมูลรายละเอียดลูกค้า พร้อมเพิ่มปุ่ม "ยกเลิกคำสั่งนี้" */}
      {selectedBookingDetail && (
        <div className="responsive-modal responsive-row" onClick={() => setSelectedBookingDetail(null)} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10002, padding: '20px' }}>
          <div className="responsive-panel" onClick={(e) => e.stopPropagation()} style={{ backgroundColor: '#ffffff', borderRadius: '24px', padding: '32px', maxWidth: '600px', width: '100%', boxShadow: '0 25px 50px rgba(0,0,0,0.15)', border: `1.5px solid ${COLORS.border}`, maxHeight: '90vh', overflowY: 'auto' }}>
            
            <div className="responsive-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: `1.5px solid ${COLORS.border}`, paddingBottom: '14px' }}>
              <div>
                <span style={{ backgroundColor: COLORS.yellow, color: COLORS.brown, padding: '3px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: '900' }}>
                  รหัสการจอง #{selectedBookingDetail.booking_id}
                </span>
                <h3 style={{ margin: '6px 0 0 0', fontSize: '20px', fontWeight: '900', color: COLORS.brown }}>
                  แพ็กเกจ: {selectedBookingDetail.package_id}
                </h3>
              </div>
              <button type="button" onClick={() => setSelectedBookingDetail(null)} style={{ background: '#f1f5f9', border: 'none', width: '34px', height: '34px', borderRadius: '50%', fontSize: '15px', fontWeight: 'bold', cursor: 'pointer', color: COLORS.textMuted }}>✕</button>
            </div>

            <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '20px', fontSize: '13px' }}>
              <div className="responsive-panel" style={{ backgroundColor: '#f8fafc', padding: '12px 14px', borderRadius: '12px', border: `1.5px solid ${COLORS.border}` }}>
                <div style={{ fontSize: '11px', color: COLORS.textMuted, fontWeight: 'bold', marginBottom: '2px' }}>📅 รอบวันเดินทาง</div>
                <div style={{ fontWeight: 'bold', color: COLORS.brown }}>{selectedBookingDetail.travel_date}</div>
              </div>

              <div className="responsive-panel" style={{ backgroundColor: '#f8fafc', padding: '12px 14px', borderRadius: '12px', border: `1.5px solid ${COLORS.border}` }}>
                <div style={{ fontSize: '11px', color: COLORS.textMuted, fontWeight: 'bold', marginBottom: '2px' }}>💰 ยอดชำระสุทธิ</div>
                <div style={{ fontWeight: '900', color: COLORS.red }}>฿{Number(selectedBookingDetail.total_price || 0).toLocaleString()}</div>
              </div>

              <div className="responsive-panel" style={{ backgroundColor: '#f8fafc', padding: '12px 14px', borderRadius: '12px', border: `1.5px solid ${COLORS.border}` }}>
                <div style={{ fontSize: '11px', color: COLORS.textMuted, fontWeight: 'bold', marginBottom: '2px' }}>✉️ อีเมลผู้จอง</div>
                <div style={{ fontWeight: 'bold', color: COLORS.textMain, wordBreak: 'break-all' }}>{selectedBookingDetail.customer_email || '-'}</div>
              </div>

              <div className="responsive-panel" style={{ backgroundColor: '#f8fafc', padding: '12px 14px', borderRadius: '12px', border: `1.5px solid ${COLORS.border}` }}>
                <div style={{ fontSize: '11px', color: COLORS.textMuted, fontWeight: 'bold', marginBottom: '2px' }}>📞 เบอร์โทรผู้จอง</div>
                <div style={{ fontWeight: 'bold', color: COLORS.textMain }}>{selectedBookingDetail.customer_phone || '-'}</div>
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '13px', fontWeight: 'bold', color: COLORS.brown, marginBottom: '10px' }}>
                👥 ผู้เดินทางในออเดอร์นี้ ({selectedBookingDetail.travelers?.length || 1} คน):
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {selectedBookingDetail.travelers?.map((t, idx) => (
                  <div className="responsive-row responsive-panel" key={idx} style={{ backgroundColor: '#f8fafc', border: `1.5px solid ${COLORS.border}`, borderRadius: '12px', padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div className="responsive-row" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: idx === 0 ? '#ffe8a3' : '#dff5f2', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold', color: COLORS.brown }}>
                        {idx + 1}
                      </span>
                      <div>
                        <div style={{ fontWeight: 'bold', fontSize: '13px', color: COLORS.brown }}>{t.name}</div>
                        <div style={{ fontSize: '11px', color: COLORS.textMuted }}>{idx === 0 ? '(ผู้จองหลัก)' : `ผู้เดินทางคนที่ ${idx + 1}`}</div>
                      </div>
                    </div>
                    <div style={{ fontSize: '12px', fontWeight: 'bold', color: COLORS.textMain }}>
                      📞 {t.phone || '-'}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px', fontSize: '12px' }}>
              <div className="responsive-panel" style={{ backgroundColor: '#fffdf4', padding: '12px 14px', borderRadius: '12px', border: '1.5px solid #fde047' }}>
                <span style={{ fontWeight: 'bold', color: '#854d0e' }}>🍲 ข้อจำกัดด้านอาหาร: </span>
                <span style={{ color: COLORS.textMain }}>{selectedBookingDetail.special_diet || 'ทั่วไป (ไม่ระบุ)'}</span>
              </div>

              <div className="responsive-panel" style={{ backgroundColor: '#f8fafc', padding: '12px 14px', borderRadius: '12px', border: `1.5px solid ${COLORS.border}` }}>
                <span style={{ fontWeight: 'bold', color: COLORS.brown }}>💬 คำขอพิเศษ / หมายเหตุจากลูกค้า: </span>
                <div style={{ color: COLORS.textMuted, marginTop: '4px' }}>{selectedBookingDetail.special_notes || 'ไม่มีคำขอพิเศษ'}</div>
              </div>

              {selectedBookingDetail.slip && (
                <div className="responsive-row responsive-panel" style={{ backgroundColor: '#f0fdf4', padding: '12px 14px', borderRadius: '12px', border: '1.5px solid #a7f3d0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 'bold', color: '#065f46' }}>📎 แนบหลักฐานสลิปโอนเงินแล้ว</span>
                  <button
                    type="button"
                    onClick={() => {
                      setPreviewSlipUrl(selectedBookingDetail.slip);
                    }}
                    style={{ backgroundColor: '#059669', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    ดูสลิป
                  </button>
                </div>
              )}
            </div>

            {/* ปุ่มยกเลิกคำสั่งซื้อนี้สำหรับแอดมิน */}
            <div className="responsive-row" style={{ display: 'flex', gap: '10px' }}>
              {!String(selectedBookingDetail.booking_status || '').includes('ยกเลิก') && (
                <button
                  type="button"
                  onClick={() => handleCancelSingleBookingByAdmin(selectedBookingDetail.booking_id)}
                  style={{ flex: 1, backgroundColor: '#fef2f2', color: '#dc2626', border: '1.5px solid #fecaca', padding: '12px', borderRadius: '14px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer' }}
                >
                  ❌ ยกเลิกคำสั่งนี้
                </button>
              )}
              <button
                type="button"
                onClick={() => setSelectedBookingDetail(null)}
                style={{ flex: 1, backgroundColor: COLORS.brown, color: '#ffffff', border: 'none', padding: '12px', borderRadius: '14px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer' }}
              >
                ปิดหน้าต่าง
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Modal แจ้งเตือนสำเร็จ */}
      {alertModal.show && (
        <div className="responsive-row responsive-modal" onClick={closeAlert} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10006, padding: '20px' }}>
          <div className="responsive-panel" onClick={(e) => e.stopPropagation()} style={{ backgroundColor: '#ffffff', borderRadius: '24px', padding: '32px 28px', maxWidth: '420px', width: '100%', textAlign: 'center', boxShadow: '0 20px 40px rgba(0,0,0,0.15)', border: `1.5px solid ${COLORS.border}` }}>
            <h3 style={{ fontSize: '18px', fontWeight: '900', color: COLORS.brown, margin: '0 0 8px 0' }}>{alertModal.title}</h3>
            <p style={{ fontSize: '13px', color: COLORS.textMuted, margin: '0 0 24px 0' }}>{alertModal.message}</p>
            <button type="button" onClick={closeAlert} style={{ backgroundColor: COLORS.yellow, color: COLORS.brown, border: 'none', padding: '11px 28px', borderRadius: '14px', fontSize: '13px', fontWeight: '900', cursor: 'pointer' }}>ตกลง</button>
          </div>
        </div>
      )}

      {/* Modal ยืนยันการทำรายการ (Confirm Modal) */}
      {confirmModal.show && (
        <div className="responsive-row responsive-modal" onClick={closeConfirm} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10007, padding: '20px' }}>
          <div className="responsive-panel" onClick={(e) => e.stopPropagation()} style={{ backgroundColor: '#ffffff', borderRadius: '24px', padding: '30px 28px', maxWidth: '420px', width: '100%', textAlign: 'center', boxShadow: '0 20px 40px rgba(0,0,0,0.18)', border: `1.5px solid ${COLORS.border}` }}>
            <h3 style={{ fontSize: '18px', fontWeight: '900', color: COLORS.brown, margin: '0 0 8px 0' }}>{confirmModal.title}</h3>
            <p style={{ fontSize: '13px', color: COLORS.textMuted, margin: '0 0 24px 0' }}>{confirmModal.message}</p>
            <div className="responsive-row" style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button type="button" onClick={closeConfirm} style={{ flex: 1, backgroundColor: '#f1f5f9', color: COLORS.textMain, border: 'none', padding: '11px 18px', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}>ยกเลิก</button>
              <button type="button" onClick={async () => { const action = confirmModal.onConfirm; closeConfirm(); if (action) await action(); }} style={{ flex: 1, backgroundColor: COLORS.red, color: '#ffffff', border: 'none', padding: '11px 18px', borderRadius: '12px', fontWeight: '900', cursor: 'pointer' }}>ยืนยัน</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal ดูสลิป */}
      {previewSlipUrl && (
        <div className="responsive-modal responsive-row" onClick={() => setPreviewSlipUrl(null)} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10005, padding: '20px' }}>
          <div className="responsive-panel" onClick={(e) => e.stopPropagation()} style={{ backgroundColor: '#ffffff', borderRadius: '20px', padding: '20px', maxWidth: '440px', width: '100%', textAlign: 'center', boxShadow: '0 25px 50px rgba(0,0,0,0.3)' }}>
            <h3 style={{ margin: '0 0 12px 0', color: COLORS.brown }}>หลักฐานการโอนเงิน (Slip)</h3>
            <PrivateDocumentImage value={previewSlipUrl} alt="Slip" style={{ width: '100%', maxHeight: '65vh', objectFit: 'contain', borderRadius: '12px' }} />
            <button onClick={() => setPreviewSlipUrl(null)} style={{ marginTop: '16px', backgroundColor: COLORS.brown, color: '#ffffff', border: 'none', padding: '8px 24px', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}>ปิดหน้าต่าง</button>
          </div>
        </div>
      )}

      {/* Modal ดูสมุดบัญชี (Book Bank Preview) */}
      {previewBookBankUrl && (
        <div className="responsive-modal responsive-row" onClick={() => setPreviewBookBankUrl(null)} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10006, padding: '20px' }}>
          <div className="responsive-panel" onClick={(e) => e.stopPropagation()} style={{ backgroundColor: '#ffffff', borderRadius: '20px', padding: '20px', maxWidth: '440px', width: '100%', textAlign: 'center', boxShadow: '0 25px 50px rgba(0,0,0,0.3)' }}>
            <h3 style={{ margin: '0 0 12px 0', color: COLORS.brown, fontSize: '16px' }}>หลักฐานสมุดบัญชี (Book Bank)</h3>
            <PrivateDocumentImage value={previewBookBankUrl} alt="Book Bank" style={{ width: '100%', maxHeight: '65vh', objectFit: 'contain', borderRadius: '12px' }} />
            <button type="button" onClick={() => setPreviewBookBankUrl(null)} style={{ marginTop: '16px', backgroundColor: COLORS.brown, color: '#ffffff', border: 'none', padding: '8px 24px', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}>ปิดหน้าต่าง</button>
          </div>
        </div>
      )}

    </div>
  );
}

const labelStyle = { display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '6px', color: COLORS.brown };
const subLabelStyle = { display: 'block', fontSize: '11px', color: COLORS.textMuted, fontWeight: '600', marginBottom: '3px' };
const inputStyle = { width: '100%', padding: '10px 14px', borderRadius: '12px', border: `1.5px solid ${COLORS.inputBorder}`, backgroundColor: '#ffffff', fontSize: '13px', color: COLORS.textMain, outline: 'none', boxSizing: 'border-box' };
const miniInputStyle = { width: '100%', padding: '8px 12px', borderRadius: '10px', border: `1.5px solid ${COLORS.inputBorder}`, backgroundColor: '#ffffff', fontSize: '12px', color: COLORS.textMain, outline: 'none', boxSizing: 'border-box' };