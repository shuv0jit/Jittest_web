import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, query, where, onSnapshot, addDoc, doc } from 'firebase/firestore';
import { useAuth } from './AuthContext';
import { Wallet, Clock, CheckCircle2, ArrowRight, ShieldCheck, X, Info, Lock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function WithdrawalHistory({ lockedBalance, paidAppsCount }) {
  const { currentUser } = useAuth();
  const [userData, setUserData] = useState({});
  const [history, setHistory] = useState([]);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState(100);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // 1. Real-time User Data (Withdrawable Balance)
  useEffect(() => {
    if (!currentUser) return;
    const unsubUser = onSnapshot(doc(db, 'users', currentUser.uid), (docSnap) => {
      if (docSnap.exists()) setUserData(docSnap.data());
    });
    return () => unsubUser();
  }, [currentUser]);

  // 3. Real-time Withdrawals History & Cooldown Logic
  useEffect(() => {
    if (!currentUser) return;
    const q = query(collection(db, 'withdrawRequests'), where('testerId', '==', currentUser.uid));
    const unsubHistory = onSnapshot(q, (snapshot) => {
      const records = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      
      // Sort descending by requestedAt (Newest first)
      records.sort((a, b) => {
        if (!a.requestedAt) return 1;
        if (!b.requestedAt) return -1;
        const dateA = a.requestedAt?.toDate ? a.requestedAt.toDate() : new Date(a.requestedAt);
        const dateB = b.requestedAt?.toDate ? b.requestedAt.toDate() : new Date(b.requestedAt);
        return dateB - dateA;
      });
      setHistory(records);

      // Cooldown Calculation (48 hours) based on the most recent requestedAt
      if (records.length > 0 && records[0].requestedAt) {
        const lastTime = records[0].requestedAt?.toDate 
          ? records[0].requestedAt.toDate().getTime() 
          : new Date(records[0].requestedAt).getTime();
        const hoursSince = (Date.now() - lastTime) / (1000 * 60 * 60);
        if (hoursSince < 48) {
          setCooldownRemaining(Math.ceil(48 - hoursSince));
        } else {
          setCooldownRemaining(0);
        }
      }
    });
    return () => unsubHistory();
  }, [currentUser]);

  // Strict Business Rule:
  // 1. Get the withdrawable balance directly from the user's database record.
  const withdrawableFromDB = userData.withdrawableBalance || 0;

  // 2. Calculate the total amount the user *should have* received from paid apps.
  const totalPotentialFromPaid = paidAppsCount * 50;

  // 3. The total amount they have actually withdrawn is the difference.
  const totalWithdrawn = Math.max(0, totalPotentialFromPaid - withdrawableFromDB);

  const handleWithdrawSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (withdrawAmount < 100 || withdrawAmount > 350) {
      setErrorMsg('Amount must be between 100 and 350 TK.');
      return;
    }
    
    // Security Enforcement: Check against DB withdrawable balance
    if (withdrawAmount > withdrawableFromDB) {
      setErrorMsg(`Insufficient balance. You only have ${withdrawableFromDB} TK available.`);
      return;
    }

    if (cooldownRemaining > 0) return;

    setIsSubmitting(true);
    try {
      // Submit to withdrawRequests, DO NOT deduct from balance yet
      await addDoc(collection(db, 'withdrawRequests'), {
        testerId: currentUser.uid,
        testerName: userData.name || 'Tester',
        amount: Number(withdrawAmount),
        status: 'pending',
        requestedAt: new Date() // This ensures Firestore stores it as a true Timestamp
      });
      
      setSuccessMsg('Withdrawal requested successfully! Awaiting admin approval.');
      setTimeout(() => {
        setIsPopupOpen(false);
        setSuccessMsg('');
        setWithdrawAmount(100);
      }, 2500);
    } catch (error) {
      setErrorMsg('An error occurred while submitting. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusConfig = (status) => {
    if (status === 'paid') {
      return {
        color: 'text-emerald-600',
        bg: 'bg-emerald-50',
        border: 'border-emerald-100',
        icon: <CheckCircle2 className="w-4 h-4" />,
        label: 'Approved'
      };
    }
    if (status === 'declined') {
      return {
        color: 'text-red-600',
        bg: 'bg-red-50',
        border: 'border-red-100',
        icon: <Info className="w-4 h-4" />,
        label: 'Declined'
      };
    }
    return {
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      border: 'border-amber-100',
      icon: <Clock className="w-4 h-4" />,
      label: 'Pending'
    };
  };

  const formatDateTime = (dateVal) => {
    if (!dateVal) return '';
    const d = dateVal.toDate ? dateVal.toDate() : new Date(dateVal);
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  };

  return (
    <div className="h-full flex flex-col max-w-5xl mx-auto">

      {/* Upgraded Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6 mb-8 mt-2">
        
        {/* Withdrawable Balance Card (Green) */}
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="lg:col-span-2 bg-gradient-to-br from-emerald-500 to-emerald-700 p-6 sm:p-8 rounded-2xl sm:rounded-[2rem] shadow-lg shadow-emerald-500/20 border border-emerald-400 relative overflow-hidden flex flex-col sm:flex-row sm:items-center justify-between gap-6">
           <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
           <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -mt-10" />
           
           <div className="relative z-10">
             <div className="flex items-center gap-3 mb-2">
               <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm"><Wallet className="w-5 h-5 text-white" /></div>
               <p className="text-emerald-100 text-xs font-bold uppercase tracking-widest flex items-center">Withdrawable <span className="ml-2 w-2 h-2 bg-white rounded-full animate-pulse" /></p>
             </div>
             <h3 className="text-4xl sm:text-5xl font-black text-white tracking-tight drop-shadow-sm">{withdrawableFromDB} <span className="text-xl sm:text-2xl font-bold text-emerald-200">TK</span></h3>
           </div>

           <button onClick={() => setIsPopupOpen(true)} className="relative z-10 w-full sm:w-auto bg-white text-emerald-600 font-bold py-3.5 px-6 rounded-xl hover:bg-emerald-50 transition-colors shadow-md flex justify-center items-center shrink-0">
              Request Withdrawal <ArrowRight className="w-4 h-4 ml-2" />
           </button>
        </motion.div>

        <div className="grid grid-cols-2 lg:grid-cols-1 gap-4 lg:col-span-1">
          {/* Locked Balance Card (Amber) */}
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-white p-4 sm:p-5 rounded-2xl border border-amber-100 shadow-sm flex flex-col justify-center relative overflow-hidden group">
             <div className="absolute top-0 right-0 w-24 h-24 bg-amber-50 rounded-full blur-2xl -mr-8 -mt-8 transition-transform group-hover:scale-110" />
             <div className="flex items-center gap-2 sm:gap-2.5 mb-2 sm:mb-3 relative z-10">
               <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-amber-50 flex items-center justify-center shrink-0"><Lock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-500" /></div>
               <p className="text-slate-500 text-[9px] sm:text-xs font-bold uppercase tracking-wider truncate">Locked Balance</p>
             </div>
             <h3 className="text-xl sm:text-3xl font-black text-amber-600 tracking-tight relative z-10">{lockedBalance} <span className="text-xs sm:text-sm font-medium text-amber-400">TK</span></h3>
          </motion.div>

          {/* Total Withdrawn Card (Blue) */}
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-white p-4 sm:p-5 rounded-2xl border border-blue-100 shadow-sm flex flex-col justify-center relative overflow-hidden group">
             <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-full blur-2xl -mr-8 -mt-8 transition-transform group-hover:scale-110" />
             <div className="flex items-center gap-2 sm:gap-2.5 mb-2 sm:mb-3 relative z-10">
               <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-blue-50 flex items-center justify-center shrink-0"><CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-500" /></div>
               <p className="text-slate-500 text-[9px] sm:text-xs font-bold uppercase tracking-wider truncate">Total Withdrawn</p>
             </div>
             <h3 className="text-xl sm:text-3xl font-black text-blue-600 tracking-tight relative z-10">{totalWithdrawn} <span className="text-xs sm:text-sm font-medium text-blue-400">TK</span></h3>
          </motion.div>
        </div>
      </div>

      {/* Ledger History Style */}
      <div className="mt-2">
        <h3 className="text-xl font-black text-slate-800 mb-6 px-1 tracking-tight">Recent Transactions</h3>
        
        <div className="space-y-3 sm:space-y-4">
          {history.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center mt-6 py-10">
              <Wallet className="w-16 h-16 text-slate-200 mb-4" strokeWidth={1.5} />
              <p className="text-slate-400 font-medium">Your ledger is clean. Transactions will appear here.</p>
            </div>
          ) : (
            <motion.div variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } }} initial="hidden" animate="show" className="space-y-3">
              {history.map(req => {
                const config = getStatusConfig(req.status);
                return (
                  <motion.div variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }} key={req.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 rounded-xl bg-white border border-slate-100 shadow-sm hover:shadow-md transition-all gap-3 group">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-colors ${config.bg} ${config.color} group-hover:bg-opacity-80`}>
                        {config.icon}
                      </div>
                      <div>
                        <div className="font-black text-lg text-slate-800 tracking-tight">{req.amount} <span className="text-xs font-medium text-slate-400">TK</span></div>
                        <div className="text-[10px] sm:text-[11px] text-slate-500 font-semibold uppercase tracking-wider mt-0.5">{formatDateTime(req.requestedAt)}</div>
                      </div>
                    </div>
                    
                    <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-1 mt-2 sm:mt-0 pt-3 sm:pt-0 border-t border-slate-50 sm:border-0">
                      <div className={`px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold border flex items-center w-max ${config.bg} ${config.color} ${config.border}`}>
                        {config.label}
                      </div>
                      {req.status === 'paid' && req.paidAt && (
                        <span className="text-[10px] text-slate-400 font-medium">Processed: {formatDateTime(req.paidAt)}</span>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </div>
      </div>

      {/* Withdrawal Popup Modal / Bottom Sheet for Mobile */}
      <AnimatePresence>
        {isPopupOpen && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => !isSubmitting && setIsPopupOpen(false)} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
            
            <motion.div initial={{ opacity: 0, y: "100%" }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: "100%" }} transition={{ type: "spring", bounce: 0, duration: 0.4 }} className="bg-white w-full max-w-md rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl relative z-10 overflow-hidden">
              
              {successMsg ? (
                <div className="p-10 flex flex-col items-center justify-center text-center">
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring" }} className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-6">
                    <CheckCircle2 className="w-10 h-10 text-emerald-600" />
                  </motion.div>
                  <h3 className="text-2xl font-black text-slate-800 mb-2">Success!</h3>
                  <p className="text-slate-500 font-medium">{successMsg}</p>
                </div>
              ) : (
                <div className="p-8">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-black text-slate-800 tracking-tight">Request Withdrawal</h3>
                    <button onClick={() => setIsPopupOpen(false)} className="text-slate-400 hover:text-slate-600 bg-slate-100 p-2 rounded-full"><X className="w-5 h-5"/></button>
                  </div>

                  {errorMsg && (
                    <div className="mb-6 bg-red-50 text-red-600 p-4 rounded-xl text-sm font-bold border border-red-100 flex items-start">
                      <Info className="w-5 h-5 mr-2 shrink-0 mt-0.5" />
                      <p>{errorMsg}</p>
                    </div>
                  )}

                  <form onSubmit={handleWithdrawSubmit} className="space-y-6">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex justify-between">
                        <span>Amount (TK)</span>
                        <span className="text-blue-600">Limit: 100 - 350</span>
                      </label>
                      <input 
                        type="number" min="100" max={Math.max(100, Math.min(350, withdrawableFromDB))} required 
                        value={withdrawAmount} 
                        onChange={(e) => setWithdrawAmount(Number(e.target.value))} 
                        disabled={cooldownRemaining > 0}
                        className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-black text-2xl text-slate-800 transition-all disabled:opacity-50" 
                      />
                    </div>

                    {cooldownRemaining > 0 ? (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start">
                        <ShieldCheck className="w-5 h-5 text-amber-600 mr-3 shrink-0 mt-0.5" />
                        <p className="text-sm font-bold text-amber-700">Security Cooldown Active. <br/><span className="font-medium text-amber-600">Next withdrawal available in {cooldownRemaining} hours.</span></p>
                      </div>
                    ) : (
                      <p className="text-xs font-medium text-slate-400 flex items-center bg-blue-50 p-3 rounded-xl border border-blue-100">
                        <Clock className="w-4 h-4 mr-2 text-blue-500 shrink-0"/> Note: Withdrawals are subject to a 48-hour security cooldown between requests.
                      </p>
                    )}

                    <motion.button 
                      whileHover={cooldownRemaining === 0 ? { scale: 1.02 } : {}} whileTap={cooldownRemaining === 0 ? { scale: 0.98 } : {}} 
                      type="submit" disabled={cooldownRemaining > 0 || isSubmitting} 
                      className="w-full bg-blue-600 text-white py-4 rounded-xl font-black tracking-wide hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/30 flex justify-center items-center disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? 'Processing...' : 'Submit Request'}
                    </motion.button>
                  </form>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}