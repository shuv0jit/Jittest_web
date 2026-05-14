/* eslint-disable no-unused-vars */
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Mail, Lock, Loader2, Shield } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { loginEmail, currentUser, role } = useAuth();
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
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-white flex items-center justify-center overflow-hidden font-sans p-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: "easeOut" }} className="relative z-10 w-full max-w-[420px]">
        
        <div className="bg-white p-8 sm:p-10 rounded-[2rem] shadow-sm border border-slate-100 relative overflow-hidden">
          <div className="text-center mb-8">
            <motion.div 
              initial={{ scale: 0 }} 
              animate={{ scale: 1 }} 
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="flex justify-center items-center gap-3 mb-5"
            >
              
              <img src="/logo.jpg" alt="JitTest Logo" className="h-20 w-auto object-contain rounded-xl shadow-sm border border-slate-100" />
            </motion.div>
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">
              Hey, Welcome Back! 
            </h2>
            <p className="mt-3 text-sm text-slate-500 font-medium leading-relaxed">
              Sign in to your account <br />
              
            </p>
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
                <input id="password-input" type="password" required value={password} onChange={e => setPassword(e.target.value)} disabled={isSubmitting} className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all font-medium disabled:opacity-50" placeholder="••••••••" />
              </div>
            </div>
            
            <div className="flex justify-end pt-1">
              <Link to="/forgot-password" className="text-[11px] font-bold tracking-wider text-blue-600 hover:text-blue-700 transition-colors uppercase">
                Forgot Password?
              </Link>
            </div>

            <motion.button whileHover={{ scale: isSubmitting ? 1 : 1.02 }} whileTap={{ scale: isSubmitting ? 1 : 0.98 }} type="submit" disabled={isSubmitting} className="w-full flex justify-center items-center py-4 px-4 rounded-xl shadow-lg shadow-blue-600/20 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-70 disabled:cursor-not-allowed mt-2">
              {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Secure Sign In <ArrowRight className="ml-2 w-4 h-4" /></>}
            </motion.button>
          </form>

          <div className="mt-8">
            <div className="relative mb-6 flex items-center justify-center">
               <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200"></div></div>
               <div className="relative bg-white px-4 text-[10px] font-bold tracking-widest text-slate-400 uppercase">Staff & Admin</div>
            </div>
            
            <motion.button 
              type="button"
              whileHover={{ scale: isSubmitting ? 1 : 1.02 }} 
              whileTap={{ scale: isSubmitting ? 1 : 0.98 }} 
              onClick={() => { setEmail('admin@jittest.com'); setPassword(''); document.getElementById('password-input')?.focus(); }} 
              disabled={isSubmitting} 
              className="w-full flex justify-center items-center py-3.5 px-4 rounded-xl shadow-sm bg-slate-900 border border-slate-800 text-sm font-bold text-white hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Shield className="w-5 h-5 mr-3 text-blue-400" />
              Admin Access
            </motion.button>

            <p className="mt-8 text-center text-xs font-medium text-slate-500">
              Don't have an account?{' '}
              <Link to="/register" className="font-bold text-blue-600 hover:text-blue-700 transition-colors">
                Register here
              </Link>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}