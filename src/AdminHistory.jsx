/* eslint-disable no-unused-vars */
import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { Search, ChevronDown, ChevronUp, Clock, CheckCircle } from 'lucide-react';
import { motion } from 'framer-motion';

export default function AdminHistory() {
  const [requests, setRequests] = useState([]);
  const [usersDict, setUsersDict] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [globalPaidAppsCount, setGlobalPaidAppsCount] = useState(0);

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

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-blue-900">Tester Withdrawal Profiles</h2>
          <p className="text-sm font-semibold text-slate-500 mt-1">Total System Withdrawn: <span className="font-black text-emerald-600">{systemTotalWithdrawn} TK</span></p>
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
                      <div className={`px-3 py-1 rounded-md text-[10px] sm:text-xs font-bold flex items-center border ${req.status === 'paid' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : req.status === 'declined' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                        {req.status === 'paid' && <CheckCircle className="w-3 h-3 mr-1.5" />}
                        {req.status.toUpperCase()}
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
    </div>
  );
}