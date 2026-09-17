// AppCard.jsx
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  CheckCircle,
  Users,
  ArrowRight
} from 'lucide-react';
import {
  doc,
  getDoc,
  runTransaction
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth } from './firebase';

const DAYS_TARGET = 14;
const TESTERS_TARGET = 12;

const STATUS_CONFIG = {
  install: {
    label: 'To install',
    action: 'Tap to install',
    icon: AlertTriangle,
    text: 'text-amber-700',
    bg: 'bg-amber-50',
    ring: '#F59E0B',
    pulse: true,
  },
  ongoing: {
    label: 'Ongoing',
    action: 'Click to test',
    icon: AlertTriangle,
    text: 'text-blue-700',
    bg: 'bg-blue-50',
    ring: '#3B82F6',
    pulse: false,
  },
  production: {
    label: 'Production',
    action: 'Testing complete',
    icon: CheckCircle,
    text: 'text-emerald-700',
    bg: 'bg-emerald-50',
    ring: '#10B981',
    pulse: false,
  },
  paid: {
    label: 'Paid',
    action: 'Paid',
    icon: CheckCircle,
    text: 'text-emerald-700',
    bg: 'bg-emerald-50',
    ring: '#10B981',
    pulse: false,
  },
};

function getDerivedStatus(app, section) {
  if (app.isPaidByAdmin || app.status === 'completed') return 'paid';
  if (app.status === 'production_access') return 'production';
  if (section === 'ongoing') return 'ongoing';
  return 'install';
}

