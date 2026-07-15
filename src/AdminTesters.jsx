/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable no-unused-vars */
import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, addDoc } from 'firebase/firestore';
import { Edit2, ShieldAlert, X, CheckCircle2, LayoutGrid, List } from 'lucide-react';
import { motion } from 'framer-motion';

export default function AdminTesters() {
  const [testers, setTesters] = useState([]);
  const [allApps, setAllApps] = useState([]);
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
  const NEW_LOGIC_CUTOFF_DATE = new Date('2026-07-14T00:00:00Z');

  // Fetch global app stats to calculate identical locked balance & y factor
  useEffect(() => {
    const unsubApps = onSnapshot(collection(db, 'apps'), (snapshot) => {
      const appsData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setAllApps(appsData);
      let lockedAppCount = 0;
      let paidAppCount = 0;
      
      for (const app of appsData) {
        const pName = typeof app.packageName === 'string' ? app.packageName.trim() : '';
        const aName = typeof app.appName === 'string' ? app.appName.trim() : '';
        if (!pName || !aName) continue;

        if (app.isPaidByAdmin) {
          paidAppCount++;
        } else {
          const testerCount = app.testerIds?.length || 0;
          
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
    
    const totalWithdrawn = tester.totalPaidAmount || 0;
    const isNewTester = tester.createdAt?.toDate() >= NEW_LOGIC_CUTOFF_DATE;
    let withdrawable;

    if (isNewTester) {
      // New Logic: Per-tester calculation
      const xAmountForTester = (tester.totalAppsPaid || 0) * 50;
      withdrawable = Math.max(0, xAmountForTester - totalWithdrawn);
    } else {
      // Old Logic: Global calculation
      withdrawable = Math.max(0, (globalPaidAppsCount * 50) - (tester.totalPaidAmount || 0));
    }

    // Re-calculate the locked balance for this specific tester to ensure it's up-to-date, matching the card.
    const lockedAppCountForTester = allApps.filter(app => {
      const testerCount = app.testerIds?.length || 0;
      const hasTested = app.testerIds?.includes(tester.id);
      return !app.isPaidByAdmin && testerCount >= 12 && hasTested;
    }).length;
    const lockedBalanceForTester = lockedAppCountForTester * 50;

    setEditLocked(lockedBalanceForTester);
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
          withdrawableBalance: newWithdrawable,
          totalPaidAmount: newTotalWithdrawn
        });
        
        // Log to history for accountability
        await addDoc(collection(db, 'adminEdits'), {
          testerId: editingTester.id,
          testerName: editingTester.name,
          previousData: {
            withdrawable: editingTester.withdrawableBalance || 0,
            totalPaid: editingTester.totalPaidAmount || 0
          },
          newData: {
            withdrawable: newWithdrawable,
            totalPaid: newTotalWithdrawn
          },
          timestamp: new Date().toISOString()
        });

      setEditingTester(null);
    } catch (error) {
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
    <div className="flex flex-col max-w-7xl mx-auto w-full h-full">

      {/* Header and Controls */}
      <div className="flex justify-between items-center mb-6 mt-2">
        <h2 className="text-xl font-black text-slate-800 tracking-tight hidden sm:block">Tester Directory</h2>
        <div className="bg-white border border-slate-100 rounded-xl flex p-1 shadow-sm shrink-0 ml-auto">
          <button onClick={() => setViewMode('grid')} className={`p-1.5 sm:p-2 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-blue-50 text-blue-600' : 'text-slate-400 hover:text-blue-500'}`}><LayoutGrid className="w-4 h-4 sm:w-5 sm:h-5" /></button>
          <button onClick={() => setViewMode('list')} className={`p-1.5 sm:p-2 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-blue-50 text-blue-600' : 'text-slate-400 hover:text-blue-500'}`}><List className="w-4 h-4 sm:w-5 sm:h-5" /></button>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex justify-center items-center text-blue-600">Loading Testers...</div>
      ) : (
        <motion.div variants={containerVariants} initial="hidden" animate="show" className={viewMode === 'grid' ? "grid grid-cols-2 gap-3 sm:gap-4 overflow-y-auto pb-6 pr-2 scrollbar-hide" : "flex flex-col gap-3 overflow-y-auto pb-6 pr-2 scrollbar-hide"}>
          {testers.map((tester) => {
            const activeToday = isTestedToday(tester.lastGoalMetDate);
            
            const isNewTester = tester.createdAt?.toDate() >= NEW_LOGIC_CUTOFF_DATE;

            let withdrawableForTester;
            if (isNewTester) {
              // New Logic: Per-tester calculation
              const xAmountForTester = (tester.totalAppsPaid || 0) * 50;
              withdrawableForTester = Math.max(0, xAmountForTester - (tester.totalPaidAmount || 0));
            } else {
              // Old Logic: Global calculation
              withdrawableForTester = Math.max(0, (globalPaidAppsCount * 50) - (tester.totalPaidAmount || 0));
            }

            // Calculate locked balance PER TESTER based on the new logic
            const lockedAppCountForTester = allApps.filter(app => {
              const testerCount = app.testerIds?.length || 0;
              const hasTested = app.testerIds?.includes(tester.id);
              // App is "locked" for this tester if it's not paid, has 12+ testers, and they installed it.
              return !app.isPaidByAdmin && testerCount >= 12 && hasTested;
            }).length;
            const lockedBalanceForTester = lockedAppCountForTester * 50;
            
            return (
              <motion.div variants={itemVariants} key={tester.id} className={`bg-white rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-all p-3 sm:p-4 relative group flex ${viewMode === 'list' ? 'flex-col sm:flex-row sm:items-center gap-3 sm:gap-4' : 'flex-col text-center'}`}>
                
                {/* Avatar & Info */}
                <div className={`flex flex-1 min-w-0 w-full ${viewMode === 'list' ? 'items-center text-left' : 'flex-col items-center pt-2'}`}>
                  <div className={`relative shrink-0 ${viewMode === 'list' ? 'mr-4' : 'mb-2 sm:mb-3'}`}>
                    <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full border-2 p-0.5 ${activeToday ? 'border-green-500' : 'border-red-500'}`}>
                      <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(tester.name)}&background=random`} alt="Profile" className="w-full h-full rounded-full" />
                    </div>
                    <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${activeToday ? 'bg-green-500' : 'bg-red-500'}`} />
                  </div>
                  <div className="flex-1 overflow-hidden w-full">
                    <h3 className="font-bold text-gray-900 truncate text-sm sm:text-base" title={tester.name}>{tester.name || "Unknown"}</h3>
                    <p className="text-[9px] sm:text-[11px] text-gray-500 truncate mt-0.5 font-medium">{tester.email}</p>
                    <span className="inline-block mt-1 bg-slate-100 text-slate-600 text-[9px] sm:text-[10px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider">App v{tester.appVersion || "N/A"}</span>
                  </div>
                </div>

                {/* Balances Grid */}
                <div className={`grid grid-cols-3 gap-2 w-full ${viewMode === 'grid' ? 'my-3' : 'mt-3 sm:mt-0 sm:w-[280px] shrink-0'}`}>
                  <div className="bg-blue-50/50 p-2 rounded-lg border border-blue-100/50 text-center">
                    <span className="text-[9px] sm:text-[10px] text-gray-500 mb-0.5 uppercase font-bold block truncate">Locked</span>
                    <span className="font-bold text-blue-900 text-xs sm:text-sm">{lockedBalanceForTester}</span>
                  </div>
                  <div className="bg-blue-50/50 p-2 rounded-lg border border-blue-100/50 text-center">
                    <span className="text-[9px] sm:text-[10px] text-gray-500 mb-0.5 uppercase font-bold block truncate">Withdrawable</span>
                    <span className="font-bold text-emerald-600 text-xs sm:text-sm">{withdrawableForTester}</span>
                  </div>
                  <div className="bg-blue-50/50 p-2 rounded-lg border border-blue-100/50 text-center">
                    <span className="text-[9px] sm:text-[10px] text-gray-500 mb-0.5 uppercase font-bold block truncate">Paid</span>
                    <span className="font-bold text-blue-600 text-xs sm:text-sm">{tester.totalPaidAmount || 0}</span>
                  </div>
                </div>

                {/* Action */}
                <div className={`flex gap-2 sm:gap-3 ${viewMode === 'list' ? 'sm:w-auto sm:ml-auto mt-3 sm:mt-0' : 'w-full mt-auto pt-2'}`}>
                  <button onClick={() => openEditModal(tester)} className="w-full flex-1 border border-slate-200 text-slate-600 bg-slate-50 py-2 sm:py-2.5 px-2 rounded-xl text-[11px] sm:text-xs font-semibold hover:bg-slate-100 flex justify-center items-center transition-colors" title="Edit Balances">
                    <Edit2 className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-1" /> <span className={viewMode === 'grid' ? 'hidden sm:inline' : 'hidden md:inline'}>Edit</span>
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