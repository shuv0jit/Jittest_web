/* eslint-disable no-unused-vars */
import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, getDocs, doc, addDoc, deleteDoc, updateDoc, writeBatch, onSnapshot, query, where, increment, serverTimestamp, setDoc } from 'firebase/firestore';
import { Plus, Trash2, Edit, DollarSign, Undo, Image as ImageIcon, X, LayoutGrid, List, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function AdminApps() {
  const [apps, setApps] = useState([]);
  const [testers, setTesters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('Ongoing');
  const [viewMode, setViewMode] = useState('grid');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [missingTestersApp, setMissingTestersApp] = useState(null);
  const [editingApp, setEditingApp] = useState(null);

  const [editPackageName, setEditPackageName] = useState('');
  const [editAppName, setEditAppName] = useState('');
  const [editInstalledCount, setEditInstalledCount] = useState(0);
  const [editDayCount, setEditDayCount] = useState(0);
  const [editAppOwner, setEditAppOwner] = useState('dont know yet');

  // Form State
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
    });
    return () => unsub();
  }, []);

  // Fetch Testers for cross-referencing Missing Installs
  useEffect(() => {
    const q = query(collection(db, 'users'), where("role", "==", "tester"));
    const unsub = onSnapshot(q, (snapshot) => {
      setTesters(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
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
        installedCount: 0,
        isPaidByAdmin: false,
        packageName: packageName,
        owner: appOwner,
        paidAt: null,
        startTime: null,
        status: 'waiting',
        targetTesters: 12,
        testerIds: []
      };

      const docRef = await addDoc(collection(db, 'apps'), newApp);
      setIsAddModalOpen(false);
      setPackageName('');
      setAppName('');
      setAppOwner('dont know yet');
    } catch (error) {
      console.error("Error adding app: ", error);
      alert("Failed to add app.");
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteApp = async (appId) => {
    if (window.confirm("CAUTION: Are you sure you want to delete this app? This action cannot be undone.")) {
      try {
        await deleteDoc(doc(db, 'apps', appId));
      } catch (error) {
        console.error("Error deleting app: ", error);
      }
    }
  };

  const handlePayToggle = async (appId, isPaying) => {
    try {
      const app = apps.find(a => a.id === appId);
      const testerIds = app?.testerIds || [];

      // Toggle the isPaidByAdmin flag
      await updateDoc(doc(db, 'apps', appId), { isPaidByAdmin: isPaying });

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
      console.error("Error updating status: ", error);
    }
  };

  const handleEditClick = (app) => {
    setEditingApp(app);
    setEditPackageName(app.packageName || '');
    setEditAppName(app.appName || '');
    setEditInstalledCount(Math.max(app.testerIds?.length || 0, app.installedCount || 0));
    setEditDayCount(app.daysActive || 0);
    setEditAppOwner(app.owner || 'dont know yet');
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      // Update startTime so the dynamic daysActive calculation perfectly matches the edited dayCount
      const newStartTime = new Date();
      newStartTime.setDate(newStartTime.getDate() - Number(editDayCount));

      const updatedData = {
        packageName: editPackageName,
        appName: editAppName,
        installedCount: Number(editInstalledCount),
        dayCount: Number(editDayCount),
        startTime: newStartTime,
        owner: editAppOwner
      };
      await updateDoc(doc(db, 'apps', editingApp.id), updatedData);
      setIsEditModalOpen(false);
      setEditingApp(null);
    } catch (error) {
      console.error("Error updating app: ", error);
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
        daysActive = Math.floor(Math.max(0, new Date() - start) / (1000 * 60 * 60 * 24));
      }
    }
    
    const displayTesterCount = Math.max(app.testerIds?.length || 0, app.installedCount || 0);
    return { ...app, pNameStr, aNameStr, finalAppName, daysActive, displayTesterCount };
  }).filter(app => app.pNameStr || app.aNameStr); // Skip empty apps

  const filterApps = (statusFilter) => {
    return processedApps.filter(app => {
      if (statusFilter === 'Paid') return app.isPaidByAdmin;
      
      const isToInstall = !app.isPaidByAdmin && app.displayTesterCount < 12;
      if (statusFilter === 'To Install') return isToInstall;

      const isReviews = app.status === 'Reviews' || app.status === 'production_access' || app.daysActive >= 14;
      if (statusFilter === 'Reviews') return !app.isPaidByAdmin && !isToInstall && isReviews;
      
      if (statusFilter === 'Ongoing') return !app.isPaidByAdmin && !isToInstall && !isReviews;
      return false;
    });
  };

  const currentApps = filterApps(activeTab);

  // Framer Motion Variants
  const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.05 } }
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <div className="p-4 md:p-8 h-full flex flex-col">
      {/* Header and Add Button */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h2 className="text-2xl font-bold text-blue-900">App Management</h2>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="bg-white border border-blue-100 rounded-lg flex p-1 shadow-sm shrink-0">
            <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-blue-50 text-blue-600' : 'text-gray-400 hover:text-blue-500'}`}><LayoutGrid className="w-5 h-5" /></button>
            <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-blue-50 text-blue-600' : 'text-gray-400 hover:text-blue-500'}`}><List className="w-5 h-5" /></button>
          </div>
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="flex-1 md:flex-none bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg flex items-center justify-center transition-colors shadow-sm font-semibold"
          >
            <Plus className="w-5 h-5 mr-2" />
            Add New App
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto space-x-4 mb-6 border-b border-gray-200 pb-1 scrollbar-hide">
        {['To Install', 'Ongoing', 'Reviews', 'Paid'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`pb-2 px-2 md:px-4 text-sm font-medium transition-colors relative whitespace-nowrap ${
              activeTab === tab ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab === 'To Install' && 'To Install '}
            {tab === 'Ongoing' && 'Closed Testing '}
            {tab === 'Reviews' && 'Reviews/Approval '}
            {tab === 'Paid' && 'Paid '}
            <span className="ml-2 bg-gray-100 text-gray-600 py-0.5 px-2 rounded-full text-xs">
              {filterApps(tab).length}
            </span>
            {activeTab === tab && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-t-md" />
            )}
          </button>
        ))}
      </div>

      {/* App Grid */}
      {loading ? (
        <div className="flex-1 flex justify-center items-center text-blue-600">Loading Apps...</div>
      ) : (
        <div className="flex-1 overflow-y-auto pr-2">
          {currentApps.length === 0 ? (
            <div className="text-center text-gray-400 mt-10">No apps found in this section.</div>
          ) : (
            <motion.div variants={containerVariants} initial="hidden" animate="show" className={viewMode === 'grid' ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 pb-6" : "flex flex-col gap-4 pb-6"}>
              {currentApps.map((app) => (
                <motion.div variants={itemVariants} key={app.id} className={`bg-white rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-all p-6 relative group flex ${viewMode === 'list' ? 'flex-col md:flex-row md:items-center gap-4' : 'flex-col'}`}>
                  
                  {/* Close/Delete Button */}
                  <button 
                    onClick={() => handleDeleteApp(app.id)}
                    className="absolute top-4 right-4 p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors z-10"
                    title="Delete App"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>

                  <div className="flex items-center flex-1 min-w-0 pr-8">
                    {app.imageUrl ? (
                      <img src={app.imageUrl} alt={app.finalAppName} className="w-14 h-14 rounded-xl object-cover shadow-sm mr-4 border border-gray-100" />
                    ) : (
                      <div className="w-14 h-14 rounded-xl bg-blue-50 flex items-center justify-center mr-4 text-blue-300 border border-blue-100">
                        <ImageIcon className="w-6 h-6" />
                      </div>
                    )}
                    <div className="flex-1 overflow-hidden">
                      <h3 className="font-bold text-gray-900 truncate" title={app.finalAppName}>{app.finalAppName}</h3>
                      <p className="text-[11px] text-gray-500 truncate mt-0.5 font-medium" title={app.pNameStr}>{app.pNameStr}</p>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className={`grid grid-cols-2 gap-4 bg-blue-50/30 p-3 rounded-lg border border-blue-50/50 ${viewMode === 'list' ? 'md:w-64' : 'my-4'}`}>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Installs</div>
                      <div className="font-semibold text-blue-900">{app.displayTesterCount} / 12</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Days</div>
                      <div className="font-semibold text-blue-900">{app.daysActive} / 14</div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className={`flex flex-wrap gap-3 w-full ${viewMode === 'list' ? 'md:w-auto mt-4 md:mt-0' : 'mt-auto pt-2'}`}>
                    <button 
                      onClick={() => setMissingTestersApp(app)}
                      className="flex-1 md:flex-none min-h-[44px] border border-amber-200 text-amber-600 bg-amber-50 py-2.5 px-3 rounded-xl text-sm font-semibold hover:bg-amber-100 flex justify-center items-center transition-colors"
                      title="View Missing Testers"
                    >
                      <Users className="w-4 h-4 md:mr-1" /> <span className={viewMode === 'grid' ? '' : 'hidden md:inline'}>Missing</span>
                    </button>

                    <button 
                      onClick={() => handleEditClick(app)}
                      className="flex-1 md:flex-none min-h-[44px] border border-gray-200 text-gray-600 py-2.5 px-3 rounded-xl text-sm font-semibold hover:bg-gray-50 flex justify-center items-center transition-colors"
                    >
                      <Edit className="w-4 h-4 md:mr-1" /> <span className={viewMode === 'grid' ? '' : 'hidden md:inline'}>Edit</span>
                    </button>
                    
                    {!app.isPaidByAdmin ? (
                      <button 
                        onClick={() => handlePayToggle(app.id, true)}
                        className="flex-1 md:flex-none min-h-[44px] bg-emerald-600 text-white py-2.5 px-3 rounded-xl text-sm font-semibold hover:bg-emerald-700 flex justify-center items-center transition-colors shadow-sm"
                      >
                        <DollarSign className="w-4 h-4 md:mr-1" /> <span className={viewMode === 'grid' ? '' : 'hidden md:inline'}>Pay</span>
                      </button>
                    ) : (
                      <button 
                        onClick={() => handlePayToggle(app.id, false)}
                        className="flex-1 md:flex-none min-h-[44px] bg-red-500 text-white py-2.5 px-3 rounded-xl text-sm font-semibold hover:bg-red-600 flex justify-center items-center transition-colors shadow-sm"
                      >
                        <Undo className="w-4 h-4 md:mr-1" /> <span className={viewMode === 'grid' ? '' : 'hidden md:inline'}>Unpay</span>
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>
      )}

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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Installed Count</label>
                  <input 
                    type="number" required min="0" value={editInstalledCount}
                    onChange={(e) => setEditInstalledCount(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Day Count</label>
                  <input 
                    type="number" required min="0" max="14" value={editDayCount}
                    onChange={(e) => setEditDayCount(e.target.value)}
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
                
                if (missing.length === 0) {
                  return <div className="p-8 text-center text-emerald-600 font-bold bg-emerald-50 rounded-xl m-3 border border-emerald-100">All registered testers have installed this app!</div>;
                }
                return missing.map((t, idx) => (
                  <div key={t.id} className={`flex items-center justify-between p-4 ${idx !== missing.length - 1 ? 'border-b border-gray-50' : ''}`}>
                    <div>
                      <div className="font-bold text-gray-800 text-sm">{t.name || "Unknown Tester"}</div>
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