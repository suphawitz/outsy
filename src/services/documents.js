import { supabase } from '../client';
import { authenticatedUser } from './booking';
import { documentPath, newDocumentPath, validateDocument } from '../lib/documents';
import { userError } from '../lib/errors';

export async function uploadBookingDocument(bookingId, kind, file) {
  const ext = await validateDocument(file);
  const user = await authenticatedUser();
  const { data, error } = await supabase.from('bookings').select('booking_id').eq('booking_id', bookingId).eq('user_id', user.id).maybeSingle();
  if (error) throw error;
  if (!data) throw userError('ไม่พบการจองที่คุณเป็นเจ้าของ');
  const path = newDocumentPath(user.id, bookingId, kind, `${crypto.randomUUID()}.${ext}`);
  const { error: uploadError } = await supabase.storage.from('slips').upload(path, file, { contentType: file.type, upsert: false, cacheControl: '0' });
  if (uploadError) throw uploadError;
  return path;
}
export async function downloadDocument(value) {
  const user = await authenticatedUser();
  const path = documentPath(value, import.meta.env.VITE_SUPABASE_URL);
  // Storage RLS is the authority, including authorization of legacy object paths.
  const { data, error } = await supabase.storage.from('slips').download(path);
  if (error) throw error;
  await validateDocument(data);
  return { blob: data, userId: user.id };
}
