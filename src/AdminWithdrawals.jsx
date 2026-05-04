/* eslint-disable no-unused-vars */
import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, increment } from 'firebase/firestore';
import { CheckCircle, XCircle, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function AdminWithdrawals() {
  const [requests, setRequests] = useState([]);
  const [usersDict, setUsersDict] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, 'withdrawRequests'), orderBy('requestedAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const allRequests = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const pendingRequests = allRequests.filter(req => req.status === 'pending' || req.status === 'requested' || req.status === 'Pending' || !req.status);
      setRequests(pendingRequests);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Real-time listen to users mapping to fetch names by testerId
  useEffect(() => {
    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      const dict = {};
      snap.docs.forEach(d => { dict[d.id] = d.data(); });
      setUsersDict(dict);
    });
    return () => unsubUsers();
  }, []);

  const handleAction = async (req, status) => {
    try {
      if (status === 'paid') {
        // Deduct from tester balances to enforce integrity
        const testerRef = doc(db, 'users', req.testerId);
        await updateDoc(testerRef, {
          paidAmount: increment(-req.amount),
          withdrawableBalance: increment(-req.amount),
          totalPaidAmount: increment(req.amount)
        });

        // Mark request as paid
        await updateDoc(doc(db, 'withdrawRequests', req.id), { 
          status: 'paid',
          paidAt: new Date()
        });
      } else {
        await updateDoc(doc(db, 'withdrawRequests', req.id), { status: 'declined' });
      }
    } catch (error) {
      console.error("Error updating status:", error);
    }
  };

  if (loading) return <div className="p-8 text-blue-600">Loading requests...</div>;

  const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.05 } }
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <div className="p-4 md:p-8">
      <h2 className="text-2xl font-bold text-blue-900 mb-6">Withdrawal Requests</h2>
      
      {requests.length === 0 ? (
        <div className="text-center text-slate-500 bg-white p-10 rounded-2xl border border-slate-100 shadow-sm">
          No pending withdrawal requests at the moment.
        </div>
      ) : (
        <motion.div variants={containerVariants} initial="hidden" animate="show" className="flex flex-col gap-4">
          {requests.map(req => (
            <motion.div variants={itemVariants} key={req.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:shadow-md transition-shadow">
              <div>
                <h3 className="font-black text-lg text-slate-800">{usersDict[req.testerId]?.name || req.testerName || "Unknown Tester"}</h3>
                <div className="flex items-center text-xs font-semibold text-slate-500 mt-1 uppercase tracking-wider">
                  <Clock className="w-3.5 h-3.5 mr-1.5" />
                  {req.requestedAt?.toDate ? req.requestedAt.toDate().toLocaleString() : new Date(req.requestedAt).toLocaleString()}
                </div>
              </div>
              <div className="text-2xl font-black text-emerald-600">{req.amount} <span className="text-sm font-bold text-emerald-400">TK</span></div>
              
              <div className="flex flex-wrap gap-3 w-full md:w-auto mt-2 md:mt-0">
                <button onClick={() => handleAction(req, 'paid')} className="flex-1 md:flex-none px-5 py-2.5 min-h-[44px] bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white rounded-xl transition-all font-bold flex justify-center items-center shadow-sm">
                  <CheckCircle className="w-4 h-4 mr-2" /> Accept
                </button>
                <button onClick={() => handleAction(req, 'declined')} className="flex-1 md:flex-none px-5 py-2.5 min-h-[44px] bg-red-50 text-red-600 hover:bg-red-600 hover:text-white rounded-xl transition-all font-bold flex justify-center items-center shadow-sm">
                  <XCircle className="w-4 h-4 mr-2" /> Decline
                </button>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}