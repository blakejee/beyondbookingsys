import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Calendar, Clock, Loader2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { DateTime } from 'luxon';

const EditBooking = () => {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const [booking, setBooking] = useState(null);
  const [newDate, setNewDate] = useState('');
  const [newStartTime, setNewStartTime] = useState('');
  const [newDuration, setNewDuration] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [availability, setAvailability] = useState({ busySlots: [], timeSlots: [] });
  const [isCheckingAvail, setIsCheckingAvail] = useState(false);

  const fetchBookingData = useCallback(async () => {
    setIsLoading(true);
    const { data: bookingData, error: bookingError } = await supabase
      .from('bookings')
      .select('*, rooms(*)')
      .eq('id', bookingId)
      .single();

    if (bookingError) {
      toast({ title: 'Error', description: 'Could not load booking.', variant: 'destructive' });
      navigate('/portal');
      return;
    }
    setBooking(bookingData);
    const startDate = DateTime.fromISO(bookingData.start_time, { zone: 'Europe/London' });
    setNewDate(startDate.toISODate());
    setNewStartTime(startDate.toFormat('HH:mm'));
    setNewDuration(bookingData.duration);
    setIsLoading(false);
  }, [bookingId, navigate]);

  useEffect(() => {
    fetchBookingData();
  }, [fetchBookingData]);

  const fetchAvailability = useCallback(async () => {
    if (!newDate || !booking) return;
    setIsCheckingAvail(true);
    setNewStartTime('');

    const timeMin = DateTime.fromISO(newDate, { zone: 'Europe/London' }).startOf('day').toISO();
    const timeMax = DateTime.fromISO(newDate, { zone: 'Europe/London' }).endOf('day').toISO();

    const [dbRes, gcalRes] = await Promise.all([
      supabase.from('bookings').select('start_time, end_time').eq('room_id', booking.room_id).neq('id', booking.id).gte('end_time', timeMin).lt('start_time', timeMax).in('status', ['pending', 'confirmed', 'processing']),
      supabase.functions.invoke('get-calendar-events', { body: { calendarId: booking.rooms.calendar_id, timeMin, timeMax } })
    ]);

    const dbSlots = dbRes.data?.map(b => ({ start: b.start_time, end: b.end_time })) || [];
    const gcalSlots = gcalRes.data?.busySlots.filter(slot => slot.id !== booking.calendar_event_id) || [];
    setAvailability(prev => ({ ...prev, busySlots: [...dbSlots, ...gcalSlots] }));
    setIsCheckingAvail(false);
  }, [newDate, booking, bookingId]);

  useEffect(() => {
    fetchAvailability();
  }, [fetchAvailability]);

  useEffect(() => {
    const openingHour = 7;
    const closingHour = 22;
    const slots = [];

    for (let hour = openingHour; hour < closingHour; hour++) {
      const slot = `${hour.toString().padStart(2, '0')}:00`;
      const slotStart = DateTime.fromISO(`${newDate}T${slot}`, { zone: 'Europe/London' });
      const slotEnd = slotStart.plus({ hours: newDuration });
      
      let isAvailable = true;
      for (const busy of availability.busySlots) {
        const busyStart = DateTime.fromISO(busy.start);
        const busyEnd = DateTime.fromISO(busy.end);
        if (slotStart < busyEnd && slotEnd > busyStart) {
          isAvailable = false;
          break;
        }
      }
      slots.push({ time: slot, available: isAvailable });
    }
    setAvailability(prev => ({ ...prev, timeSlots: slots }));
  }, [availability.busySlots, newDate, newDuration]);

  const handleReschedule = async (e) => {
    e.preventDefault();
    if (!newStartTime) {
      toast({ title: 'Selection Required', description: 'Please select a new time slot.', variant: 'destructive' });
      return;
    }
    setIsRescheduling(true);

    const { data, error } = await supabase.functions.invoke('reschedule-booking', {
      body: {
        booking_id: parseInt(bookingId),
        date: newDate,
        startTime: newStartTime,
        duration: parseInt(newDuration),
      },
    });

    if (error) {
        const errorData = JSON.parse(error.context.text);
        if (errorData.reason === 'db_conflict') {
          toast({
            title: 'Time unavailable',
            description: 'That slot overlaps an existing booking in this room.',
            variant: 'destructive'
          });
        } else if (errorData.reason === 'gcal_conflict') {
          toast({
            title: 'Time unavailable (Calendar)',
            description: 'That slot conflicts with a calendar event for this room.',
            variant: 'destructive'
          });
        } else {
          toast({
            title: 'Reschedule failed',
            description: errorData.error || 'Please try a different time.',
            variant: 'destructive'
          });
        }
        fetchAvailability();
    } else if (data.ok) {
        toast({ title: 'Success!', description: 'Your booking has been rescheduled.' });
        navigate('/portal');
    }
    setIsRescheduling(false);
  };

  if (isLoading) return <div className="flex justify-center items-center h-screen"><Loader2 className="h-16 w-16 animate-spin" /></div>;
  if (!booking) return <div className="text-center py-12">Booking not found.</div>;

  return (
    <>
      <Helmet>
        <title>Reschedule Booking - {booking.rooms.name}</title>
      </Helmet>
      <div className="min-h-screen py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <Button variant="ghost" onClick={() => navigate('/portal')} className="mb-8 text-purple-400 hover:text-purple-300"><ArrowLeft className="w-4 h-4 mr-2" /> Back to Portal</Button>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-4xl font-bold mb-2">Reschedule Booking</h1>
            <p className="text-gray-400 mb-8">Booking ID: {booking.id} for {booking.rooms.name}</p>

            <form onSubmit={handleReschedule} className="glass-card p-8 space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="date" className="flex items-center gap-2 mb-2"><Calendar className="w-4 h-4" /> New Date</Label>
                  <Input id="date" type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} required min={new Date().toISOString().split('T')[0]} />
                </div>
                <div>
                  <Label htmlFor="duration">Duration (hours)</Label>
                  <Input id="duration" type="number" min="1" value={newDuration} onChange={(e) => setNewDuration(parseInt(e.target.value))} required />
                </div>
              </div>
              <div>
                <Label className="flex items-center gap-2 mb-2"><Clock className="w-4 h-4" /> Select New Time</Label>
                {isCheckingAvail ? <Loader2 className="animate-spin" /> : 
                  <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
                    {availability.timeSlots.map(slot => (
                      <button key={slot.time} type="button" onClick={() => setNewStartTime(slot.time)} disabled={!slot.available} className={`p-3 rounded-lg border transition-all ${newStartTime === slot.time ? 'bg-purple-600 border-purple-500 glow-purple' : slot.available ? 'bg-white/5 border-white/10 hover:border-purple-500/50' : 'bg-red-500/10 border-red-500/20 text-gray-500 cursor-not-allowed'}`}>
                        {slot.time}
                      </button>
                    ))}
                  </div>
                }
              </div>
              <Button type="submit" disabled={isRescheduling || isCheckingAvail} className="w-full">
                {isRescheduling ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Rescheduling...</> : 'Confirm Reschedule'}
              </Button>
            </form>
          </motion.div>
        </div>
      </div>
    </>
  );
};

export default EditBooking;