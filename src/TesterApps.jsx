import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, onSnapshot, doc, updateDoc, arrayUnion, serverTimestamp } from 'firebase/firestore';
import { useAuth } from './AuthContext';
import { Download, Clock, CheckCircle, CreditCard, PlaySquare, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function TesterApps() {
  const { currentUser } = useAuth();
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState('install');

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
          const diffTime = Math.max(0, new Date() - start);
          daysActive = Math.floor(diffTime / (1000 * 60 * 60 * 24));
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
          if (daysActive >= 14) {
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
  
  const handleMarkInstalled = async (appId) => {
    try {
      const appRef = doc(db, 'apps', appId);
      await updateDoc(appRef, {
        testerIds: arrayUnion(currentUser.uid)
      });
    } catch (error) {
      alert("Failed to mark as installed. Please try again.");
    }
  };

  const handleInstallClick = async (app) => {
    if (app.packageName) {
      window.open(`https://play.google.com/store/apps/details?id=${app.packageName}`, '_blank', 'noopener,noreferrer');
    }
    await handleMarkInstalled(app.id);
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
    <div className="flex flex-col max-w-7xl mx-auto w-full pb-20 md:pb-0">
      
      {/* Header and Sub Tabs */}
      <div className="mb-8">
        <h2 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight mb-4">Application Pipeline</h2>
        
        <div className="flex bg-white p-1.5 rounded-2xl border border-slate-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] overflow-x-auto scrollbar-hide">
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
                className={`relative flex items-center px-4 sm:px-6 py-3 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${isActive ? 'text-blue-700' : 'text-slate-400 hover:text-slate-700'}`}
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
      </div>

      {/* Cards Grid */}
      <AnimatePresence mode="wait">
        {currentApps.length === 0 ? (
          <motion.div key="empty-state" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center h-64 text-center">
            <div className="w-20 h-20 bg-slate-100 rounded-[2rem] flex items-center justify-center mb-4"><CheckCircle className="w-10 h-10 text-slate-300" /></div>
            <h3 className="text-xl font-black text-slate-700">No Applications Found</h3>
            <p className="text-slate-400 font-medium mt-2">You're completely caught up in this section.</p>
          </motion.div>
        ) : (
          <motion.div key="grid-state" variants={containerVariants} initial="hidden" animate="show" exit={{ opacity: 0 }} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {currentApps.map((app) => (
              <AppCard 
                key={app.id} 
                app={app} 
                section={activeSubTab} 
                onInstallClick={() => handleInstallClick(app)} 
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Responsive & Animated App Card Component
const AppCard = ({ app, section, onInstallClick }) => {
  const pNameStr = typeof app.packageName === 'string' ? app.packageName : '';
  const finalAppName = app.appName || (pNameStr ? pNameStr.split('.').pop() : 'Unknown Application');
  
  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
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
      whileTap={{ scale: 0.98 }} // Mobile Press Interaction
      onClick={handleCardClick}
      className="cursor-pointer bg-white/90 backdrop-blur-xl p-5 rounded-[1.5rem] shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-blue-50 flex flex-col relative overflow-hidden group"
    >
      <div className="flex items-center mb-6 gap-4 relative z-10">
        {app.imageUrl ? (
          <img src={app.imageUrl} alt={finalAppName} className="w-16 h-16 rounded-2xl object-cover shadow-sm ring-1 ring-slate-900/5" />
        ) : (
          <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center border border-blue-100">
            <PlaySquare className="w-7 h-7 text-blue-400" />
          </div>
        )}
        <div className="flex-1 overflow-hidden">
          <h3 className="font-black text-lg text-slate-800 truncate leading-tight group-hover:text-blue-600 transition-colors">{finalAppName}</h3>
          <p className="text-xs font-semibold text-slate-400 truncate mt-1">{app.packageName}</p>
        </div>
      </div>

      {/* Dynamic Section Based Bottom Area */}
      <div className="mt-auto w-full space-y-3">
        <div className="flex justify-between items-center text-[11px] font-bold text-slate-500 uppercase tracking-wider px-1">
          <span>Registered Testers</span>
          <span className="text-blue-600">{app.displayTesterCount || 0}/12</span>
        </div>

        {section === 'install' && (
          <button onClick={(e) => { e.stopPropagation(); onInstallClick(); }} className="w-full bg-blue-600 text-white py-3.5 rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20 flex justify-center items-center">
            <Download className="w-4 h-4 mr-2"/> Install via Play Store
          </button>
        )}

        {section === 'ongoing' && (
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
             <div className="flex justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
               <span>Testing Progress</span>
               <span className="text-blue-600">Day {app.daysActive}/14</span>
             </div>
             <div className="w-full bg-slate-200/80 rounded-full h-2.5 overflow-hidden">
                <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, (app.daysActive / 14) * 100)}%` }} transition={{ duration: 1, ease: "easeOut" }} className="bg-blue-500 h-full rounded-full" />
             </div>
          </div>
        )}

        {section === 'production' && (
          <div className="w-full bg-blue-50 text-blue-600 py-3 rounded-xl text-sm font-bold flex justify-center items-center border border-blue-100">
             <CheckCircle2 className="w-4 h-4 mr-2"/> Testing Complete
          </div>
        )}

        {section === 'paid' && (
          <div className="w-full bg-emerald-50 text-emerald-600 py-3 rounded-xl text-sm font-bold flex justify-center items-center border border-emerald-100">
             <CheckCircle2 className="w-4 h-4 mr-2"/> Payment Dispatched
          </div>
        )}
      </div>
      
    </motion.div>
  );
};