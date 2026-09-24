/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable no-unused-vars */
import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  runTransaction,
  writeBatch,
} from 'firebase/firestore';
import { Edit2, ShieldAlert, X, CheckCircle2, LayoutGrid, List } from 'lucide-react';
import { motion } from 'framer-motion';

const PRICE_PER_APP = 50;

// Always a safe whole number >= 0
const safeInt = (v) => {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

export default function AdminTesters() {
  const [testers, setTesters] = useState([]);
  const [allApps, setAllApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingTester, setEditingTester] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [viewMode, setViewMode] = useState('grid');
  const [saving, setSaving] = useState(false);

  const [editLocked, setEditLocked] = useState(0);
  const [editWithdrawable, setEditWithdrawable] = useState(0);
  const [editTotalWithdrawn, setEditTotalWithdrawn] = useState(0);

  useEffect(() => {
    const unsubApps = onSnapshot(collection(db, 'apps'), (snapshot) => {
      setAllApps(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsubApps();
  }, []);

  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, 'users'), where('role', '==', 'tester'));
    const unsub = onSnapshot(q, (snapshot) => {
      setTesters(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Locked = unpaid apps with 12+ testers where THIS tester is in testerIds
  const getLockedForTester = (tester) =>
    allApps.filter((app) => {
      const ids = Array.isArray(app.testerIds) ? app.testerIds : [];
      return !app.isPaidByAdmin && ids.length >= 12 && ids.includes(tester.id);
    }).length * PRICE_PER_APP;

  const isTestedToday = (lastGoalMetDate) => {
    if (!lastGoalMetDate) return false;
    const today = new Date().toISOString().split('T')[0];
    return lastGoalMetDate === today;
  };

  const openEditModal = (tester) => {
    setEditingTester(tester);
    setEditLocked(getLockedForTester(tester));
    setEditWithdrawable(safeInt(tester.withdrawableBalance));
    setEditTotalWithdrawn(safeInt(tester.totalPaidAmount));
    setErrorMsg('');
  };

  const closeModal = () => {
    if (saving) return;
    setEditingTester(null);
    setErrorMsg('');
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (saving || !editingTester) return;
    setErrorMsg('');

    const newWithdrawable = safeInt(editWithdrawable);
    const newTotalWithdrawn = safeInt(editTotalWithdrawn);

    const ok = window.confirm(
      `Save changes for ${editingTester.name || 'this tester'}?\n\n` +
        `Withdrawable: ${safeInt(editingTester.withdrawableBalance)} -> ${newWithdrawable}\n` +
        `Total Withdrawn: ${safeInt(editingTester.totalPaidAmount)} -> ${newTotalWithdrawn}`
    );
    if (!ok) return;

    setSaving(true);

    try {
      const userRef = doc(db, 'users', editingTester.id);
      const logRef = doc(collection(db, 'adminEdits'));

      await runTransaction(db, async (tx) => {
        const snap = await tx.get(userRef);

        if (!snap.exists()) throw new Error('This user no longer exists.');
        const current = snap.data();
        if (current.role !== 'tester') throw new Error('This user is not a tester.');

        // Block save if balance changed while the modal was open
        if (
          safeInt(current.totalPaidAmount) !== safeInt(editingTester.totalPaidAmount) ||
          safeInt(current.withdrawableBalance) !== safeInt(editingTester.withdrawableBalance)
        ) {
          throw new Error('Balance changed while you were editing. Close and reopen.');
        }

        tx.update(userRef, {
          withdrawableBalance: newWithdrawable,
          totalPaidAmount: newTotalWithdrawn,
        });

        tx.set(logRef, {
          testerId: editingTester.id,
          testerName: editingTester.name || '',
          previousData: {
            withdrawable: safeInt(current.withdrawableBalance),
            totalPaid: safeInt(current.totalPaidAmount),
          },
          newData: {
            withdrawable: newWithdrawable,
            totalPaid: newTotalWithdrawn,
          },
          timestamp: new Date().toISOString(),
        });
      });

      setEditingTester(null);
    } catch (error) {
      console.error('Edit balance error:', error);
      setErrorMsg(error?.message || 'Database error during update.');
    } finally {
      setSaving(false);
    }
  };

  // ONE-TIME: sets withdrawableBalance for existing testers from the apps
  // that really contain their ID. Run once, then delete this function + its button.
  const migrateBalancesOnce = async () => {
    if (!window.confirm('Set every tester\'s withdrawable balance from paid apps they really installed? Run this ONCE only.')) return;
    try {
      const batch = writeBatch(db);
      testers.forEach((t) => {
        const paidApps = allApps.filter((a) => {
          if (!a.isPaidByAdmin) return false;
          const ids = Array.isArray(a.paidTesterIds) ? a.paidTesterIds : Array.isArray(a.testerIds) ? a.testerIds : [];
          return ids.includes(t.id);
        }).length;
        batch.update(doc(db, 'users', t.id), {
          withdrawableBalance: Math.max(0, paidApps * PRICE_PER_APP - safeInt(t.totalPaidAmount)),
        });
      });
      await batch.commit();
      alert('Done.');
    } catch (err) {
      alert('Migration failed: ' + err.message);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.05 } },
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0 },
  };

  return (
    <div className="flex flex-col max-w-7xl mx-auto w-full h-full">
      {/* Header and Controls */}
      <div className="flex justify-between items-center mb-6 mt-2 gap-2">
        <h2 className="text-xl font-black text-slate-800 tracking-tight hidden sm:block">Tester Directory</h2>
        <button
          onClick={migrateBalancesOnce}
          className="ml-auto px-3 py-2 text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-xl hover:bg-amber-100"
        >
          Run Migration (once)
        </button>
        <div className="bg-white border border-slate-100 rounded-xl flex p-1 shadow-sm shrink-0">
          <button onClick={() => setViewMode('grid')} className={`p-1.5 sm:p-2 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-blue-50 text-blue-600' : 'text-slate-400 hover:text-blue-500'}`}><LayoutGrid className="w-4 h-4 sm:w-5 sm:h-5" /></button>
          <button onClick={() => setViewMode('list')} className={`p-1.5 sm:p-2 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-blue-50 text-blue-600' : 'text-slate-400 hover:text-blue-500'}`}><List className="w-4 h-4 sm:w-5 sm:h-5" /></button>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex justify-center items-center text-blue-600">Loading Testers...</div>
      ) : (
        <motion.div variants={containerVariants} initial="hidden" animate="show" className={viewMode === 'grid' ? 'grid grid-cols-2 gap-3 sm:gap-4 overflow-y-auto pb-6 pr-2 scrollbar-hide' : 'flex flex-col gap-3 overflow-y-auto pb-6 pr-2 scrollbar-hide'}>
          {testers.map((tester) => {
            const activeToday = isTestedToday(tester.lastGoalMetDate);
            const withdrawableForTester = safeInt(tester.withdrawableBalance);
            const lockedBalanceForTester = getLockedForTester(tester);

            return (
              <motion.div variants={itemVariants} key={tester.id} className={`bg-white rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-all p-3 sm:p-4 relative group flex ${viewMode === 'list' ? 'flex-col sm:flex-row sm:items-center gap-3 sm:gap-4' : 'flex-col text-center'}`}>

                {/* Avatar & Info */}
                <div className={`flex flex-1 min-w-0 w-full ${viewMode === 'list' ? 'items-center text-left' : 'flex-col items-center pt-2'}`}>
                  <div className={`relative shrink-0 ${viewMode === 'list' ? 'mr-4' : 'mb-2 sm:mb-3'}`}>
                    <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full border-2 p-0.5 ${activeToday ? 'border-green-500' : 'border-red-500'}`}>
                      <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(tester.name || 'U')}&background=random`} alt="Profile" className="w-full h-full rounded-full" />
                    </div>
                    <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${activeToday ? 'bg-green-500' : 'bg-red-500'}`} />
                  </div>
                  <div className="flex-1 overflow-hidden w-full">
                    <h3 className="font-bold text-gray-900 truncate text-sm sm:text-base" title={tester.name}>{tester.name || 'Unknown'}</h3>
                    <p className="text-[9px] sm:text-[11px] text-gray-500 truncate mt-0.5 font-medium">{tester.email}</p>
                    <span className="inline-block mt-1 bg-slate-100 text-slate-600 text-[9px] sm:text-[10px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider">App v{tester.appVersion || 'N/A'}</span>
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
                    <span className="font-bold text-blue-600 text-xs sm:text-sm">{safeInt(tester.totalPaidAmount)}</span>
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-bold text-gray-900">Edit Balance: {editingTester.name}</h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
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
                <input type="number" readOnly value={editLocked} className="w-full px-3 py-2 border border-gray-200 bg-gray-50 text-gray-500 rounded-lg outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Withdrawable Balance (TK)</label>
                <input
                  type="number"
                  required
                  min="0"
                  value={editWithdrawable}
                  onChange={(e) => setEditWithdrawable(safeInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Total Withdrawn (TK)</label>
                <input
                  type="number"
                  required
                  min="0"
                  value={editTotalWithdrawn}
                  onChange={(e) => setEditTotalWithdrawn(safeInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:border-blue-500"
                />
                <p className="text-xs text-gray-500 mt-2 leading-tight">
                  Withdrawable grows only when an admin pays an app the tester installed. These two fields are edited separately.
                </p>
              </div>

              <div className="mt-6 flex justify-end gap-3 border-t pt-4">
                <button type="button" onClick={closeModal} disabled={saving} className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50">Cancel</button>
                <button type="submit" disabled={saving} className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 flex items-center disabled:opacity-50">
                  <CheckCircle2 className="w-4 h-4 mr-2" /> {saving ? 'Saving...' : 'Save Balance'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}