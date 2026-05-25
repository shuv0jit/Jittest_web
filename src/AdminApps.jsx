/* eslint-disable no-unused-vars */
import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, getDocs, doc, addDoc, deleteDoc, updateDoc, writeBatch, onSnapshot, query, where, increment, serverTimestamp, setDoc } from 'firebase/firestore';
import { Plus, Trash2, Edit, DollarSign, Undo, Image as ImageIcon, X, LayoutGrid, List, Users, Download, Clock, CheckCircle, CreditCard, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function AdminApps() {
  const [apps, setApps] = useState([]);
  const [testers, setTesters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('Ongoing');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('grid');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [missingTestersApp, setMissingTestersApp] = useState(null);
  const [editingApp, setEditingApp] = useState(null);

  const [editPackageName, setEditPackageName] = useState('');
  const [editAppName, setEditAppName] = useState('');
  const [editInstalledCount, setEditInstalledCount] = useState(0);
  const [editDayCount, setEditDayCount] = useState(0);
  const [editStartTime, setEditStartTime] = useState('');
  const [editAppOwner, setEditAppOwner] = useState('dont know yet');

  const [touchStartX, setTouchStartX] = useState(null);
  const [touchEndX, setTouchEndX] = useState(null);
  const [touchStartY, setTouchStartY] = useState(null);
  const [touchEndY, setTouchEndY] = useState(null);

  // Form State
  const [appLink, setAppLink] = useState('');
  const [packageName, setPackageName] = useState('');
  const [appName, setAppName] = useState('');
  const [appOwner, setAppOwner] = useState('dont know yet');
  const [uploading, setUploading] = useState(false);

  // Real-time listener for Apps
  useEffect(() => {
    setLoading(true);
    const unsub = onSnapshot(collection(db, 'apps'), (snapshot) => {
      setApps(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => {
      setLoading(false); // Stop the infinite loading spinner
    });
    return () => unsub();
  }, []);

  // Fetch Testers for cross-referencing Missing Installs
  useEffect(() => {
    const q = query(collection(db, 'users'), where("role", "==", "tester"));
    const unsub = onSnapshot(q, (snapshot) => {
      setTesters(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
    });
    return () => unsub();
  }, []);

  const handleAddApp = async (e) => {
    e.preventDefault();
    setUploading(true);
    try {
      let finalAppName = appName;
      if (!finalAppName) {
        const parts = packageName.split('.');
        finalAppName = parts[parts.length - 1]; // Extract last word if empty
      }

      const newApp = {
        appName: finalAppName,
        createdAt: serverTimestamp(),
        installedCount: 1, // Auto-include your admin tester account
        isPaidByAdmin: false,
        packageName: packageName,
        owner: appOwner,
        paidAt: null,
        startTime: null,
        status: 'waiting',
        targetTesters: 12,
        testerIds: ['Tg0UN8ayxFSzCTmTuorR0UxI2Y12'] // Your specific tester ID
      };

      const docRef = await addDoc(collection(db, 'apps'), newApp);
      setIsAddModalOpen(false);
      
      // Trigger background push notifications via Vercel Serverless Function
      try {
        fetch('/api/notifyNewApp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ appName: finalAppName })
          });
      } catch(e) {
        // Catch sync errors silently so UI flow isn't blocked
      }

      setAppLink('');
      setPackageName('');
      setAppName('');
      setAppOwner('dont know yet');
    } catch (error) {
      alert("Failed to add app.");
    } finally {
      setUploading(false);
    }
  };

  // Auto-extract package name and app name from Play Store URL
  const handleLinkChange = (e) => {
    const link = e.target.value;
    setAppLink(link);
    
    const idMatch = link.match(/id=([a-zA-Z0-9._]+)/);
    if (idMatch && idMatch[1]) {
      const id = idMatch[1];
      setPackageName(id);
      const parts = id.split('.');
      setAppName(parts.length >= 3 ? parts[2] : parts[parts.length - 1]);
    }
  };

  const handleDeleteApp = async (appId) => {
    if (window.confirm("CAUTION: Are you sure you want to delete this app? This action cannot be undone.")) {
      try {
        await deleteDoc(doc(db, 'apps', appId));
      } catch (error) {
      }
    }
  };

  const handlePayToggle = async (appId, isPaying) => {
    try {
      const app = apps.find(a => a.id === appId);
      const testerIds = app?.testerIds || [];

      // Toggle the isPaidByAdmin flag
      await updateDoc(doc(db, 'apps', appId), { 
        isPaidByAdmin: isPaying,
        paidAt: isPaying ? serverTimestamp() : null
      });

      // Only update the withdrawable balance for testers who ACTUALLY installed this app!
      if (testerIds.length > 0) {
        const batch = writeBatch(db);
        const hourId = Math.floor(Date.now() / 3600000); // Unique ID for the current 1-hour window
        
        const promises = testerIds.map(async (testerId) => {
          const userRef = doc(db, 'users', testerId);
          batch.update(userRef, {
            withdrawableBalance: increment(isPaying ? 50 : -50)
          });

          // Group payment notifications automatically by the hour
          if (isPaying) {
            const notifRef = doc(db, 'testerNotifications', `pay_${testerId}_${hourId}`);
            batch.set(notifRef, {
              testerId: testerId,
              type: 'payment',
              count: increment(1),
              amount: increment(50),
              updatedAt: serverTimestamp()
            }, { merge: true });
          } else {
            // Reverse notification on unpay
            const q = query(collection(db, 'testerNotifications'), where('testerId', '==', testerId));
            const notifSnap = await getDocs(q);
            const payments = notifSnap.docs
              .filter(d => d.data().type === 'payment')
              .sort((a, b) => {
                const dateA = a.data().updatedAt?.toDate ? a.data().updatedAt.toDate().getTime() : 0;
                const dateB = b.data().updatedAt?.toDate ? b.data().updatedAt.toDate().getTime() : 0;
                return dateB - dateA; // Sort descending to get the most recent payment
              });
            
            if (payments.length > 0) {
              const latestNotif = payments[0];
              if (latestNotif.data().count > 1) {
                batch.update(latestNotif.ref, {
                  count: increment(-1),
                  amount: increment(-50)
                });
              } else {
                batch.delete(latestNotif.ref);
              }
            }
          }
        });
        await Promise.all(promises);
        await batch.commit();
      }
      alert(`App successfully ${isPaying ? 'Paid' : 'Unpaid'}. Tester balances updated.`);
    } catch (error) {
    }
  };

  const handleEditClick = (app) => {
    setEditingApp(app);
    setEditPackageName(app.packageName || '');
    setEditAppName(app.appName || '');
    setEditInstalledCount(app.testerIds?.length || 0);
    setEditDayCount(app.daysActive || 0);
    
    if (app.startTime) {
      const start = app.startTime.toDate ? app.startTime.toDate() : new Date(app.startTime);
      if (!isNaN(start)) {
        const year = start.getFullYear();
        const month = String(start.getMonth() + 1).padStart(2, '0');
        const day = String(start.getDate()).padStart(2, '0');
        setEditStartTime(`${year}-${month}-${day}`);
      } else {
        setEditStartTime('');
      }
    } else {
      setEditStartTime('');
    }

    setEditAppOwner(app.owner || 'dont know yet');
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      // 2-Step Verification: Ensure installed count does not exceed total live testers
      let finalInstalledCount = Number(editInstalledCount);
      if (testers.length > 0 && finalInstalledCount > testers.length) {
        alert(`Verification Failed: You cannot set installed count to ${finalInstalledCount} because there are currently only ${testers.length} registered testers. Adjusting to the maximum available limit.`);
        finalInstalledCount = testers.length;
      }

      const updatedData = {
        packageName: editPackageName,
        appName: editAppName,
        installedCount: finalInstalledCount,
        owner: editAppOwner
      };

      if (Number(editInstalledCount) >= 12 && Number(editDayCount) === 0 && !editStartTime) {
        // Auto-start timer if admin manually pushes installs to 12+ but leaves Day Count at 0
        updatedData.startTime = serverTimestamp();
        updatedData.status = 'Ongoing';
        updatedData.dayCount = 0;
      } else if (editStartTime) {
        // Update startTime based on the date picker
        const startMidnight = new Date(editStartTime);
        startMidnight.setHours(0, 0, 0, 0);
        updatedData.startTime = startMidnight;
      } else {
        updatedData.startTime = null;
      }

      await updateDoc(doc(db, 'apps', editingApp.id), updatedData);
      setIsEditModalOpen(false);
      setEditingApp(null);
    } catch (error) {
      alert("Failed to update app.");
    }
  };

  // Apply identical formatting & time calculation as Tester panel
  const processedApps = apps.map(app => {
    const pNameStr = typeof app.packageName === 'string' ? app.packageName.trim() : '';
    const aNameStr = typeof app.appName === 'string' ? app.appName.trim() : '';
    const finalAppName = aNameStr || (pNameStr ? pNameStr.split('.').pop() : 'Unknown Application');
    
    let daysActive = app.dayCount || 0;
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
    // Connected Socket Math: Ensure display count never exceeds total live testers
    let displayTesterCount = Array.isArray(app.testerIds) ? app.testerIds.length : 0;

    if (testers.length > 0 && displayTesterCount > testers.length) {
      displayTesterCount = testers.length;
    }

    return { ...app, pNameStr, aNameStr, finalAppName, daysActive, displayTesterCount };
  }).filter(app => app.pNameStr || app.aNameStr); // Skip empty apps

  const filterApps = (statusFilter) => {
    return processedApps.filter(app => {
      if (statusFilter === 'Paid') return app.isPaidByAdmin;
      
      const isToInstall = !app.isPaidByAdmin && app.displayTesterCount < 12;
      if (statusFilter === 'To Install') return isToInstall;

      const isReviews = app.status === 'Reviews' || app.status === 'production_access' || app.daysActive >= 15;
      if (statusFilter === 'Reviews') return !app.isPaidByAdmin && !isToInstall && isReviews;
      
      if (statusFilter === 'Ongoing') return !app.isPaidByAdmin && !isToInstall && !isReviews;
      return false;
    });
  };

  const currentApps = filterApps(activeTab).filter(app => {
    if (!searchQuery) return true;
    const lowerQ = searchQuery.toLowerCase();
    return (app.finalAppName?.toLowerCase().includes(lowerQ) || app.pNameStr?.toLowerCase().includes(lowerQ));
  });

  currentApps.sort((a, b) => {
    if (activeTab === 'Ongoing') {
      return b.daysActive - a.daysActive;
    } else if (activeTab === 'Reviews') {
      return (b.startTime?.toDate?.() || 0) - (a.startTime?.toDate?.() || 0);
    } else if (activeTab === 'Paid') {
      return (b.paidAt?.toDate?.() || 0) - (a.paidAt?.toDate?.() || 0);
    }
    return 0;
  });

  // Framer Motion Variants
  const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.05 } }
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0 }
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
      const tabs = ['To Install', 'Ongoing', 'Reviews', 'Paid'];
      const currentIndex = tabs.indexOf(activeTab);

      if (distanceX > 50 && currentIndex < tabs.length - 1) setActiveTab(tabs[currentIndex + 1]);
      if (distanceX < -50 && currentIndex > 0) setActiveTab(tabs[currentIndex - 1]);
    }
  };

  return (
    <div className="flex flex-col max-w-7xl mx-auto w-full h-full" onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
      
      {/* Header and Sub Tabs */}
      <div className="mb-4 sm:mb-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2 sm:gap-3">
          <div className="flex bg-white p-1 rounded-xl border border-slate-100 shadow-sm overflow-x-auto scrollbar-hide flex-1 min-w-0">
            {[
              { id: 'To Install', label: 'To Install', icon: Download },
              { id: 'Ongoing', label: 'Closed Testing', icon: Clock },
              { id: 'Reviews', label: 'Reviews/Approval', icon: CheckCircle },
              { id: 'Paid', label: 'Paid', icon: CreditCard }
            ].map((tab) => {
              const isActive = activeTab === tab.id;
              const count = filterApps(tab.id).length;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative flex items-center px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${isActive ? 'text-blue-700' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  {isActive && (
                    <motion.div layoutId="activeTabAdmin" className="absolute inset-0 bg-blue-50 rounded-lg border border-blue-100/50" transition={{ type: "spring", stiffness: 400, damping: 30 }} />
                  )}
                  <span className="relative z-10 flex items-center">
                    <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2 hidden sm:block" />
                    {tab.label}
                    <span className={`ml-1.5 sm:ml-2 px-1.5 py-0.5 rounded-full text-[9px] sm:text-[10px] leading-none flex items-center justify-center ${isActive ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>{count}</span>
                  </span>
                </button>
              );
            })}
          </div>
          
          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
            <div className="flex items-center gap-2 h-9 sm:h-10 justify-between sm:justify-start">
              <button 
                onClick={() => setIsAddModalOpen(true)}
                className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 bg-blue-600 text-white rounded-xl shadow-sm hover:bg-blue-700 hover:shadow-md hover:scale-105 active:scale-95 transition-all shrink-0"
                title="Add App"
              >
                <Plus className="w-5 h-5" />
              </button>
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

      {/* App Grid */}
      <div>
        {loading ? (
          <div className="flex justify-center items-center h-64 text-blue-600 font-bold animate-pulse">Loading Apps...</div>
        ) : currentApps.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <div className="w-20 h-20 bg-slate-100 rounded-[2rem] flex items-center justify-center mb-4"><LayoutGrid className="w-10 h-10 text-slate-300" /></div>
            <h3 className="text-xl font-black text-slate-700">No Apps Found</h3>
            <p className="text-slate-400 font-medium mt-2">There are no applications in this section.</p>
          </div>
        ) : (
          <motion.div variants={containerVariants} initial="hidden" animate="show" className={viewMode === 'grid' ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" : "flex flex-col gap-3"}>
              {currentApps.map((app) => (
              <motion.div 
                variants={itemVariants} 
                key={app.id} 
                onClick={() => window.open(`https://play.google.com/store/apps/details?id=${app.packageName}`, '_blank')}
                className={`cursor-pointer bg-white rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-all p-3 sm:p-4 relative group flex ${viewMode === 'list' ? 'flex-col sm:flex-row sm:items-center gap-3 sm:gap-4' : 'flex-col text-center'}`}>
                  
                  {/* Close/Delete Button */}
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleDeleteApp(app.id); }}
                    className="absolute top-2 right-2 sm:top-3 sm:right-3 p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors z-10"
                    title="Delete App"
                  >
                    <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>

                  <div className={`flex flex-1 min-w-0 w-full ${viewMode === 'list' ? 'items-center text-left pr-8' : 'flex-col items-center pt-2'}`}>
                    {app.imageUrl ? (
                      <img src={app.imageUrl} alt={app.finalAppName} className={`rounded-xl object-cover shadow-sm border border-gray-100 shrink-0 ${viewMode === 'list' ? 'w-12 h-12 mr-4' : 'w-12 h-12 sm:w-14 sm:h-14 mb-2 sm:mb-3'}`} />
                    ) : (
                      <div className={`rounded-xl bg-blue-50 flex items-center justify-center text-blue-300 border border-blue-100 shrink-0 ${viewMode === 'list' ? 'w-12 h-12 mr-4' : 'w-12 h-12 sm:w-14 sm:h-14 mb-2 sm:mb-3'}`}>
                        <ImageIcon className="w-6 h-6" />
                      </div>
                    )}
                    <div className="flex-1 overflow-hidden w-full">
                      <h3 className="font-bold text-gray-900 truncate text-sm sm:text-base" title={app.finalAppName}>{app.finalAppName}</h3>
                      <p className="text-[9px] sm:text-[11px] text-gray-500 truncate mt-0.5 font-medium" title={app.pNameStr}>{app.pNameStr}</p>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className={`grid grid-cols-2 gap-2 w-full ${viewMode === 'grid' ? 'my-3' : 'mt-3 sm:mt-0 sm:w-40 shrink-0'}`}>
                    <div className="bg-blue-50/50 p-2 rounded-lg border border-blue-100/50 text-center">
                      <div className="text-[9px] sm:text-[10px] text-gray-500 mb-0.5 uppercase font-bold">Installs</div>
                      <div className="font-bold text-blue-900 text-xs sm:text-sm">{app.displayTesterCount}/12</div>
                    </div>
                    <div className="bg-blue-50/50 p-2 rounded-lg border border-blue-100/50 text-center">
                      <div className="text-[9px] sm:text-[10px] text-gray-500 mb-0.5 uppercase font-bold">Days</div>
                      <div className="font-bold text-blue-900 text-xs sm:text-sm">{app.daysActive}/14</div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className={`flex gap-2 sm:gap-3 ${viewMode === 'list' ? 'sm:w-auto sm:ml-auto mt-3 sm:mt-0' : 'w-full mt-auto pt-2'}`}>
                    <button 
                      onClick={(e) => { e.stopPropagation(); setMissingTestersApp(app); }}
                      className="flex-1 sm:flex-none border border-amber-200 text-amber-600 bg-amber-50 py-2 sm:py-2.5 min-h-[44px] px-2 rounded-xl text-[11px] sm:text-xs font-semibold hover:bg-amber-100 flex justify-center items-center transition-colors"
                      title="View Missing Testers"
                    >
                      <Users className="w-3 h-3 sm:w-4 sm:h-4 md:mr-1" /> <span className={viewMode === 'grid' ? 'hidden sm:inline' : 'hidden md:inline'}>Missing</span>
                    </button>

                    <button 
                      onClick={(e) => { e.stopPropagation(); handleEditClick(app); }}
                      className="flex-1 sm:flex-none border border-slate-200 text-slate-600 bg-slate-50 py-2 sm:py-2.5 min-h-[44px] px-2 rounded-xl text-[11px] sm:text-xs font-semibold hover:bg-slate-100 flex justify-center items-center transition-colors"
                    >
                      <Edit className="w-3 h-3 sm:w-4 sm:h-4 md:mr-1" /> <span className={viewMode === 'grid' ? 'hidden sm:inline' : 'hidden md:inline'}>Edit</span>
                    </button>
                    
                    {!app.isPaidByAdmin ? (
                      <button 
                        onClick={(e) => { e.stopPropagation(); handlePayToggle(app.id, true); }}
                        className="flex-1 sm:flex-none bg-emerald-600 text-white py-2 sm:py-2.5 min-h-[44px] px-2 rounded-xl text-[11px] sm:text-xs font-semibold hover:bg-emerald-700 flex justify-center items-center transition-colors shadow-sm"
                      >
                        <DollarSign className="w-3 h-3 sm:w-4 sm:h-4 md:mr-1" /> <span className={viewMode === 'grid' ? 'hidden sm:inline' : 'hidden md:inline'}>Pay</span>
                      </button>
                    ) : (
                      <button 
                        onClick={(e) => { e.stopPropagation(); handlePayToggle(app.id, false); }}
                        className="flex-1 sm:flex-none bg-red-500 text-white py-2 sm:py-2.5 min-h-[44px] px-2 rounded-xl text-[11px] sm:text-xs font-semibold hover:bg-red-600 flex justify-center items-center transition-colors shadow-sm"
                      >
                        <Undo className="w-3 h-3 sm:w-4 sm:h-4 md:mr-1" /> <span className={viewMode === 'grid' ? 'hidden sm:inline' : 'hidden md:inline'}>Unpay</span>
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}
            </motion.div>
        )}
      </div>

      {/* Add App Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-xl font-bold text-gray-900">Add New App</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleAddApp} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Play Store Link (Auto-fill)</label>
                <input 
                  type="text" 
                  value={appLink}
                  onChange={handleLinkChange}
                  placeholder="https://play.google.com/store/apps/details?id=com.example.app"
                  className="w-full px-3 py-2 border border-blue-200 bg-blue-50 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                />
              </div>
              <div className="relative flex items-center py-1">
                 <div className="flex-grow border-t border-gray-200"></div>
                 <span className="shrink-0 mx-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Or Manual Entry</span>
                 <div className="flex-grow border-t border-gray-200"></div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">App Name *</label>
                <input 
                  type="text" 
                  required 
                  value={appName}
                  onChange={(e) => setAppName(e.target.value)}
                  placeholder="e.g. Hisab"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Package Name *</label>
                <input 
                  type="text" 
                  required 
                  value={packageName}
                  onChange={(e) => setPackageName(e.target.value)}
                  placeholder="com.example.app"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">App Owner *</label>
                <select 
                  value={appOwner} 
                  onChange={(e) => setAppOwner(e.target.value)} 
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-white"
                >
                  <option value="dont know yet">Don't know yet</option>
                  <option value="shuvojit">Shuvojit</option>
                  <option value="nobojit">Nobojit</option>
                </select>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button 
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={uploading}
                  className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {uploading ? 'Adding...' : 'Add App'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit App Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-xl font-bold text-gray-900">Edit App</h3>
              <button onClick={() => setIsEditModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Package Name</label>
                <input 
                  type="text" required value={editPackageName}
                  onChange={(e) => setEditPackageName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">App Name</label>
                <input 
                  type="text" required value={editAppName}
                  onChange={(e) => setEditAppName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Installed Count</label>
                  <input 
                    type="number" required min="0" value={editInstalledCount}
                    onChange={(e) => setEditInstalledCount(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                  <input 
                    type="date" value={editStartTime}
                    onChange={(e) => {
                      setEditStartTime(e.target.value);
                      if (e.target.value) {
                        const startMidnight = new Date(e.target.value);
                        startMidnight.setHours(0, 0, 0, 0);
                        const nowMidnight = new Date();
                        nowMidnight.setHours(0, 0, 0, 0);
                        const days = Math.floor(Math.max(0, nowMidnight.getTime() - startMidnight.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                        setEditDayCount(days);
                      } else {
                        setEditDayCount(0);
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Day Count</label>
                  <input 
                    type="number" required min="0" max="14" value={editDayCount}
                    onChange={(e) => {
                      const days = Number(e.target.value);
                      setEditDayCount(days);
                      if (days > 0) {
                        const newStartTime = new Date();
                        newStartTime.setDate(newStartTime.getDate() - days);
                        const year = newStartTime.getFullYear();
                        const month = String(newStartTime.getMonth() + 1).padStart(2, '0');
                        const day = String(newStartTime.getDate()).padStart(2, '0');
                        setEditStartTime(`${year}-${month}-${day}`);
                      } else {
                        setEditStartTime('');
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">App Owner</label>
                <select 
                  value={editAppOwner} 
                  onChange={(e) => setEditAppOwner(e.target.value)} 
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-white"
                >
                  <option value="dont know yet">Don't know yet</option>
                  <option value="shuvojit">Shuvojit</option>
                  <option value="nobojit">Nobojit</option>
                </select>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button type="button" onClick={() => setIsEditModalOpen(false)} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Missing Testers Modal */}
      {missingTestersApp && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[80vh]">
            <div className="flex justify-between items-center p-5 border-b border-gray-100 bg-gray-50/50">
              <div>
                <h3 className="text-lg font-bold text-gray-900 leading-tight">Missing Testers</h3>
                <p className="text-xs text-gray-500 mt-1">{missingTestersApp.finalAppName}</p>
              </div>
              <button onClick={() => setMissingTestersApp(null)} className="text-gray-400 hover:text-gray-600 bg-white border border-gray-200 p-1.5 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            
            <div className="overflow-y-auto p-2">
              {(() => {
                const testedIds = missingTestersApp.testerIds || [];
                const missing = testers.filter(t => !testedIds.includes(t.id));
                
                let finalMissingList = missing;
                
                // 2-Step Socket Verification: Installed + Missing cannot exceed total testers
                if (missingTestersApp.displayTesterCount >= testers.length) {
                  finalMissingList = [];
                }

                if (finalMissingList.length === 0) {
                  return <div className="p-8 text-center text-emerald-600 font-bold bg-emerald-50 rounded-xl m-3 border border-emerald-100">All registered testers have installed this app!</div>;
                }
                return finalMissingList.map((t, idx) => (
                  <div key={t.id} className={`flex items-center justify-between p-4 ${idx !== finalMissingList.length - 1 ? 'border-b border-gray-50' : ''}`}>
                    <div>
                      <div className="font-bold text-sm text-gray-800">{t.name || 'Unknown Tester'}</div>
                      <div className="text-xs text-gray-500">{t.email}</div>
                    </div>
                
                    <span className="bg-red-50 text-red-600 px-2.5 py-1 rounded-md text-[10px] font-bold border border-red-100">Not Installed</span>
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}