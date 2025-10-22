import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Calendar, Clock, MapPin, Download, X, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useNavigate } from 'react-router-dom';

const CustomerPortal = () => {
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchBookings = async () => {
      if (!user) return;
      setIsLoading(true);
      const { data, error } = await supabase
        .from('bookings')
        .select('*, rooms(*)')
        .eq('user_id', user.id)
        .order('start_time', { ascending: false });

      if (error) {
        toast({
          title: 'Error fetching bookings',
          description: error.message,
          variant: 'destructive',
        });
      } else {
        setBookings(data);
      }
      setIsLoading(false);
    };

    fetchBookings();
  }, [user]);
  
  const handleCancel = async (booking) => {
    const confirm = window.confirm('Are you sure you want to cancel this booking? This action cannot be undone.');
    if (!confirm) return;

    try {
      const { error: deleteError } = await supabase
        .from('bookings')
        .delete()
        .eq('id', booking.id);
      
      if (deleteError) {
        // RLS policy likely prevented deletion (e.g., within 24 hours)
        toast({
          title: 'Cancellation Forbidden',
          description: 'Bookings can only be cancelled more than 24 hours in advance.',
          variant: 'destructive',
        });
        return;
      }
      
      if (booking.calendar_event_id) {
        await supabase.functions.invoke('delete-google-calendar-event', {
          body: { booking_id: booking.id },
        });
      }

      toast({
        title: 'Booking Cancelled',
        description: 'Your booking has been successfully cancelled.',
      });

      setBookings(bookings.filter(b => b.id !== booking.id));

    } catch (error) {
      toast({
        title: 'Cancellation Failed',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleDownloadInvoice = async (bookingId) => {
    const { data, error } = await supabase
      .from('invoices')
      .select('html_content')
      .eq('booking_id', bookingId)
      .single();

    if (error || !data) {
      toast({ title: 'Error', description: 'Could not find invoice.', variant: 'destructive' });
      return;
    }

    const blob = new Blob([data.html_content], { type: 'text/html' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `invoice-${bookingId}.html`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
  };

  const handleAmend = (bookingId) => {
    navigate(`/admin/booking/${bookingId}/edit`);
  };
  
  const upcomingBookings = bookings.filter(b => new Date(b.end_time) >= new Date() && b.status === 'confirmed');
  const pastBookings = bookings.filter(b => new Date(b.end_time) < new Date() || b.status !== 'confirmed');


  const renderBookingList = (list, isUpcoming) => {
    if (isLoading) {
      return <div className="glass-card p-12 text-center"><p className="text-gray-400">Loading bookings...</p></div>;
    }
    if (list.length === 0) {
      return <div className="glass-card p-12 text-center"><p className="text-gray-400">No {isUpcoming ? 'upcoming' : 'past'} bookings</p></div>;
    }
    return list.map((booking) => (
      <BookingCard
        key={booking.id}
        booking={booking}
        onCancel={() => handleCancel(booking)}
        onDownloadInvoice={handleDownloadInvoice}
        onAmend={() => handleAmend(booking.id)}
        showActions={isUpcoming}
      />
    ));
  };

  return (
    <>
      <Helmet>
        <title>My Bookings - Studio Booking</title>
        <meta name="description" content="Manage your rehearsal space bookings" />
      </Helmet>

      <div className="min-h-screen py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-4xl font-bold mb-8">My Bookings</h1>
            <Tabs defaultValue="upcoming" className="space-y-6">
              <TabsList className="glass-card p-1">
                <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
                <TabsTrigger value="past">Past</TabsTrigger>
              </TabsList>
              <TabsContent value="upcoming" className="space-y-4">{renderBookingList(upcomingBookings, true)}</TabsContent>
              <TabsContent value="past" className="space-y-4">{renderBookingList(pastBookings, false)}</TabsContent>
            </Tabs>
          </motion.div>
        </div>
      </div>
    </>
  );
};

const BookingCard = ({ booking, onCancel, onDownloadInvoice, onAmend, showActions }) => {
  const startTime = new Date(booking.start_time);
  const endTime = new Date(booking.end_time);
  const canAmend = startTime.getTime() - Date.now() > 24 * 60 * 60 * 1000;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6">
      <div className="flex flex-col md:flex-row justify-between gap-6">
        <div className="flex-1 space-y-3">
          <h3 className="text-xl font-semibold">{booking.rooms.name}</h3>
          <div className="flex items-center gap-2 text-gray-400 text-sm"><MapPin className="w-4 h-4" /><span>{booking.rooms.location}</span></div>
          <div className="flex items-center gap-2 text-gray-400 text-sm"><Calendar className="w-4 h-4" /><span>{startTime.toLocaleDateString('en-GB', { timeZone: 'Europe/London' })}</span></div>
          <div className="flex items-center gap-2 text-gray-400 text-sm"><Clock className="w-4 h-4" /><span>{startTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' })} - {endTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' })} ({booking.duration}h)</span></div>
          <div className="pt-2">
            <span className="text-2xl font-bold text-purple-400">£{parseFloat(booking.total_price).toFixed(2)}</span>
            <span className={`ml-4 inline-block px-3 py-1 rounded-full text-xs ${
              booking.status === 'confirmed' ? 'bg-green-500/20 text-green-400' :
              booking.status === 'cancelled' ? 'bg-red-500/20 text-red-400' :
              'bg-yellow-500/20 text-yellow-400'
            }`}>{booking.status}</span>
          </div>
        </div>
        <div className="flex flex-col gap-2 justify-center">
          <Button variant="outline" size="sm" onClick={() => onDownloadInvoice(booking.id)} className="border-purple-500/50 hover:bg-purple-500/10"><Download className="w-4 h-4 mr-2" />Invoice</Button>
          {showActions && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="w-full">
                    <Button variant="outline" size="sm" onClick={onAmend} disabled={!canAmend} className="w-full border-blue-500/50 hover:bg-blue-500/10 text-blue-400 disabled:opacity-50 disabled:cursor-not-allowed">
                      <Edit className="w-4 h-4 mr-2" />Amend
                    </Button>
                  </div>
                </TooltipTrigger>
                {!canAmend && <TooltipContent><p>Amendments allowed only >24h before start time.</p></TooltipContent>}
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="w-full">
                    <Button variant="outline" size="sm" onClick={onCancel} disabled={!canAmend} className="w-full border-red-500/50 hover:bg-red-500/10 text-red-400 disabled:opacity-50 disabled:cursor-not-allowed">
                      <X className="w-4 h-4 mr-2" />Cancel
                    </Button>
                  </div>
                </TooltipTrigger>
                {!canAmend && <TooltipContent><p>Cancellations allowed only >24h before start time.</p></TooltipContent>}
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default CustomerPortal;