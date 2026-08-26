import React from 'react';
import { db } from './firebase';
import { doc, deleteDoc } from 'firebase/firestore';
import {
  Bell,
  Check,
  Copy,
  Clock,
  ArrowLeft,
  AlertTriangle,
  WalletCards
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function AdminNotifications({ notifications = [], onBack }) {

  const handleDelete = async (id) => {
    try {
      await deleteDoc(doc(db, 'notifications', id));
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const handleCopy = async (text) => {
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
      alert('Copied');
    } catch (error) {
      console.error('Copy failed:', error);
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {

      // Existing production notification
      case 'production_reminder':
        return (
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-blue-50 flex items-center justify-center shrink-0 border border-blue-100 shadow-sm">
            <Check className="w-5 h-5 sm:w-6 sm:h-6 text-blue-500" />
          </div>
        );

      // New advance notification
      case 'advance_reminder':
        return (
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-emerald-50 flex items-center justify-center shrink-0 border border-emerald-100 shadow-sm">
            <WalletCards className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-500" />
          </div>
        );

      // Other system notifications
      default:
        return (
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-amber-50 flex items-center justify-center shrink-0 border border-amber-100 shadow-sm">
            <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 text-amber-500" />
          </div>
        );
    }
  };

  const formatDateTime = (dateVal) => {
    if (!dateVal) return '';

    try {
      const d = dateVal?.toDate
        ? dateVal.toDate()
        : new Date(dateVal);

      if (isNaN(d.getTime())) return '';

      return d.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      });
    } catch (error) {
      return '';
    }
  };

  const getNotificationLabel = (type) => {
    switch (type) {
      case 'advance_reminder':
        return 'Advance Reminder';

      case 'production_reminder':
        return 'Production Reminder';

      default:
        return 'System Alert';
    }
  };

  return (
    <div className="p-4 md:p-6 h-full flex flex-col">

      {/* Back Button */}
      {onBack && (
        <div className="mb-4 sm:mb-6">
          <button
            onClick={onBack}
            className="flex items-center text-sm font-bold text-slate-600 hover:text-blue-600 transition-colors bg-white px-4 py-2.5 rounded-xl border border-slate-200 shadow-sm w-max"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-row justify-between items-center mb-4 sm:mb-6 h-10 sm:h-auto">

        <h2 className="text-lg sm:text-2xl font-bold text-slate-800 flex items-center tracking-tight shrink-0">
          <Bell className="w-5 h-5 mr-2 sm:mr-3 text-blue-600" />
          System Notifications
        </h2>

        <div className="bg-blue-100 text-blue-700 px-2.5 sm:px-3 py-1 rounded-full text-[11px] sm:text-sm font-bold shadow-sm">
          {notifications.length} Alerts
        </div>

      </div>

      {/* Notifications */}
      <div className="flex-1 overflow-y-auto pr-1 -mr-2 space-y-2.5 sm:space-y-3">

        <AnimatePresence mode="popLayout">

          {notifications.length === 0 ? (

            /* Empty State */
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center text-slate-400 bg-white p-10 sm:p-12 rounded-2xl border border-slate-100 shadow-sm mt-4 flex flex-col items-center"
            >
              <Bell
                className="w-12 h-12 text-slate-300 mb-4"
                strokeWidth={1.5}
              />

              <p className="font-semibold">
                You have no notifications at this time.
              </p>
            </motion.div>

          ) : (

            notifications.map((notif) => (

              <motion.div
                key={notif.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={`bg-white p-3 sm:p-4 rounded-2xl shadow-sm border flex flex-row items-center justify-between gap-2 sm:gap-4 group hover:shadow-md transition-all ${
                  notif.type === 'advance_reminder'
                    ? 'border-emerald-100'
                    : 'border-slate-100'
                }`}
              >

                {/* Left Side */}
                <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">

                  {/* Icon */}
                  {getNotificationIcon(notif.type)}

                  {/* Notification Information */}
                  <div className="flex-1 min-w-0">

                    {/* Small Notification Type */}
                    {notif.type === 'advance_reminder' && (
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-[9px] sm:text-[10px] font-extrabold uppercase tracking-wider text-emerald-600">
                          Advance Required
                        </span>
                      </div>
                    )}

                    {/* Title */}
                    <h3 className="font-bold text-gray-800 text-sm whitespace-normal">
                      {notif.title || getNotificationLabel(notif.type)}
                    </h3>

                    {/* Message */}
                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed font-medium whitespace-normal">
                      {notif.message}
                    </p>

                    {/* Owner */}
                    {notif.owner && (
                      <p className="text-xs text-blue-600 font-semibold mt-1 whitespace-normal">
                        Owner: {notif.owner}
                      </p>
                    )}

                    {/* Date */}
                    <div className="flex items-center text-[10px] text-gray-400 mt-1 font-bold tracking-wider uppercase">
                      <Clock className="w-2.5 h-2.5 mr-1.5" />
                      {formatDateTime(notif.createdAt)}
                    </div>

                  </div>
                </div>

                {/* Right Side Actions */}
                <div className="flex flex-row items-center gap-1.5 shrink-0">

                  {/* Copy Owner */}
                  {notif.owner && (
                    <button
                      onClick={() => handleCopy(notif.owner)}
                      className="p-2 sm:p-2.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 border border-slate-200 rounded-lg transition-all"
                      title="Copy Owner"
                    >
                      <Copy className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </button>
                  )}

                  {/* Mark as Done */}
                  <button
                    onClick={() => handleDelete(notif.id)}
                    className="p-2 sm:p-2.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 border border-slate-200 rounded-lg transition-all"
                    title="Mark as Done"
                  >
                    <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </button>

                </div>

              </motion.div>

            ))
          )}

        </AnimatePresence>

      </div>
    </div>
  );
}