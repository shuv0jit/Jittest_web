/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable no-unused-vars */
import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, addDoc } from 'firebase/firestore';
import { Edit2, ShieldAlert, X, CheckCircle2, LayoutGrid, List } from 'lucide-react';
import { motion } from 'framer-motion';

export default function AdminTesters() {
  const [testers, setTesters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingTester, setEditingTester] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [viewMode, setViewMode] = useState('grid');
  
  const [editLocked, setEditLocked] = useState(0);
  const [editWithdrawable, setEditWithdrawable] = useState(0);
  const [editTotalWithdrawn, setEditTotalWithdrawn] = useState(0);
  
  // Global Application Stats
  const [globalLockedBalance, setGlobalLockedBalance] = useState(0);
  const [globalPaidAppsCount, setGlobalPaidAppsCount] = useState(0);

  // Fetch global app stats to calculate identical locked balance & y factor
  useEffect(() => {
    const unsubApps = onSnapshot(collection(db, 'apps'), (snapshot) => {
      const allApps = snapshot.docs.map(d => d.data());
      let lockedAppCount = 0;
      let paidAppCount = 0;
      
      for (const app of allApps) {
        const pName = typeof app.packageName === 'string' ? app.packageName.trim() : '';
        const aName = typeof app.appName === 'string' ? app.appName.trim() : '';
        if (!pName || !aName) continue;
        
        if (app.isPaidByAdmin) {
          paidAppCount++;
        } else {
          const testerCount = Math.max(app.testerIds?.length || 0, app.installedCount || 0);
          
          // Locked Balance = Ongoing + Production Phase (Apps with 12+ testers)
          if (testerCount >= 12) {
            lockedAppCount++;
          }
        }
      }
      setGlobalLockedBalance(lockedAppCount * 50);
      setGlobalPaidAppsCount(paidAppCount);
    });
    return () => unsubApps();
  }, []);

  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, 'users'), where("role", "==", "tester"));
    const unsub = onSnapshot(q, (snapshot) => {
      setTesters(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const isTestedToday = (lastGoalMetDate) => {
    if (!lastGoalMetDate) return false;
    const today = new Date().toISOString().split('T')[0];
    return lastGoalMetDate === today;
  };

  const openEditModal = (tester) => {
    setEditingTester(tester);
    
    const withdrawable = tester.withdrawableBalance || 0;
    const totalWithdrawn = Math.max(0, (globalPaidAppsCount * 50) - withdrawable);

    setEditLocked(globalLockedBalance); // Locked is globally consistent
    setEditWithdrawable(withdrawable);
    setEditTotalWithdrawn(totalWithdrawn);
    setErrorMsg('');
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    const newLocked = Number(editLocked);
    const newWithdrawable = Number(editWithdrawable);
    const newTotalWithdrawn = Number(editTotalWithdrawn);

    try {
        // Execute real DB write
        await updateDoc(doc(db, 'users', editingTester.id), {
          lockedBalance: newLocked,
          withdrawableBalance: newWithdrawable,
          totalPaidAmount: newTotalWithdrawn
        });
        
        // Log to history for accountability
        await addDoc(collection(db, 'adminEdits'), {
          testerId: editingTester.id,
          testerName: editingTester.name,
          previousData: {
            locked: editingTester.lockedBalance || globalLockedBalance,
            withdrawable: editingTester.withdrawableBalance || 0,
            totalPaid: editingTester.totalPaidAmount || 0
          },
          newData: {
            locked: newLocked,
            withdrawable: newWithdrawable,
            totalPaid: newTotalWithdrawn
          },
          timestamp: new Date().toISOString()
        });

      setEditingTester(null);
    } catch (error) {
      console.error("Error updating balance:", error);
      setErrorMsg("Database error during update.");
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.05 } }
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <div className="p-4 md:p-8 h-full flex flex-col">
      
      {/* View Mode Toggle */}
      <div className="flex justify-between items-end mb-4">
        <h3 className="text-lg font-black text-slate-800 tracking-tight">Tester Directory</h3>
        <div className="bg-white border border-slate-200 rounded-lg flex p-1 shadow-sm shrink-0">
          <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-blue-50 text-blue-600' : 'text-slate-400 hover:text-blue-500'}`}><LayoutGrid className="w-4 h-4" /></button>
          <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-blue-50 text-blue-600' : 'text-slate-400 hover:text-blue-500'}`}><List className="w-4 h-4" /></button>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex justify-center items-center text-blue-600">Loading Testers...</div>
      ) : (
        <motion.div variants={containerVariants} initial="hidden" animate="show" className={viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6 overflow-y-auto pb-6 pr-2 scrollbar-hide" : "flex flex-col gap-4 overflow-y-auto pb-6 pr-2 scrollbar-hide"}>
          {testers.map((tester) => {
            const activeToday = isTestedToday(tester.lastGoalMetDate);
            
            // Dynamically Calculate Financials for this tester
            const withdrawable = tester.withdrawableBalance || 0;
            const yAmount = globalPaidAppsCount * 50;
            const calculatedTotalWithdrawn = Math.max(0, yAmount - withdrawable);
            
            return (
              <motion.div variants={itemVariants} key={tester.id} className={`bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex relative hover:shadow-md transition-shadow gap-6 ${viewMode === 'list' ? 'flex-col lg:flex-row lg:items-center justify-between' : 'flex-col justify-between'}`}>
                
                {/* Avatar & Info (Left) */}
                <div className={`flex items-center gap-4 w-full ${viewMode === 'list' ? 'lg:w-auto' : ''}`}>
                  <div className="relative shrink-0">
                    <div className={`w-14 h-14 rounded-full border-2 p-0.5 ${activeToday ? 'border-green-500' : 'border-red-500'}`}>
                      <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(tester.name)}&background=random`} alt="Profile" className="w-full h-full rounded-full" />
                    </div>
                    <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${activeToday ? 'bg-green-500' : 'bg-red-500'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-black text-lg text-slate-800 truncate" title={tester.name}>{tester.name || "Unknown"}</h3>
                    <p className="text-xs font-semibold text-slate-500 mt-0.5 truncate">{tester.email}</p>
                    <span className="inline-block mt-1 bg-slate-100 text-slate-600 text-[10px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider">App v{tester.appVersion || "N/A"}</span>
                  </div>
                </div>

                {/* Balances Grid (Middle) */}
                <div className={`grid grid-cols-3 gap-4 w-full bg-slate-50/50 p-4 rounded-xl border border-slate-100 ${viewMode === 'list' ? 'lg:flex-1 lg:max-w-xl' : ''}`}>
                  <div>
                    <span className="text-gray-500 block text-xs">Locked Balance</span>
                    <span className="font-black text-base text-slate-800">{globalLockedBalance} <span className="text-xs text-slate-400 font-medium">TK</span></span>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-xs">Withdrawable</span>
                    <span className="font-black text-base text-emerald-600">{withdrawable} <span className="text-xs text-emerald-400 font-medium">TK</span></span>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-xs">Total Paid</span>
                    <span className="font-black text-base text-blue-600">{calculatedTotalWithdrawn} <span className="text-xs text-blue-400 font-medium">TK</span></span>
                  </div>
                </div>

                {/* Action (Right) */}
                <div className={`absolute top-4 right-4 ${viewMode === 'list' ? 'lg:relative lg:top-0 lg:right-0' : ''}`}>
                  <button onClick={() => openEditModal(tester)} className="text-blue-500 hover:text-white bg-blue-50 hover:bg-blue-600 p-2.5 rounded-xl transition-colors shadow-sm" title="Edit Balances">
                    <Edit2 className="w-5 h-5" />
                  </button>
                </div>

              </motion.div>
            );
          })}
        </motion.div>
      )}

      {/* Edit Balance Modal */}
      {editingTester && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-bold text-gray-900">Edit Balance: {editingTester.name}</h3>
              <button onClick={() => setEditingTester(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            
            {errorMsg && (
              <div className="mb-4 bg-red-50 text-red-600 p-3 rounded-lg text-sm flex items-start">
                <ShieldAlert className="w-5 h-5 mr-2 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}
            
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Locked Balance (TK)</label>
                <input 
                  type="number" required value={editLocked} 
                  onChange={(e) => setEditLocked(e.target.value)} 
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:border-blue-500" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Withdrawable Balance (TK)</label>
                <input 
                  type="number" required value={editWithdrawable} 
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setEditWithdrawable(val);
                    setEditTotalWithdrawn(Math.max(0, globalPaidAppsCount * 50 - val));
                  }} 
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:border-blue-500" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Total Withdrawn (TK)</label>
                <input 
                  type="number" required value={editTotalWithdrawn} 
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setEditTotalWithdrawn(val);
                    setEditWithdrawable(Math.max(0, globalPaidAppsCount * 50 - val));
                  }} 
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:border-blue-500" 
                />
                <p className="text-xs text-gray-500 mt-2 leading-tight">Withdrawable and Total Withdrawn automatically adjust each other to maintain precision with the (Paid Apps × 50) platform rule.</p>
              </div>

              <div className="mt-6 flex justify-end gap-3 border-t pt-4">
                <button type="button" onClick={() => setEditingTester(null)} className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
                <button type="submit" className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 flex items-center"><CheckCircle2 className="w-4 h-4 mr-2" /> Save Balance</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}