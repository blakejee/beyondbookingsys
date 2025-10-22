import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Calendar, Clock, User, CreditCard, ArrowLeft, ArrowRight, Loader2, Info, Users, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import { DateTime } from 'luxon';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';

const stripePromise = loadStripe("pk_test_51S7XL0Rm3Vs8LEQNZJObubBxW6nJkFsbe4Io4hUeP3xTuEQWxqJEAuJS4Vy9ndpq8ISWQzAQuf0pz9PI3o5n76b300utAibbTS");

const TermsAndConditions = () => (
  <DialogContent className="glass-card max-h-[80vh] overflow-y-auto">
    <DialogHeader>
      <DialogTitle>The Studio Beyond – Terms & Conditions of Hire</DialogTitle>
      <DialogDescription>
        By completing a booking, you agree to the following Terms and Conditions for the hire of space at The Studio Beyond, 63 Wood Street, Liverpool.
      </DialogDescription>
    </DialogHeader>
    <div className="text-sm space-y-4 text-gray-300">
        <p><strong>1. Definitions</strong><br/>• The Venue: The Studio Beyond, 63 Wood Street, Liverpool<br/>• The Hirer: The person or organisation named on the booking form or online booking system<br/>• The Premises: The room(s) booked for use<br/>• The Building: All areas within 63 Wood Street<br/>• The Amount Due: The fee payable for hire, as shown on the booking form or invoice<br/>• The Period of Hire: The specific dates and times of hire</p>
        <p><strong>2. Maximum Capacity</strong><br/>• First Floor Studio – 50 people<br/>• Second Floor Studio – 50 people<br/>• Podcast Studio – 8 people<br/>Maximum total occupancy of the building: 60 people (fire regulation limit). The Hirer must not exceed these numbers.</p>
        <p><strong>3. Use of the Premises</strong><br/>The Premises may only be used for the purpose stated on your booking form. You may not use or allow the space to be used for: Political rallies or demonstrations, Illegal or unauthorised activities, Events likely to cause unrest or division, Activities that may endanger the building or invalidate insurance. The Venue reserves the right to: Refuse or cancel bookings that may breach the law or pose safety/reputation risks; Exclude any person acting inappropriately or causing nuisance. All equipment and belongings must be removed at the end of each hire unless otherwise agreed.</p>
        <p><strong>4. Licences & Permissions</strong><br/>• The Hirer is responsible for obtaining any necessary licences (e.g. PRS, PPL).<br/>• Use of the Venue’s Premises Licence is allowed only with written permission and must follow all conditions.<br/>• Temporary Event Notices must not be applied for without written approval.<br/>• The Hirer must hold all required consents and permits for their event.</p>
        <p><strong>5. Health & Safety</strong><br/>The Hirer is responsible for health and safety during hire and must comply with all Venue safety requests. A risk assessment must be provided at least 14 days before the event (28 days for large events). The Hirer must be familiar with: Alarm and entry procedures, Fire exits, evacuation routes, and assembly points, First aid arrangements and accident reporting. Emergency exits must remain clear at all times. Fire doors must not be propped open. Fire wardens should be appointed for larger events.</p>
        <p><strong>6. Electrical Equipment</strong><br/>All electrical equipment must be PAT tested (personal laptops exempt). The Venue reserves the right to prohibit unsafe equipment.</p>
        <p><strong>7. Alterations</strong><br/>No decorations, signage, or alterations may be made without prior written consent.</p>
        <p><strong>8. Food & Drink</strong><br/>Anyone preparing or serving food must hold a valid Basic Food Hygiene Certificate. All catering must comply with relevant food safety laws. External caterers must meet all hygiene and safety requirements.</p>
        <p><strong>9. General Regulations</strong><br/>No illegal, dangerous, or offensive items may be sold or displayed. Smoking and vaping are strictly prohibited indoors. A designated outdoor smoking/vaping area is available in the rear car park.</p>
        <p><strong>10. Nuisance</strong><br/>Please ensure your event does not disturb other users or neighbours. Anyone causing a nuisance must leave immediately if requested by the Venue.</p>
        <p><strong>11. Children & Safeguarding</strong><br/>If your activity involves children or vulnerable adults, you must have safeguarding policies in place. The Venue may request evidence of DBS checks or safeguarding documentation.</p>
        <p><strong>12. Booking, Charges & Cancellations</strong><br/>Bookings are confirmed once accepted by the Venue and the deposit is paid. The Venue may cancel any booking at any time without liability (any fees already paid will be refunded). Cancellations made by the Hirer within 7 days of the booking date are non-refundable and the full fee remains payable. Deposits are non-refundable. The Venue is not liable for cancellations caused by force majeure (e.g. fire, flood, strike, government restrictions).</p>
        <p><strong>13. End of Hire</strong><br/>Please vacate promptly at the end of your hire. Leave all areas clean and tidy; remove rubbish to bins at the rear. If using the kitchen, ensure all crockery, utensils, and fridge are left clean and empty. A £25 cleaning charge applies if not left in satisfactory condition. Additional charges may apply for non-compliance or damage.</p>
        <p><strong>14. Payment</strong><br/>A deposit is payable on booking; the balance is due within 14 days of invoice. Late payments incur 4% interest above the Bank of England base rate. Prices may change with 14 days’ notice. Pricing concerns must be raised within 30 days of booking confirmation.</p>
        <p><strong>15. Insurance & Liability</strong><br/>The Hirer is responsible for any damage, loss, or injury arising from their use of the Premises and must indemnify the Venue (except where due to Venue negligence). The Hirer must hold Public Liability Insurance of at least £2 million and provide proof 14 days before the event. The Venue’s insurance does not cover the Hirer’s equipment or personal property.</p>
        <p><strong>16. Data Protection</strong><br/>Personal data will be used and stored in accordance with the Data Protection Act 2018 and UK GDPR for booking administration, safety, and service planning.</p>
        <p><strong>17. Care of the Premises</strong><br/>Please take care to avoid damage to the Premises, furniture, or equipment. The Hirer will be charged for repairs or replacements where damage occurs.</p>
        <p><strong>18. Loss or Damage</strong><br/>The Venue accepts no liability for loss, theft, or damage to personal property, or for injury, except where caused by its own negligence.</p>
        <p><strong>19. Advertising & Promotion</strong><br/>No posters, flyers, or digital promotions may use the Venue name or logo without written approval. All event artwork must be pre-approved by the Venue.</p>
        <p><strong>20. General Terms</strong><br/>The Venue may amend these Terms at any time. The Hirer must comply with all relevant laws and Venue policies. If any clause is found invalid, the remaining clauses remain enforceable. No third party has rights under this Agreement (Contracts (Rights of Third Parties) Act 1999). This Agreement is governed by English law, under the jurisdiction of the courts of England and Wales.</p>
        <p><strong>Acceptance</strong><br/>By completing an online booking or submitting a Room Hire Booking Form, you confirm that you have read, understood, and agree to these Terms and Conditions of Hire.</p>
    </div>
  </DialogContent>
);

