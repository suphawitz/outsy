import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../client';

export default function UpdatePassword() {
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('กำลังตรวจสอบลิงก์...');
  const [done, setDone] = useState(false);

  useEffect(() => {
    let active = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (active && session && (event === 'PASSWORD_RECOVERY' || event === 'INITIAL_SESSION')) {
        setReady(true);
        setMessage('');
      }
    });
    // getSession waits for URL session initialization, including recovery links.
    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      setReady(Boolean(data.session) && !error);
      setMessage(error || !data.session ? 'ลิงก์ไม่ถูกต้องหรือหมดอายุ กรุณาขอลิงก์ใหม่จากหน้าเข้าสู่ระบบ' : '');
    }).catch(() => {
      if (active) setMessage('ตรวจสอบลิงก์ไม่สำเร็จ กรุณาลองใหม่');
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  async function submit(event) {
    event.preventDefault();
    if (!ready || busy) return;
    if (password.length < 8) { setMessage('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร'); return; }
    if (password !== confirmation) { setMessage('รหัสผ่านทั้งสองช่องไม่ตรงกัน'); return; }
    setBusy(true);
    setMessage('');
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setDone(true);
      setPassword('');
      setConfirmation('');
      setMessage('เปลี่ยนรหัสผ่านเรียบร้อยแล้ว');
    } catch (error) {
      setMessage(error.message || 'เปลี่ยนรหัสผ่านไม่สำเร็จ');
    } finally { setBusy(false); }
  }

  const fieldStyle = { display: 'block', width: '100%', padding: 12, margin: '8px 0 20px', boxSizing: 'border-box' };
  return (
    <main style={{ maxWidth: 440, margin: '60px auto', padding: 24, background: '#fffdf9', borderRadius: 20 }}>
      <h1>ตั้งรหัสผ่านใหม่</h1>
      {message && <p role="status">{message}</p>}
      {ready && !done && <form onSubmit={submit}>
        <label htmlFor="new-password">รหัสผ่านใหม่ (อย่างน้อย 8 ตัวอักษร)</label>
        <input id="new-password" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)} style={fieldStyle} />
        <label htmlFor="confirm-password">ยืนยันรหัสผ่านใหม่</label>
        <input id="confirm-password" type="password" autoComplete="new-password" required minLength={8} value={confirmation} onChange={e => setConfirmation(e.target.value)} style={fieldStyle} />
        <button disabled={busy} style={{ padding: 12, marginBottom: 20 }}>{busy ? 'กำลังบันทึก...' : 'บันทึกรหัสผ่านใหม่'}</button>
      </form>}
      <Link to="/login">กลับหน้าเข้าสู่ระบบ</Link>
    </main>
  );
}
