import { supabase } from '../client';
import { bookingApi } from '../lib/bookingApi';

// There is deliberately no fallback to direct writes when RPCs are missing.
export const { authenticatedUser, createBooking, bookingAction, adminAction } = bookingApi(supabase);
