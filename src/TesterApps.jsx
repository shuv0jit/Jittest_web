import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, onSnapshot, doc, updateDoc, arrayUnion, serverTimestamp } from 'firebase/firestore';
import { useAuth } from './AuthContext';
import { Download, Clock, CheckCircle, CreditCard, PlaySquare, CheckCircle2, LayoutGrid, List, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function TesterApps() {
  const { currentUser } = useAuth();
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState('install');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('grid');

  const [touchStartX, setTouchStartX] = useState(null);
  const [touchEndX, setTouchEndX] = useState(null);
  const [touchStartY, setTouchStartY] = useState(null);
  const [touchEndY, setTouchEndY] = useState(null);

  // Real-time Firestore Listener
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'apps'), (snapshot) => {
      const appsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setApps(appsData);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Categorization Logic
  const categorizedApps = {
    install: [],
    ongoing: [],
    production: [],
    paid: []
  };

  for (const app of apps) {
    try {
      const pName = typeof app.packageName === 'string' ? app.packageName.trim() : '';
      const aName = typeof app.appName === 'string' ? app.appName.trim() : '';
      
      // Skip apps without a valid name or package (do not display them)
      if (!pName || !aName) {
        continue;
      }

      let daysActive = app.daysActive || 0;
      if (app.startTime) {
        const start = app.startTime.toDate ? app.startTime.toDate() : new Date(app.startTime);
        if (!isNaN(start)) {
          const startMidnight = new Date(start);
          startMidnight.setHours(0, 0, 0, 0);
          const nowMidnight = new Date();
          nowMidnight.setHours(0, 0, 0, 0);
          daysActive = Math.floor(Math.max(0, nowMidnight.getTime() - startMidnight.getTime()) / (1000 * 60 * 60 * 24));
        }
      }

      const appWithDays = { ...app, daysActive };
      
      appWithDays.displayTesterCount = Array.isArray(appWithDays.testerIds) ? appWithDays.testerIds.length : 0;
      
      // Strict Array check to prevent .includes() crashes
      const hasTested = Array.isArray(appWithDays.testerIds) ? appWithDays.testerIds.includes(currentUser.uid) : false;

      // STEP 1: Logic Change - Direct send isPaidByAdmin apps to Paid zone
      if (appWithDays.isPaidByAdmin) {
        categorizedApps.paid.push(appWithDays);
        continue; // App is assigned, immediately skip the rest of the checks
      }

      // STEP 2: Move unpaid apps that are 15+ days old to Production
      if (daysActive >= 15 && !app.isPaidByAdmin) {
        categorizedApps.production.push(appWithDays);
        continue;
      }

      // STEP 2: Only after Step 1, evaluate 'production_access' logic
      if (appWithDays.status === 'production_access' || appWithDays.status === 'Reviews') {
        if (hasTested) {
          if (daysActive >= 15) {
            categorizedApps.production.push(appWithDays);
          } else {
            categorizedApps.ongoing.push(appWithDays);
          }
        } else {
          categorizedApps.install.push(appWithDays);
        }
        continue; // App is assigned, immediately skip the rest of the checks
      }

      // STEP 3: Remaining apps - if no tester ID match, send to Install. Otherwise Ongoing.
      if (!hasTested) {
        categorizedApps.install.push(appWithDays);
      } else {
        if (daysActive >= 15) {
          categorizedApps.production.push(appWithDays);
        } else {
          categorizedApps.ongoing.push(appWithDays);
        }
      }
    } catch (err) {
      // Silently ignore to prevent render crashes
    }
  }
  
  const handleMarkInstalled = async (app) => {
    try {
      const appRef = doc(db, 'apps', app.id);
      
      const isAlreadyTester = Array.isArray(app.testerIds) && app.testerIds.includes(currentUser.uid);
      if (isAlreadyTester) return; // Prevent duplicate writes

      const currentTesterCount = Array.isArray(app.testerIds) ? app.testerIds.length : 0;
      const newCount = currentTesterCount + 1;

      const updates = {
        testerIds: arrayUnion(currentUser.uid),
        installedCount: newCount
      };

      // Upgrade database info when the 12 testers target is reached
      if (newCount >= 12 && !app.startTime) {
        updates.startTime = serverTimestamp();
        updates.status = 'Ongoing';
        updates.dayCount = 0;
      }

      await updateDoc(appRef, updates);
    } catch (error) {
      alert("Failed to mark as installed. Please try again.");
    }
  };

  const handleInstallClick = async (app) => {
    if (app.packageName) {
      window.open(`https://play.google.com/store/apps/details?id=${app.packageName}`, '_blank', 'noopener,noreferrer');
    }
    await handleMarkInstalled(app);
  };

  if (loading) {
    return <div className="flex-1 flex justify-center items-center h-full text-blue-600 font-bold animate-pulse">Synchronizing Data Pipeline...</div>;
  }

  let currentApps = categorizedApps[activeSubTab] || [];

  if (searchQuery) {
    const lowerQ = searchQuery.toLowerCase();
    currentApps = currentApps.filter(app => {
      const pNameStr = typeof app.packageName === 'string' ? app.packageName : '';
      const finalAppName = app.appName || (pNameStr ? pNameStr.split('.').pop() : 'Unknown Application');
      return (
        finalAppName.toLowerCase().includes(lowerQ) || 
        pNameStr.toLowerCase().includes(lowerQ)
      );
    });
  }

  currentApps.sort((a, b) => {
    if (activeSubTab === 'ongoing') {
      return b.daysActive - a.daysActive;
    } else if (activeSubTab === 'production') {
      return (b.startTime?.toDate?.() || 0) - (a.startTime?.toDate?.() || 0);
    } else if (activeSubTab === 'paid') {
      return (b.paidAt?.toDate?.() || 0) - (a.paidAt?.toDate?.() || 0);
    }
    return 0;
  });

  // Framer Motion Stagger Variants
  const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

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
      if (distanceX < -50 && touchStartX < 50) return;
      const tabs = ['install', 'ongoing', 'production', 'paid'];
      const currentIndex = tabs.indexOf(activeSubTab);

      if (distanceX > 50 && currentIndex < tabs.length - 1) setActiveSubTab(tabs[currentIndex + 1]);
      if (distanceX < -50 && currentIndex > 0) setActiveSubTab(tabs[currentIndex - 1]);
    }
  };

  return (
    <div className="flex flex-col max-w-7xl mx-auto w-full h-full" onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
      
      {/* Header and Sub Tabs */}
      <div className="mb-4 sm:mb-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2 sm:gap-3">
          <div className="flex bg-white p-1 rounded-xl border border-slate-100 shadow-sm overflow-x-auto scrollbar-hide flex-1 min-w-0">
          {[
            { id: 'install', label: 'To Install', icon: Download },
            { id: 'ongoing', label: 'Ongoing', icon: Clock },
            { id: 'production', label: 'Production', icon: CheckCircle },
            { id: 'paid', label: 'Paid', icon: CreditCard }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeSubTab === tab.id;
            const count = categorizedApps[tab.id]?.length || 0;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id)}
                className={`relative flex items-center px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${isActive ? 'text-blue-700' : 'text-slate-400 hover:text-slate-700'}`}
              >
                {isActive && (
                  <motion.div layoutId="activeSubTab" className="absolute inset-0 bg-blue-50 rounded-lg border border-blue-100/50" transition={{ type: "spring", stiffness: 400, damping: 30 }} />
                )}
                <span className="relative z-10 flex items-center">
                  <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2 hidden sm:block" /> {tab.label}
                  <span className={`ml-1.5 sm:ml-2 px-1.5 py-0.5 rounded-full text-[9px] sm:text-[10px] leading-none flex items-center justify-center ${isActive ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-500'}`}>{count}</span>
                </span>
              </button>
            );
          })}
          </div>
          
          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
            <div className="flex items-center gap-2 h-9 sm:h-10 justify-end sm:justify-start">
              <div className="bg-white border border-slate-100 rounded-xl flex p-0.5 h-full shrink-0 shadow-sm">
                <button onClick={() => setViewMode('grid')} className={`p-1.5 sm:p-2 rounded-lg transition-colors flex items-center justify-center ${viewMode === 'grid' ? 'bg-blue-50 text-blue-600' : 'text-slate-400 hover:text-blue-500'}`}><LayoutGrid className="w-4 h-4" /></button>
                <button onClick={() => setViewMode('list')} className={`p-1.5 sm:p-2 rounded-lg transition-colors flex items-center justify-center ${viewMode === 'list' ? 'bg-blue-50 text-blue-600' : 'text-slate-400 hover:text-blue-500'}`}><List className="w-4 h-4" /></button>
              </div>
            </div>
            <div className="relative w-full sm:w-48 lg:w-60 h-9 sm:h-10">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input 
                type="text" 
                placeholder="Search apps..." 
                value={searchQuery} 
                onChange={(e) => setSearchQuery(e.target.value)} 
                className="w-full pl-8 pr-3 h-full border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 bg-white shadow-sm text-xs sm:text-sm font-medium transition-all" 
              />
            </div>
          </div>
        </div>
      </div>

      {/* Cards Grid */}
      {/* BUG FIX: Removed outer AnimatePresence to prevent React tree crashes on rapid tab switching. The inner stagger animation is sufficient. */}
      <div>
        {currentApps.length === 0 ? (
          <motion.div key="empty-state" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center h-64 text-center">
            <div className="w-20 h-20 bg-slate-100 rounded-[2rem] flex items-center justify-center mb-4"><CheckCircle className="w-10 h-10 text-slate-300" /></div>
            <h3 className="text-xl font-black text-slate-700">No Applications Found</h3>
            <p className="text-slate-400 font-medium mt-2">You're completely caught up in this section.</p>
          </motion.div>
        ) : (
          <motion.div key="grid-state" variants={containerVariants} initial="hidden" animate="show" className={viewMode === 'grid' ? "grid grid-cols-2 gap-3 sm:gap-4" : "flex flex-col gap-3"}>
            {currentApps.map((app) => (
              <AppCard 
                key={app.id} 
                app={app} 
                section={activeSubTab} 
                onInstallClick={() => handleInstallClick(app)} 
                viewMode={viewMode}
              />
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}

// Responsive & Animated App Card Component
const AppCard = ({ app, section, onInstallClick, viewMode }) => {
  const pNameStr = typeof app.packageName === 'string' ? app.packageName : '';
  const finalAppName = app.appName || (pNameStr ? pNameStr.split('.').pop() : 'Unknown Application');
  
  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0 }
  };

  const handleCardClick = () => {
    if (section === 'install') {
      onInstallClick();
    } else if (pNameStr) {
      window.open(`https://play.google.com/store/apps/details?id=${pNameStr}`, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <motion.div 
      variants={itemVariants}
      whileHover={{ scale: 1.02 }}
      onClick={handleCardClick}
      className={`cursor-pointer bg-white rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-all p-3 sm:p-4 relative group flex ${viewMode === 'list' ? 'flex-col sm:flex-row sm:items-center gap-3 sm:gap-4' : 'flex-col text-center'}`}
    >
      {/* App Info */}
      <div className={`flex flex-1 min-w-0 w-full ${viewMode === 'list' ? 'items-center text-left' : 'flex-col items-center'}`}>
        {app.imageUrl ? (
          <img src={app.imageUrl} alt={finalAppName} className={`rounded-xl object-cover shadow-sm border border-gray-100 shrink-0 ${viewMode === 'list' ? 'w-12 h-12 mr-4' : 'w-12 h-12 sm:w-14 sm:h-14 mb-2 sm:mb-3'}`} />
        ) : (
          <div className={`rounded-xl bg-blue-50 flex items-center justify-center text-blue-300 border border-blue-100 shrink-0 ${viewMode === 'list' ? 'w-12 h-12 mr-4' : 'w-12 h-12 sm:w-14 sm:h-14 mb-2 sm:mb-3'}`}>
            <PlaySquare className="w-6 h-6" />
          </div>
        )}
        <div className="flex-1 overflow-hidden w-full">
          <h3 className="font-bold text-slate-800 truncate group-hover:text-blue-600 transition-colors text-sm sm:text-base">{finalAppName}</h3>
          <p className="text-[9px] sm:text-[11px] text-slate-400 truncate mt-0.5 font-medium">{app.packageName}</p>
        </div>
      </div>

      {/* Stats */}
      <div className={`grid grid-cols-2 gap-2 w-full ${viewMode === 'grid' ? 'my-3' : 'mt-3 sm:mt-0 sm:w-40 shrink-0'}`}>
        <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 text-center">
          <div className="text-[9px] sm:text-[10px] text-slate-500 mb-0.5 uppercase font-bold">Installs</div>
          <div className="font-bold text-slate-800 text-xs sm:text-sm">{app.displayTesterCount}/12</div>
        </div>
        <div className={`bg-slate-50 p-2 rounded-lg border border-slate-100 text-center transition-opacity ${section === 'install' ? 'opacity-40' : ''}`}>
          <div className="text-[9px] sm:text-[10px] text-slate-500 mb-0.5 uppercase font-bold">Days</div>
          <div className="font-bold text-slate-800 text-xs sm:text-sm">{section === 'install' ? '0' : app.daysActive}/14</div>
        </div>
      </div>

      {/* Actions */}
      <div className={`flex gap-2 sm:gap-3 ${viewMode === 'list' ? 'sm:w-auto sm:ml-auto mt-3 sm:mt-0' : 'w-full mt-auto'}`}>
        {section === 'install' && (
          <button onClick={(e) => { e.stopPropagation(); onInstallClick(); }} className="w-full bg-blue-600 text-white py-2 sm:py-3 rounded-xl text-[11px] sm:text-sm font-bold hover:bg-blue-700 transition-colors shadow-md shadow-blue-600/20 flex justify-center items-center">
            <Download className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2"/> Install
          </button>
        )}

        {section === 'ongoing' && (
          <div className="w-full bg-slate-50 p-2 sm:p-3 rounded-xl border border-slate-100">
             <div className="w-full bg-slate-200/80 rounded-full h-1.5 sm:h-2 overflow-hidden" title={`Day ${app.daysActive} of 14`}>
                <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, (app.daysActive / 14) * 100)}%` }} transition={{ duration: 1, ease: "easeOut" }} className="bg-blue-500 h-full rounded-full" />
             </div>
          </div>
        )}

        {section === 'production' && (
          <div className="w-full bg-blue-50 text-blue-600 py-2 sm:py-3 rounded-xl text-[10px] sm:text-sm font-bold flex justify-center items-center border border-blue-100">
             <CheckCircle2 className="w-3 h-3 mr-1"/> Complete
          </div>
        )}

        {section === 'paid' && (
          <div className="w-full bg-emerald-50 text-emerald-600 py-2 sm:py-3 rounded-xl text-[10px] sm:text-sm font-bold flex justify-center items-center border border-emerald-100">
             <CheckCircle2 className="w-3 h-3 mr-1"/> Paid
          </div>
        )}
      </div>
    </motion.div>
  );
};