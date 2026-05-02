/* eslint-disable no-unused-vars */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, ArrowRight, Mail, Lock, Loader2 } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { loginEmail, loginGoogle, currentUser, role } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (currentUser && role) {
      navigate(role === 'admin' ? '/admin' : '/tester');
    }
  }, [currentUser, role, navigate]);

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      await loginEmail(email, password);
    } catch (err) {
      setError('Failed to log in. Please check your credentials.');
      console.error(err);
      setIsSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    try {
      await loginGoogle();
    } catch (err) {
      setError('Google sign-in failed.');
      console.error(err);
    }
  };

  return (
    <div className="relative min-h-screen bg-slate-50 flex items-center justify-center overflow-hidden font-sans p-4">
      {/* High-tech Abstract Background (Light Theme) */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <motion.div animate={{ scale: [1, 1.1, 1], x: [0, 30, 0], y: [0, 20, 0] }} transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }} className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-blue-400/20 rounded-full blur-[100px]" />
        <motion.div animate={{ scale: [1, 1.2, 1], x: [0, -30, 0], y: [0, -20, 0] }} transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }} className="absolute top-[20%] right-[-10%] w-[400px] h-[400px] bg-cyan-400/20 rounded-full blur-[100px]" />
        <motion.div animate={{ scale: [1, 1.1, 1], x: [0, 20, 0], y: [0, -30, 0] }} transition={{ duration: 9, repeat: Infinity, ease: "easeInOut", delay: 2 }} className="absolute bottom-[-20%] left-[20%] w-[600px] h-[600px] bg-indigo-400/20 rounded-full blur-[100px]" />
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: "easeOut" }} className="relative z-10 w-full max-w-[420px]">
        
        <div className="bg-white p-8 sm:p-10 rounded-[2rem] shadow-[0_20px_60px_-15px_rgba(37,99,235,0.15)] border border-white/50 backdrop-blur-xl">
          <div className="text-center mb-10">
            <motion.img 
              src="/logo.jpg" 
              alt="JitTest Logo" 
              initial={{ scale: 0 }} 
              animate={{ scale: 1 }} 
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }} 
              className="mx-auto h-20 w-auto object-contain mb-6 drop-shadow-md rounded-2xl" 
            />
            <p className="text-sm text-slate-500 mt-2 font-medium">Secure access to your testing dashboard</p>
          </div>

          <AnimatePresence>
            {error && (
              <motion.div initial={{ opacity: 0, y: -10, height: 0 }} animate={{ opacity: 1, y: 0, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mb-6 bg-red-50 border border-red-100 text-red-600 text-sm font-bold text-center p-3.5 rounded-xl overflow-hidden">
                {error}
              </motion.div>
            )}
          </AnimatePresence>
          
          <form className="space-y-6" onSubmit={handleEmailLogin}>
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold tracking-wider text-slate-500 uppercase">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)} disabled={isSubmitting} className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all font-medium disabled:opacity-50" placeholder="Enter your email" />
              </div>
            </div>
            
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold tracking-wider text-slate-500 uppercase">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input type="password" required value={password} onChange={e => setPassword(e.target.value)} disabled={isSubmitting} className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all font-medium disabled:opacity-50" placeholder="••••••••" />
              </div>
            </div>
            
            <motion.button whileHover={{ scale: isSubmitting ? 1 : 1.02 }} whileTap={{ scale: isSubmitting ? 1 : 0.98 }} type="submit" disabled={isSubmitting} className="w-full flex justify-center items-center py-4 px-4 rounded-xl shadow-lg shadow-blue-600/20 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-70 disabled:cursor-not-allowed mt-2">
              {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Secure Sign In <ArrowRight className="ml-2 w-4 h-4" /></>}
            </motion.button>
          </form>

          <div className="mt-8">
            <div className="relative mb-6 flex items-center justify-center">
               <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200"></div></div>
               <div className="relative bg-white px-4 text-[10px] font-bold tracking-widest text-slate-400 uppercase">Or Continue With</div>
            </div>
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleGoogleLogin} disabled={isSubmitting} className="w-full flex justify-center items-center py-3.5 px-4 rounded-xl shadow-sm bg-white border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              <img className="h-5 w-5 mr-3" src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google logo" />
              Google Account
            </motion.button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}