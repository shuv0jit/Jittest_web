/* eslint-disable no-unused-vars */
import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, onSnapshot, query, orderBy, doc, setDoc, updateDoc } from 'firebase/firestore';
import { Search, ChevronDown, ChevronUp, Clock, CheckCircle, Edit2, X, ShieldAlert } from 'lucide-react';
import { motion } from 'framer-motion';

export default function AdminHistory() {
  const [requests, setRequests] = useState([]);
  const [usersDict, setUsersDict] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [globalPaidAppsCount, setGlobalPaidAppsCount] = useState(0);
  const [manualSystemTotal, setManualSystemTotal] = useState(null);
  const [isTotalEditModalOpen, setIsTotalEditModalOpen] = useState(false);
  const [editSystemTotalValue, setEditSystemTotalValue] = useState('');
  
  const [editingRequest, setEditingRequest] = useState(null);
  const [editReqAmount, setEditReqAmount] = useState(0);
  const [editReqStatus, setEditReqStatus] = useState('');

  // Real-time listen to manual override for system total
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'systemSettings', 'totals'), (docSnap) => {
      if (docSnap.exists() && docSnap.data().manualTotalSystemWithdrawn !== undefined && docSnap.data().manualTotalSystemWithdrawn !== null) {
        setManualSystemTotal(docSnap.data().manualTotalSystemWithdrawn);
      } else {
        setManualSystemTotal(null);
      }
    });
    return () => unsub();
  }, []);

  // Real-time listen to global apps for math logic
  useEffect(() => {
    const unsubApps = onSnapshot(collection(db, 'apps'), (snapshot) => {
      let paidAppCount = 0;
      snapshot.docs.forEach(doc => {
        const app = doc.data();
        const pName = typeof app.packageName === 'string' ? app.packageName.trim() : '';
        const aName = typeof app.appName === 'string' ? app.appName.trim() : '';
        if (pName && aName && app.isPaidByAdmin) {
          paidAppCount++;
        }
      });
      setGlobalPaidAppsCount(paidAppCount);
    });
    return () => unsubApps();
  }, []);

  // Real-time listen to users mapping
  useEffect(() => {
    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      const dict = {};
      snap.docs.forEach(d => { dict[d.id] = d.data(); });
      setUsersDict(dict);
    });
    return () => unsubUsers();
  }, []);

  // Real-time listen to withdrawRequests
  useEffect(() => {
    const q = query(collection(db, 'withdrawRequests'), orderBy('requestedAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setRequests(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Group data dynamically
  const groupedData = React.useMemo(() => {
    const groups = {};
    requests.forEach(req => {
        const tId = req.testerId;
        if (!groups[tId]) {
          groups[tId] = {
            testerId: tId,
            testerName: usersDict[tId]?.name || req.testerName || 'Unknown Tester',
            totalWithdrawn: 0,
            requests: []
          };
        }
        groups[tId].requests.push(req);
        if (req.status === 'paid') {
          groups[tId].totalWithdrawn += Number(req.amount) || 0;
        }
      });
      
    return Object.values(groups);
  }, [requests, usersDict]);

  const handleTotalEditSubmit = async (e) => {
    e.preventDefault();
    const val = editSystemTotalValue === '' ? null : Number(editSystemTotalValue);
    await setDoc(doc(db, 'systemSettings', 'totals'), { manualTotalSystemWithdrawn: val }, { merge: true });
    setIsTotalEditModalOpen(false);
  };

  const openRequestEditModal = (req) => {
    setEditingRequest(req);
    setEditReqAmount(req.amount);
    setEditReqStatus(req.status);
  };

  const handleRequestEditSubmit = async (e) => {
    e.preventDefault();
    try {
      await updateDoc(doc(db, 'withdrawRequests', editingRequest.id), {
        amount: Number(editReqAmount),
        status: editReqStatus
      });
      setEditingRequest(null);
    } catch (err) {
    }
  };

  const filteredData = groupedData.filter(g => 
    (g.testerName || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <div className="p-8 text-blue-600 font-bold animate-pulse">Loading withdrawal history...</div>;

  const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.05 } }
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0 }
  };

  // Calculate Total System Withdrawn dynamically across all testers (Total Paid Addition)
  const systemTotalWithdrawn = Object.values(usersDict).reduce((sum, user) => {
    if (user.role === 'tester') {
      const withdrawable = user.withdrawableBalance || 0;
      return sum + Math.max(0, (globalPaidAppsCount * 50) - withdrawable);
    }
    return sum;
  }, 0);
  
  const displayTotal = manualSystemTotal !== null ? manualSystemTotal : systemTotalWithdrawn;

  return (
    <div className="p-4 md:p-8 h-full flex flex-col">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-blue-900">Tester Withdrawal Profiles</h2>
          <p className="text-sm font-semibold text-slate-500 mt-1 flex items-center">
            Total System Withdrawn: <span className="font-black text-emerald-600 ml-1">{displayTotal} TK</span>
            <button onClick={() => { setEditSystemTotalValue(displayTotal); setIsTotalEditModalOpen(true); }} className="ml-2 text-slate-400 hover:text-blue-600 transition-colors p-1 bg-slate-100 hover:bg-blue-50 rounded-md" title="Edit Total System Withdrawn">
              <Edit2 className="w-3.5 h-3.5" />
            </button>
          </p>
        </div>
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input type="text" placeholder="Search tester name..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-3 min-h-[44px] border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-sm" />
        </div>
      </div>

      {filteredData.length === 0 ? <div className="p-10 text-center text-slate-500 bg-white rounded-2xl border border-slate-100 shadow-sm font-medium">No withdrawal history found.</div> : (
        <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-4">
          {filteredData.map(group => (
          <motion.div variants={itemVariants} key={group.testerId} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden transition-all">
            {/* Header / Summary */}
            <div 
              onClick={() => setExpandedId(expandedId === group.testerId ? null : group.testerId)}
              className="p-6 cursor-pointer hover:bg-slate-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center text-blue-600 font-bold text-lg border border-blue-100">
                  {group.testerName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-black text-slate-800 text-lg">{group.testerName}</h3>
                  <p className="text-xs font-semibold text-slate-500 mt-0.5">{group.requests.length} Total Requests</p>
                </div>
              </div>
              
              <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-6 border-t sm:border-0 pt-3 sm:pt-0">
                <div className="text-left sm:text-right">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Total Withdrawn</p>
                  <p className="font-black text-2xl text-emerald-600">{group.totalWithdrawn} <span className="text-sm text-emerald-400 font-medium">TK</span></p>
                </div>
                <button className="text-slate-400 p-2 hover:bg-slate-200 rounded-full transition-colors">
                  {expandedId === group.testerId ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Expanded Detailed List */}
            {expandedId === group.testerId && (
              <div className="bg-slate-50 border-t border-slate-100 px-4 py-5 sm:p-6">
                <div className="space-y-3">
                  {group.requests.map(req => (
                    <div key={req.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-white border border-slate-100 rounded-xl shadow-sm gap-3">
                      <div>
                        <div className="font-black text-slate-800 text-lg">{req.amount} <span className="text-xs font-semibold text-slate-400">TK</span></div>
                        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 flex items-center mt-1">
                          <Clock className="w-3.5 h-3.5 mr-1.5" />
                          {req.requestedAt?.toDate ? req.requestedAt.toDate().toLocaleString() : new Date(req.requestedAt).toLocaleString()}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={`px-3 py-1 rounded-md text-[10px] sm:text-xs font-bold flex items-center border ${req.status === 'paid' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : req.status === 'declined' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                          {req.status === 'paid' && <CheckCircle className="w-3 h-3 mr-1.5" />}
                          {req.status.toUpperCase()}
                        </div>
                        <button onClick={() => openRequestEditModal(req)} className="p-1.5 text-slate-400 hover:text-blue-600 bg-slate-100 hover:bg-blue-50 rounded-lg transition-colors border border-slate-200" title="Edit Request">
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        ))}
        </motion.div>
      )}

      {/* Total System Withdrawn Edit Modal */}
      {isTotalEditModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-bold text-slate-800">Edit Total System Withdrawn</h3>
              <button onClick={() => setIsTotalEditModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="bg-red-50 border border-red-100 p-4 rounded-xl mb-5 flex items-start">
              <ShieldAlert className="w-5 h-5 text-red-500 mr-3 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-red-700 uppercase tracking-wider mb-1">Danger Zone</p>
                <p className="text-xs font-medium text-red-600 leading-relaxed">STRICT WARNING: Do not edit this unless you absolutely need to manually override the system total. Admins are strictly advised NOT to use this.</p>
              </div>
            </div>
            <form onSubmit={handleTotalEditSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Override Amount (TK) <span className="lowercase text-gray-400 font-normal">(Leave empty to reset to auto-calc)</span></label>
                <input 
                  type="number" 
                  value={editSystemTotalValue} 
                  onChange={(e) => setEditSystemTotalValue(e.target.value)} 
                  className="w-full px-4 py-3 border border-red-200 bg-red-50/30 text-red-900 font-bold rounded-xl outline-none focus:border-red-500 focus:ring-2 focus:ring-red-200 transition-all" 
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setIsTotalEditModalOpen(false)} className="px-4 py-2 text-slate-600 bg-slate-100 rounded-xl font-bold hover:bg-slate-200 transition-colors">Cancel</button>
                <button type="submit" className="px-4 py-2 text-white bg-red-600 rounded-xl font-bold hover:bg-red-700 transition-colors">Save Override</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Single Request Edit Modal */}
      {editingRequest && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-bold text-slate-800">Edit History Record</h3>
              <button onClick={() => setEditingRequest(null)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleRequestEditSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Amount (TK)</label>
                <input type="number" required value={editReqAmount} onChange={(e) => setEditReqAmount(e.target.value)} className="w-full px-4 py-3 border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all font-semibold" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Status</label>
                <select value={editReqStatus} onChange={(e) => setEditReqStatus(e.target.value)} className="w-full px-4 py-3 border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all font-semibold bg-white">
                  <option value="pending">Pending</option>
                  <option value="paid">Paid</option>
                  <option value="declined">Declined</option>
                </select>
              </div>
              <p className="text-xs text-amber-600 font-medium bg-amber-50 p-3 rounded-lg border border-amber-100">Warning: Editing this record will change the tester's total withdrawn sum in the system history page.</p>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setEditingRequest(null)} className="px-4 py-2 text-slate-600 bg-slate-100 rounded-xl font-bold hover:bg-slate-200 transition-colors">Cancel</button>
                <button type="submit" className="px-4 py-2 text-white bg-blue-600 rounded-xl font-bold hover:bg-blue-700 transition-colors">Update Record</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}