import { useEffect, useState } from 'react';
import { supabase } from '../client';
import { loadPrivateImage } from '../lib/privateDocuments';

export default function PrivateDocumentImage({ value, alt, style }) {
  const [url,setUrl] = useState('');
  const [error,setError] = useState('');
  useEffect(() => {
    let active=true, objectUrl, viewerId, sessionId;
    setUrl(''); setError('');
    const {data:{subscription}}=supabase.auth.onAuthStateChange((event,session)=>{
      sessionId=session?.user?.id;
      if (event==='SIGNED_OUT' || (viewerId && sessionId && viewerId!==sessionId)) {
        active=false;
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        setUrl(''); setError('กรุณาเข้าสู่ระบบเพื่อดูเอกสาร');
      }
    });
    loadPrivateImage(supabase,value,import.meta.env.VITE_SUPABASE_URL).then(({blob,userId})=>{
      if (!active || (sessionId && sessionId!==userId)) return;
      viewerId=userId;
      objectUrl=URL.createObjectURL(blob); setUrl(objectUrl);
    }).catch(()=>{if(active)setError('เปิดเอกสารไม่ได้ กรุณาตรวจสอบสิทธิ์ Storage หรือไฟล์เดิมกับผู้ดูแล');});
    return ()=>{active=false; subscription.unsubscribe(); if(objectUrl)URL.revokeObjectURL(objectUrl);};
  },[value]);
  if(error)return <p role="alert">{error}</p>;
  if(!url)return <p role="status">กำลังโหลดเอกสาร...</p>;
  return <img src={url} alt={alt} style={style}/>;
}
