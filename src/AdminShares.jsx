import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, onSnapshot, query, orderBy, addDoc, serverTimestamp } from 'firebase/firestore';
import { Calculator, ArrowRight, X, Clock, CheckCircle2, User } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function AdminShares() {
  const [apps, setApps] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Payment Modal State
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentOwner, setPaymentOwner] = useState('shuvojit');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const unsubApps = onSnapshot(collection(db, 'apps'), (snap) => {
      setApps(snap.docs.map(doc => doc.data()));
    });

    const q = query(collection(db, 'ownerPayments'), orderBy('timestamp', 'desc'));
    const unsubPayments = onSnapshot(q, (snap) => {
      setPayments(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });

    return () => { unsubApps(); unsubPayments(); };
  }, []);

  // Mathematic Calculations
  const shuvojitAppsCount = apps.filter(a => a.owner === 'shuvojit').length;
  const nobojitAppsCount = apps.filter(a => a.owner === 'nobojit').length;

  const shuvojitOwed = shuvojitAppsCount * 50;
  const nobojitOwed = nobojitAppsCount * 50 * 2; // Nobojit receives a 2x share (100 TK per app)

  const shuvojitReleased = payments.filter(p => p.owner === 'shuvojit').reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const nobojitReleased = payments.filter(p => p.owner === 'nobojit').reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  const shuvojitBalance = Math.max(0, shuvojitOwed - shuvojitReleased);
  const nobojitBalance = Math.max(0, nobojitOwed - nobojitReleased);

  const handleReleasePayment = async (e) => {
    e.preventDefault();
    if (!paymentAmount || isNaN(paymentAmount) || Number(paymentAmount) <= 0) return;

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'ownerPayments'), {
        owner: paymentOwner,
        amount: Number(paymentAmount),
        timestamp: serverTimestamp()
      });
      setIsPaymentModalOpen(false);
      setPaymentAmount('');
    } catch (error) {
      alert("Failed to release payment.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openPaymentModal = (ownerName) => {
    setPaymentOwner(ownerName);
    setPaymentAmount('');
    setIsPaymentModalOpen(true);
  };

  if (loading) return <div className="p-8 text-blue-600 font-bold animate-pulse">Synchronizing Ledgers...</div>;

  return (
    <div className="p-4 md:p-8 h-full flex flex-col max-w-7xl mx-auto">
      
      <div className="mb-6 sm:mb-8">
        <h2 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight flex items-center">
          <Calculator className="mr-3 w-8 h-8 text-blue-600" /> Calculation & Shares
        </h2>
        <p className="text-sm text-slate-500 font-medium mt-1">Platform equity distribution and owner ledger.</p>
      </div>

      {/* Owner Balance Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
        {/* Shuvojit Card */}
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8 flex flex-col relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none" />
          <div className="flex items-center gap-4 mb-6 relative z-10">
            <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white shadow-lg">
              <User className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-2xl font-black text-slate-800">Shuvojit</h3>
              <p className="text-sm font-semibold text-slate-500">{shuvojitAppsCount} Apps Registered</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-6 relative z-10">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Total Earned</p>
              <p className="font-black text-xl text-slate-800">{shuvojitOwed} <span className="text-xs text-slate-400 font-medium">TK</span></p>
            </div>
            <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
              <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider mb-1">Total Released</p>
              <p className="font-black text-xl text-emerald-700">{shuvojitReleased} <span className="text-xs text-emerald-500 font-medium">TK</span></p>
              <p className="text-[10px] font-bold text-emerald-500 mt-1">({(shuvojitReleased / 50).toFixed(1)} Apps Cleared)</p>
            </div>
          </div>
          <div className="mt-auto flex items-center justify-between relative z-10 pt-4 border-t border-slate-100">
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Remaining Balance</p>
              <p className="font-black text-3xl text-blue-600">{shuvojitBalance} <span className="text-sm text-blue-400 font-medium">TK</span></p>
            </div>
            <button onClick={() => openPaymentModal('shuvojit')} className="bg-slate-900 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-blue-600 transition-colors shadow-md">Release Funds</button>
          </div>
        </motion.div>

        {/* Nobojit Card */}
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8 flex flex-col relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-50 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none" />
          <div className="flex items-center gap-4 mb-6 relative z-10">
            <div className="w-14 h-14 bg-gradient-to-br from-amber-500 to-orange-500 rounded-full flex items-center justify-center text-white shadow-lg">
              <User className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-2xl font-black text-slate-800">Nobojit</h3>
              <p className="text-sm font-semibold text-slate-500">{nobojitAppsCount} Apps Registered</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-6 relative z-10">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Total Earned</p>
              <p className="font-black text-xl text-slate-800">{nobojitOwed} <span className="text-xs text-slate-400 font-medium">TK</span></p>
            </div>
            <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
              <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider mb-1">Total Released</p>
              <p className="font-black text-xl text-emerald-700">{nobojitReleased} <span className="text-xs text-emerald-500 font-medium">TK</span></p>
              <p className="text-[10px] font-bold text-emerald-500 mt-1">({(nobojitReleased / 100).toFixed(1)} Apps Cleared)</p>
            </div>
          </div>
          <div className="mt-auto flex items-center justify-between relative z-10 pt-4 border-t border-slate-100">
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Remaining Balance</p>
              <p className="font-black text-3xl text-amber-600">{nobojitBalance} <span className="text-sm text-amber-400 font-medium">TK</span></p>
            </div>
            <button onClick={() => openPaymentModal('nobojit')} className="bg-slate-900 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-amber-500 transition-colors shadow-md">Release Funds</button>
          </div>
        </motion.div>
      </div>

      {/* Payment Release Ledger */}
      <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50">
          <h3 className="text-lg font-black text-slate-800 tracking-tight">Payment Release Ledger</h3>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {payments.length === 0 ? (
            <div className="text-center text-slate-400 font-medium mt-10">No payments have been released yet.</div>
          ) : (
            payments.map(payment => (
              <div key={payment.id} className="flex items-center justify-between p-4 rounded-xl border border-slate-100 hover:shadow-sm transition-shadow bg-white">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${payment.owner === 'shuvojit' ? 'bg-blue-500' : 'bg-amber-500'}`}>
                    {payment.owner.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 capitalize">{payment.owner}</h4>
                    <div className="text-[11px] text-slate-500 font-semibold flex items-center mt-0.5 uppercase tracking-wider">
                      <Clock className="w-3 h-3 mr-1" /> {payment.timestamp?.toDate ? payment.timestamp.toDate().toLocaleString() : 'Processing...'}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-black text-xl text-emerald-600">+{payment.amount} <span className="text-xs text-emerald-400">TK</span></div>
                  <div className="text-[10px] font-bold text-slate-400">({(payment.amount / (payment.owner === 'nobojit' ? 100 : 50)).toFixed(1)} APPS)</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Release Payment Modal */}
      <AnimatePresence>
        {isPaymentModalOpen && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden">
              <div className="flex justify-between items-center p-6 border-b border-slate-100">
                <h3 className="text-xl font-black text-slate-800">Issue Payment</h3>
                <button onClick={() => setIsPaymentModalOpen(false)} className="text-slate-400 hover:text-slate-600 bg-slate-50 p-2 rounded-full"><X className="w-5 h-5"/></button>
              </div>
              <form onSubmit={handleReleasePayment} className="p-6 space-y-5">
                <div>
                  <label className="block text-xs font-bold tracking-wider text-slate-500 uppercase mb-2">Select Payee</label>
                  <select value={paymentOwner} onChange={(e) => setPaymentOwner(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-semibold text-slate-800 capitalize">
                    <option value="shuvojit">Shuvojit</option>
                    <option value="nobojit">Nobojit</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold tracking-wider text-slate-500 uppercase mb-2 flex justify-between">
                    <span>Amount (TK)</span>
                    <span className="text-blue-600 font-medium">1 App = {paymentOwner === 'nobojit' ? '100' : '50'} TK</span>
                  </label>
                  <input type="number" required min="1" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} placeholder="0.00" className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-black text-2xl text-slate-800" />
                </div>
                <button type="submit" disabled={isSubmitting} className="w-full bg-slate-900 text-white py-3.5 rounded-xl font-bold hover:bg-slate-800 transition-colors shadow-md flex items-center justify-center disabled:opacity-50 mt-2">
                  {isSubmitting ? 'Processing...' : <><CheckCircle2 className="w-5 h-5 mr-2" /> Confirm Transfer</>}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}