import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate, NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

const Login = () => {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await signIn(email, password);
    if (!error) {
      navigate('/');
    }
    setLoading(false);
  };

  return (
    <>
      <Helmet>
        <title>Log In - Studio Booking</title>
      </Helmet>
      <div className="min-h-screen flex items-center justify-center py-12 px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <form onSubmit={handleLogin} className="glass-card p-8 space-y-6">
            <div className="text-center">
              <h1 className="text-3xl font-bold text-white">Welcome Back</h1>
              <p className="text-gray-400">Log in to manage your bookings</p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-white/5 border-white/10"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-white/5 border-white/10"
              />
            </div>

            <Button type="submit" disabled={loading} className="w-full bg-purple-600 hover:bg-purple-700">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Log In
            </Button>
            
            <p className="text-center text-sm text-gray-400">
              Don't have an account?{' '}
              <NavLink to="/signup" className="font-medium text-purple-400 hover:text-purple-300">
                Sign Up
              </NavLink>
            </p>
          </form>
        </motion.div>
      </div>
    </>
  );
};

export default Login;