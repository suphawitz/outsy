import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
const Home = lazy(() => import('./pages/Home'));
const TourPackages = lazy(() => import('./pages/TourPackages'));
const TourDetail = lazy(() => import('./pages/TourDetail'));
const Booking = lazy(() => import('./pages/Booking'));
const BookingHistory = lazy(() => import('./pages/BookingHistory'));
const Login = lazy(() => import('./pages/Login'));
const UpdatePassword = lazy(() => import('./pages/UpdatePassword'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const BookingDetail = lazy(() => import('./pages/BookingDetail'));
import AdminRoute from './components/AdminRoute'; 

export default function App() {
  return (
    <BrowserRouter>
      {/* แถบ Navbar ด้านบน */}
      <Navbar />

      {/* ระบบสลับหน้าเว็บ */}
      <Suspense fallback={<div className="outsy-page" role="status" style={{ padding: '120px 24px 40px' }}>กำลังโหลด...</div>}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/packages" element={<TourPackages />} />
        <Route path="/package/:id" element={<TourDetail />} />
        
        <Route path="/booking" element={<Booking />} />
        <Route path="/booking/:id" element={<Booking />} />

        <Route path="/history" element={<BookingHistory />} />
        <Route path="/booking-detail/:bookingId" element={<BookingDetail />} />
        <Route path="/login" element={<Login />} />
        <Route path="/update-password" element={<UpdatePassword />} />
        <Route path="*" element={<div className="outsy-page" style={{ padding: '120px 24px 40px' }}><h1>ไม่พบหน้าที่ต้องการ</h1><a href="/">กลับหน้าแรก</a></div>} />
        
        {/* ล็อกเส้นทาง Admin เฉพาะบัญชีที่มี role เป็น Admin เท่านั้น */}
        <Route path="/admin" element={
          <AdminRoute>
            <AdminDashboard />
          </AdminRoute>
        } />
      
      </Routes>
      </Suspense>
    </BrowserRouter>
  );
}