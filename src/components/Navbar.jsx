import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../client';

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const isActive = (path) => location.pathname === path;

  // State ตรวจสอบสถานะเข้าสู่ระบบและสิทธิ์แอดมิน
  const [user, setUser] = useState(null);
  const [username, setUsername] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  
  // State สำหรับควบคุม Custom Alert Modal ออกจากระบบ
  const [logoutModal, setLogoutModal] = useState(false);

  const dropdownRef = useRef(null);

  useEffect(() => {
    // 1. ตรวจสอบ session ปัจจุบัน
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserInfo(session.user.id, session.user.email);
      }
    });

    // 2. ดักฟังเหตุการณ์ เข้าสู่ระบบ / ออกจากระบบ แบบ Realtime
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserInfo(session.user.id, session.user.email);
      } else {
        setUsername('');
        setIsAdmin(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // ดึงชื่อผู้ใช้และตรวจสอบสิทธิ์ Admin จากตาราง users
  const fetchUserInfo = async (authId, email) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('username, role')
        .eq('auth_id', authId)
        .maybeSingle();

      if (data) {
        if (data.username) setUsername(data.username);
        else setUsername(email ? email.split('@')[0] : 'ผู้ใช้งาน');

        // ตรวจสอบว่า role เป็น Admin หรือไม่ (รองรับทั้งตัวพิมพ์เล็กและใหญ่)
        if (data.role && (data.role.toLowerCase() === 'admin')) {
          setIsAdmin(true);
        } else {
          setIsAdmin(false);
        }
      } else {
        setUsername(email ? email.split('@')[0] : 'ผู้ใช้งาน');
        setIsAdmin(false);
      }
    } catch {
      setUsername(email ? email.split('@')[0] : 'ผู้ใช้งาน');
      setIsAdmin(false);
    }
  };

  // ปิดเมนูลอยเมื่อคลิกที่อื่น
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ฟังก์ชันกดออกจากระบบ (เปิด Custom Modal)
  const handleLogoutClick = () => {
    setDropdownOpen(false);
    setLogoutModal(true);
  };

  // ยืนยันการออกจากระบบจริง
  const confirmLogout = async () => {
    try {
      await supabase.auth.signOut();
      setLogoutModal(false);
      setIsAdmin(false);
      navigate('/');
    } catch (err) {
      console.error('Logout error:', err.message);
      setLogoutModal(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: '16px',
      left: 0,
      right: 0,
      zIndex: 1000,
      padding: '0 24px',
      boxSizing: 'border-box',
      pointerEvents: 'none'
    }}>
      <header style={{
        maxWidth: '1280px',
        margin: '0 auto',
        height: '66px',
        padding: '0 28px',
        display: 'grid',
        gridTemplateColumns: '1fr auto 1fr',
        alignItems: 'center',
        borderRadius: '9999px',
        backgroundColor: 'rgba(255, 255, 255, 0.92)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        border: '1.5px solid rgba(255, 255, 255, 0.95)',
        boxShadow: '0 8px 30px rgba(0, 0, 0, 0.12)',
        pointerEvents: 'auto'
      }}>

        {/* ฝั่งซ้าย: เมนูนำทาง */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: '8px', justifySelf: 'start' }}>
          {[
            { name: 'หน้าหลัก', path: '/' },
            { name: 'แพ็กเกจทัวร์', path: '/packages' },
            { name: 'ประวัติการจอง', path: '/history' }
          ].map((item) => {
            const active = isActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                style={{
                  textDecoration: 'none',
                  fontSize: '14px',
                  fontWeight: active ? '800' : '600',
                  color: active ? '#573e33' : '#786154',
                  padding: '7px 16px',
                  borderRadius: '20px',
                  backgroundColor: active ? '#fdd501' : 'transparent',
                  border: active ? '1.5px solid #fdd501' : '1.5px solid transparent',
                  transition: 'all 0.18s ease'
                }}
              >
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* ตรงกลาง: โลโก้ Outsy! */}
        <Link 
          to="/" 
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            textDecoration: 'none',
            transition: 'transform 0.2s ease'
          }}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
          <img
            src="/logo.png"
            alt="Outsy Logo"
            style={{
              height: '65px',
              width: 'auto',
              objectFit: 'contain',
              display: 'block'
            }}
            onError={(e) => {
              e.target.src = '/images/logo.png';
            }}
          />
        </Link>

        {/* ฝั่งขวา: โปรไฟล์ผู้ใช้ / ปุ่มเข้าสู่ระบบ & ปุ่ม Admin (แสดงเฉพาะ Admin) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', justifySelf: 'end' }}>
          
          {user ? (
            <div style={{ position: 'relative' }} ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setDropdownOpen(!dropdownOpen)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  backgroundColor: '#f8fafc',
                  border: '1.5px solid #e2e8f0',
                  padding: '4px 12px 4px 5px',
                  borderRadius: '9999px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = '#2bcdd1'}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = '#e2e8f0'}
              >
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  backgroundColor: '#fdd501',
                  color: '#573e33',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '16px'
                }}>
                  👤
                </div>

                <span style={{
                  fontSize: '13px',
                  fontWeight: '700',
                  color: '#573e33',
                  maxWidth: '110px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  {username || 'ผู้ใช้'}
                </span>

                <span style={{ fontSize: '10px', color: '#94a3b8' }}>▼</span>
              </button>

              {dropdownOpen && (
                <div style={{
                  position: 'absolute',
                  right: 0,
                  top: '46px',
                  width: '200px',
                  backgroundColor: '#ffffff',
                  borderRadius: '16px',
                  boxShadow: '0 10px 28px rgba(0, 0, 0, 0.12)',
                  border: '1px solid #e2e8f0',
                  padding: '8px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  zIndex: 1100
                }}>
                  <div style={{ padding: '8px 12px', borderBottom: '1px solid #f1f5f9', marginBottom: '2px' }}>
                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>อีเมลที่เข้าสู่ระบบ</div>
                    <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#573e33', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {user.email}
                    </div>
                  </div>

                  <Link
                    to="/history"
                    onClick={() => setDropdownOpen(false)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '10px',
                      textDecoration: 'none',
                      fontSize: '13px',
                      color: '#573e33',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      transition: 'background-color 0.15s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <span>📜</span>
                    <span>ประวัติการจองของฉัน</span>
                  </Link>

                  <button
                    type="button"
                    onClick={handleLogoutClick}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '10px',
                      border: 'none',
                      backgroundColor: 'transparent',
                      fontSize: '13px',
                      color: '#e7191f',
                      fontWeight: 'bold',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      cursor: 'pointer',
                      textAlign: 'left',
                      width: '100%',
                      transition: 'background-color 0.15s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fff1f2'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <span>🚪</span>
                    <span>ออกจากระบบ</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link
              to="/login"
              style={{
                textDecoration: 'none',
                fontSize: '14px',
                fontWeight: '700',
                color: '#573e33',
                padding: '8px 16px',
                borderRadius: '20px',
                transition: 'all 0.2s ease'
              }}
            >
              เข้าสู่ระบบ
            </Link>
          )}

          {/* ปุ่ม Admin (จะแสดงผลก็ต่อเมื่อผู้ใช้เข้าสู่ระบบและมีสิทธิ์เป็น Admin เท่านั้น) */}
          {isAdmin && (
            <Link
              to="/admin"
              style={{
                textDecoration: 'none',
                fontSize: '13px',
                fontWeight: '800',
                color: '#ffffff',
                padding: '9px 22px',
                borderRadius: '9999px',
                backgroundColor: '#573e33',
                boxShadow: '0 4px 12px rgba(87, 62, 51, 0.25)',
                transition: 'all 0.2s ease'
              }}
            >
              Admin
            </Link>
          )}
        </div>

      </header>

      {/* Custom Alert Modal ดีไซน์มินิมอลสวยงาม */}
      {logoutModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(5px)',
          WebkitBackdropFilter: 'blur(5px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          padding: '20px',
          pointerEvents: 'auto',
          fontFamily: "'Prompt', sans-serif"
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '24px',
            padding: '36px 32px',
            maxWidth: '380px',
            width: '100%',
            textAlign: 'center',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.2)',
            border: '1.5px solid #e6ebf1',
            animation: 'fadeIn 0.2s ease-out'
          }}>
            <div style={{ 
              width: '60px', 
              height: '60px', 
              borderRadius: '50%', 
              backgroundColor: '#fef3c7', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              fontSize: '28px', 
              margin: '0 auto 16px' 
            }}>
              ✨
            </div>
            
            <h3 style={{ fontSize: '20px', fontWeight: '900', color: '#573e33', margin: '0 0 8px 0' }}>
              ออกจากระบบสำเร็จ
            </h3>
            
            <p style={{ fontSize: '13px', color: '#738096', margin: '0 0 24px 0', lineHeight: '1.5' }}>
              ขอบคุณที่ใช้บริการ Outsy! ไว้กลับมาเที่ยวชมแพ็กเกจใหม่ๆ กับเราอีกนะคะ 👋
            </p>
            
            <button
              type="button"
              onClick={confirmLogout}
              style={{
                width: '100%',
                backgroundColor: '#fdd501',
                color: '#573e33',
                border: 'none',
                padding: '13px',
                borderRadius: '16px',
                fontSize: '14px',
                fontWeight: '900',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(253,213,1,0.35)',
                transition: 'transform 0.1s ease'
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
            >
              ตกลง
            </button>
          </div>
        </div>
      )}

    </div>
  );
}