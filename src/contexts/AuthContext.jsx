import React, { createContext, useContext, useState, useEffect } from 'react';
import { toast } from '@/components/ui/use-toast';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Mock auth - in production, integrate with Supabase Auth
    const mockUser = localStorage.getItem('mockUser');
    if (mockUser) {
      setUser(JSON.parse(mockUser));
    }
    setLoading(false);
  }, []);

  const signIn = async (email, password) => {
    // Mock sign in
    const mockUser = {
      id: '123',
      email,
      full_name: 'Test User',
      role: 'customer'
    };
    localStorage.setItem('mockUser', JSON.stringify(mockUser));
    setUser(mockUser);
    toast({
      title: 'Signed in successfully!',
      description: 'Welcome back!',
    });
  };

  const signUp = async (email, password, fullName) => {
    // Mock sign up
    const mockUser = {
      id: '123',
      email,
      full_name: fullName,
      role: 'customer'
    };
    localStorage.setItem('mockUser', JSON.stringify(mockUser));
    setUser(mockUser);
    toast({
      title: 'Account created!',
      description: 'Welcome to Studio Booking!',
    });
  };

  const signOut = async () => {
    localStorage.removeItem('mockUser');
    setUser(null);
    toast({
      title: 'Signed out',
      description: 'See you next time!',
    });
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};