import React from 'react';
import { Bell, Clock, ShieldAlert, CheckCircle2, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function TesterNotifications({ notifications, onBack }) {
  
  // Sort notifications by updatedAt descending locally
  const sortedNotifs = [...(notifications || [])].sort((a, b) => {
    const dateA = a.updatedAt?.toDate ? a.updatedAt.toDate() : new Date(a.updatedAt || 0);
    const dateB = b.updatedAt?.toDate ? b.updatedAt.toDate() : new Date(b.updatedAt || 0);
    return dateB - dateA;
  });

  const formatDateTime = (dateVal) => {
    if (!dateVal) return '';
    const d = dateVal.toDate ? dateVal.toDate() : new Date(dateVal);
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  };

  return (
    <div className="flex flex-col max-w-4xl mx-auto w-full pb-20 md:pb-0 h-full">
      
      {onBack && (
        <div className="mb-4 mt-2">
          <button onClick={onBack} className="flex items-center text-sm font-bold text-slate-600 hover:text-blue-600 transition-colors bg-white px-4 py-2.5 rounded-xl border border-slate-200 shadow-sm w-max">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Dashboard
          </button>
        </div>
      )}

      <div className="flex items-center bg-amber-50 border border-amber-100 p-3 rounded-xl mb-4">
        <ShieldAlert className="w-4 h-4 mr-2 text-amber-500 shrink-0"/> 
        <p className="text-xs sm:text-sm text-amber-700 font-medium">Note: Notifications may be deleted after 2 months for data storage issues.</p>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3">
        <AnimatePresence mode="wait">
          {sortedNotifs.length === 0 ? (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center text-slate-400 bg-white p-10 rounded-[2rem] border border-slate-100 shadow-[0_2px_10px_rgb(0,0,0,0.02)] mt-4 flex flex-col items-center">
              <Bell className="w-12 h-12 text-slate-200 mb-4" strokeWidth={1.5} />
              <p className="font-bold">You have no new notifications at this time.</p>
            </motion.div>
          ) : (
            sortedNotifs.map((notif) => (
              <motion.div key={notif.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white p-5 rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.02)] border border-slate-100 flex flex-col sm:flex-row sm:items-center gap-4 group">
                <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center shrink-0 border border-emerald-100 shadow-sm">
                  <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                </div>
                <div>
                  <h3 className="font-black text-slate-800 text-lg tracking-tight">Payment Received</h3>
                  <p className="text-sm text-slate-600 mt-0.5 font-medium">
                    {notif.count === 1 
                      ? `1 app was paid by admins, you received ${notif.amount || 50} TK.` 
                      : `${notif.count} apps were paid by admins on that last time. You received ${notif.amount} TK.`}
                  </p>
                  <div className="flex items-center text-[11px] text-slate-400 mt-2 font-bold tracking-wider uppercase"><Clock className="w-3 h-3 mr-1.5" /> {formatDateTime(notif.updatedAt)}</div>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}