import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../client';

// กำหนด Palette สีหลักของระบบ Outsy (Clean & Minimal)
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

export default function Home() {
  const navigate = useNavigate();

  const [selectedProvince, setSelectedProvince] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  
  const [featuredPackages, setFeaturedPackages] = useState([]);
  const [loading, setLoading] = useState(true);

  // ข้อมูล 5 จังหวัด พร้อมรูปภาพแลนด์มาร์กไฮไลต์
  const provinces = [
    {
      id: 1,
      name: 'เชียงใหม่',
      desc: 'วัดป่าแดด • ดอยสุเทพ • วัดอุโมงค์',
      badge: 'ยอดนิยม 🔥',
      image: 'https://sihfjdpefsozabdhwucd.supabase.co/storage/v1/object/public/tourist_images/PKG-MU01/2.jpeg'
    },
    {
      id: 2,
      name: 'เชียงราย',
      desc: 'วัดร่องขุ่น • ร่องเสือเต้น • ห้วยปลากั้ง',
      badge: 'สายพุทธศิลป์ 🪷',
      image: 'https://sihfjdpefsozabdhwucd.supabase.co/storage/v1/object/public/tourist_images/PKG-MU03/1.jpg'
    },
    {
      id: 3,
      name: 'ลำปาง',
      desc: 'พระธาตุลำปางหลวง • วัดเฉลิมพระเกียรติ',
      badge: 'เมืองรถม้า 🏛️',
      image: 'https://sihfjdpefsozabdhwucd.supabase.co/storage/v1/object/public/tourist_images/PKG-MU05/2.png'
    },
    {
      id: 4,
      name: 'ลำพูน',
      desc: 'พระธาตุหริภุญชัย • อนุสาวรีย์จามเทวี',
      badge: 'สิริมงคลล้านนา 👑',
      image: 'https://sihfjdpefsozabdhwucd.supabase.co/storage/v1/object/public/tourist_images/PKG-MU06/1.jpg'
    },
    {
      id: 5,
      name: 'น่าน',
      desc: 'กระซิบรักวัดภูมินทร์ • พระธาตุแช่แห้ง',
      badge: 'เสน่ห์เมืองน่าน 🌿',
      image: 'https://sihfjdpefsozabdhwucd.supabase.co/storage/v1/object/public/tourist_images/PKG-MU09/1.jpg'
    }
  ];

  // จุดเด่นการบริการ
  const features = [
    {
      icon: '✨',
      title: 'วางเส้นทางตามฤกษ์มงคล',
      desc: 'คัดสรรลำดับวัดและช่วงเวลาไหว้ที่ถูกต้อง เสริมพลังชีวิตอย่างเต็มเปี่ยม'
    },
    {
      icon: '🚐',
      title: 'รถตู้ VIP เดินทางสบาย',
      desc: 'รถตู้ปรับอากาศ เบาะนุ่ม พร้อมคนขับมืออาชีพชำนาญเส้นทางภาคเหนือ'
    },
    {
      icon: '👥',
      title: 'การันตีออกทริปง่าย',
      desc: 'เพียง 4 ท่านก็ออกทริปได้ทันที ไม่ต้องรอนาน พร้อมแจ้งเตือนสถานะโปร่งใส'
    },
    {
      icon: '💯',
      title: 'ดูแลโดยคนท้องถิ่น',
      desc: 'มีผู้ดูแลทริปแนะนำการไหว้ บทสวด และวิธีขอพรให้สัมฤทธิ์ผล'
    }
  ];

  useEffect(() => {
    async function fetchFeaturedPackages() {
      setLoading(true);
      const { data, error } = await supabase
        .from('Tour_Packages')
        .select('*')
        .order('package_id', { ascending: true })
        .limit(3);

      if (!error && data) {
        setFeaturedPackages(data);
      }
      setLoading(false);
    }

    fetchFeaturedPackages();
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    const queryParams = new URLSearchParams();
    
    if (selectedProvince && selectedProvince.trim() !== '') {
      queryParams.append('province', selectedProvince);
    }
    if (selectedDate && selectedDate.trim() !== '') {
      queryParams.append('date', selectedDate);
    }
    if (maxPrice && maxPrice.trim() !== '') {
      queryParams.append('budget', maxPrice);
    }

    navigate(`/packages?${queryParams.toString()}`);
  };

  return (
    <div style={{ fontFamily: "'Prompt', -apple-system, sans-serif", backgroundColor: COLORS.bg, minHeight: '100vh', color: COLORS.textMain, paddingBottom: '70px' }}>
      
      {/* 1. Hero Section */}
      <section style={{
        position: 'relative',
        minHeight: '520px',
        backgroundImage: 'linear-gradient(180deg, rgba(87, 62, 51, 0.45) 0%, rgba(87, 62, 51, 0.82) 100%), url("https://images.unsplash.com/photo-1528181304800-259b08848526?w=1600&auto=format&fit=crop&q=80")',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '110px 20px 100px 20px',
        textAlign: 'center'
      }}>
        {/* ป้ายเหลืองสด #fdd501 */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          backgroundColor: COLORS.yellow,
          color: COLORS.brown,
          padding: '6px 20px',
          borderRadius: '9999px',
          fontWeight: '900',
          fontSize: '12px',
          marginBottom: '16px',
          boxShadow: '0 4px 14px rgba(0,0,0,0.15)'
        }}>
          <span>🚩</span> จองแพ็กเกจทัวร์สายมู One-Day Trip ภาคเหนือ
        </div>

        <h1 style={{ fontSize: '42px', fontWeight: '900', color: '#ffffff', margin: '0 0 10px 0', textShadow: '0 3px 12px rgba(0,0,0,0.5)', letterSpacing: '0.2px' }}>
          ค้นหาทริปมูเตลูที่ตรงใจคุณ 🛕
        </h1>
        <p style={{ color: '#f8fafc', fontSize: '16px', margin: '0 0 40px 0', textShadow: '0 2px 8px rgba(0,0,0,0.4)', maxWidth: '640px', lineHeight: '1.6' }}>
          รวมเส้นทางแสวงบุญล้านนา เสริมดวง ชัยชนะ โชคลาภ และความรัก เที่ยวสบายใน 1 วัน
        </p>

        {/* คอนเทนเนอร์กล่อง Search ลอย */}
        <form
          onSubmit={handleSearch}
          style={{
            position: 'absolute',
            bottom: '-40px',
            width: '92%',
            maxWidth: '1040px',
            backgroundColor: COLORS.card,
            borderRadius: '9999px',
            padding: '10px 14px 10px 28px',
            boxShadow: '0 18px 36px rgba(0, 0, 0, 0.08)',
            border: `1.5px solid ${COLORS.border}`,
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            boxSizing: 'border-box',
            zIndex: 10
          }}
        >
          {/* ช่องเลือกจังหวัด */}
          <div style={{ flex: 1.2, textAlign: 'left' }}>
            <span style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: COLORS.cyan }}>
              📍 จุดหมายปลายทาง
            </span>
            <select
              value={selectedProvince}
              onChange={(e) => setSelectedProvince(e.target.value)}
              style={{
                width: '100%',
                border: 'none',
                outline: 'none',
                background: 'transparent',
                fontSize: '14px',
                fontWeight: '700',
                color: COLORS.brown,
                cursor: 'pointer',
                padding: '4px 0 0 0'
              }}
            >
              <option value="">เลือกจังหวัด (ทั้งหมด)</option>
              <option value="เชียงใหม่">เชียงใหม่</option>
              <option value="เชียงราย">เชียงราย</option>
              <option value="ลำปาง">ลำปาง</option>
              <option value="ลำพูน">ลำพูน</option>
              <option value="น่าน">น่าน</option>
              <option value="พะเยา">พะเยา</option>
              <option value="แพร่">แพร่</option>
            </select>
          </div>

          <div style={{ width: '1px', height: '34px', backgroundColor: COLORS.border }} />

          {/* ช่องเลือกวันที่เดินทาง */}
          <div style={{ flex: 1.2, textAlign: 'left' }}>
            <span style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: COLORS.red }}>
              📅 วันที่เดินทาง
            </span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{
                width: '100%',
                border: 'none',
                outline: 'none',
                background: 'transparent',
                fontSize: '13px',
                fontWeight: '700',
                color: COLORS.brown,
                cursor: 'pointer',
                padding: '4px 0 0 0'
              }}
            />
          </div>

          <div style={{ width: '1px', height: '34px', backgroundColor: COLORS.border }} />

          {/* ช่องงบประมาณ */}
          <div style={{ flex: 1.1, textAlign: 'left' }}>
            <span style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: '#16a34a' }}>
              💰 งบประมาณสูงสุด
            </span>
            <select
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              style={{
                width: '100%',
                border: 'none',
                outline: 'none',
                background: 'transparent',
                fontSize: '14px',
                fontWeight: '700',
                color: COLORS.brown,
                cursor: 'pointer',
                padding: '4px 0 0 0'
              }}
            >
              <option value="">ไม่จำกัดราคา</option>
              <option value="1200">ไม่เกิน ฿1,200</option>
              <option value="1500">ไม่เกิน ฿1,500</option>
              <option value="2000">ไม่เกิน ฿2,000</option>
              <option value="3000">ไม่เกิน ฿3,000</option>
            </select>
          </div>

          {/* ปุ่มกดค้นหาสีแดง #e7191f */}
          <button
            type="submit"
            style={{
              backgroundColor: COLORS.red,
              color: '#ffffff',
              border: 'none',
              borderRadius: '9999px',
              padding: '12px 28px',
              fontSize: '14px',
              fontWeight: '900',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 4px 14px rgba(231, 25, 31, 0.35)',
              whiteSpace: 'nowrap',
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
            ค้นหาทัวร์ 🔍
          </button>
        </form>
      </section>

      {/* 2. การ์ดจุดหมายปลายทางสายมู */}
      <section style={{ maxWidth: '1200px', margin: '90px auto 0 auto', padding: '0 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '22px' }}>
          <div>
            
            <h2 style={{ fontSize: '24px', fontWeight: '900', margin: '0 0 4px 0', color: COLORS.brown }}>
              เลือกจุดหมายปลายทางสายมู 🪷
            </h2>
            <p style={{ color: COLORS.textMuted, margin: 0, fontSize: '13px' }}>
              สัมผัสพลังศรัทธาและมนต์เสน่ห์ล้านนาในจังหวัดที่คุณปรารถนา
            </p>
          </div>
          {/* ปุ่มขอบฟ้า Outsy Minimal */}
          <button
            onClick={() => navigate('/packages')}
            style={{
              backgroundColor: '#ffffff',
              border: `1.5px solid ${COLORS.cyan}`,
              borderRadius: '9999px',
              padding: '7px 20px',
              fontSize: '13px',
              fontWeight: 'bold',
              color: '#088387',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 6px rgba(43, 205, 209, 0.08)',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#f0fdfe';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#ffffff';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            ดูครบทุกพื้นที่ →
          </button>
        </div>

        {/* ตะแกรงการ์ดรูปภาพ 5 จังหวัด */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '18px'
        }}>
          {provinces.map((p) => (
            <div
              key={p.id}
              onClick={() => navigate(`/packages?province=${encodeURIComponent(p.name)}`)}
              style={{
                position: 'relative',
                height: '250px',
                borderRadius: '22px',
                overflow: 'hidden',
                cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.04)',
                border: `1.5px solid ${COLORS.border}`,
                transition: 'all 0.25s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-5px)';
                e.currentTarget.style.borderColor = COLORS.cyan;
                e.currentTarget.style.boxShadow = '0 12px 26px rgba(43, 205, 209, 0.18)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.borderColor = COLORS.border;
                e.currentTarget.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.04)';
              }}
            >
              <img
                src={p.image}
                alt={p.name}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover'
                }}
              />

              <div style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.1) 0%, rgba(15, 23, 42, 0.85) 100%)'
              }} />

              {/* ป้าย Badge สีเหลืองทอง #fdd501 */}
              <div style={{
                position: 'absolute',
                top: '14px',
                left: '14px',
                backgroundColor: COLORS.yellow,
                color: COLORS.brown,
                fontSize: '11px',
                fontWeight: '900',
                padding: '4px 10px',
                borderRadius: '12px',
                boxShadow: '0 2px 6px rgba(0,0,0,0.15)'
              }}>
                {p.badge}
              </div>

              <div style={{ position: 'absolute', bottom: '16px', left: '16px', right: '16px', color: '#ffffff' }}>
                <h3 style={{ fontSize: '19px', fontWeight: 'bold', margin: '0 0 3px 0', textShadow: '0 2px 4px rgba(0,0,0,0.4)' }}>
                  {p.name}
                </h3>
                <p style={{ fontSize: '11px', margin: 0, color: '#f1f5f9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', opacity: 0.9 }}>
                  {p.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 3. แถบจุดเด่นและบริการ (Service Highlights) */}
      <section style={{ maxWidth: '1200px', margin: '40px auto 0 auto', padding: '0 24px' }}>
        <div style={{
          backgroundColor: COLORS.card,
          borderRadius: '24px',
          padding: '24px 28px',
          border: `1.5px solid ${COLORS.border}`,
          boxShadow: '0 4px 18px rgba(0,0,0,0.03)',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
          gap: '20px'
        }}>
          {features.map((f, i) => (
            <div key={i} style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
              <div style={{
                width: '44px',
                height: '44px',
                borderRadius: '14px',
                backgroundColor: '#fffdf0',
                border: `1.5px solid ${COLORS.yellow}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '20px',
                flexShrink: 0
              }}>
                {f.icon}
              </div>
              <div>
                <h4 style={{ fontSize: '14px', fontWeight: '800', color: COLORS.brown, margin: '0 0 4px 0' }}>
                  {f.title}
                </h4>
                <p style={{ fontSize: '12px', color: COLORS.textMuted, margin: 0, lineHeight: '1.5' }}>
                  {f.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 4. รายการแพ็กเกจทัวร์แนะนำประจำสัปดาห์ */}
      <section style={{ maxWidth: '1200px', margin: '55px auto 40px auto', padding: '0 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '24px' }}>
          <div>
            <h2 style={{ fontSize: '24px', fontWeight: '900', margin: '0 0 4px 0', color: COLORS.brown }}>
              แพ็กเกจทัวร์แนะนำ🌟
            </h2>
            <p style={{ color: COLORS.textMuted, margin: 0, fontSize: '13px' }}>
              จัดสรรเวลาและเส้นทางมูอย่างคุ้มค่า จบครบในวันเดียว
            </p>
          </div>
          <button
            onClick={() => navigate('/packages')}
            style={{
              backgroundColor: '#ffffff',
              border: `1.5px solid ${COLORS.cyan}`,
              borderRadius: '9999px',
              padding: '7px 20px',
              fontSize: '13px',
              fontWeight: 'bold',
              color: '#088387',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 6px rgba(43, 205, 209, 0.08)',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#f0fdfe';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#ffffff';
            }}
          >
            ดูทั้งหมด →
          </button>
        </div>

        {loading ? (
          <p style={{ textAlign: 'center', color: COLORS.textMuted, padding: '40px 0' }}>กำลังโหลดแพ็กเกจแนะนำจากระบบ...</p>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '24px'
          }}>
            {featuredPackages.map((pkg) => (
              <div
                key={pkg.package_id}
                onClick={() => navigate(`/package/${pkg.package_id}`)}
                style={{
                  backgroundColor: COLORS.card,
                  borderRadius: '24px',
                  overflow: 'hidden',
                  border: `1.5px solid ${COLORS.border}`,
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
                {/* รูปภาพแพ็กเกจ */}
                <div style={{ position: 'relative', width: '100%', height: '220px', overflow: 'hidden' }}>
                  <img
                    src={
                      pkg.image_path
                        ? pkg.image_path.split(',')[0].trim()
                        : 'https://images.unsplash.com/photo-1528181304800-259b08848526?w=800'
                    }
                    alt={pkg.package_name}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover'
                    }}
                    onError={(e) => {
                      e.target.src = 'https://images.unsplash.com/photo-1528181304800-259b08848526?w=800&auto=format&fit=crop&q=80';
                    }}
                  />
                  {/* Badge สีเหลืองทอง #fdd501 */}
                  <span
                    style={{
                      position: 'absolute',
                      top: '14px',
                      left: '14px',
                      backgroundColor: COLORS.yellow,
                      color: COLORS.brown,
                      fontSize: '11px',
                      fontWeight: '900',
                      padding: '4px 11px',
                      borderRadius: '14px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                    }}
                  >
                    📍 {pkg.package_id}
                  </span>
                </div>

                {/* รายละเอียดแพ็กเกจ */}
                <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
                  {/* ป้ายหมวดหมู่สีฟ้า #2bcdd1 */}
                  <div style={{ marginBottom: '8px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 'bold', color: COLORS.cyan }}>
                      {pkg.category_name || 'สายมู & ขอพร'} • {pkg.duration || '1 วัน'}
                    </span>
                  </div>

                  <h3 style={{ fontSize: '17px', fontWeight: '800', color: COLORS.brown, margin: '0 0 6px 0', lineHeight: '1.4' }}>
                    {pkg.package_name}
                  </h3>

                  <p style={{ fontSize: '12px', color: COLORS.textMuted, margin: '0 0 16px 0', lineHeight: '1.6', flexGrow: 1 }}>
                    {pkg.description}
                  </p>

                  {/* แถบราคาและปุ่มกดจอง */}
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
                      {/* ราคาตัวเลขสีแดง #e7191f */}
                      <div style={{ fontSize: '24px', fontWeight: '900', color: COLORS.red, lineHeight: 1.1 }}>
                        ฿{Number(pkg.price).toLocaleString()}
                      </div>
                    </div>

                    {/* ปุ่มจองทริปสีแดง #e7191f */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/booking/${pkg.package_id}`);
                      }}
                      style={{
                        backgroundColor: COLORS.red,
                        color: '#ffffff',
                        border: 'none',
                        padding: '10px 20px',
                        borderRadius: '14px',
                        fontSize: '13px',
                        fontWeight: 'bold',
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
            ))}
          </div>
        )}
      </section>

    </div>
  );
}