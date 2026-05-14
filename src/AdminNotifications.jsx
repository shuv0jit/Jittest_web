import React from 'react';
import { db } from './firebase';
import { doc, deleteDoc } from 'firebase/firestore';
import { Bell, Trash2, Clock, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function AdminNotifications({ notifications, onBack }) {
  
  const handleDelete = async (id) => {
    try {
      await deleteDoc(doc(db, 'notifications', id));
    } catch (error) {
    }
  };

  const formatDateTime = (dateVal) => {
    if (!dateVal) return '';
    const d = dateVal.toDate ? dateVal.toDate() : new Date(dateVal);
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  };

  return (
    <div className="p-4 md:p-8 h-full flex flex-col">
      {onBack && (
        <div className="mb-6">
          <button onClick={onBack} className="flex items-center text-sm font-bold text-slate-500 hover:text-blue-600 transition-colors bg-white px-4 py-2.5 rounded-xl border border-slate-200 shadow-sm w-max">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Dashboard
          </button>
        </div>
      )}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-blue-900 flex items-center tracking-tight">
          <Bell className="w-6 h-6 mr-3 text-blue-600" /> System Notifications
        </h2>
        <div className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-bold shadow-sm">
          {notifications.length} Alerts
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 space-y-4">
        <AnimatePresence mode="popLayout">
          {notifications.length === 0 ? (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center text-slate-500 bg-white p-12 rounded-2xl border border-slate-100 shadow-sm mt-4 flex flex-col items-center">
              <Bell className="w-12 h-12 text-slate-300 mb-4" strokeWidth={1.5} />
              <p className="font-semibold">You have no notifications at this time.</p>
            </motion.div>
          ) : (
            notifications.map((notif) => (
              <motion.div key={notif.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white p-6 rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.02)] border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group hover:shadow-md transition-all">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center shrink-0 border border-amber-100 shadow-sm">
                    <Bell className="w-6 h-6 text-amber-500" />
                  </div>
                  <div>
                    <h3 className="font-black text-gray-900 text-lg tracking-tight">{notif.title || 'System Alert'}</h3>
                    <p className="text-sm text-gray-600 mt-1 leading-relaxed font-medium">{notif.message}</p>
                    <div className="flex items-center text-[11px] text-gray-400 mt-2 font-bold tracking-wider uppercase">
                      <Clock className="w-3 h-3 mr-1.5" />
                      {formatDateTime(notif.createdAt)}
                    </div>
                  </div>
                </div>
                <button onClick={() => handleDelete(notif.id)} className="self-end sm:self-center p-3 min-h-[44px] text-slate-400 hover:text-red-500 hover:bg-red-50 border border-transparent hover:border-red-100 rounded-xl transition-all shrink-0" title="Delete Notification">
                  <Trash2 className="w-5 h-5" />
                </button>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}