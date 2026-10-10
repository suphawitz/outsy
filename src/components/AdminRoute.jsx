import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../client';

export default function AdminRoute({ children }) {
  const [isAdmin, setIsAdmin] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    async function checkAdminRole() {
      try {
        // 1. เช็กว่าผู้ใช้เข้าสู่ระบบหรือยัง
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
          navigate('/login');
          return;
        }

        // 2. ตรวจสอบสิทธิ์จากโปรไฟล์ที่ผูกกับบัญชี Auth
        const { data: userData, error } = await supabase
          .from('users')
          .select('role')
          .eq('auth_id', user.id)
          .maybeSingle();

        if (error || !userData || (userData.role !== 'Admin' && userData.role !== 'admin')) {
          alert('คุณไม่มีสิทธิ์เข้าถึงหน้าผู้ดูแลระบบ');
          navigate('/'); // ดีดกลับหน้าแรก
          return;
        }

        // ถ้าผ่าน เป็น Admin ตัวจริง
        setIsAdmin(true);
      } catch (err) {
        console.error('Check admin error:', err);
        navigate('/');
      }
    }

    checkAdminRole();
  }, [navigate]);

  if (isAdmin === null) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Prompt', sans-serif" }}>
        <h3>กำลังตรวจสอบสิทธิ์ผู้ดูแลระบบ... ⏳</h3>
      </div>
    );
  }

  return children;
}