// Bangladesh date: YYYY-MM-DD
function getBangladeshDate() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Dhaka',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export default function AppCard({
  app,
  section,
  onInstallClick,
  viewMode = 'grid',
  ongoingAppsCount = 0,
}) {
  const derivedStatus = getDerivedStatus(app, section);
  const config = STATUS_CONFIG[derivedStatus];
  const StatusIcon = config.icon;

  const [today, setToday] = useState(getBangladeshDate());
  const [testedToday, setTestedToday] = useState(false);
  const [loading, setLoading] = useState(false);

  const rawAppName = app.appName || app.packageName || 'Untitled app';
  const appName =
    rawAppName.charAt(0).toUpperCase() + rawAppName.slice(1);

  const daysCount = app.daysActive ?? 0;
  const testersCount = app.displayTesterCount ?? 0;
  const testersUnderTarget = testersCount < TESTERS_TARGET;

  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const progressRatio = Math.min(daysCount / DAYS_TARGET, 1);
  const offset = circumference - progressRatio * circumference;

  const isList = viewMode === 'list';

  // Check today's testing record
  useEffect(() => {
    if (section !== 'ongoing') return;

    let unsubscribe;

    unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user?.email || !app?.id) return;

      try {
        const logRef = doc(db, 'testingLogs', user.email);
        const snap = await getDoc(logRef);

        if (!snap.exists()) {
          setTestedToday(false);
          return;
        }

        const data = snap.data();
        const todayApps = data.tested?.[today] || [];

        setTestedToday(todayApps.includes(app.id));
      } catch (error) {
        console.error('Testing log read error:', error);
      }
    });

    return () => unsubscribe?.();
  }, [app?.id, section, today]);

  // Automatically reset at Bangladesh midnight
  useEffect(() => {
    const checkDate = () => {
      const newDate = getBangladeshDate();

      if (newDate !== today) {
        setToday(newDate);
        setTestedToday(false);
      }
    };

    const interval = setInterval(checkDate, 30000);

    return () => clearInterval(interval);
  }, [today]);

  const handleTestClick = async () => {
    if (section !== 'ongoing') {
      if (section === 'install') {
        onInstallClick?.();
      } else {
        window.open(
          `https://play.google.com/store/apps/details?id=${app.packageName}`,
          '_blank',
          'noopener,noreferrer'
        );
      }

      return;
    }

   if (loading || !app?.id) return;
    const user = auth.currentUser;

    if (!user?.email) {
      alert('Please login first.');
      return;
    }

    setLoading(true);

    // Open Play Store immediately so popup blocker doesn't stop it
    const playWindow = window.open(
      `https://play.google.com/store/apps/details?id=${app.packageName}`,
      '_blank'
    );

    try {
      const logRef = doc(db, 'testingLogs', user.email);

      await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(logRef);

        const data = snap.exists() ? snap.data() : {};
        const tested = data.tested || {};

        // Apps tested today
        const todayApps = Array.isArray(tested[today])
          ? tested[today]
          : [];

        // Already tested → don't count again
        if (todayApps.includes(app.id)) {
          return;
        }

        const updatedTodayApps = [...todayApps, app.id];

        transaction.set(
          logRef,
          {
            tested: {
              ...tested,
              [today]: updatedTodayApps,
            },
          },
          { merge: true }
        );
      });

      setTestedToday(true);

      if (playWindow) {
        playWindow.focus();
      }
    } catch (error) {
      console.error('Testing log save error:', error);

      if (playWindow) {
        playWindow.close();
      }

      alert('Could not save testing status. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Only ongoing cards have today's tested state
  const buttonText =
    section === 'ongoing' && testedToday
      ? 'Tested today'
      : config.action;

  const ButtonIcon =
    section === 'ongoing' && testedToday
      ? CheckCircle
      : ArrowRight;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.35,
        ease: [0.22, 1, 0.36, 1],
      }}
      whileHover={{
        y: -4,
        boxShadow: '0 16px 32px rgba(47,95,255,0.14)',
      }}
      whileTap={{ scale: 0.98 }}
     onClick={handleTestClick}
      className={`relative cursor-pointer rounded-[22px] border border-blue-100/70 bg-gradient-to-b from-white via-white to-blue-50 shadow-[0_1px_2px_rgba(15,35,90,0.04),0_10px_24px_rgba(15,35,90,0.06)] flex ${
        isList
          ? 'flex-col sm:flex-row sm:items-center sm:gap-5 p-4'
          : 'flex-col p-4 text-center'
      }`}
    >
      {/* App name + status */}
      <div
        className={`flex flex-col items-center ${
          isList
            ? 'sm:items-start sm:flex-1 sm:min-w-0'
            : ''
        }`}
      >
        <h3 className="font-sora font-bold text-[15px] text-slate-800 leading-snug truncate w-full">
          {appName}
        </h3>

        <span
          className={`relative mt-1.5 inline-flex items-center gap-1 shrink-0 ${config.bg} ${config.text} font-mono text-[10px] font-semibold px-2 py-1 rounded-full overflow-hidden`}
        >
          {config.pulse && (
            <motion.span
              className="absolute inset-0 rounded-full"
              style={{ background: config.ring }}
              initial={{
                opacity: 0.25,
                scale: 1,
              }}
              animate={{
                opacity: 0,
                scale: 1.8,
              }}
              transition={{
                duration: 1.6,
                repeat: Infinity,
                ease: 'easeOut',
              }}
            />
          )}

          <StatusIcon
            size={11}
            className="relative z-10"
          />

          <span className="relative z-10">
            {config.label}
          </span>
        </span>
      </div>

      {/* Days + testers */}
      <div
        className={`flex flex-col items-center ${
          isList
            ? 'sm:flex-row sm:flex-1 sm:justify-start sm:gap-6'
            : ''
        }`}
      >
        {/* Circular days indicator */}
        <div className="relative flex justify-center my-2">
          <svg
            width="120"
            height="120"
            viewBox="0 0 120 120"
            className="-rotate-90"
          >
            <circle
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              stroke="#EEF3FC"
              strokeWidth="8"
            />

            <motion.circle
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              stroke={config.ring}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              initial={{
                strokeDashoffset: circumference,
              }}
              animate={{
                strokeDashoffset: offset,
              }}
              transition={{
                duration: 1,
                ease: [0.22, 1, 0.36, 1],
                delay: 0.15,
              }}
            />
          </svg>

          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <motion.div
              className="flex items-baseline gap-1"
              initial={{
                opacity: 0,
                scale: 0.85,
              }}
              animate={{
                opacity: 1,
                scale: 1,
              }}
              transition={{
                delay: 0.3,
                duration: 0.3,
              }}
            >
              <span className="font-sora font-extrabold text-[30px] text-slate-800 leading-none">
                {daysCount}
              </span>

              <span className="font-mono font-semibold text-xs text-slate-400">
                /{DAYS_TARGET}
              </span>
            </motion.div>

            <div className="text-[9.5px] font-medium text-slate-400 uppercase tracking-wider mt-1">
              days tested
            </div>
          </div>
        </div>

        {/* Tester count */}
        <div
          className={`flex items-center justify-center gap-1.5 py-2 mb-3 border-y border-dashed border-blue-100 w-full ${
            isList
              ? 'sm:border-none sm:py-0 sm:mb-0 sm:w-auto'
              : ''
          }`}
        >
          <Users
            size={13}
            className="text-blue-600"
          />

          <motion.span
            key={testersCount}
            initial={{
              opacity: 0,
              y: -4,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            className={`font-mono font-semibold text-[12px] ${
              testersUnderTarget
                ? 'text-red-600'
                : 'text-slate-800'
            }`}
          >
            {testersCount}/{TESTERS_TARGET}
          </motion.span>

          <span className="text-[11.5px] text-slate-400">
            testers active
          </span>
        </div>
      </div>

      {/* Action button */}
      <div
        className={`flex items-center justify-center ${
          isList ? 'sm:ml-auto' : ''
        }`}
      >
        <motion.button
          onClick={(e) => {
            e.stopPropagation();
            handleTestClick();
          }}
          disabled={
            section === 'ongoing' &&
            (testedToday || loading)
          }
          whileHover={
            !testedToday
              ? { scale: 1.03 }
              : undefined
          }
          whileTap={
            !testedToday
              ? { scale: 0.97 }
              : undefined
          }
          className={`group ${
            section === 'ongoing' && testedToday
              ? 'bg-emerald-500 hover:bg-emerald-600'
              : 'bg-blue-600 hover:bg-blue-700'
          } text-white font-sora font-bold text-[11px] py-2 rounded-xl flex items-center justify-center gap-1.5 transition-colors ${
            isList
              ? 'w-auto px-8'
              : 'w-full'
          }`}
          style={{
            minWidth: isList ? '160px' : 'auto',
          }}
        >
          {loading ? 'Saving...' : buttonText}

          <ButtonIcon
            size={14}
            className={
              testedToday
                ? ''
                : 'transition-transform duration-200 group-hover:translate-x-0.5'
            }
          />
        </motion.button>
      </div>
    </motion.div>
  );
}