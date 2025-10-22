
import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { MapPin, Clock, Lock, ImageOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';

const Home = () => {
  const navigate = useNavigate();
  const {
    toast
  } = useToast();
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const fetchRooms = async () => {
      setLoading(true);
      const {
        data,
        error
      } = await supabase.from('rooms').select('*').eq('is_active', true);
      if (error) {
        toast({
          title: 'Error fetching rooms',
          description: error.message,
          variant: 'destructive'
        });
      } else {
        setRooms(data);
      }
      setLoading(false);
    };
    fetchRooms();
  }, [toast]);
  return <>
      <Helmet>
        <title>Studio Booking - Rehearsal Spaces in Liverpool</title>
        <meta name="description" content="Book professional rehearsal spaces at Studio Below and Studio Beyond in Liverpool" />
      </Helmet>

      <div className="min-h-screen">
        <section className="relative py-20 px-4 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-purple-900/20 to-transparent"></div>
          <motion.div initial={{
          opacity: 0,
          y: 20
        }} animate={{
          opacity: 1,
          y: 0
        }} transition={{
          duration: 0.8
        }} className="max-w-7xl mx-auto text-center relative z-10">
            <h1 className="text-5xl md:text-7xl font-bold mb-6 text-glow">
              Book Your Perfect
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
                Rehearsal Space
              </span>
            </h1>
            <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">rehearsal studios in the heart of Liverpool. 
          </p>
            <div className="flex gap-4 justify-center items-center text-sm text-gray-400">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                <span>07:00 - 22:00 -  available outside of hours  (contact us)</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                <span>Liverpool City Centre</span>
              </div>
            </div>
          </motion.div>
        </section>

        <section className="py-16 px-4">
          <div className="max-w-7xl mx-auto">
            <motion.h2 initial={{
            opacity: 0
          }} animate={{
            opacity: 1
          }} className="text-3xl font-bold mb-12 text-center">Our  Spaces</motion.h2>

            {loading ? <div className="text-center">Loading spaces...</div> : <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {rooms.map((room, index) => <motion.div key={room.id} initial={{
              opacity: 0,
              y: 20
            }} animate={{
              opacity: 1,
              y: 0
            }} transition={{
              delay: index * 0.1
            }} className="glass-card overflow-hidden hover:scale-[1.02] transition-all duration-300 flex flex-col">
                    {room.image_url ? (
                      <img src={room.image_url} alt={room.name} className="w-full h-48 object-cover" />
                    ) : (
                      <div className="w-full h-48 bg-white/5 flex items-center justify-center">
                        <ImageOff className="w-10 h-10 text-gray-500" />
                      </div>
                    )}
                    <div className="p-6 flex flex-col flex-grow">
                      <div className="flex items-start gap-4 mb-4">
                        <div className="flex-1">
                          <h3 className="text-xl font-bold mb-1">{room.name}</h3>
                          <div className="flex items-center gap-2 text-gray-400 text-sm">
                            <MapPin className="w-4 h-4" />
                            <span>{room.location}</span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-auto flex items-end justify-between">
                        <div>
                          <p className="text-3xl font-bold text-purple-400">
                            £{parseFloat(room.hourly_price).toFixed(2)}
                          </p>
                          <p className="text-sm text-gray-400">per hour</p>
                        </div>
                        <Button onClick={() => navigate(`/room/${room.id}`)} className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700">
                          Book Now
                        </Button>
                      </div>
                    </div>
                  </motion.div>)}
              </div>}
          </div>
        </section>

        <section className="py-16 px-4 bg-gradient-to-b from-transparent to-purple-950/20">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[{
              title: 'Instant Booking',
              desc: 'Book and pay online in minutes'
            }, {
              title: 'Flexible Hours',
              desc: 'Available 7am-10pm every day'
            }, {
              title: 'Professional Setup',
              desc: 'Fully equipped rehearsal spaces'
            }].map((feature, i) => <motion.div key={i} initial={{
              opacity: 0,
              y: 20
            }} animate={{
              opacity: 1,
              y: 0
            }} transition={{
              delay: 0.5 + i * 0.1
            }} className="text-center">
                  <h3 className="text-xl font-bold mb-2 text-purple-400">{feature.title}</h3>
                  <p className="text-gray-400">{feature.desc}</p>
                </motion.div>)}
            </div>
          </div>
        </section>

        <footer className="text-center py-8">
          <Link to="/admin" className="text-gray-500 hover:text-purple-400 transition-colors flex items-center justify-center gap-2">
            <Lock className="w-4 h-4" />
            <p>Admin</p>
          </Link>
        </footer>
      </div>
    </>;
};
export default Home;
