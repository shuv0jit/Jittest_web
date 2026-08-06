import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, onSnapshot, doc, updateDoc, arrayUnion, serverTimestamp } from 'firebase/firestore';
import { useAuth } from './AuthContext';
import { Download, Clock, CheckCircle, CreditCard, PlaySquare, CheckCircle2, LayoutGrid, List, Search } from 'lucide-react';
import DynamicAppIcon from './DynamicAppIcon';
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

      // STEP 2: Check status for 'production_access'
      if (appWithDays.status === 'production_access') {
        if (hasTested) {
          categorizedApps.production.push(appWithDays);
        } else {
          categorizedApps.install.push(appWithDays);
        }
        continue; // App is assigned, immediately skip the rest of the checks
      }

      // STEP 3: Check status for 'Ongoing'
      if (appWithDays.status === 'Ongoing') {
        if (hasTested) {
        categorizedApps.ongoing.push(appWithDays);
        } else {
          categorizedApps.install.push(appWithDays);
        }
        continue; // App is assigned, skip the rest
      }

      // STEP 4: Default categorization for any other apps (e.g., status is 'waiting' or undefined)
      if (!hasTested) {
        categorizedApps.install.push(appWithDays);
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

// Responsive & Animated App Card Component
const AppCard = ({ app, section, onInstallClick, viewMode }) => {
  const pNameStr = typeof app.packageName === 'string' ? app.packageName : '';
  const finalAppName = app.appName || (pNameStr ? pNameStr.split('.').pop() : 'Unknown Application');
  const daysProgress = Math.min(1, (section === 'install' ? 0 : app.daysActive) / 14);

  // --- DYNAMIC CHART GENERATION ---
  // This function creates a pseudo-random, but consistent, path for the graph based on app data.
  const generateChartPath = (testerCount, maxTesters = 14) => {
    const points = [
      { x: 0, y: 68 } // Start point
    ];
    // Create a few data points for a more realistic curve
    for (let i = 1; i < 4; i++) {
      // Use app ID to create a consistent but varied shape
      const yVariance = (app.id.charCodeAt(i % app.id.length) % 20) - 10;
      points.push({ x: i * 25, y: 60 - (i * (testerCount / maxTesters) * 2) + yVariance });
    }
    // End point is the actual tester count
    points.push({ x: 100, y: 68 - (testerCount / maxTesters) * 60 });
    
    // Create a smooth SVG curve from the points
    let path = `M ${points[0].x},${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const x_mid = (points[i].x + points[i+1].x) / 2;
      const y_mid = (points[i].y + points[i+1].y) / 2;
      const cp_x1 = (x_mid + points[i].x) / 2;
      const cp_x2 = (x_mid + points[i+1].x) / 2;
      path += ` Q ${cp_x1},${points[i].y} ${x_mid},${y_mid}`;
      path += ` Q ${cp_x2},${points[i+1].y} ${points[i+1].x},${points[i+1].y}`;
    }
    return path;
  };

  const chartPath = generateChartPath(app.displayTesterCount);
  const areaPath = `${chartPath} L 100,70 L 0,70 Z`;
  // --- END DYNAMIC CHART GENERATION ---

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
      className="relative w-full rounded-2xl bg-gradient-to-br from-green-200 via-green-100 to-green-200 p-0.5 shadow-xl shadow-green-900/10 cursor-pointer group"
    >
      <div className="relative h-full w-full rounded-[0.9rem] bg-white p-4 flex flex-col overflow-hidden transition-all group-hover:shadow-inner">
        <div className="absolute inset-0 bg-[url('/subtle-pattern.svg')] opacity-[0.03] pointer-events-none"></div>

        {/* Top Section: App Info */}
        <div className="flex flex-col items-center text-center mb-4">
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            className="w-14 h-14 mb-3 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-green-500/20 overflow-hidden"
          >
            {app.imageUrl ? (
              <img src={app.imageUrl} alt={finalAppName} className="w-full h-full object-cover rounded-3xl" />
            ) : (
              <img 
                src={`https://ui-avatars.com/api/?name=${encodeURIComponent(finalAppName)}&background=random&color=fff&size=128&font-size=0.3&bold=true`} 
                alt={finalAppName} 
                className="w-full h-full object-cover" 
              />
            )}
          </motion.div>
          <h2 className="text-sm font-black text-blue-700 tracking-tight">{finalAppName}</h2>
          <p className="text-[10px] text-slate-500 mt-0.5 font-medium truncate">{app.packageName}</p>
        </div>

        {/* Metrics & Install Graph */}
        <div className="grid grid-cols-2 gap-4 my-auto text-center">
          <div className="flex flex-col">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">INSTALLS</p>
            <p className="text-lg font-black text-slate-900 mt-1">
              {app.displayTesterCount}<span className="text-slate-900">/12</span>
            </p>
            <div className="w-full h-1 bg-slate-100 rounded-full mt-2 overflow-hidden"><div className="h-full bg-black" style={{width: `${Math.min(100, (app.displayTesterCount / 12) * 100)}%`}}></div></div>
          </div>
          <div className="flex flex-col">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">DAYS</p>
            <p className="text-lg font-black text-slate-900 mt-1">
              {section === 'install' ? 0 : app.daysActive}<span className="text-slate-900">/14</span>
            </p>
            <div className="w-full h-1 bg-slate-100 rounded-full mt-2 overflow-hidden"><div className="h-full bg-black" style={{width: `${daysProgress * 100}%`}}></div></div>
          </div>
        </div>

        {/* Days Progress Bar at the bottom */}
        <div className="mt-auto pt-4">
          <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden relative border-2 border-slate-200">
            <motion.div
              className="absolute inset-0 rounded-full liquid-progress-bar"
              initial={{ width: 0 }}
              animate={{ width: `${daysProgress * 100}%` }}
              transition={{ duration: 2, ease: [0.22, 1, 0.36, 1] }}
            />
            {/* White head at the END of the bar */}
            <motion.div
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 bg-gradient-to-br from-stone-200 to-neutral-900 rounded-none z-20 border-2 border-white shadow-md outline outline-1 outline-blue-500/50"  initial={{ left: '0%' }}
              animate={{ left: `${daysProgress * 100}%` }}
              transition={{ duration: 2, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
};