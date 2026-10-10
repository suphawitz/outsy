import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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

const CATEGORIES_LIST = [
  'การเงินและโชคลาภ',
  'การงานและความสำเร็จ',
  'ความรักและเมตตา',
  'สุขภาพและความสงบ',
  'สิริมงคลรอบด้าน'
];

const PROVINCES_LIST = ['ทั้งหมด', 'เชียงใหม่', 'ลำพูน', 'ลำปาง', 'แพร่', 'น่าน', 'พะเยา', 'เชียงราย'];

// ฟังก์ชันแปลงวันที่ให้เป็น YYYY-MM-DD แบบ ค.ศ.
function normalizeDate(str) {
  if (!str) return '';
  const clean = String(str).trim().split('T')[0];

  if (clean.includes('/')) {
    const parts = clean.split('/');
    if (parts.length === 3) {
      let year = Number(parts[2]);
      if (year > 2500) year -= 543;
      const month = parts[1].padStart(2, '0');
      const day = parts[0].padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  }

  if (clean.includes('-')) {
    const parts = clean.split('-');
    if (parts.length === 3) {
      let year = Number(parts[0]);
      if (year > 2500) year -= 543;
      const month = parts[1].padStart(2, '0');
      const day = parts[2].padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  }

  return clean;
}

export default function TourPackages() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const initialProvince = searchParams.get('province') || 'ทั้งหมด';
  const initialDate = searchParams.get('date') || '';
  const initialBudget = searchParams.get('budget') ? Number(searchParams.get('budget')) : 10000;

  const [packages, setPackages] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedProvince, setSelectedProvince] = useState(initialProvince);
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [placeKeyword, setPlaceKeyword] = useState('');
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [maxPrice, setMaxPrice] = useState(initialBudget);

  useEffect(() => {
    const provParam = searchParams.get('province');
    const dateParam = searchParams.get('date');
    const budgetParam = searchParams.get('budget');

    setSelectedProvince(provParam && provParam.trim() !== '' ? provParam : 'ทั้งหมด');
    setSelectedDate(dateParam || '');
    setMaxPrice(budgetParam ? Number(budgetParam) : 10000);
  }, [searchParams]);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);

      const [pkgRes, schRes] = await Promise.all([
        supabase.from('Tour_Packages').select('*').order('package_id', { ascending: true }),
        supabase.from('Tour_Schedules').select('*').eq('status', 'open')
      ]);

      if (!pkgRes.error && pkgRes.data) {
        setPackages(pkgRes.data);
      }
      if (!schRes.error && schRes.data) {
        setSchedules(schRes.data);
      }

      setLoading(false);
    }

    fetchData();
  }, []);

  const handleCategoryToggle = (cat) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const handleResetFilters = () => {
    setSelectedProvince('ทั้งหมด');
    setSelectedDate('');
    setPlaceKeyword('');
    setSelectedCategories([]);
    setMaxPrice(10000);
    navigate('/packages', { replace: true });
  };

  const formatThaiDate = (dateStr) => {
    const norm = normalizeDate(dateStr);
    if (!norm) return '';
    const [y, m, d] = norm.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);

    const dayNames = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
    const monthNames = [
      'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
      'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
    ];
    const dayOfWeek = dayNames[dateObj.getDay()] || '';
    const dateNum = dateObj.getDate();
    const monthName = monthNames[dateObj.getMonth()] || '';
    const thaiYearShort = (y + 543).toString().slice(-2);
    return `${dayOfWeek} ${dateNum} ${monthName} ${thaiYearShort}`;
  };

  // นำทางไปยังหน้ารายละเอียดแพ็กเกจ พร้อมส่งวันที่ที่แปลงเป็นมาตรฐานแล้วไปด้วย
  const handleGoToTourDetail = (pkg, scheduleDate) => {
    const travelDate = normalizeDate(selectedDate) || normalizeDate(scheduleDate) || '';
    const dateParam = travelDate ? `?date=${travelDate}` : '';
    
    // ✅ เปลี่ยนจาก /tour/ เป็น /package/ ให้ตรงกับ Route ใน App.jsx
    navigate(`/package/${pkg.package_id}${dateParam}`, {
      state: {
        travelDate: travelDate
      }
    });
  };

  const filteredPackages = useMemo(() => {
    const targetDateNorm = normalizeDate(selectedDate);

    const availablePackageIdsOnDate = targetDateNorm
      ? schedules
          .filter((s) => {
            const sDateNorm = normalizeDate(s.travel_date);
            const booked = Number(s.booked_count || 0);
            const maxCap = Number(s.max_capacity || 10);
            return sDateNorm === targetDateNorm && booked < maxCap;
          })
          .map((s) => s.package_id)
      : null;

    return packages.filter((pkg) => {
      if (targetDateNorm && availablePackageIdsOnDate !== null) {
        if (!availablePackageIdsOnDate.includes(pkg.package_id)) {
          return false;
        }
      }

      if (selectedProvince !== 'ทั้งหมด') {
        const matchProv = pkg.package_name?.includes(selectedProvince) || 
                          pkg.description?.includes(selectedProvince) ||
                          pkg.destination?.includes(selectedProvince) ||
                          pkg.province_name === selectedProvince;
        if (!matchProv) return false;
      }

      if (maxPrice && Number(pkg.price) > Number(maxPrice)) {
        return false;
      }

      if (placeKeyword.trim() !== '') {
        const q = placeKeyword.toLowerCase();
        const matchTitle = pkg.package_name?.toLowerCase().includes(q);
        const matchDesc = pkg.description?.toLowerCase().includes(q);
        if (!matchTitle && !matchDesc) return false;
      }

      if (selectedCategories.length > 0) {
        const catValue = pkg.category_name || '';
        const matchCat = selectedCategories.some((c) => {
          const keyword = c.replace('และ', '').substring(0, 4);
          return catValue.includes(c) || catValue.includes(keyword) ||
                 pkg.package_name?.includes(keyword) || pkg.description?.includes(keyword);
        });
        if (!matchCat) return false;
      }

      return true;
    });
  }, [packages, schedules, selectedDate, selectedProvince, placeKeyword, selectedCategories, maxPrice]);

  return (
    <div style={{ backgroundColor: COLORS.bg, minHeight: '100vh', padding: '115px 24px 80px 24px', fontFamily: "'Prompt', -apple-system, sans-serif", color: COLORS.textMain }}>
      <div style={{ maxWidth: '1350px', margin: '0 auto' }}>
        
        {/* หัวข้อหน้า */}
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: '900', margin: '0 0 6px 0', color: COLORS.brown }}>
            แพ็กเกจทัวร์สายมู One-Day Trip ทั้งหมด 🛕
          </h1>
          <p style={{ color: COLORS.textMuted, margin: 0, fontSize: '14px' }}>
            คัดสรรเส้นทางแสวงบุญภาคเหนือ เสริมบารมี โชคลาภ และความสำเร็จ
          </p>
        </div>

        {/* แถบปุ่มเลือกจังหวัด แนวนอน */}
        <div style={{ 
          display: 'flex', 
          gap: '12px', 
          overflowX: 'auto', 
          padding: '8px 4px 16px 4px', 
          marginBottom: '20px',
          alignItems: 'center',
          scrollbarWidth: 'none',
          WebkitOverflowScrolling: 'touch'
        }}>
          {PROVINCES_LIST.map((prov) => {
            const isSelected = selectedProvince === prov;
            return (
              <button
                key={prov}
                onClick={() => setSelectedProvince(prov)}
                style={{
                  backgroundColor: isSelected ? COLORS.brown : COLORS.card,
                  color: isSelected ? '#ffffff' : COLORS.brown,
                  border: isSelected ? `1.5px solid ${COLORS.brown}` : `1.5px solid ${COLORS.border}`,
                  padding: '9px 24px',
                  borderRadius: '9999px',
                  fontWeight: isSelected ? '800' : '600',
                  fontSize: '14px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  boxShadow: isSelected 
                    ? '0 6px 14px rgba(87, 62, 51, 0.2)' 
                    : '0 2px 6px rgba(0, 0, 0, 0.02)',
                  transition: 'all 0.2s ease',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  lineHeight: '1.4'
                }}
              >
                {isSelected && <span style={{ fontSize: '12px' }}>📍</span>}
                {prov}
              </button>
            );
          })}
        </div>

        {/* โครงสร้าง 2 ฝั่ง: Sidebar ซ้าย + Cards ขวา */}
        <div style={{ display: 'grid', gridTemplateColumns: '310px 1fr', gap: '28px', alignItems: 'start' }}>
          
          {/* ================= Sidebar ตัวกรอง ================= */}
          <aside style={{
            backgroundColor: COLORS.card,
            borderRadius: '24px',
            padding: '24px',
            border: `1.5px solid ${COLORS.border}`,
            boxShadow: '0 4px 18px rgba(0, 0, 0, 0.02)',
            position: 'sticky',
            top: '95px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 'bold', margin: 0, color: COLORS.brown }}>
                🔍 ตัวกรองค้นหา
              </h3>
              <button
                onClick={handleResetFilters}
                style={{ background: 'none', border: 'none', color: COLORS.cyan, fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', padding: 0 }}
              >
                ล้างทั้งหมด
              </button>
            </div>

            {/* 1. เลือกจังหวัด */}
            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '8px', color: COLORS.brown }}>
                📍 เลือกจังหวัด
              </label>
              <select
                value={selectedProvince}
                onChange={(e) => setSelectedProvince(e.target.value)}
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
                {PROVINCES_LIST.map((prov) => (
                  <option key={prov} value={prov}>{prov === 'ทั้งหมด' ? 'ทุกจังหวัด (ภาคเหนือ)' : `จังหวัด${prov}`}</option>
                ))}
              </select>
            </div>

            {/* 2. เลือกวันที่เดินทาง */}
            <div style={{ marginBottom: '18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label style={{ fontSize: '13px', fontWeight: 'bold', color: COLORS.brown }}>
                  📅 วันที่เดินทาง
                </label>
                {selectedDate && (
                  <button
                    onClick={() => setSelectedDate('')}
                    style={{ background: 'none', border: 'none', color: COLORS.red, fontSize: '11px', cursor: 'pointer', padding: 0, fontWeight: 'bold' }}
                  >
                    ล้างวันที่
                  </button>
                )}
              </div>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '12px',
                  border: `1.5px solid ${COLORS.border}`,
                  backgroundColor: '#ffffff',
                  fontSize: '13px',
                  color: COLORS.brown,
                  outline: 'none',
                  boxSizing: 'border-box',
                  cursor: 'pointer'
                }}
              />
            </div>

            {/* 3. ค้นหาชื่อวัด */}
            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '8px', color: COLORS.brown }}>
                🛕 ค้นหาชื่อวัด / สถานที่
              </label>
              <input
                type="text"
                value={placeKeyword}
                onChange={(e) => setPlaceKeyword(e.target.value)}
                placeholder="เช่น วัดป่าแดด, วัดภูมินทร์..."
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '12px',
                  border: `1.5px solid ${COLORS.border}`,
                  boxSizing: 'border-box',
                  fontSize: '13px',
                  outline: 'none',
                  backgroundColor: '#ffffff'
                }}
              />
            </div>

            {/* 4. สไลเดอร์งบประมาณ */}
            <div style={{ marginBottom: '22px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: 'bold', color: COLORS.brown }}>💰 งบประมาณสูงสุด</span>
                <span style={{ fontSize: '15px', fontWeight: '900', color: COLORS.red }}>
                  ฿{maxPrice.toLocaleString()}
                </span>
              </div>
              <input
                type="range"
                min="1000"
                max="10000"
                step="100"
                value={maxPrice}
                onChange={(e) => setMaxPrice(Number(e.target.value))}
                style={{ width: '100%', accentColor: COLORS.cyan, cursor: 'pointer' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: COLORS.textMuted, marginTop: '4px' }}>
                <span>฿1,000</span>
                <span>฿10,000</span>
              </div>
            </div>

            {/* 5. Checkbox หมวดหมู่สายมู */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '10px', color: COLORS.brown }}>
                ✨ หมวดหมู่สายมู (เลือกได้หลายข้อ)
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {CATEGORIES_LIST.map((cat) => {
                  const isChecked = selectedCategories.includes(cat);
                  return (
                    <label
                      key={cat}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        fontSize: '13px',
                        color: isChecked ? COLORS.brown : COLORS.textMuted,
                        fontWeight: isChecked ? 'bold' : 'normal',
                        cursor: 'pointer',
                        padding: '6px 10px',
                        borderRadius: '10px',
                        backgroundColor: isChecked ? '#fffdf0' : 'transparent',
                        border: isChecked ? `1px solid ${COLORS.yellow}` : '1px solid transparent'
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleCategoryToggle(cat)}
                        style={{ width: '16px', height: '16px', accentColor: COLORS.brown, cursor: 'pointer' }}
                      />
                      <span>{cat}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* แสดงจำนวนผลลัพธ์ */}
            <div style={{ paddingTop: '14px', borderTop: `1px dashed ${COLORS.border}`, fontSize: '12px', color: COLORS.textMuted, textAlign: 'center', marginBottom: '16px' }}>
              พบแพ็กเกจทั้งหมด <strong>{filteredPackages.length}</strong> รายการ
            </div>

            {/* ปุ่มรีเซ็ต */}
            <button
              onClick={handleResetFilters}
              style={{
                width: '100%',
                backgroundColor: '#ffffff',
                color: COLORS.brown,
                border: `1.5px solid ${COLORS.border}`,
                borderRadius: '14px',
                padding: '10px 16px',
                fontSize: '13px',
                fontWeight: 'bold',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                transition: 'background-color 0.2s ease'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#2bced191')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#2bcdd1')}
            >
              <span>🔄</span> รีเซ็ตค่าตัวกรองทั้งหมด
            </button>
          </aside>

          {/* ================= รายการการ์ดแพ็กเกจ ================= */}
          <main>
            {loading ? (
              <p style={{ textAlign: 'center', color: COLORS.textMuted, padding: '40px 0' }}>กำลังโหลดข้อมูลแพ็กเกจ...</p>
            ) : filteredPackages.length === 0 ? (
              <div style={{ backgroundColor: COLORS.card, padding: '50px 20px', borderRadius: '24px', textAlign: 'center', border: `1.5px solid ${COLORS.border}` }}>
                <div style={{ fontSize: '38px', marginBottom: '8px' }}>🔍</div>
                <p style={{ margin: '0 0 6px 0', fontWeight: 'bold', color: COLORS.brown }}>ไม่พบแพ็กเกจที่ตรงตามเงื่อนไข</p>
                <p style={{ margin: 0, fontSize: '13px', color: COLORS.textMuted }}>
                  {selectedDate ? `ไม่มีรอบเดินทางในวันที่ ${selectedDate} หรือรอบเต็มแล้ว ` : ''}ลองปรับเปลี่ยนตัวกรองดูใหม่อีกครั้ง
                </p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: '24px' }}>
                {filteredPackages.map((pkg) => {
                  const categoryName = pkg.category_name || 'สายมู & ขอพร';
                  
                  const targetDateNorm = normalizeDate(selectedDate);
                  const currentSchedule = targetDateNorm
                    ? schedules.find((s) => {
                        const sDateNorm = normalizeDate(s.travel_date);
                        return s.package_id === pkg.package_id && sDateNorm === targetDateNorm;
                      })
                    : null;

                  const booked = currentSchedule ? Number(currentSchedule.booked_count || 0) : 0;
                  const maxCap = currentSchedule ? Number(currentSchedule.max_capacity || 10) : (pkg.max_people || 10);
                  const minCap = currentSchedule ? Number(currentSchedule.min_capacity || 4) : 4;
                  const remainingSeats = maxCap - booked;
                  const progressPercent = Math.min(100, Math.round((booked / maxCap) * 100));

                  return (
                    <div
                      key={pkg.package_id}
                      onClick={() => handleGoToTourDetail(pkg, currentSchedule?.travel_date)}
                      style={{
                        backgroundColor: COLORS.card,
                        borderRadius: '24px',
                        border: `1.5px solid ${COLORS.border}`,
                        overflow: 'hidden',
                        boxShadow: '0 4px 18px rgba(0, 0, 0, 0.03)',
                        display: 'flex',
                        flexDirection: 'column',
                        cursor: 'pointer',
                        transition: 'transform 0.25s ease, box-shadow 0.25s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-5px)';
                        e.currentTarget.style.boxShadow = '0 12px 28px rgba(0, 0, 0, 0.08)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 4px 18px rgba(0, 0, 0, 0.03)';
                      }}
                    >
                      {/* รูปภาพ พร้อมป้าย package_id ซ้าย และ Selected Date Badge ขวา */}
                      <div style={{ position: 'relative', width: '100%', height: '220px' }}>
                        <img
                          src={pkg.image_path ? pkg.image_path.split(',')[0].trim() : 'https://images.unsplash.com/photo-1528181304800-259b08848526?w=800'}
                          alt={pkg.package_name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          onError={(e) => {
                            e.target.src = 'https://images.unsplash.com/photo-1528181304800-259b08848526?w=800&auto=format&fit=crop&q=80';
                          }}
                        />

                        {/* ป้ายรหัสแพ็กเกจ (ซ้ายบน) */}
                        <div style={{
                          position: 'absolute',
                          top: '14px',
                          left: '14px',
                          backgroundColor: COLORS.yellow,
                          color: COLORS.brown,
                          padding: '4px 11px',
                          borderRadius: '14px',
                          fontSize: '11px',
                          fontWeight: '900',
                          letterSpacing: '0.3px',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                        }}>
                          📍 {pkg.package_id}
                        </div>

                        {/* Selected Date Badge (ขวาบน) */}
                        {selectedDate && (
                          <div style={{
                            position: 'absolute',
                            top: '14px',
                            right: '14px',
                            backgroundColor: COLORS.cyan,
                            color: '#013a3d',
                            padding: '5px 12px',
                            borderRadius: '14px',
                            fontSize: '11px',
                            fontWeight: '800',
                            letterSpacing: '0.2px',
                            boxShadow: '0 3px 10px rgba(43,205,209,0.3)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}>
                            <span>📅</span> รอบวัน{formatThaiDate(selectedDate)}
                          </div>
                        )}
                      </div>

                      {/* เนื้อหาการ์ด */}
                      <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
                        <div style={{ marginBottom: '8px' }}>
                          <span style={{ fontSize: '13px', fontWeight: 'bold', color: COLORS.cyan }}>
                            {categoryName} • {pkg.duration || '1 วัน'}
                          </span>
                        </div>

                        <h3 style={{
                          fontSize: '17px',
                          fontWeight: '800',
                          margin: '0 0 6px 0',
                          lineHeight: '1.4',
                          color: COLORS.brown
                        }}>
                          {pkg.package_name}
                        </h3>

                        <p style={{
                          fontSize: '12px',
                          color: COLORS.textMuted,
                          margin: '0 0 14px 0',
                          lineHeight: '1.6',
                          flexGrow: 1
                        }}>
                          {pkg.description}
                        </p>

                        {/* สถานะความจุและจำนวนที่นั่งคงเหลือ */}
                        {selectedDate && currentSchedule && (
                          <div style={{
                            backgroundColor: '#f8fafc',
                            border: `1px solid ${COLORS.border}`,
                            borderRadius: '14px',
                            padding: '10px 14px',
                            marginBottom: '14px'
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                              <span style={{ fontSize: '11px', color: COLORS.textMuted, fontWeight: '700' }}>
                                สถานะที่นั่งรอบนี้:
                              </span>
                              <span style={{
                                fontSize: '12px',
                                fontWeight: '800',
                                color: remainingSeats <= 3 ? COLORS.red : '#059669'
                              }}>
                                {remainingSeats <= 3 ? `🔥 เหลือเพียง ${remainingSeats} ที่!` : `ว่างอีก ${remainingSeats} ที่`}
                              </span>
                            </div>

                            <div style={{ fontSize: '11px', lineHeight: '1.4' }}>
                              {booked >= minCap ? (
                                <span style={{ color: '#059669', fontWeight: '800' }}>
                                  ✅ ยืนยันออกทริปแน่นอน (จองแล้ว {booked}/{maxCap} ท่าน)
                                </span>
                              ) : (
                                <span style={{ color: '#d97706', fontWeight: '600' }}>
                                  ⏳ รับจองแล้ว {booked}/{maxCap} ท่าน (ต้องการอีก {minCap - booked} ท่านเพื่อออกทริป)
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Mini Progress Bar */}
                        {selectedDate && currentSchedule && (
                          <div style={{ marginBottom: '14px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: COLORS.textMuted, marginBottom: '3px', fontWeight: 'bold' }}>
                              <span>ความจุทริป</span>
                              <span>{progressPercent}%</span>
                            </div>
                            <div style={{ width: '100%', height: '5px', backgroundColor: '#e2e8f0', borderRadius: '9999px', overflow: 'hidden' }}>
                              <div style={{
                                width: `${progressPercent}%`,
                                height: '100%',
                                backgroundColor: remainingSeats <= 3 ? COLORS.red : COLORS.cyan,
                                borderRadius: '9999px',
                                transition: 'width 0.3s ease'
                              }} />
                            </div>
                          </div>
                        )}

                        {/* แถบราคาและปุ่มจอง */}
                        <div style={{
                          marginTop: 'auto',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          paddingTop: '16px',
                          borderTop: `1px dashed ${COLORS.border}`
                        }}>
                          <div>
                            <span style={{ fontSize: '11px', color: COLORS.textMuted, display: 'block' }}>ราคาเริ่มต้น / ท่าน</span>
                            <div style={{ fontSize: '24px', fontWeight: '900', color: COLORS.red, lineHeight: 1.1 }}>
                              ฿{Number(pkg.price).toLocaleString()}
                            </div>
                          </div>

                          {/* ปุ่มจองทริปสีแดง */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleGoToTourDetail(pkg, currentSchedule?.travel_date);
                            }}
                            style={{
                              backgroundColor: COLORS.red,
                              color: '#ffffff',
                              border: 'none',
                              padding: '10px 20px',
                              borderRadius: '14px',
                              fontWeight: 'bold',
                              fontSize: '13px',
                              cursor: 'pointer',
                              boxShadow: '0 4px 14px rgba(231, 25, 31, 0.3)',
                              transition: 'transform 0.15s ease, background-color 0.15s ease'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.transform = 'scale(1.03)';
                              e.currentTarget.style.backgroundColor = '#d3151b';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.transform = 'scale(1)';
                              e.currentTarget.style.backgroundColor = COLORS.red;
                            }}
                          >
                            จองทริปนี้ ➔
                          </button>
                        </div>

                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </main>

        </div>

      </div>
    </div>
  );
}