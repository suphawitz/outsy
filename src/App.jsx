import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import TourPackages from './pages/TourPackages';
import TourDetail from './pages/TourDetail';
import Booking from './pages/Booking';
import BookingHistory from './pages/BookingHistory';
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import BookingDetail from './pages/BookingDetail';
import AdminRoute from './components/AdminRoute'; 

export default function App() {
  return (
    <BrowserRouter>
      {/* แถบ Navbar ด้านบน */}
      <Navbar />

      {/* ระบบสลับหน้าเว็บ */}
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/packages" element={<TourPackages />} />
        <Route path="/package/:id" element={<TourDetail />} />
        
        <Route path="/booking" element={<Booking />} />
        <Route path="/booking/:id" element={<Booking />} />

        <Route path="/history" element={<BookingHistory />} />
        <Route path="/booking-detail/:bookingId" element={<BookingDetail />} />
        <Route path="/login" element={<Login />} />
        
        {/* ล็อกเส้นทาง Admin เฉพาะบัญชีที่มี role เป็น Admin เท่านั้น */}
        <Route path="/admin" element={
          <AdminRoute>
            <AdminDashboard />
          </AdminRoute>
        } />
      
      </Routes>
    </BrowserRouter>
  );
}