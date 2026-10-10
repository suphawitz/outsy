import { useEffect, useState } from 'react';
import { supabase } from '../client';
import { downloadDocument } from '../services/documents';
import { thaiError } from '../lib/errors';

export default function PrivateDocumentImage({ value, alt = 'เอกสารส่วนตัว', style }) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    let objectUrl;
    let viewerId;
    let sessionUserId;
    setUrl(''); setError('');
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      sessionUserId = session?.user?.id;
      if (event === 'SIGNED_OUT' || (viewerId && sessionUserId && viewerId !== sessionUserId)) {
        active = false;
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        setUrl(''); setError('กรุณาเข้าสู่ระบบเพื่อดูเอกสาร');
      }
    });
    downloadDocument(value).then(({ blob, userId }) => {
      if (!active || (sessionUserId && sessionUserId !== userId)) return;
      viewerId = userId;
      objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
    }).catch(err => { if (active) setError(thaiError(err, 'เปิดเอกสารไม่ได้ กรุณาตรวจสอบสิทธิ์หรือให้ผู้ดูแลย้ายเอกสารเดิม')); });
    return () => { active = false; subscription.unsubscribe(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [value]);
  if (error) return <p role="alert">{error}</p>;
  if (!url) return <p role="status">กำลังโหลดเอกสารส่วนตัว...</p>;
  return <img src={url} alt={alt} style={style} />;
}
