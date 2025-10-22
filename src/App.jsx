import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { Toaster } from '@/components/ui/toaster';
import Home from '@/pages/Home';
import RoomDetails from '@/pages/RoomDetails';
import Booking from '@/pages/Booking';
import Confirmation from '@/pages/Confirmation';
import CustomerPortal from '@/pages/CustomerPortal';
import AdminPortal from '@/pages/AdminPortal';
import EditBooking from '@/pages/EditBooking';
import { AuthProvider } from '@/contexts/SupabaseAuthContext';
import Login from '@/pages/Login';
import SignUp from '@/pages/SignUp';
import Navbar from '@/components/Navbar';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Helmet>
          <title>Studio Booking System</title>
          <meta name="description" content="Book rehearsal spaces at Studio Below and Studio Beyond" />
        </Helmet>
        <div className="min-h-screen">
          <Navbar />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<SignUp />} />
            <Route path="/room/:id" element={<RoomDetails />} />
            <Route path="/booking/:roomId" element={<Booking />} />
            <Route path="/confirmation/:bookingId" element={<Confirmation />} />
            <Route path="/portal" element={<CustomerPortal />} />
            <Route path="/admin" element={<AdminPortal />} />
            <Route path="/admin/booking/:bookingId/edit" element={<EditBooking />} />
          </Routes>
          <Toaster />
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;