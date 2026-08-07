import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, onSnapshot, doc, updateDoc, arrayUnion, serverTimestamp } from 'firebase/firestore';
import { useAuth } from './AuthContext';
import { Download, Clock, CheckCircle, CreditCard, PlaySquare, CheckCircle2, LayoutGrid, List, Search, AlertTriangle, SlidersHorizontal, Users } from 'lucide-react';
import DynamicAppIcon from './DynamicAppIcon';
import { motion, AnimatePresence } from 'framer-motion';

export default function TesterApps() {
  const { currentUser, testerData } = useAuth(); // Get testerData from AuthContext
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

  const NEW_LOGIC_CUTOFF_DATE = new Date('2026-07-14T00:00:00Z');

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

      // Determine if the current user is a "new" tester based on the cutoff date
      const isNewTester = testerData?.createdAt?.toDate() >= NEW_LOGIC_CUTOFF_DATE;

      // --- New Tester Specific Filtering (applies to all categories for new testers) ---
      // This filter applies to ALL apps for new testers, regardless of tab.
      if (isNewTester) {
        const testerJoinDate = testerData.createdAt.toDate();
        const appCreationDate = app.createdAt?.toDate();

        if (appCreationDate) {
          // Change 14-day window to 8 days
          const eightDaysBeforeJoin = new Date(testerJoinDate.getTime() - 8 * 24 * 60 * 60 * 1000);
          if (appCreationDate < eightDaysBeforeJoin) {
            // Skip this app entirely for new testers if it's too old based on the 8-day window
            continue; 
          }
        }
      }

      // STEP 1: Logic Change - Direct send isPaidByAdmin apps to Paid zone
      if (appWithDays.isPaidByAdmin) {
        categorizedApps.paid.push(appWithDays);
        continue; // App is assigned, immediately skip the rest of the checks
      }

      // Universal Rule: Apps with 'production_access' or 'completed' status should NEVER appear in 'To Install'
      const isProductionOrCompletedStatus = appWithDays.status === 'production_access' || appWithDays.status === 'completed';

      // STEP 2: Check for apps the user has already installed
      if (hasTested) {
        if (appWithDays.status === 'production_access') {
          categorizedApps.production.push(appWithDays);
        } else {
          // If they have tested it, and it's not production or paid, it's ongoing.
          categorizedApps.ongoing.push(appWithDays);
        }
        continue; // App is assigned, immediately skip the rest of the checks
      }

      // STEP 3: Check status for 'Ongoing'
      if (appWithDays.status === 'Ongoing') {
        if (hasTested) {
          categorizedApps.ongoing.push(appWithDays);
        } else {
          // If not tested, and it's Ongoing, it goes to install.
          categorizedApps.install.push(appWithDays);
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
          <motion.div key="grid-state" variants={containerVariants} initial="hidden" animate="show" className={viewMode === 'grid' ? "grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4" : "flex flex-col gap-3"}>
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

const ProgressBar = ({ progress, color, thumbColor }) => {
  return (
    <div className="relative w-full h-2 rounded-lg bg-slate-200 overflow-hidden">
      {/* Fill */}
      <motion.div
        className="h-full rounded-lg"
        style={{ backgroundColor: color }}
        initial={{ width: 0 }}
        animate={{ width: `${progress}%` }}
        transition={{ duration: 1.5, ease: "easeInOut" }}
      />
      {/* Thumb/Knob Indicator */}
      <motion.div
        className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-lg bg-white shadow-[0_2px_4px_rgba(0,0,0,0.15)]"
        style={{
          border: `3px solid ${thumbColor}`,
          left: `${progress}%`,
          transform: 'translate(-50%, -50%)',
        }}
        initial={{ left: '0%' }}
        animate={{ left: `${progress}%` }}
        transition={{ duration: 1.5, ease: "easeInOut" }}
      />
    </div>
  );
};

const AppCard = ({ app, section, onInstallClick, viewMode }) => {
  const pNameStr = typeof app.packageName === 'string' ? app.packageName : '';
  const finalAppName = app.appName || (pNameStr ? pNameStr.split('.').pop() : 'Unknown Application');

  // 1. Derive data from props to match the requested structure
  const daysCount = section === 'install' ? 0 : app.daysActive;
  const daysTarget = 14;
  const testersCount = app.displayTesterCount;
  const testersTarget = 12;
  
  // New status logic based on database field
  let derivedStatus = section; // Start with the section name
  if (app.isPaidByAdmin || app.status === 'completed') {
    derivedStatus = 'paid';
  } else if (app.status === 'production_access') {
    derivedStatus = 'production';
  } else if (section === 'ongoing') {
    derivedStatus = 'ongoing';
  }

  const statusConfig = {
    install: { label: 'To Install', actionText: 'Tap to install', icon: AlertTriangle },
    ongoing: { label: 'Ongoing', actionText: 'Keep testing', icon: AlertTriangle },
    production: { label: 'Production', actionText: 'Testing complete', icon: CheckCircle },
    paid: { label: 'Paid', actionText: 'Payment processed', icon: CheckCircle, color: 'text-green-500' },
  };

  const currentStatus = statusConfig[derivedStatus] || statusConfig.install;

  const daysProgress = Math.min(100, (daysCount / daysTarget) * 100);
  const testersProgress = Math.min(100, (testersCount / testersTarget) * 100);

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
      onClick={handleCardClick}
      className="w-full bg-gradient-to-br from-teal-100 via-white to-orange-100 rounded-[2rem] cursor-pointer p-0.5 flex flex-col"
      style={{ boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 15px 30px -15px rgba(0, 0, 0, 0.15)' }}
    >
      <div className="bg-gradient-to-br from-white/90 to-white/70 rounded-[1.9rem] h-full w-full backdrop-blur-md flex flex-col flex-1">
        <div className="p-5 sm:pb-4">
          {/* --- SHARED HEADER --- */}
          <div className="flex items-start justify-between">
            <div className="min-w-0 pr-4">
              <p className="text-[12px] text-slate-500">App Name</p>
              <p className="text-base font-bold text-slate-900 mb-1 truncate" title={finalAppName}>{finalAppName}</p>
              <p className="text-[12px] text-slate-500 mt-2">Status</p>
              <p className="text-sm font-semibold text-slate-900">{currentStatus.label}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[12px] text-slate-500">Days</p>
              <p className="text-base font-bold text-slate-900 mb-1">
                {daysCount}<span className="font-medium text-slate-400">/{daysTarget}</span>
              </p>
              <p className="text-[12px] text-slate-500 mt-2">Testers</p>
              <p className="text-base font-bold text-slate-900">
                {testersCount}<span className="font-medium text-slate-400">/{testersTarget}</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* --- TABLET/PC FOOTER (Hidden by default, visible on sm+) --- */}
      <div className="hidden sm:flex items-center justify-between gap-6 bg-[#F8FAFC] border-t border-slate-200 px-5 py-3 rounded-b-[1.9rem]">
        <div className="flex items-center gap-2 text-[13px] font-medium text-slate-900">
          <SlidersHorizontal className="w-4 h-4 text-slate-500" />
          {currentStatus.actionText}
        </div>
        <div className="flex items-center gap-2 text-[13px] font-medium text-slate-900">
          <Users className="w-4 h-4 text-slate-500" />
          Active testers: {testersCount}
        </div>
      </div>
    </motion.div>
  );
};