import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { supabase } from '../client';

export default function AdminRoute({ children }) {
  const [access, setAccess] = useState('checking');
  const location = useLocation();
  useEffect(() => {
    let active = true;
    let generation = 0;
    async function check() {
      const request = ++generation;
      setAccess('checking');
      try {
        const { data, error } = await supabase.auth.getUser();
        if (!active || request !== generation) return;
        if (error || !data.user) { setAccess('anonymous'); return; }
        const { data: profile, error: profileError } = await supabase.from('users')
          .select('role').eq('auth_id', data.user.id).maybeSingle();
        if (!active || request !== generation) return;
        setAccess(!profileError && profile?.role?.toLowerCase() === 'admin' ? 'admin' : 'denied');
      } catch { if (active && request === generation) setAccess('denied'); }
    }
    void check();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      generation++;
      setAccess(event === 'SIGNED_OUT' ? 'anonymous' : 'checking');
      if (event !== 'SIGNED_OUT') setTimeout(() => { if (active) void check(); }, 0);
    });
    return () => { active = false; generation++; subscription.unsubscribe(); };
  }, []);
  if (access === 'checking') return <div role="status" style={{ padding: '140px 24px' }}>กำลังตรวจสอบสิทธิ์ผู้ดูแลระบบ...</div>;
  if (access === 'anonymous') return <Navigate to="/login" replace state={{ returnUrl: location.pathname }} />;
  if (access === 'denied') return <div role="alert" style={{ padding: '140px 24px' }}>คุณไม่มีสิทธิ์เข้าถึงหน้าผู้ดูแลระบบ <a href="/">กลับหน้าแรก</a></div>;
  return children;
}
