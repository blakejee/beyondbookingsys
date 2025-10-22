
import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/customSupabaseClient';

const Navbar = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const checkAdminRole = async () => {
      if (user) {
        const { data, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();

        if (data && data.role === 'admin') {
          setIsAdmin(true);
        } else {
          setIsAdmin(false);
        }
      } else {
        setIsAdmin(false);
      }
    };

    checkAdminRole();
    
    // Re-check when user changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      checkAdminRole();
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, [user]);

  const handleSignOut = async () => {
    await signOut();
    setIsAdmin(false);
    navigate('/');
  };

  return (
    <nav className="sticky top-0 z-50 bg-slate-950/50 backdrop-blur-lg border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <NavLink to="/" className="flex items-center gap-2 text-xl font-bold text-white">
            Studio Booking
          </NavLink>
          <div className="flex items-center gap-4">
            {user ? (
              <>
                {isAdmin && (
                  <NavLink to="/admin" className="text-sm font-medium text-purple-400 hover:text-purple-300">Admin</NavLink>
                )}
                <NavLink to="/portal" className="text-sm font-medium text-gray-300 hover:text-white">My Bookings</NavLink>
                <Button variant="ghost" onClick={handleSignOut} size="sm">Sign Out</Button>
              </>
            ) : (
              <>
                <NavLink to="/login" className="text-sm font-medium text-gray-300 hover:text-white">Log In</NavLink>
                <Button onClick={() => navigate('/signup')} size="sm" className="bg-purple-600 hover:bg-purple-700">Sign Up</Button>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
