
import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MapPin, Clock, ArrowLeft, ImageOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';

const RoomDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRoom = async () => {
      if (!id) return;
      setLoading(true);
      const { data, error } = await supabase
        .from('rooms')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        toast({
          title: 'Error fetching room details',
          description: error.message,
          variant: 'destructive',
        });
        navigate('/');
      } else {
        setRoom(data);
      }
      setLoading(false);
    };

    fetchRoom();
  }, [id, toast, navigate]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading room...</div>;
  }

  if (!room) return null;

  const roomFeatures = Array.isArray(room.features) ? room.features : [];

  return (
    <>
      <Helmet>
        <title>{room.name} - Studio Booking</title>
        <meta name="description" content={room.description || `Details for ${room.name}`} />
      </Helmet>

      <div className="min-h-screen py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <Button
            variant="ghost"
            onClick={() => navigate('/')}
            className="mb-8 text-purple-400 hover:text-purple-300"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Rooms
          </Button>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card overflow-hidden"
          >
            {room.image_url ? (
              <img src={room.image_url} alt={room.name} className="w-full h-64 object-cover" />
            ) : (
              <div className="w-full h-64 bg-white/5 flex items-center justify-center">
                <ImageOff className="w-12 h-12 text-gray-500" />
              </div>
            )}
            
            <div className="p-8">
              <h1 className="text-4xl font-bold mb-4">{room.name}</h1>
              
              <div className="flex items-center gap-4 mb-6 text-gray-400">
                <div className="flex items-center gap-2">
                  <MapPin className="w-5 h-5" />
                  <span>{room.location}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  <span>07:00 - 22:00</span>
                </div>
              </div>

              <p className="text-gray-300 mb-8">{room.description || 'A professional rehearsal space equipped for all your needs.'}</p>

              <div className="border-t border-white/10 pt-6 mb-8">
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-4xl font-bold text-purple-400">
                      £{parseFloat(room.hourly_price).toFixed(2)}
                    </p>
                    <p className="text-gray-400">per hour</p>
                  </div>
                  <Button
                    onClick={() => navigate(`/booking/${room.id}`)}
                    size="lg"
                    className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 glow-purple"
                  >
                    Book This Room
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="glass-card p-4">
                  <h3 className="font-semibold mb-2 text-purple-400">Features</h3>
                  {roomFeatures.length > 0 ? (
                    <ul className="space-y-1 text-gray-400">
                      {roomFeatures.map((feature, index) => (
                        <li key={index}>• {feature}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-gray-400">No features listed.</p>
                  )}
                </div>
                <div className="glass-card p-4">
                  <h3 className="font-semibold mb-2 text-purple-400">Booking Info</h3>
                  <ul className="space-y-1 text-gray-400">
                    <li>• Minimum 1 hour booking</li>
                    <li>• Back-to-back bookings available</li>
                    <li>• Instant confirmation</li>
                  </ul>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </>
  );
};

export default RoomDetails;
  