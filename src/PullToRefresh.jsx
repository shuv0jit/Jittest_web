import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';

export default function PullToRefresh({ children }) {
  const [startY, setStartY] = useState(0);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const MAX_PULL = 120;
  const THRESHOLD = 70;

  useEffect(() => {
    const handleTouchStart = (e) => {
      // Check if we are at the top of the closest scrolling container
      const scrollable = e.target.closest('.overflow-auto, .overflow-y-auto');
      // If there is no scrollable container, or we are at the absolute top of it, allow pull
      if (!scrollable || scrollable.scrollTop <= 0) {
        setStartY(e.touches[0].clientY);
      } else {
        setStartY(0); // Ignore pull if they are already scrolled down
      }
    };

    const handleTouchMove = (e) => {
      if (startY > 0 && !isRefreshing) {
        const currentY = e.touches[0].clientY;
        const distance = currentY - startY;

        // Only trigger if pulling downwards
        if (distance > 0) {
          // Prevent default browser scrolling to give focus to our custom pull animation
          if (e.cancelable && distance > 10) {
             e.preventDefault();
          }
          setPullDistance(Math.min(distance * 0.4, MAX_PULL)); 
        } else {
          setPullDistance(0);
        }
      }
    };

    const handleTouchEnd = async () => {
      if (pullDistance >= THRESHOLD && !isRefreshing) {
        setIsRefreshing(true);
        
        // Simulate a soft sync/update delay instead of a hard browser refresh
        // Firebase is already real-time, so this gives tactile feedback of a manual sync!
        await new Promise(resolve => setTimeout(resolve, 1200));
        
        setIsRefreshing(false);
        setPullDistance(0);
        setStartY(0);
      } else if (!isRefreshing) {
        setPullDistance(0);
        setStartY(0);
      }
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [startY, pullDistance, isRefreshing]);

  return (
    <div className="w-full h-full relative">
      <AnimatePresence>
        {pullDistance > 0 && (
          <motion.div initial={{ opacity: 0, y: -50, scale: 0.5 }} animate={{ opacity: Math.min(1, pullDistance / THRESHOLD), y: Math.min(pullDistance, MAX_PULL) - 50, scale: pullDistance >= THRESHOLD ? 1.1 : 1 }} exit={{ opacity: 0, y: -50, scale: 0.5 }} transition={{ type: "spring", stiffness: 300, damping: 20 }} className="fixed top-0 left-1/2 -translate-x-1/2 z-[9999] flex justify-center pointer-events-none">
            <div className="bg-white shadow-xl shadow-blue-900/10 rounded-full p-2.5 flex items-center justify-center border border-slate-100 mt-4">
              {isRefreshing ? (
                <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
              ) : (
                <Loader2 className="w-6 h-6 text-blue-600" style={{ transform: `rotate(${pullDistance * 4}deg)` }} />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <div style={{ transform: `translateY(${isRefreshing ? THRESHOLD * 0.4 : pullDistance * 0.15}px)`, transition: (pullDistance === 0 || isRefreshing) ? 'transform 0.3s ease-out' : 'none' }} className="w-full h-full">
        {children}
      </div>
    </div>
  );
}