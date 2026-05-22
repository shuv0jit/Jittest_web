import React, { useState, useEffect } from 'react';
import AdminApps from './AdminApps';
import AdminTesters from './AdminTesters';
import AdminWithdrawals from './AdminWithdrawals';
import AdminHistory from './AdminHistory';
import AdminNotifications from './AdminNotifications';
import AdminShares from './AdminShares';
import { useAuth } from './AuthContext';
import { db } from './firebase';
import { collection, onSnapshot, query, orderBy, getDocs, addDoc, updateDoc, doc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { LayoutDashboard, Users, CreditCard, LogOut, Activity, History, Menu, X, Bell, Calculator } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState('apps');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [pendingWithdrawalsCount, setPendingWithdrawalsCount] = useState(0);
  const { logout } = useAuth();

  const [touchStartX, setTouchStartX] = useState(null);
  const [touchEndX, setTouchEndX] = useState(null);
  const [touchStartY, setTouchStartY] = useState(null);
  const [touchEndY, setTouchEndY] = useState(null);

  // Calculate how many notifications haven't been read yet
  const unreadCount = notifications.filter(n => !n.read).length;

  // Automatically mark all notifications as read when visiting the notifications tab
  useEffect(() => {
    if (activeTab === 'notifications' && unreadCount > 0) {
      notifications.forEach(n => {
        if (!n.read) {
          updateDoc(doc(db, 'notifications', n.id), { read: true }).catch(() => {});
        }
      });
    }
  }, [activeTab, notifications, unreadCount]);

  useEffect(() => {
    // Fetch Notifications for Bell Icon
    const q = query(collection(db, 'notifications'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // Fetch Pending Withdrawals for Green Dot
    const unsubWithdrawals = onSnapshot(collection(db, 'withdrawRequests'), (snap) => {
      const count = snap.docs.filter(d => {
        const data = d.data();
        return data.status === 'pending' || data.status === 'requested' || data.status === 'Pending' || !data.status;
      }).length;
      setPendingWithdrawalsCount(count);
    });

    // Background Check: Generate Alerts for Apps older than 7 Days (Starting from April 26, 2026)
    const checkAppsForNotifications = async () => {
      try {
        // Cleanup old notifications to safely match the new rules
        const notifSnap = await getDocs(collection(db, 'notifications'));
        notifSnap.forEach(async (nDoc) => {
          if (nDoc.data().version !== 2) {
            await deleteDoc(doc(db, 'notifications', nDoc.id));
          }
        });

        const appsSnap = await getDocs(collection(db, 'apps'));
        const now = Date.now();
        const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
        const cutoffDate = new Date('2026-04-26T00:00:00').getTime(); // April 26th, 2026

        appsSnap.forEach(async (appDoc) => {
          const app = appDoc.data();
          if (app.createdAt && !app.advanceNotificationCreated) {
            const createdAtMs = app.createdAt?.toDate ? app.createdAt.toDate().getTime() : new Date(app.createdAt).getTime();
              
            if (!isNaN(createdAtMs) && createdAtMs >= cutoffDate && (now - createdAtMs >= sevenDaysMs)) {
              await addDoc(collection(db, 'notifications'), {
                title: 'Advance Payment Required',
                message: `You have to take advance of 7 days from this app: ${app.appName || 'Unknown App'} (${app.packageName || 'Unknown Package'})`,
                createdAt: serverTimestamp(),
                version: 2 // Version flag to prevent future deletion
              });
              await updateDoc(doc(db, 'apps', appDoc.id), { advanceNotificationCreated: true });
            }
          }
        });
      } catch (error) {
      }
    };
    checkAppsForNotifications();
    return () => {
      unsub();
      unsubWithdrawals();
    };
  }, []);

  const handleTouchStart = (e) => {
    setTouchEndX(null);
    setTouchEndY(null);
    setTouchStartX(e.targetTouches[0].clientX);
    setTouchStartY(e.targetTouches[0].clientY);
  };

  const handleTouchMove = (e) => {
    setTouchEndX(e.targetTouches[0].clientX);
    setTouchEndY(e.targetTouches[0].clientY);
  };

  const handleTouchEnd = () => {
    if (!touchStartX || !touchEndX || !touchStartY || !touchEndY) return;
    const distanceX = touchStartX - touchEndX;
    const distanceY = touchStartY - touchEndY;

    if (Math.abs(distanceX) > Math.abs(distanceY)) {
      if (distanceX < -50 && touchStartX < 50) {
        setIsSidebarOpen(true);
      }
      if (distanceX > 50 && isSidebarOpen) {
        setIsSidebarOpen(false);
      }
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 font-sans overflow-hidden" onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
      
      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsSidebarOpen(false)} className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60] md:hidden" />
        )}
      </AnimatePresence>

      {/* Futuristic Sidebar (Mobile sliding) */}
      <div
        className={`fixed inset-y-0 left-0 w-[260px] bg-white text-slate-600 border-r border-slate-100 flex flex-col z-[70] shadow-2xl md:relative transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
      >
        <div className="p-4 sm:p-5 h-14 sm:h-16 flex items-center justify-between border-b border-slate-100 shrink-0">
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex items-center mx-auto md:mx-0">
             <img src="/logo.jpg" alt="JitTest Logo" className="h-8 sm:h-9 w-auto object-contain rounded-lg" />
          </motion.div>
          <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-slate-400 hover:text-slate-800"><X className="w-5 h-5" /></button>
        </div>
        
        <nav className="flex-1 mt-6 px-4 space-y-2 overflow-y-auto">
          <button onClick={() => {setActiveTab('apps'); setIsSidebarOpen(false);}} className={`w-full flex items-center px-4 py-3.5 min-h-[44px] rounded-xl transition-all duration-300 font-semibold ${activeTab === 'apps' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' : 'text-slate-500 hover:bg-slate-50 hover:text-blue-600'}`}>
            <LayoutDashboard className="w-5 h-5 mr-3" /> Apps
          </button>
          <button onClick={() => {setActiveTab('testers'); setIsSidebarOpen(false);}} className={`w-full flex items-center px-4 py-3.5 min-h-[44px] rounded-xl transition-all duration-300 font-semibold ${activeTab === 'testers' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' : 'text-slate-500 hover:bg-slate-50 hover:text-blue-600'}`}>
            <Users className="w-5 h-5 mr-3" /> Testers
          </button>
          <button onClick={() => {setActiveTab('withdrawals'); setIsSidebarOpen(false);}} className={`w-full flex items-center justify-between px-4 py-3.5 min-h-[44px] rounded-xl transition-all duration-300 font-semibold ${activeTab === 'withdrawals' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' : 'text-slate-500 hover:bg-slate-50 hover:text-blue-600'}`}>
            <div className="flex items-center"><CreditCard className="w-5 h-5 mr-3" /> Withdrawals</div>
            {pendingWithdrawalsCount > 0 && (
              <span className="w-2.5 h-2.5 bg-green-500 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse" />
            )}
          </button>
          <button onClick={() => {setActiveTab('history'); setIsSidebarOpen(false);}} className={`w-full flex items-center px-4 py-3.5 min-h-[44px] rounded-xl transition-all duration-300 font-semibold ${activeTab === 'history' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' : 'text-slate-500 hover:bg-slate-50 hover:text-blue-600'}`}>
            <History className="w-5 h-5 mr-3" /> System History
          </button>
          <button onClick={() => {setActiveTab('shares'); setIsSidebarOpen(false);}} className={`w-full flex items-center px-4 py-3.5 min-h-[44px] rounded-xl transition-all duration-300 font-semibold ${activeTab === 'shares' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' : 'text-slate-500 hover:bg-slate-50 hover:text-blue-600'}`}>
            <Calculator className="w-5 h-5 mr-3" /> Calc & Shares
          </button>
        </nav>
        <div className="p-6 shrink-0">
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={logout} className="w-full flex items-center justify-center py-3 min-h-[44px] bg-red-500/10 text-red-500 border border-red-500/20 rounded-xl hover:bg-red-500 hover:text-white font-bold transition-all shadow-lg shadow-red-500/0 hover:shadow-red-500/20">
            <LogOut className="w-5 h-5 mr-2" /> Sign Out
          </motion.button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col relative z-10 overflow-hidden w-full">
        <header className="h-14 sm:h-16 bg-white/90 backdrop-blur-xl border-b border-slate-200/50 px-4 sm:px-6 flex items-center justify-between shadow-sm sticky top-0 z-30 shrink-0">
          <div className="flex items-center gap-3 sm:gap-4">
            <button onClick={() => setIsSidebarOpen(true)} className="md:hidden text-slate-600 hover:bg-slate-100 p-1.5 sm:p-2 rounded-xl transition-colors"><Menu className="w-5 h-5 sm:w-6 sm:h-6" /></button>
            <h2 className="text-lg sm:text-xl md:text-2xl font-black text-slate-800 capitalize tracking-tight">{activeTab.replace('-', ' ')}</h2>
          </div>
          <div className="flex items-center gap-3 sm:gap-4">
            <button onClick={() => setActiveTab('notifications')} className="relative p-2.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors">
              <Bell className="w-6 h-6" />
              {unreadCount > 0 && (
                <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
              )}
            </button>
            <div className="hidden sm:flex items-center text-sm font-bold text-slate-500 bg-slate-100 px-4 py-2 rounded-full border border-slate-200">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse mr-2"></div> System Online
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-auto bg-slate-50/50 p-4 md:p-8">
          <div className="h-full">
            {activeTab === 'apps' && <AdminApps />}
            {activeTab === 'testers' && <AdminTesters />}
            {activeTab === 'withdrawals' && <AdminWithdrawals />}
            {activeTab === 'history' && <AdminHistory />}
            {activeTab === 'shares' && <AdminShares />}
            {activeTab === 'notifications' && <AdminNotifications notifications={notifications} onBack={() => setActiveTab('apps')} />}
          </div>
        </main>
      </div>
    </div>
  );
}