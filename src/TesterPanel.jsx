/* eslint-disable no-unused-vars */
import React, { useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { db } from './firebase';
import { doc, getDoc, collection, onSnapshot, query, where } from 'firebase/firestore';
import { Wallet, User, LogOut, CheckCircle2, PlaySquare, ArrowRight, Menu, Bell } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import TesterApps from './TesterApps';
import TesterSidebar from './TesterSidebar';
import WithdrawalHistory from './WithdrawalHistory';
import TesterNotifications from './TesterNotifications';

export default function TesterPanel() {
  const { logout, currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState('apps');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [testerData, setTesterData] = useState(null);
  const [totalTestedCount, setTotalTestedCount] = useState(0);
  const [lockedBalance, setLockedBalance] = useState(0);
  const [paidAppsCount, setPaidAppsCount] = useState(0);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      if (!currentUser) return;
      
      // Fetch Tester Profile
      const userRef = doc(db, 'users', currentUser.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        setTesterData(userSnap.data());
      }
    };
    fetchData();
  }, [currentUser]);

  // Fetch Tester Notifications
  useEffect(() => {
    if (!currentUser) return;
    const q = query(collection(db, 'testerNotifications'), where('testerId', '==', currentUser.uid));
    const unsubNotifs = onSnapshot(q, (snapshot) => {
      setNotifications(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsubNotifs();
  }, [currentUser]);

  // Real-time calculation: Total Tested Apps = Install + Ongoing + Production + Paid
  useEffect(() => {
    if (!currentUser) return;
    const unsubApps = onSnapshot(collection(db, 'apps'), (snapshot) => {
      const allApps = snapshot.docs.map(d => d.data());
      let count = 0;
      let eligibleCount = 0;
      let pCount = 0;

      for (const app of allApps) {
        try {
          const pName = typeof app.packageName === 'string' ? app.packageName.trim() : '';
          const aName = typeof app.appName === 'string' ? app.appName.trim() : '';
          
          // Skip apps without a valid name or package (do not count them anywhere)
          if (!pName || !aName) {
            continue;
          }

          const hasTested = Array.isArray(app.testerIds) ? app.testerIds.includes(currentUser.uid) : false;

          if (app.isPaidByAdmin) {
            count++;
            pCount++; // Count all apps directly sent to paid section
            continue;
          }
          
          const testerCount = Math.max(Array.isArray(app.testerIds) ? app.testerIds.length : 0, app.installedCount || 0);
          
          // Locked Balance = Ongoing + Production Phase (Apps with 12+ testers)
          if (testerCount >= 12) {
            count++;
            eligibleCount++;
            continue;
          }
          
          count++;
        } catch(err) {
          // Silently ignore to prevent render crashes
        }
      }
      setTotalTestedCount(count);
      setLockedBalance(eligibleCount * 50);
      setPaidAppsCount(pCount);
    });
    return () => unsubApps();
  }, [currentUser]);

  const renderContent = () => {
    if (!testerData) return <div className="flex-1 flex justify-center items-center h-full text-blue-600 font-bold">Initializing Interface...</div>;

    switch (activeTab) {
      case 'apps': {
        return <TesterApps />;
      }

      case 'wallet':
        return <WithdrawalHistory lockedBalance={lockedBalance} paidAppsCount={paidAppsCount} />;

      case 'notifications':
        return <TesterNotifications notifications={notifications} />;

      case 'profile':
        return (
          <div className="h-full flex items-center justify-center">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white/80 backdrop-blur-xl rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-slate-100 p-12 max-w-lg w-full text-center relative overflow-hidden">
              <div className="relative inline-block mb-6">
                <div className="absolute inset-0 bg-blue-500 rounded-full animate-ping opacity-20"></div>
                <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(testerData.name || 'User')}&background=0f172a&color=fff&size=128&bold=true`} alt="Profile" className="w-32 h-32 rounded-full border-4 border-white shadow-xl relative z-10" />
              </div>
              <h2 className="text-3xl font-black text-slate-800 mb-2 tracking-tight">{testerData.name}</h2>
              <p className="text-slate-500 font-semibold mb-8">{testerData.email}</p>
              
              <div className="bg-slate-50 rounded-2xl p-6 mb-8 border border-slate-100 shadow-inner">
                <div className="text-[10px] text-slate-400 font-bold tracking-widest uppercase mb-2">Total Tested Apps</div>
                <div className="text-5xl font-black text-blue-600">{totalTestedCount}</div>
              </div>

              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={logout} className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold tracking-wide hover:bg-slate-800 transition-colors shadow-lg shadow-slate-900/20 flex justify-center items-center">
                <LogOut className="w-5 h-5 mr-2" /> Sign Out from Node
              </motion.button>
            </motion.div>
          </div>
        );
      default: return null;
    }
  };

  return (
    <div className="flex h-screen bg-slate-50/80 font-sans overflow-hidden">
      
      <TesterSidebar activeTab={activeTab} setActiveTab={setActiveTab} isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col relative z-10 overflow-hidden">
        <header className="h-20 bg-white border-b border-slate-100 px-4 sm:px-8 flex items-center justify-between shadow-[0_2px_10px_rgba(0,0,0,0.02)] sticky top-0 z-30">
          <div className="flex items-center">
            <button onClick={() => setIsSidebarOpen(true)} className="md:hidden mr-4 p-2 text-slate-500 hover:bg-slate-50 rounded-xl transition-colors">
              <Menu className="w-6 h-6" />
            </button>
            <h2 className="text-xl sm:text-2xl font-black text-slate-800 capitalize tracking-tight">{activeTab.replace('-', ' ')}</h2>
          </div>
          
          <div className="flex items-center gap-3">
             <button onClick={() => setActiveTab('notifications')} className="relative p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors">
               <Bell className="w-6 h-6" />
               {notifications.length > 0 && (
                 <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
               )}
             </button>
             <div className="hidden sm:flex items-center text-xs font-bold text-slate-500 bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-100">
                <User className="w-4 h-4 mr-2 text-blue-600" /> {testerData?.name || 'Loading...'}
             </div>
             <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={logout} className="p-2.5 bg-red-50 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-colors border border-red-100 hover:border-red-500">
               <LogOut className="w-5 h-5" />
             </motion.button>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-4 sm:p-8">
          <AnimatePresence mode="wait">
            <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="h-full">
              {renderContent()}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}