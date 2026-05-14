import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutDashboard, Wallet, User, PlaySquare, X, Bell } from 'lucide-react';

export default function TesterSidebar({ activeTab, setActiveTab, isOpen, setIsOpen }) {
  const navItems = [
    { id: 'apps', label: 'Testing Apps', icon: LayoutDashboard },
    { id: 'wallet', label: 'My Wallet', icon: Wallet },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'profile', label: 'Profile', icon: User }
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 md:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar Shell */}
      <div className={`fixed inset-y-0 left-0 z-50 w-72 bg-white flex flex-col md:static md:translate-x-0 transition-transform duration-300 ease-in-out shadow-2xl md:shadow-[4px_0_24px_rgba(0,0,0,0.02)] border-r border-slate-100 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        
        <div className="h-14 sm:h-16 flex items-center justify-between px-6 sm:px-8 border-b border-slate-100/60">
          <div className="flex items-center">
             <img src="/logo.jpg" alt="JitTest Logo" className="h-8 sm:h-9 w-auto object-contain rounded-lg" />
          </div>
          <button onClick={() => setIsOpen(false)} className="md:hidden text-slate-400 hover:text-slate-600 bg-slate-50 p-1.5 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 mt-8 px-5 space-y-2.5">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button key={item.id} onClick={() => { setActiveTab(item.id); setIsOpen(false); }} className={`w-full flex items-center px-4 py-4 rounded-[1.2rem] transition-all duration-300 font-bold tracking-wide ${isActive ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25' : 'text-slate-500 hover:bg-slate-50 hover:text-blue-600'}`}>
                <Icon className={`w-5 h-5 mr-3.5 transition-colors ${isActive ? 'text-white' : 'text-slate-400'}`} /> {item.label}
              </button>
            );
          })}
        </nav>
      </div>
    </>
  );
}