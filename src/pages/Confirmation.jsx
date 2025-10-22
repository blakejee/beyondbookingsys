import React, { useEffect, useState, useRef } from 'react';
import { Helmet } from 'react-helmet';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle, Calendar, Clock, MapPin, Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';

const Confirmation = () => {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [booking, setBooking] = useState(null);
  const [loadingMessage, setLoadingMessage] = useState('Confirming your payment...');
  const intervalRef = useRef(null);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!bookingId) {
      navigate('/');
      return;
    }

    const fetchBooking = async () => {
      const { data, error } = await supabase
        .from('bookings')
        .select('*, rooms(*)')
        .eq('id', bookingId)
        .single();

      if (!isMounted.current) return;

      if (error || !data) {
        toast({ title: 'Error', description: 'Could not find your booking.', variant: 'destructive' });
        clearInterval(intervalRef.current);
        navigate('/');
        return;
      }

      if (data.status === 'processing') {
        setLoadingMessage('Finalizing your booking details...');
      }

      if (data.status === 'confirmed') {
        setBooking(data);
        clearInterval(intervalRef.current);
      }
    };

    fetchBooking(); // Initial fetch
    intervalRef.current = setInterval(fetchBooking, 2000); // Polling

    const timeout = setTimeout(() => {
      if (!isMounted.current) return;
      clearInterval(intervalRef.current);
      // Check one last time before navigating away
      supabase.from('bookings').select('status').eq('id', bookingId).single().then(({data}) => {
          if(isMounted.current && (!data || data.status !== 'confirmed')){
               toast({ title: 'Confirmation Delayed', description: "We're still confirming your booking. Please check your portal shortly.", variant: 'default' });
               navigate('/portal');
          }
      })
    }, 25000); // Increased timeout to 25 seconds

    return () => {
      clearInterval(intervalRef.current);
      clearTimeout(timeout);
    };
  }, [bookingId, toast, navigate]);

  const handleDownloadInvoice = async () => {
    const { data, error } = await supabase
      .from('invoices')
      .select('html_content')
      .eq('booking_id', bookingId)
      .single();

    if (error || !data || !data.html_content) {
      toast({ title: 'Error', description: 'Could not find a valid invoice to download.', variant: 'destructive' });
    } else {
      const blob = new Blob([data.html_content], { type: 'text/html' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `invoice-${bookingId}.html`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    }
  };

  if (!booking) {
    return <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white">
        <Loader2 className="w-12 h-12 animate-spin text-purple-400 mb-4" />
        <p className="text-lg">{loadingMessage}</p>
        <p className="text-sm text-gray-400">Please wait, this may take a moment.</p>
    </div>;
  }

  const startTime = new Date(booking.start_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' });
  const endTime = new Date(booking.end_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' });

  return (
    <>
      <Helmet>
        <title>Booking Confirmed - Studio Booking</title>
        <meta name="description" content="Your booking has been confirmed" />
      </Helmet>

      <div className="min-h-screen py-12 px-4">
        <div className="max-w-2xl mx-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-card p-8 text-center"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring' }}
              className="inline-block mb-6"
            >
              <CheckCircle className="w-20 h-20 text-green-400 glow-purple" />
            </motion.div>

            <h1 className="text-4xl font-bold mb-4">Booking Confirmed!</h1>
            <p className="text-gray-400 mb-8">
              Your booking is confirmed. A confirmation email is on its way to your inbox.
            </p>

            <div className="glass-card p-6 text-left space-y-4 mb-8">
              <h2 className="text-xl font-semibold mb-4 text-purple-400">Booking Details</h2>
              
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-gray-400 mt-1" />
                <div>
                  <p className="font-semibold">{booking.rooms.name}</p>
                  <p className="text-sm text-gray-400">{booking.rooms.location}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="font-semibold">
                    {new Date(booking.start_time).toLocaleDateString('en-GB', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      timeZone: 'Europe/London'
                    })}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="font-semibold">
                    {startTime} - {endTime}
                  </p>
                  <p className="text-sm text-gray-400">{booking.duration} hour(s)</p>
                </div>
              </div>

              <div className="border-t border-white/10 pt-4 mt-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Total Paid</span>
                  <span className="text-2xl font-bold text-purple-400">
                    £{parseFloat(booking.total_price).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                variant="outline"
                onClick={handleDownloadInvoice}
                className="border-purple-500/50 hover:bg-purple-500/10"
              >
                <Download className="w-4 h-4 mr-2" />
                Download Invoice
              </Button>
              <Button
                onClick={() => navigate('/portal')}
                className="bg-purple-600 hover:bg-purple-700"
              >
                View My Bookings
              </Button>
            </div>

            <Button
              variant="ghost"
              onClick={() => navigate('/')}
              className="mt-8 text-gray-400 hover:text-white"
            >
              Back to Home
            </Button>
          </motion.div>
        </div>
      </div>
    </>
  );
};

export default Confirmation;