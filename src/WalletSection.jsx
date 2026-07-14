import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, query, where, onSnapshot, addDoc, doc } from 'firebase/firestore';
import { useAuth } from './AuthContext';
import { Wallet, Clock, CheckCircle2, XCircle, ArrowRight, ShieldCheck, X, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function WalletSection() {
  const { currentUser } = useAuth();
  const [userData, setUserData] = useState({});
  const [lockedBalance, setLockedBalance] = useState(0);
  const [history, setHistory] = useState([]);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState(100);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // 1. Real-time User Data (Withdrawable & Total Paid)
  useEffect(() => {
    if (!currentUser) return;
    const unsubUser = onSnapshot(doc(db, 'users', currentUser.uid), (docSnap) => {
      if (docSnap.exists()) setUserData(docSnap.data());
    });
    return () => unsubUser();
  }, [currentUser]);

  // 2. Real-time Locked Balance Calculation (Active Apps * 50)
  useEffect(() => {
    if (!currentUser) return;
    // Listen to all apps to correctly calculate locked balance
    const unsubApps = onSnapshot(collection(db, 'apps'), (snapshot) => {
      let lockedAppCount = 0;
      snapshot.forEach(doc => {
        const app = doc.data();
        const hasTested = app.testerIds?.includes(currentUser.uid);
        const testerCount = app.testerIds?.length || 0;
        if (!app.isPaidByAdmin && testerCount >= 12 && hasTested) {
          lockedAppCount++;
        }
      });
      setLockedBalance(lockedAppCount * 50);
    });
    return () => unsubApps();
  }, [currentUser]);

  // 3. Real-time Withdrawals History & Cooldown Logic
  useEffect(() => {
    if (!currentUser) return;
    const q = query(collection(db, 'withdrawRequests'), where('testerId', '==', currentUser.uid));
    const unsubHistory = onSnapshot(q, (snapshot) => {
      const records = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      
      // Sort descending by requestedAt (Newest first)
      records.sort((a, b) => {
        const dateA = a.requestedAt?.toDate ? a.requestedAt.toDate().getTime() : new Date(a.requestedAt || a.createdAt || 0).getTime();
        const dateB = b.requestedAt?.toDate ? b.requestedAt.toDate().getTime() : new Date(b.requestedAt || b.createdAt || 0).getTime();
        return dateB - dateA;
      });
      setHistory(records);

      // Cooldown Calculation (48 hours)
      if (records.length > 0) {
        const mostRecent = records[0];
        const lastTime = mostRecent.requestedAt?.toDate ? mostRecent.requestedAt.toDate().getTime() : new Date(mostRecent.requestedAt || mostRecent.createdAt || 0).getTime();
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

  const handleWithdrawSubmit = async (e) => {
    e.preventDefault();
    if (withdrawAmount < 100 || withdrawAmount > 350) return;
    if (cooldownRemaining > 0) return;

    setIsSubmitting(true);
    try {
      // Adds to withdrawal collection. Note: We DO NOT deduct the balance here.
      await addDoc(collection(db, 'withdrawRequests'), {
        testerId: currentUser.uid,
        testerName: userData.name || 'Tester',
        amount: Number(withdrawAmount),
        status: 'requested',
        requestedAt: new Date()
      });
      
      setSuccessMsg('Withdrawal requested successfully! Awaiting admin approval.');
      setTimeout(() => {
        setIsPopupOpen(false);
        setSuccessMsg('');
        setWithdrawAmount(100);
      }, 2500);
    } catch (error) {
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusStyle = (status) => {
    if (status === 'Accepted' || status === 'Approved' || status === 'paid') return 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20 border-emerald-500';
    if (status === 'Declined' || status === 'declined') return 'bg-transparent text-red-600 border-red-500';
    return 'bg-yellow-50 text-yellow-700 border-yellow-200'; // Pending
  };

  const getStatusContent = (status) => {
    if (status === 'Accepted' || status === 'Approved' || status === 'paid') return <><CheckCircle2 className="w-4 h-4 mr-1.5" /> Approved</>;
    if (status === 'Declined' || status === 'declined') return <><Info className="w-4 h-4 mr-1.5" /> Declined</>;
    return <><div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse mr-2" /> {status === 'requested' ? 'Requested' : 'Pending'}</>;
  };

  const formatDateTime = (isoString) => {
    if (!isoString) return '';
    const d = isoString.toDate ? isoString.toDate() : new Date(isoString);
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  };

  return (
    <div className="h-full flex flex-col max-w-5xl mx-auto">
      
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight flex items-center">
          <Wallet className="mr-3 w-8 h-8 text-blue-600" /> Financial Dashboard
        </h2>
        <motion.button 
          whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
          onClick={() => setIsPopupOpen(true)}
          className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-blue-600/30 hover:bg-blue-700 transition-colors flex items-center"
        >
          Withdraw Funds <ArrowRight className="w-4 h-4 ml-2" />
        </motion.button>
      </div>

      {/* Glassmorphic Blue/White Theme Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white p-6 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full blur-3xl -mr-10 -mt-10" />
          <div className="text-slate-400 text-xs font-bold tracking-widest uppercase mb-2 relative z-10">Locked Balance</div>
          <div className="text-4xl font-black tracking-tight text-slate-800 relative z-10">{lockedBalance} <span className="text-lg font-medium text-slate-400 tracking-normal">TK</span></div>
          <p className="text-xs text-slate-400 mt-2 font-medium relative z-10">From Ongoing & Production Apps</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-gradient-to-br from-blue-600 to-indigo-700 p-6 rounded-[2rem] shadow-[0_8px_30px_rgba(37,99,235,0.2)] border border-blue-400 relative overflow-hidden ring-4 ring-blue-500/20">
          <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
          <div className="text-blue-100 text-xs font-bold tracking-widest uppercase mb-2 relative z-10 flex items-center">
            Withdrawable <span className="ml-2 w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          </div>
          <div className="text-4xl font-black tracking-tight text-white relative z-10 drop-shadow-md">{userData.withdrawableBalance || 0} <span className="text-lg font-medium text-blue-200 tracking-normal">TK</span></div>
          <p className="text-xs text-blue-200 mt-2 font-medium relative z-10">Available for immediate withdrawal</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-white p-6 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-full blur-3xl -mr-10 -mt-10" />
          <div className="text-slate-400 text-xs font-bold tracking-widest uppercase mb-2 relative z-10">Total Withdrawn</div>
          <div className="text-4xl font-black tracking-tight text-slate-800 relative z-10">{userData.totalPaidAmount || userData.paidAmount || 0} <span className="text-lg font-medium text-slate-400 tracking-normal">TK</span></div>
          <p className="text-xs text-slate-400 mt-2 font-medium relative z-10">Lifetime earnings processed</p>
        </motion.div>

      </div>

      {/* Withdrawal History */}
      <div className="flex-1 bg-white rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 p-6 sm:p-8 overflow-hidden flex flex-col">
        <h3 className="text-lg font-black text-slate-800 mb-6 tracking-tight flex items-center">
          Transaction History
        </h3>
        
        <div className="flex-1 overflow-y-auto pr-2 space-y-3">
          {history.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center mt-10">
              <Wallet className="w-16 h-16 text-slate-200 mb-4" />
              <p className="text-slate-400 font-medium">Your transaction history will appear here.</p>
            </div>
          ) : (
            <motion.div variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 } } }} initial="hidden" animate="show" className="space-y-3">
              {history.map(req => (
                <motion.div variants={{ hidden: { opacity: 0, x: -20 }, show: { opacity: 1, x: 0 } }} key={req.id} className="flex items-center justify-between p-5 rounded-2xl border border-slate-100 bg-white shadow-sm hover:shadow-md transition-shadow">
                  <div>
                    <div className="font-black text-2xl text-blue-600 mb-1">{req.amount} TK</div>
                    <div className="text-sm text-slate-400 font-medium">{formatDateTime(req.requestedAt || req.createdAt)}</div>
                  </div>
                  <div className={`px-4 py-2 rounded-xl text-sm font-bold border flex items-center ${getStatusStyle(req.status)}`}>
                    {getStatusContent(req.status)}
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>
      </div>

      {/* Withdrawal Popup */}
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

                  <form onSubmit={handleWithdrawSubmit} className="space-y-6">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex justify-between">
                        <span>Amount (TK)</span>
                        <span className="text-blue-600">Limit: 100 - 350</span>
                      </label>
                      <input 
                        type="number" min="100" max="350" required 
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