import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate, NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Loader2 } from 'lucide-react';

const SignUp = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { signUp } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignUp = async (e) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await signUp(email, password, {
      data: {
        full_name: fullName,
      },
    });

    if (!error) {
      toast({
        title: 'Account Created!',
        description: 'Please check your email to verify your account.',
      });
      navigate('/login');
    }
    setLoading(false);
  };

  return (
    <>
      <Helmet>
        <title>Sign Up - Studio Booking</title>
      </Helmet>
      <div className="min-h-screen flex items-center justify-center py-12 px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <form onSubmit={handleSignUp} className="glass-card p-8 space-y-6">
            <div className="text-center">
              <h1 className="text-3xl font-bold text-white">Create an Account</h1>
              <p className="text-gray-400">Start booking your rehearsal space today</p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} required className="bg-white/5 border-white/10" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="bg-white/5 border-white/10" />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="bg-white/5 border-white/10" />
            </div>

            <Button type="submit" disabled={loading} className="w-full bg-purple-600 hover:bg-purple-700">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sign Up
            </Button>
            
            <p className="text-center text-sm text-gray-400">
              Already have an account?{' '}
              <NavLink to="/login" className="font-medium text-purple-400 hover:text-purple-300">
                Log In
              </NavLink>
            </p>
          </form>
        </motion.div>
      </div>
    </>
  );
};

export default SignUp;