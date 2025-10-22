
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Search, Download, Edit, Trash2, Plus, AlertCircle, ShieldOff, Loader2, X, Upload, ImageOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';

const AdminPortal = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [bookings, setBookings] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const fetchAdminData = async () => {
    const bookingPromise = supabase.from('bookings').select('*, profiles(full_name, email), rooms(name)').order('start_time', { ascending: false });
    const roomPromise = supabase.from('rooms').select('*');
    const invoicePromise = supabase.from('invoices').select('*, bookings(id, profiles(full_name))').order('created_at', { ascending: false });

    const [{ data: bookingData, error: bookingError }, { data: roomData, error: roomError }, {data: invoiceData, error: invoiceError}] = await Promise.all([bookingPromise, roomPromise, invoicePromise]);
      
    if (bookingError || roomError || invoiceError) {
      toast({ title: 'Error', description: 'Failed to fetch admin data.', variant: 'destructive' });
    } else {
      setBookings(bookingData);
      setRooms(roomData);
      setInvoices(invoiceData);
    }
  };

  useEffect(() => {
    const checkAdminAndFetchData = async () => {
      if (!user) {
        setIsLoading(false);
        return;
      }
      
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      
      if (profileError || profile.role !== 'admin') {
        setIsAdmin(false);
        setIsLoading(false);
        toast({
          title: 'Access Denied',
          description: "You don't have permission to view this page.",
          variant: 'destructive',
        });
        navigate('/');
        return;
      }
      
      setIsAdmin(true);
      await fetchAdminData();
      setIsLoading(false);
    };

    checkAdminAndFetchData();
  }, [user, navigate]);

  const handleEditBooking = (bookingId) => {
    navigate(`/admin/booking/${bookingId}/edit`);
  };

  const filteredBookings = bookings.filter(booking => 
    (booking.profiles?.full_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (booking.profiles?.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (booking.rooms?.name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  if (isLoading) {
    return <div className="flex justify-center items-center h-screen"><div className="text-center p-12">Loading Admin Portal...</div></div>;
  }
  
  if (!isAdmin) {
    return (
       <div className="flex flex-col justify-center items-center h-[calc(100vh-80px)] text-center p-12">
        <ShieldOff className="w-16 h-16 text-red-500 mb-4" />
        <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
        <p className="text-gray-400">You must be an administrator to view this page.</p>
        <Button onClick={() => navigate('/')} className="mt-6">Go to Homepage</Button>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Admin Portal - Studio Booking</title>
        <meta name="description" content="Manage bookings and rooms" />
      </Helmet>
      <div className="min-h-screen py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex justify-between items-center mb-8">
              <h1 className="text-4xl font-bold">Admin Portal</h1>
            </div>

            <Tabs defaultValue="bookings" className="space-y-6">
              <TabsList className="glass-card p-1">
                <TabsTrigger value="bookings">Bookings</TabsTrigger>
                <TabsTrigger value="rooms">Rooms</TabsTrigger>
                <TabsTrigger value="invoices">Invoices</TabsTrigger>
              </TabsList>

              <TabsContent value="bookings" className="space-y-4">
                <div className="glass-card p-4"><div className="relative"><Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" /><Input placeholder="Search by customer, email, or room..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 bg-white/5 border-white/10" /></div></div>
                <div className="space-y-4">{filteredBookings.map((booking) => (<BookingRow key={booking.id} booking={booking} onEdit={handleEditBooking} />))}</div>
              </TabsContent>

              <TabsContent value="rooms" className="space-y-4"><RoomManagement rooms={rooms} onRoomsUpdate={fetchAdminData} /></TabsContent>

              <TabsContent value="invoices" className="space-y-4"><InvoiceList invoices={invoices} /></TabsContent>
            </Tabs>
          </motion.div>
        </div>
      </div>
    </>
  );
};

const BookingRow = ({ booking, onEdit }) => (
  <div className="glass-card p-6">
    <div className="flex justify-between items-start">
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">{booking.rooms?.name || 'N/A'}</h3>
        <p className="text-sm text-gray-400">Customer: {booking.profiles?.full_name || 'N/A'} ({booking.profiles?.email || 'N/A'})</p>
        <p className="text-sm text-gray-400">Date: {new Date(booking.start_time).toLocaleDateString('en-GB')} | Time: {new Date(booking.start_time).toLocaleTimeString('en-GB', {hour: '2-digit', minute: '2-digit'})} - {new Date(booking.end_time).toLocaleTimeString('en-GB', {hour: '2-digit', minute: '2-digit'})}</p>
        <p className="text-lg font-bold text-purple-400">£{parseFloat(booking.total_price).toFixed(2)}</p>
        <span className={`inline-block px-3 py-1 rounded-full text-xs ${booking.status === 'confirmed' ? 'bg-green-500/20 text-green-400' : booking.status === 'cancelled' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'}`}>{booking.status}</span>
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => onEdit(booking.id)}><Edit className="w-4 h-4" /></Button>
      </div>
    </div>
  </div>
);

const RoomManagement = ({ rooms, onRoomsUpdate }) => {
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState(null);

  const handleEditClick = (room) => {
    setSelectedRoom(room);
    setIsEditDialogOpen(true);
  };
  
  const handleUpdate = () => {
    onRoomsUpdate();
    setIsEditDialogOpen(false);
  }

  return (
    <>
      <div className="flex justify-end mb-4">
        <Button className="bg-purple-600 hover:bg-purple-700" onClick={() => toast({ title: '🚧 This feature isn\'t implemented yet—but don\'t worry! You can request it in your next prompt! 🚀' })}>
          <Plus className="w-4 h-4 mr-2" />Add Room
        </Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {rooms.map((room) => (
          <div key={room.id} className="glass-card p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">{room.name}</h3>
                <p className="text-2xl font-bold text-purple-400">£{parseFloat(room.hourly_price).toFixed(2)}/hour</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs ${room.is_active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>{room.is_active ? 'Active' : 'Inactive'}</span>
            </div>
            {room.image_url && <img src={room.image_url} alt={room.name} className="w-full h-32 object-cover rounded-md mb-4" />}
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="flex-1" onClick={() => handleEditClick(room)}>
                <Edit className="w-4 h-4 mr-2" />Edit
              </Button>
              <Button size="sm" variant="outline" className="border-red-500/50 hover:bg-red-500/10 text-red-400" onClick={() => toast({ title: '🚧 This feature isn\'t implemented yet—but don\'t worry! You can request it in your next prompt! 🚀' })}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
      {selectedRoom && (
        <EditRoomDialog 
          room={selectedRoom} 
          isOpen={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          onRoomUpdated={handleUpdate}
        />
      )}
    </>
  );
};

const EditRoomDialog = ({ room, isOpen, onOpenChange, onRoomUpdated }) => {
  const [name, setName] = useState(room.name);
  const [price, setPrice] = useState(room.hourly_price);
  const [features, setFeatures] = useState(Array.isArray(room.features) ? room.features : []);
  const [newFeature, setNewFeature] = useState('');
  const [imageUrl, setImageUrl] = useState(room.image_url);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    setName(room.name);
    setPrice(room.hourly_price);
    setFeatures(Array.isArray(room.features) ? room.features : []);
    setImageUrl(room.image_url);
  }, [room]);
  
  const handleAddFeature = () => {
    if (newFeature.trim()) {
      setFeatures([...features, newFeature.trim()]);
      setNewFeature('');
    }
  };

  const handleRemoveFeature = (indexToRemove) => {
    setFeatures(features.filter((_, index) => index !== indexToRemove));
  };
  
  const handleImageUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsUploading(true);
    const filePath = `room-images/${room.id}-${Date.now()}`;
    const { error: uploadError } = await supabase.storage
      .from('room-images')
      .upload(filePath, file);

    if (uploadError) {
      toast({ title: 'Upload Error', description: uploadError.message, variant: 'destructive' });
      setIsUploading(false);
      return;
    }

    const { data: { publicUrl } } = supabase.storage.from('room-images').getPublicUrl(filePath);
    setImageUrl(publicUrl);
    setIsUploading(false);
    toast({ title: 'Success', description: 'Image uploaded.' });
  };
  
  const handleSave = async () => {
    setIsSaving(true);
    const { error } = await supabase
      .from('rooms')
      .update({ name, hourly_price: price, features, image_url: imageUrl })
      .eq('id', room.id);

    setIsSaving(false);
    if (error) {
      toast({ title: 'Error updating room', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Room updated successfully.' });
      onRoomUpdated();
    }
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="glass-card max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Room: {room.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label>Room Image</Label>
            {imageUrl ? (
                <div className="my-2 relative">
                  <img src={imageUrl} alt="Room preview" className="w-full h-48 object-cover rounded-md" />
                </div>
              ) : (
                <div className="my-2 w-full h-48 bg-white/5 rounded-md flex items-center justify-center">
                  <ImageOff className="w-10 h-10 text-gray-500" />
                </div>
              )}
            <Input id="image-upload" type="file" onChange={handleImageUpload} disabled={isUploading} className="bg-white/5 border-white/10" accept="image/png, image/jpeg" />
            {isUploading && <div className="flex items-center gap-2 mt-2 text-sm text-purple-400"><Loader2 className="w-4 h-4 animate-spin"/> Uploading...</div>}
          </div>
          <div>
            <Label htmlFor="room-name">Room Name</Label>
            <Input id="room-name" value={name} onChange={e => setName(e.target.value)} className="bg-white/5 border-white/10" />
          </div>
          <div>
            <Label htmlFor="room-price">Hourly Price (£)</Label>
            <Input id="room-price" type="number" value={price} onChange={e => setPrice(e.target.value)} className="bg-white/5 border-white/10" />
          </div>
          <div>
            <Label>Features</Label>
            <div className="space-y-2">
              {features.map((feature, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input value={feature} readOnly className="bg-white/5 border-white/10 flex-1" />
                  <Button variant="ghost" size="icon" onClick={() => handleRemoveFeature(index)}><X className="w-4 h-4 text-red-400" /></Button>
                </div>
              ))}
              <div className="flex items-center gap-2">
                <Input placeholder="Add a new feature" value={newFeature} onChange={e => setNewFeature(e.target.value)} className="bg-white/5 border-white/10" />
                <Button onClick={handleAddFeature}><Plus className="w-4 h-4" /></Button>
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
          <Button onClick={handleSave} disabled={isSaving || isUploading}>
            {(isSaving || isUploading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const InvoiceList = ({ invoices }) => {
  const handleDownloadInvoice = async (bookingId) => {
    const { data, error } = await supabase.from('invoices').select('html_content').eq('booking_id', bookingId).single();
    if (error || !data) { toast({ title: 'Error', description: 'Could not find invoice.', variant: 'destructive' }); return; }
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

  if (!invoices.length) {
    return <div className="glass-card p-12 text-center"><p className="text-gray-400">No invoices found.</p></div>
  }

  return (
    <div className="glass-card divide-y divide-white/10">
      {invoices.map((invoice) => (
        <div key={invoice.id} className="p-4 flex justify-between items-center">
          <div>
            <p>Invoice for Booking #{invoice.booking_id}</p>
            <p className="text-sm text-gray-400">Customer: {invoice.bookings?.profiles?.full_name || 'N/A'}</p>
            <p className="text-sm text-gray-400">Generated: {new Date(invoice.created_at).toLocaleString()}</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => handleDownloadInvoice(invoice.booking_id)}>
            <Download className="w-4 h-4 mr-2" /> Download
          </Button>
        </div>
      ))}
    </div>
  )
};

export default AdminPortal;
  