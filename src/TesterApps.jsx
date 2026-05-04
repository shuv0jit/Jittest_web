import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, onSnapshot, doc, updateDoc, arrayUnion, serverTimestamp } from 'firebase/firestore';
import { useAuth } from './AuthContext';
import { Download, Clock, CheckCircle, CreditCard, PlaySquare, CheckCircle2, LayoutGrid, List } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function TesterApps() {
  const { currentUser } = useAuth();
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState('install');
  const [viewMode, setViewMode] = useState('grid');

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
          daysActive = Math.floor(Math.max(0, nowMidnight.getTime() - startMidnight.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        }
      }
      const appWithDays = { ...app, daysActive };
      
      appWithDays.displayTesterCount = Math.max(Array.isArray(appWithDays.testerIds) ? appWithDays.testerIds.length : 0, appWithDays.installedCount || 0);
      
      // Strict Array check to prevent .includes() crashes
      const hasTested = Array.isArray(appWithDays.testerIds) ? appWithDays.testerIds.includes(currentUser.uid) : false;

      // STEP 1: Logic Change - Direct send isPaidByAdmin apps to Paid zone
      if (appWithDays.isPaidByAdmin) {
        categorizedApps.paid.push(appWithDays);
        continue; // App is assigned, immediately skip the rest of the checks
      }

      // STEP 2: Only after Step 1, evaluate 'production_access' logic
      if (appWithDays.status === 'production_access' || appWithDays.status === 'Reviews') {
        if (hasTested) {
          if (daysActive > 14) {
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
        categorizedApps.ongoing.push(appWithDays);
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

      const currentTesterCount = Math.max(Array.isArray(app.testerIds) ? app.testerIds.length : 0, app.installedCount || 0);
      const newCount = currentTesterCount + 1;

      const updates = {
        testerIds: arrayUnion(currentUser.uid),
        installedCount: newCount
      };

      // Upgrade database info when the 12 testers target is reached
      if (newCount >= 12 && !app.startTime) {
        updates.startTime = serverTimestamp();
        updates.status = 'Ongoing';
        updates.dayCount = 1;
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

  const currentApps = categorizedApps[activeSubTab] || [];

  // Framer Motion Stagger Variants
  const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  return (
    <div className="flex flex-col max-w-7xl mx-auto w-full h-full">
      
      {/* Header and Sub Tabs */}
      <div className="mb-6">
        <div className="flex justify-between items-center gap-2 sm:gap-3">
          <div className="flex bg-white p-1.5 rounded-2xl border border-slate-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] overflow-x-auto scrollbar-hide flex-1">
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
                className={`relative flex items-center px-3 sm:px-4 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${isActive ? 'text-blue-700' : 'text-slate-400 hover:text-slate-700'}`}
              >
                {isActive && (
                  <motion.div layoutId="activeSubTab" className="absolute inset-0 bg-blue-50 rounded-xl border border-blue-100/50" transition={{ type: "spring", stiffness: 400, damping: 30 }} />
                )}
                <span className="relative z-10 flex items-center">
                  <Icon className="w-4 h-4 mr-2 hidden sm:block" /> {tab.label}
                  <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${isActive ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-500'}`}>{count}</span>
                </span>
              </button>
            );
          })}
          </div>
          <div className="bg-white border border-slate-100 rounded-xl flex p-1 shadow-sm shrink-0 h-full">
            <button onClick={() => setViewMode('grid')} className={`p-2 sm:p-2.5 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-blue-50 text-blue-600' : 'text-slate-400 hover:text-blue-500'}`}><LayoutGrid className="w-4 h-4 sm:w-5 sm:h-5" /></button>
            <button onClick={() => setViewMode('list')} className={`p-2 sm:p-2.5 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-blue-50 text-blue-600' : 'text-slate-400 hover:text-blue-500'}`}><List className="w-4 h-4 sm:w-5 sm:h-5" /></button>
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
    if (pNameStr) {
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