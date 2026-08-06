import React from 'react';
import { motion } from 'framer-motion';

const DynamicAppIcon = ({ appName, size = 14, className = '' }) => {
  const initial = appName ? appName.charAt(0).toUpperCase() : '?';
  const colorPalette = [
    '#2563EB', '#1D4ED8', '#0F3A9F', // Blues
    '#059669', '#047857', '#065F46', // Greens
    '#D97706', '#B45309', '#92400E', // Ambers
    '#DC2626', '#B91C1C', '#991B1B', // Reds
  ];

  // Simple hash function to pick a consistent color based on the initial
  const getColor = (char) => {
    const charCode = char.charCodeAt(0);
    return colorPalette[charCode % colorPalette.length];
  };

  const bgColor = getColor(initial);
  const textColor = '#FFFFFF'; // Always white text for contrast

  // Determine a simple shape based on the initial for some variety
  const getShape = (char) => {
    const charCode = char.charCodeAt(0);
    if (charCode % 3 === 0) return 'circle';
    if (charCode % 3 === 1) return 'square';
    return 'triangle';
  };

  const shape = getShape(initial);

  const iconSize = size * 4; // Tailwind w-14, h-14 is 56px, so size=14 means 56px
  const fontSize = size * 0.4; // Adjust font size relative to icon size

  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 20 }}
      className={`relative flex items-center justify-center rounded-xl overflow-hidden ${className}`}
      style={{ width: iconSize, height: iconSize }}
    >
      <svg width="100%" height="100%" viewBox="0 0 100 100" className="absolute inset-0">
        {shape === 'circle' && (<circle cx="50" cy="50" r="45" fill={bgColor} />)}
        {shape === 'square' && (<rect x="5" y="5" width="90" height="90" rx="15" ry="15" fill={bgColor} />)}
        {shape === 'triangle' && (<polygon points="50,5 95,95 5,95" fill={bgColor} />)}
        <text x="50" y="58" textAnchor="middle" dominantBaseline="middle" fontSize={fontSize * 2.5} fontWeight="bold" fill={textColor} fontFamily="sans-serif">
          {initial}
        </text>
      </svg>
    </motion.div>
  );
};

export default DynamicAppIcon;