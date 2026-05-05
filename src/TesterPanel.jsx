/* eslint-disable no-unused-vars */
import React, { useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { db, app } from './firebase';
import { doc, getDoc, updateDoc, collection, onSnapshot, query, where } from 'firebase/firestore';
import { getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging';
import { Wallet, User, LogOut, CheckCircle2, PlaySquare, ArrowRight, Menu, Bell, Info } from 'lucide-react';
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
  const [showNotifBanner, setShowNotifBanner] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!currentUser) return;
      
      console.log('[TesterPanel] Fetching profile for user:', currentUser.uid);
      // Fetch Tester Profile
      try {
        const userRef = doc(db, 'users', currentUser.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          setTesterData(userSnap.data());
        } else {
          console.warn('[TesterPanel] Warning: User document does not exist in database!');
        }
      } catch (error) {
        console.error('[TesterPanel] Profile fetch failed or timed out! Reason:', error.message);
      }
    };
    fetchData();
  }, [currentUser]);

  // Check if we need to ask for Notification permissions
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      setShowNotifBanner(true);
    }
  }, []);

  const handleEnableNotifications = async () => {
    try {
      const supported = await isSupported();
      if (!supported) return setShowNotifBanner(false); // Silently fail if not supported (e.g., Safari iOS)
      
      const permission = await Notification.requestPermission();
      if (permission === 'granted' && currentUser) {
        const messaging = getMessaging(app);
        
        // Explicitly register the service worker to ensure it controls the push notifications
        const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
        
        // IMPORTANT: Replace with your Firebase Project's VAPID Key from Project Settings > Cloud Messaging -> Web configuration
        const token = await getToken(messaging, { 
          vapidKey: 'BDkHiIz4ES1d2C-ErhrSuT5bDpdA-xoDCnIdibJVDUco65ZRTMeobTEepn0Mpa20YxKkdDN2PkVRyu4AVGHky0w',
          serviceWorkerRegistration: registration
        });
        
        if (token) {
          await updateDoc(doc(db, 'users', currentUser.uid), { fcmToken: token });
        }
      }
      setShowNotifBanner(false);
    } catch (error) {
      console.error("Failed to enable notifications", error);
      setShowNotifBanner(false);
    }
  };

  // Handle Foreground Notifications (When the user has the website actively open)
  useEffect(() => {
    const setupForegroundMessaging = async () => {
      const supported = await isSupported();
      if (supported && currentUser) {
        const messaging = getMessaging(app);
        onMessage(messaging, (payload) => {
          if (Notification.permission === 'granted') {
            // Android mobile browsers block 'new Notification()'. We must use the ServiceWorker.
            navigator.serviceWorker.ready.then((registration) => {
              const title = payload.notification?.title || payload.data?.title || 'New App Available';
              const body = payload.notification?.body || payload.data?.body || 'A new app has been added for testing!';
              registration.showNotification(title, {
                body: body,
                icon: '/jittest.png'
              });
            });
          }
        });
      }
    };
    setupForegroundMessaging();
  }, [currentUser]);

  // Fetch Tester Notifications
  useEffect(() => {
    if (!currentUser) return;
    console.log('[TesterPanel] Listening for notifications...');
    const q = query(collection(db, 'testerNotifications'), where('testerId', '==', currentUser.uid));
    const unsubNotifs = onSnapshot(q, (snapshot) => {
      setNotifications(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      console.error('[TesterPanel] Notifications stream timed out or disconnected:', error.message);
    });
    return () => unsubNotifs();
  }, [currentUser]);

  // Real-time calculation: Total Tested Apps = Install + Ongoing + Production + Paid
  useEffect(() => {
    if (!currentUser) return;
    console.log('[TesterPanel] Listening for apps to calculate balances...');
    const unsubApps = onSnapshot(collection(db, 'apps'), (snapshot) => {
      const allApps = snapshot.docs.map(d => d.data());
      console.log(`[TesterPanel] Received ${allApps.length} apps. Calculating...`);
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
    }, (error) => {
      console.error('[TesterPanel] Apps stream timed out or disconnected:', error.message);
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
        return <TesterNotifications notifications={notifications} onBack={() => setActiveTab('apps')} />;

      case 'profile':
        return (
          <div className="h-full flex flex-col max-w-4xl mx-auto">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden mt-2">
              
              {/* Cover Banner */}
              <div className="h-32 sm:h-48 bg-gradient-to-r from-blue-600 to-indigo-700 relative overflow-hidden">
                 <div className="absolute inset-0 bg-white/10 mix-blend-overlay"></div>
                 <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-white/20 rounded-full blur-3xl pointer-events-none"></div>
                 <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 pointer-events-none"></div>
              </div>

              <div className="px-6 sm:px-10 pb-8 sm:pb-10 relative">
                {/* Avatar & Top Actions */}
                <div className="flex justify-between items-end -mt-12 sm:-mt-16 mb-6">
                  <div className="relative">
                    <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full border-4 border-white bg-slate-100 shadow-xl overflow-hidden relative z-10">
                      <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(testerData.name || 'User')}&background=eff6ff&color=2563eb&size=128&bold=true`} alt="Profile" className="w-full h-full object-cover" />
                    </div>
                    <div className="absolute bottom-1 right-1 sm:bottom-2 sm:right-2 w-5 h-5 sm:w-6 sm:h-6 bg-green-500 border-2 border-white rounded-full z-20 shadow-sm" title="Online"></div>
                  </div>
                  
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={logout} className="hidden sm:flex bg-red-50 text-red-600 px-5 py-2.5 rounded-xl font-bold hover:bg-red-500 hover:text-white transition-colors shadow-sm items-center border border-red-100 hover:border-red-500">
                    <LogOut className="w-4 h-4 mr-2" /> Sign Out
                  </motion.button>
                </div>

                {/* User Info */}
                <div className="mb-8">
                  <h2 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight flex items-center">
                    {testerData.name}
                    <span className="ml-3 px-2.5 py-1 bg-blue-50 text-blue-600 text-[10px] sm:text-xs font-bold uppercase tracking-wider rounded-lg border border-blue-100 flex items-center">
                      <CheckCircle2 className="w-3 h-3 mr-1" /> Verified Tester
                    </span>
                  </h2>
                  <p className="text-slate-500 font-medium mt-1">{testerData.email}</p>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 mb-2">
                  <div className="bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-100 hover:shadow-sm transition-shadow">
                    <div className="text-[10px] sm:text-xs text-slate-400 font-bold tracking-widest uppercase mb-1 sm:mb-2 flex items-center"><PlaySquare className="w-3.5 h-3.5 mr-1.5 text-blue-400" /> Total Tested</div>
                    <div className="text-2xl sm:text-4xl font-black text-slate-800">{totalTestedCount}</div>
                  </div>
                  <div className="bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-100 hover:shadow-sm transition-shadow">
                    <div className="text-[10px] sm:text-xs text-slate-400 font-bold tracking-widest uppercase mb-1 sm:mb-2 flex items-center"><CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-emerald-400" /> Paid Apps</div>
                    <div className="text-2xl sm:text-4xl font-black text-slate-800">{paidAppsCount}</div>
                  </div>
                  <div className="bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-100 col-span-2 md:col-span-1 hover:shadow-sm transition-shadow">
                    <div className="text-[10px] sm:text-xs text-slate-400 font-bold tracking-widest uppercase mb-1 sm:mb-2 flex items-center"><Wallet className="w-3.5 h-3.5 mr-1.5 text-amber-400" /> Locked Balance</div>
                    <div className="text-2xl sm:text-4xl font-black text-slate-800">{lockedBalance} <span className="text-sm font-bold text-slate-400">TK</span></div>
                  </div>
                </div>

                {/* Mobile Logout Button */}
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={logout} className="w-full sm:hidden py-3.5 bg-red-50 text-red-600 rounded-xl font-bold hover:bg-red-500 hover:text-white transition-colors shadow-sm flex justify-center items-center border border-red-100 hover:border-red-500 mt-6">
                  <LogOut className="w-5 h-5 mr-2" /> Sign Out
                </motion.button>
              </div>
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
        <header className="h-16 bg-white/80 backdrop-blur-xl border-b border-slate-100 px-4 sm:px-6 flex items-center justify-between shadow-sm sticky top-0 z-30 shrink-0">
          <div className="flex items-center">
            <button onClick={() => setIsSidebarOpen(true)} className="md:hidden mr-4 p-2 text-slate-500 hover:bg-slate-50 rounded-xl transition-colors">
              <Menu className="w-6 h-6" />
            </button>
            <h2 className="text-lg sm:text-xl font-black text-slate-800 capitalize tracking-tight">{activeTab.replace('-', ' ')}</h2>
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
        
        {/* Notification Permission Banner */}
        <AnimatePresence>
          {showNotifBanner && (
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="m-4 sm:mx-6 bg-blue-600 rounded-2xl p-4 sm:p-5 shadow-lg shadow-blue-600/20 text-white flex flex-col sm:flex-row items-center justify-between gap-4 relative overflow-hidden z-20 shrink-0">
              <div className="absolute -right-10 -top-10 w-32 h-32 bg-white/10 rounded-full blur-3xl pointer-events-none"></div>
              <div className="flex items-center gap-3">
                 <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center shrink-0">
                   <Bell className="w-5 h-5 text-white" />
                 </div>
                 <div>
                   <h4 className="font-bold text-base">Enable Push Notifications</h4>
                   <p className="text-blue-100 text-sm font-medium mt-0.5">Get instantly notified when a new app is available to test!</p>
                 </div>
              </div>
              <div className="flex gap-2 w-full sm:w-auto relative z-10">
                 <button onClick={() => setShowNotifBanner(false)} className="flex-1 px-4 py-2 bg-blue-700 hover:bg-blue-800 rounded-xl text-sm font-bold transition-colors sm:w-auto text-center">Maybe Later</button>
                 <button onClick={handleEnableNotifications} className="flex-1 px-4 py-2 bg-white text-blue-600 hover:bg-blue-50 rounded-xl text-sm font-bold transition-colors shadow-sm sm:w-auto text-center">Allow Notifications</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <main className="flex-1 overflow-auto p-4 sm:p-6">
          {renderContent()}
        </main>
      </div>
    </div>
  );
}