const Booking = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  const [step, setStep] = useState(1);
  const [room, setRoom] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedTime, setSelectedTime] = useState('');
  const [duration, setDuration] = useState(1);
  const [customerDetails, setCustomerDetails] = useState({
    companyName: '',
    email: '',
    phone: '',
    description: '',
    attendees: 1,
    agreedToTerms: false
  });
  const [clientSecret, setClientSecret] = useState('');
  const [bookingId, setBookingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [availability, setAvailability] = useState({ busySlots: [], timeSlots: [] });

  useEffect(() => {
    if (!user) {
      toast({ title: 'Authentication Required', description: 'Please log in to make a booking.', variant: 'destructive' });
      navigate('/login');
    } else {
      setCustomerDetails(prev => ({ 
        ...prev, 
        companyName: user.user_metadata?.company_name || user.user_metadata?.full_name || '', 
        email: user.email || '' 
      }));
    }
  }, [user, navigate, toast]);

  useEffect(() => {
    setLoading(true);
    supabase.from('rooms').select('*').eq('id', roomId).single()
      .then(({ data, error }) => {
        if (error) {
          toast({ title: 'Error', description: 'Room not found.', variant: 'destructive' });
          navigate('/');
        } else {
          setRoom(data);
        }
      });
  }, [roomId, navigate, toast]);

  const fetchAvailability = useCallback(async () => {
    if (!selectedDate || !room) return;
    setLoading(true);
    setSelectedTime('');

    const timeMin = DateTime.fromISO(selectedDate, { zone: 'Europe/London' }).startOf('day').toISO();
    const timeMax = DateTime.fromISO(selectedDate, { zone: 'Europe/London' }).endOf('day').toISO();

    const [dbRes, gcalRes] = await Promise.all([
      supabase.from('bookings').select('start_time, end_time').eq('room_id', room.id).eq('date', selectedDate).in('status', ['pending', 'confirmed']),
      supabase.functions.invoke('get-calendar-events', { body: { calendarId: room.calendar_id, timeMin, timeMax } })
    ]);

    const dbSlots = dbRes.data?.map(b => ({ start: b.start_time, end: b.end_time })) || [];
    const gcalSlots = gcalRes.data?.busySlots || [];
    setAvailability(prev => ({ ...prev, busySlots: [...dbSlots, ...gcalSlots] }));
    setLoading(false);
  }, [selectedDate, room]);

  useEffect(() => {
    fetchAvailability();
  }, [fetchAvailability]);
  
  useEffect(() => {
    const openingHour = 7;
    const closingHour = 22;
    const slots = [];

    for (let hour = openingHour; hour < closingHour; hour++) {
      const slot = `${hour.toString().padStart(2, '0')}:00`;
      const slotStart = DateTime.fromISO(`${selectedDate}T${slot}`, { zone: 'Europe/London' });
      const slotEnd = slotStart.plus({ hours: duration });
      
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
  }, [availability.busySlots, selectedDate, duration]);

  const handleDateTimeNext = () => {
    if (!selectedTime) {
      toast({ title: 'Missing selection', description: 'Please select a time slot.', variant: 'destructive' });
      return;
    }
    setStep(2);
  };

  const handleDetailsNext = async () => {
    const { companyName, phone, description, attendees, agreedToTerms } = customerDetails;
    if (!companyName || !phone || !description || !attendees) {
      toast({ title: 'Missing details', description: 'Please fill in all required fields.', variant: 'destructive' });
      return;
    }
    if (!agreedToTerms) {
      toast({ title: 'Agreement Required', description: 'You must agree to the terms and conditions.', variant: 'destructive' });
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.functions.invoke('process-booking', {
      body: { 
        user_id: user.id, 
        room_id: room.id, 
        date: selectedDate, 
        startTime: selectedTime, 
        duration,
        company_name: companyName,
        hirer_phone: phone,
        event_description: description,
        attendee_count: attendees,
        agreed_to_terms: agreedToTerms
      }
    });
    if (error || data.error) {
      toast({ title: 'Booking Failed', description: error?.message || data.error, variant: 'destructive' });
      setLoading(false); return;
    }
    setBookingId(data.booking_id);

    const { data: paymentData, error: paymentError } = await supabase.functions.invoke('create-payment-intent', {
      body: { booking_id: data.booking_id }
    });
    if (paymentError || paymentData.error) {
      toast({ title: 'Payment Error', description: paymentError?.message || paymentData.error.message, variant: 'destructive' });
      setLoading(false); return;
    }
    setClientSecret(paymentData.clientSecret);
    setLoading(false);
    setStep(3);
  };

  if (!room) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin" /></div>;

  return (
    <>
      <Helmet><title>Book {room.name}</title></Helmet>
      <Dialog>
        <div className="min-h-screen py-12 px-4">
          <div className="max-w-4xl mx-auto">
            <Button variant="ghost" onClick={() => navigate(`/room/${roomId}`)} className="mb-8 text-purple-400 hover:text-purple-300"><ArrowLeft className="w-4 h-4 mr-2" /> Back</Button>
            <div className="flex items-center justify-center mb-12 gap-4">
              {[1, 2, 3].map(s => <React.Fragment key={s}><div className={`flex items-center justify-center w-10 h-10 rounded-full ${step >= s ? 'bg-purple-600 glow-purple' : 'bg-white/10'} transition-all`}>{s}</div>{s < 3 && <div className={`w-16 h-1 ${step > s ? 'bg-purple-600' : 'bg-white/10'}`} />}</React.Fragment>)}
            </div>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-8">
              <h1 className="text-3xl font-bold mb-6">{room.name}</h1>
              {step === 1 && (
                <div className="space-y-6">
                  <div><Label className="flex items-center gap-2 mb-2"><Calendar className="w-4 h-4" /> Select Date</Label><Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} min={new Date().toISOString().split('T')[0]} className="bg-white/5 border-white/10" /></div>
                  <div><Label className="flex items-center gap-2 mb-2"><Clock className="w-4 h-4" /> Select Time</Label>{loading ? <Loader2 className="animate-spin" /> : <div className="grid grid-cols-3 md:grid-cols-5 gap-2">{availability.timeSlots.map(slot => <button key={slot.time} type="button" onClick={() => setSelectedTime(slot.time)} disabled={!slot.available} className={`p-3 rounded-lg border transition-all ${selectedTime === slot.time ? 'bg-purple-600 border-purple-500 glow-purple' : slot.available ? 'bg-white/5 border-white/10 hover:border-purple-500/50' : 'bg-red-500/10 border-red-500/20 text-gray-500 cursor-not-allowed'}`}>{slot.time}</button>)}</div>}</div>
                  <div><Label className="mb-2">Duration (hours)</Label><Input type="number" min="1" max="8" value={duration} onChange={(e) => setDuration(parseInt(e.target.value))} className="bg-white/5 border-white/10" /></div>
                  <div className="border-t border-white/10 pt-6 flex justify-between items-center"><div><p className="text-2xl font-bold text-purple-400">£{(parseFloat(room.hourly_price) * duration).toFixed(2)}</p><p className="text-sm text-gray-400">Total price</p></div><Button onClick={handleDateTimeNext} className="bg-purple-600 hover:bg-purple-700">Next <ArrowRight className="w-4 h-4 ml-2" /></Button></div>
                </div>
              )}
              {step === 2 && (
                <div className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div><Label className="flex items-center gap-2 mb-2"><User className="w-4 h-4" /> Full Name or Company Name *</Label><Input value={customerDetails.companyName} onChange={e => setCustomerDetails(p => ({ ...p, companyName: e.target.value }))} className="bg-white/5 border-white/10" /></div>
                    <div><Label className="flex items-center gap-2 mb-2"><Phone className="w-4 h-4" /> Phone Number *</Label><Input type="tel" value={customerDetails.phone} onChange={e => setCustomerDetails(p => ({ ...p, phone: e.target.value }))} className="bg-white/5 border-white/10" /></div>
                  </div>
                  <div><Label className="mb-2">Email *</Label><Input type="email" value={customerDetails.email} readOnly className="bg-white/5 border-white/10 cursor-not-allowed" /></div>
                  <div><Label className="flex items-center gap-2 mb-2"><Info className="w-4 h-4" /> Description of what's taking place *</Label><Input value={customerDetails.description} onChange={e => setCustomerDetails(p => ({ ...p, description: e.target.value }))} className="bg-white/5 border-white/10" /></div>
                  <div><Label className="flex items-center gap-2 mb-2"><Users className="w-4 h-4" /> How many people attending? *</Label><Input type="number" min="1" value={customerDetails.attendees} onChange={e => setCustomerDetails(p => ({ ...p, attendees: parseInt(e.target.value) || 1 }))} className="bg-white/5 border-white/10" /></div>

                  <div className="flex items-center space-x-2 pt-4">
                    <Checkbox id="terms" checked={customerDetails.agreedToTerms} onCheckedChange={checked => setCustomerDetails(p => ({ ...p, agreedToTerms: checked }))} />
                    <Label htmlFor="terms" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      I agree to the <DialogTrigger><span className="text-purple-400 hover:underline">hire agreement</span></DialogTrigger>.
                    </Label>
                  </div>
                  
                  <div className="border-t border-white/10 pt-6 flex justify-between"><Button variant="outline" onClick={() => setStep(1)}><ArrowLeft className="w-4 h-4 mr-2" /> Back</Button><Button onClick={handleDetailsNext} disabled={loading} className="bg-purple-600 hover:bg-purple-700">{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Continue to Payment <ArrowRight className="w-4 h-4 ml-2" /></Button></div>
                </div>
              )}
              {step === 3 && clientSecret && (
                <div className="space-y-6">
                  <div className="flex items-center gap-2 mb-4"><CreditCard className="w-5 h-5 text-purple-400" /> <h2 className="text-xl font-semibold">Payment Details</h2></div>
                  <Elements stripe={stripePromise} options={{ clientSecret }}><PaymentForm bookingId={bookingId} onBack={() => setStep(2)} totalPrice={parseFloat(room.hourly_price) * duration} /></Elements>
                </div>
              )}
            </motion.div>
          </div>
        </div>
        <TermsAndConditions />
      </Dialog>
    </>
  );
};

const PaymentForm = ({ bookingId, onBack, totalPrice }) => {
  const stripe = useStripe();
  const elements = useElements();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [processing, setProcessing] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setProcessing(true);
    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: `${window.location.origin}/confirmation/${bookingId}` },
    });
    if (error) {
      toast({ title: 'Payment Failed', description: error.message, variant: 'destructive' });
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="glass-card p-4 mb-4"><p className="text-sm text-gray-400 mb-1">Total Amount</p><p className="text-3xl font-bold text-purple-400">£{totalPrice.toFixed(2)}</p></div>
      <PaymentElement />
      <div className="flex justify-between pt-6 border-t border-white/10">
        <Button type="button" variant="outline" onClick={onBack} disabled={processing}><ArrowLeft className="w-4 h-4 mr-2" /> Back</Button>
        <Button type="submit" disabled={!stripe || processing} className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 glow-purple">{processing ? 'Processing...' : `Pay £${totalPrice.toFixed(2)}`}</Button>
      </div>
    </form>
  );
};

export default Booking;