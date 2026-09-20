// AdminTestingInfo.jsx

import React, { useEffect, useMemo, useState } from 'react';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  documentId,
} from 'firebase/firestore';
import { db } from './firebase';

import {
  Check,
  X,
  UserCheck,
  UserX,
  RefreshCw,
  Trash2,
  CalendarDays,
  Moon,
  Sun,
  ChevronRight,
} from 'lucide-react';

const START_DATE = '2026-09-17';
const SPECIAL_TESTER = 'shuvojitgb@gmail.com';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function getBDDate() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Dhaka',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function dateObj(date) {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function toDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDate(date) {
  const d = dateObj(date);

  return d.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function getYesterday() {
  const d = dateObj(getBDDate());
  d.setDate(d.getDate() - 1);
  return toDateStr(d);
}

/** Formats an ISO timestamp as BD-local "11:17pm" style (no space, lowercase). */
function formatTimeBD(iso) {
  if (!iso) return null;

  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;

    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Dhaka',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).formatToParts(d);

    const hour = parts.find((p) => p.type === 'hour')?.value ?? '';
    const minute = parts.find((p) => p.type === 'minute')?.value ?? '';
    const period = (parts.find((p) => p.type === 'dayPeriod')?.value ?? '').toLowerCase();

    if (!hour || !minute) return null;
    return `${hour}:${minute}${period}`;
  } catch {
    return null;
  }
}

function getTesterName(user) {
  return (
    user.name ||
    user.displayName ||
    user.fullName ||
    user.email?.split('@')[0] ||
    'Unknown tester'
  );
}

function getInitials(name) {
  return name
    .split(' ')
    .map((x) => x[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

/**
 * A tester's daily log entry may be:
 *  - an array (legacy: list of tested app ids) -> tested if non-empty, no time
 *  - a boolean -> tested if true, no time
 *  - an object like { time: <ISO string> } -> tested, with a time
 * We never read/derive how many apps were tested — only whether the day is tested.
 */
function getDayStatus(logs, email, dateStr) {
  const entry = logs[email]?.tested?.[dateStr];

  if (entry === undefined || entry === null) {
    return { tested: false, time: null };
  }
  if (Array.isArray(entry)) {
    return { tested: entry.length > 0, time: null };
  }
  if (typeof entry === 'boolean') {
    return { tested: entry, time: null };
  }
  if (typeof entry === 'object') {
    const time = entry.time || entry.testedAt || null;
    return { tested: true, time };
  }

  return { tested: Boolean(entry), time: null };
}

/** Builds calendar month grids (with leading/trailing blanks) from START_DATE to endDate. */
function buildCalendarMonths(startDateStr, endDateStr) {
  const start = dateObj(startDateStr);
  const end = dateObj(endDateStr);

  const months = [];
  let y = start.getFullYear();
  let m = start.getMonth();

  while (y < end.getFullYear() || (y === end.getFullYear() && m <= end.getMonth())) {
    const firstDay = new Date(y, m, 1);
    const startWeekday = firstDay.getDay();
    const daysInMonth = new Date(y, m + 1, 0).getDate();

    const cells = [];
    for (let i = 0; i < startWeekday; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(y, m, d));
    while (cells.length % 7 !== 0) cells.push(null);

    const weeks = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

    months.push({ year: y, month: m, label: MONTH_LABELS[m], weeks });

    m += 1;
    if (m > 11) {
      m = 0;
      y += 1;
    }
  }

  return months;
}

export default function AdminTestingInfo() {

  const [logs, setLogs] = useState({});
  const [activeTesters, setActiveTesters] = useState([]);

  const [loading, setLoading] = useState(true);
  const [savingActive, setSavingActive] = useState(false);

  const [activeModal, setActiveModal] = useState(false);
  const [notTestedModal, setNotTestedModal] = useState(false);

  const [calendarTester, setCalendarTester] = useState(null);

  const [missedOption, setMissedOption] = useState('none'); // 'none' | 'yesterday' | 'custom'
  const [missedCustomDate, setMissedCustomDate] = useState('');

  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('adminTestingDark') === 'true';
  });

  const [selectedActive, setSelectedActive] = useState([]);

  // Full tester roster — only fetched once the Manage modal is opened.
  const [allUsers, setAllUsers] = useState([]);
  const [allUsersLoaded, setAllUsersLoaded] = useState(false);
  const [loadingManage, setLoadingManage] = useState(false);

  const today = getBDDate();
  const yesterday = getYesterday();

  // --------------------------------------------------
  // LOAD CORE DATA (active testers + their logs only)
  // --------------------------------------------------

  const loadData = async () => {
    setLoading(true);

    try {
      // 1. Active tester settings — 1 read
      const settingsRef = doc(db, 'testingSettings', 'activeTesters');
      const settingsSnap = await getDoc(settingsRef);

      let savedActive = settingsSnap.exists() ? settingsSnap.data().emails || [] : [];

      if (!savedActive.includes(SPECIAL_TESTER)) {
        savedActive = [...savedActive, SPECIAL_TESTER];
        await setDoc(settingsRef, { emails: savedActive }, { merge: true });
      }

      // 2. Logs for active testers only (needed for "Tested today" + "All testers")
      const logsData = {};
      const activeEmails = [...new Set(savedActive)];

      for (let i = 0; i < activeEmails.length; i += 30) {
        const emailBatch = activeEmails.slice(i, i + 30);
        if (!emailBatch.length) continue;

        const logsQuery = query(
          collection(db, 'testingLogs'),
          where(documentId(), 'in', emailBatch)
        );

        const logsSnap = await getDocs(logsQuery);
        logsSnap.forEach((d) => {
          logsData[d.id] = d.data();
        });
      }

      setLogs(logsData);
      setActiveTesters(savedActive);
      setSelectedActive(savedActive);
    } catch (error) {
      console.error('Admin testing load error:', error);
      alert('Could not load testing information.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // --------------------------------------------------
  // FULL TESTER ROSTER — lazy, only for the Manage modal
  // --------------------------------------------------

  const loadAllUsers = async () => {
    if (allUsersLoaded) return;

    setLoadingManage(true);

    try {
      const testersQuery = query(collection(db, 'users'), where('role', '==', 'tester'));
      const usersSnap = await getDocs(testersQuery);

      const usersData = usersSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((u) => u.email);

      setAllUsers(usersData);
      setAllUsersLoaded(true);
    } catch (error) {
      console.error('Tester roster load error:', error);
      alert('Could not load the tester list.');
    } finally {
      setLoadingManage(false);
    }
  };

  const openActiveModal = () => {
    setActiveModal(true);
    loadAllUsers();
  };

  // --------------------------------------------------
  // TESTER LIST (site-wide display names)
  // --------------------------------------------------

  const testerList = useMemo(() => {
    const map = {};

    allUsers.forEach((user) => {
      if (user.email) {
        map[user.email] = { email: user.email, name: getTesterName(user) };
      }
    });

    Object.keys(logs).forEach((email) => {
      if (!map[email]) {
        map[email] = { email, name: email.split('@')[0] };
      }
    });

    activeTesters.forEach((email) => {
      if (!map[email]) {
        map[email] = { email, name: email.split('@')[0] };
      }
    });

    if (!map[SPECIAL_TESTER]) {
      map[SPECIAL_TESTER] = { email: SPECIAL_TESTER, name: 'Shuvojit' };
    }

    return Object.values(map);
  }, [allUsers, logs, activeTesters]);

  // Roster shown inside the Manage modal (all potential testers + already-active ones)
  const manageTesterList = useMemo(() => {
    const map = {};

    allUsers.forEach((user) => {
      if (user.email) {
        map[user.email] = { email: user.email, name: getTesterName(user) };
      }
    });

    activeTesters.forEach((email) => {
      if (!map[email]) {
        map[email] = { email, name: email.split('@')[0] };
      }
    });

    if (!map[SPECIAL_TESTER]) {
      map[SPECIAL_TESTER] = { email: SPECIAL_TESTER, name: 'Shuvojit' };
    }

    return Object.values(map);
  }, [allUsers, activeTesters]);

  // --------------------------------------------------
  // TODAY
  // --------------------------------------------------

  const activeTesterData = useMemo(() => {
    return activeTesters
      .map((email) => {
        const user = testerList.find((u) => u.email === email) || {
          email,
          name: email.split('@')[0],
        };

        const { tested, time } = getDayStatus(logs, email, today);

        return { ...user, complete: tested, time };
      })
      .sort((a, b) => Number(b.complete) - Number(a.complete));
  }, [activeTesters, testerList, logs, today]);

  const todayComplete = activeTesterData.filter((t) => t.complete);
  const todayNotTested = activeTesterData.filter((t) => !t.complete);

  // --------------------------------------------------
  // MISSED REPORT — nothing computed until a period is chosen
  // --------------------------------------------------

  const missedDates = useMemo(() => {
    if (missedOption === 'yesterday') return [getYesterday()];
    if (missedOption === 'custom' && missedCustomDate) return [missedCustomDate];
    return [];
  }, [missedOption, missedCustomDate]);

  const missedData = useMemo(() => {
    if (!missedDates.length) return [];

    return activeTesters
      .map((email) => {
        const user = testerList.find((u) => u.email === email) || {
          email,
          name: email.split('@')[0],
        };

        const missed = missedDates.filter((date) => !getDayStatus(logs, email, date).tested);

        return { ...user, missedDates: missed, missedCount: missed.length };
      })
      .filter((t) => t.missedCount > 0)
      .sort((a, b) => b.missedCount - a.missedCount);
  }, [missedDates, activeTesters, testerList, logs]);

  // --------------------------------------------------
  // OVERALL DATA (day-based ratios — no app counts)
  // --------------------------------------------------

  const overallTesterData = useMemo(() => {
    const finalizedDates =
      dateObj(START_DATE) <= dateObj(yesterday)
        ? (() => {
            const result = [];
            let cur = dateObj(START_DATE);
            const last = dateObj(yesterday);
            while (cur <= last) {
              result.push(toDateStr(cur));
              cur.setDate(cur.getDate() + 1);
            }
            return result;
          })()
        : [];

    return activeTesters
      .map((email) => {
        const user = testerList.find((u) => u.email === email) || {
          email,
          name: email.split('@')[0],
        };

        const testedDays = finalizedDates.filter(
          (date) => getDayStatus(logs, email, date).tested
        ).length;
        const totalDays = finalizedDates.length;
        const missedDays = totalDays - testedDays;
        const ratio = totalDays > 0 ? testedDays / totalDays : 0;

        const { tested: testedToday } = getDayStatus(logs, email, today);

        return {
          ...user,
          testedDays,
          missedDays,
          totalDays,
          ratio,
          testedToday,
        };
      })
      .sort((a, b) => {
        if (b.ratio !== a.ratio) return b.ratio - a.ratio;
        if (a.missedDays !== b.missedDays) return a.missedDays - b.missedDays;
        return b.testedDays - a.testedDays;
      });
  }, [activeTesters, testerList, logs, today, yesterday]);

  // --------------------------------------------------
  // ACTIVE TESTER SAVE
  // --------------------------------------------------

  const toggleActiveTester = (email) => {
    if (email === SPECIAL_TESTER) return;

    setSelectedActive((prev) =>
      prev.includes(email) ? prev.filter((e) => e !== email) : [...prev, email]
    );
  };

  const saveActiveTesters = async () => {
    setSavingActive(true);

    try {
      let finalList = [...selectedActive];

      if (!finalList.includes(SPECIAL_TESTER)) {
        finalList.push(SPECIAL_TESTER);
      }

      await setDoc(
        doc(db, 'testingSettings', 'activeTesters'),
        { emails: finalList, updatedAt: new Date() },
        { merge: true }
      );

      setActiveTesters(finalList);
      setSelectedActive(finalList);
      setActiveModal(false);

      // Active roster changed — refresh logs for the new set.
      await loadData();
    } catch (error) {
      console.error(error);
      alert('Could not save active testers.');
    } finally {
      setSavingActive(false);
    }
  };

  // --------------------------------------------------
  // REMOVE TESTER TODAY
  // --------------------------------------------------

  const removeTesterToday = async (email) => {
    if (!window.confirm(`Remove ${email} from today's testing?`)) {
      return;
    }

    try {
      const logRef = doc(db, 'testingLogs', email);
      const snap = await getDoc(logRef);

      if (!snap.exists()) return;

      const data = snap.data();
      const tested = { ...(data.tested || {}) };
      tested[today] = false;

      await updateDoc(logRef, { tested });

      setLogs((prev) => ({
        ...prev,
        [email]: { ...prev[email], tested },
      }));
    } catch (error) {
      console.error(error);
      alert('Could not remove tester from today.');
    }
  };

  // --------------------------------------------------
  // DARK MODE
  // --------------------------------------------------

  const toggleDark = () => {
    const next = !darkMode;
    setDarkMode(next);
    localStorage.setItem('adminTestingDark', String(next));
  };

  // --------------------------------------------------
  // CALENDAR — only built once a tester is clicked; no extra reads
  // --------------------------------------------------

  const calendarMonths = useMemo(() => {
    if (!calendarTester) return [];
    return buildCalendarMonths(START_DATE, today);
  }, [calendarTester, today]);

  const openCalendar = (tester) => {
    setCalendarTester(tester);
  };

  // --------------------------------------------------
  // STYLES
  // --------------------------------------------------

  const page = darkMode ? 'bg-[#080b12] text-slate-200' : 'bg-[#f7f9fc] text-slate-700';
  const card = darkMode ? 'bg-[#10151f] border-slate-800/80' : 'bg-white border-slate-200/80';
  const muted = darkMode ? 'text-slate-500' : 'text-slate-400';

  // --------------------------------------------------
  // UI
  // --------------------------------------------------

  return (
    <div
      className={`min-h-screen ${page}`}
      style={{ fontFamily: '"Inter", "SF Pro Display", "Segoe UI", sans-serif' }}
    >
      <div className="max-w-6xl mx-auto px-3 sm:px-5 lg:px-6 py-4 sm:py-6">

        {/* ============================================
            HEADER
        ============================================ */}

        <header className="flex items-center justify-between mb-5">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              <h1
                className={`text-lg sm:text-xl font-semibold tracking-tight ${
                  darkMode ? 'text-slate-100' : 'text-slate-800'
                }`}
              >
                Testing
              </h1>
            </div>
            <p className={`text-[11px] mt-0.5 ${muted}`}>{formatDate(today)}</p>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={toggleDark}
              title="Toggle night mode"
              className={`w-8 h-8 rounded-lg border flex items-center justify-center transition ${
                darkMode
                  ? 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                  : 'bg-white border-slate-200 text-slate-500 hover:text-blue-600'
              }`}
            >
              {darkMode ? <Sun size={15} /> : <Moon size={15} />}
            </button>

            <button
              onClick={loadData}
              title="Refresh"
              className={`w-8 h-8 rounded-lg border flex items-center justify-center transition ${
                darkMode
                  ? 'bg-slate-900 border-slate-800 text-slate-400 hover:text-blue-400'
                  : 'bg-white border-slate-200 text-slate-500 hover:text-blue-600'
              }`}
            >
              <RefreshCw size={15} />
            </button>
          </div>
        </header>

        {/* ============================================
            COMPACT ACTIVE BAR
        ============================================ */}

        <button
          onClick={openActiveModal}
          className={`w-full mb-5 px-3.5 py-2.5 rounded-xl border flex items-center justify-between transition ${card} hover:border-blue-300`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <UserCheck size={14} />
            </div>

            <div className="flex items-center gap-2 min-w-0">
              <span
                className={`text-xs font-medium ${
                  darkMode ? 'text-slate-300' : 'text-slate-600'
                }`}
              >
                Active testers
              </span>
              <span className="text-sm font-semibold text-blue-600">
                {activeTesters.length}
              </span>
            </div>
          </div>

          <div
            className={`flex items-center gap-1 text-[10px] font-medium ${
              darkMode ? 'text-slate-500' : 'text-slate-400'
            }`}
          >
            Manage
            <ChevronRight size={13} />
          </div>
        </button>

        {/* ============================================
            TESTED TODAY
        ============================================ */}

        <section className="mb-7">
          <div className="flex items-end justify-between mb-2.5">
            <div>
              <div className="flex items-center gap-2">
                <h2
                  className={`text-[15px] font-semibold ${
                    darkMode ? 'text-slate-200' : 'text-slate-800'
                  }`}
                >
                  Tested today
                </h2>
                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-600 font-medium">
                  {todayComplete.length}/{activeTesters.length}
                </span>
              </div>
              <p className={`text-[10px] mt-0.5 ${muted}`}>Tap a tester to view history</p>
            </div>

            <button
              onClick={() => setNotTestedModal(true)}
              className="flex items-center gap-1.5 text-[10px] font-medium text-red-500 hover:text-red-600"
            >
              <UserX size={13} />
              Missed
              <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-red-50 flex items-center justify-center text-[9px]">
                {todayNotTested.length}
              </span>
            </button>
          </div>

          <div
            className={`w-full overflow-x-auto scrollbar-hide ${
              todayComplete.length ? '' : 'overflow-hidden'
            }`}
            style={{ WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}
          >
            <div className="flex gap-2.5 min-w-max pb-1">
              {todayComplete.length === 0 ? (
                <div className={`px-4 py-3 rounded-xl border text-[11px] ${card} ${muted}`}>
                  No tester has tested yet today.
                </div>
              ) : (
                todayComplete.map((tester) => (
                  <button
                    key={tester.email}
                    onClick={() => openCalendar(tester)}
                    className="group flex flex-col items-center w-[58px] sm:w-[64px]"
                  >
                    <div className="relative">
                      <div
                        className={`w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-[11px] font-semibold transition group-hover:scale-105 ${
                          darkMode
                            ? 'bg-blue-950 text-blue-300 ring-1 ring-blue-900'
                            : 'bg-blue-50 text-blue-600 ring-1 ring-blue-100'
                        }`}
                      >
                        {getInitials(tester.name)}
                      </div>

                      <span
                        className={`absolute -right-0.5 -bottom-0.5 w-4 h-4 rounded-full flex items-center justify-center border-2 ${
                          darkMode
                            ? 'bg-emerald-500 border-[#10151f]'
                            : 'bg-emerald-500 border-[#f7f9fc]'
                        }`}
                      >
                        <Check size={9} strokeWidth={3} className="text-white" />
                      </span>
                    </div>

                    <span
                      className={`w-full mt-1.5 text-[9px] font-medium text-center truncate ${
                        darkMode ? 'text-slate-300' : 'text-slate-600'
                      }`}
                    >
                      {tester.name}
                    </span>

                    <span className="text-[8px] text-emerald-500 mt-0.5">Tested</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </section>

        {/* ============================================
            ALL TESTERS
        ============================================ */}

        <section className="mb-7">
          <div className="flex items-center justify-between mb-2.5">
            <div>
              <h2
                className={`text-[15px] font-semibold ${
                  darkMode ? 'text-slate-200' : 'text-slate-800'
                }`}
              >
                All testers
              </h2>
              <p className={`text-[10px] mt-0.5 ${muted}`}>Tested / missed · from 17 Sep</p>
            </div>

            <span className={`text-[10px] ${muted}`}>{overallTesterData.length} testers</span>
          </div>

          <div className={`rounded-xl border overflow-hidden ${card}`}>
            {overallTesterData.map((tester, index) => {
              const { tested: testedToday } = getDayStatus(logs, tester.email, today);

              return (
                <div
                  key={tester.email}
                  className={`group flex items-center gap-2.5 px-3 py-2.5 sm:px-3.5 ${
                    index !== overallTesterData.length - 1
                      ? darkMode
                        ? 'border-b border-slate-800/70'
                        : 'border-b border-slate-100'
                      : ''
                  }`}
                >
                  <span className={`w-4 text-center text-[9px] font-medium ${muted}`}>
                    {index + 1}
                  </span>

                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-[9px] font-semibold shrink-0 ${
                      testedToday
                        ? darkMode
                          ? 'bg-emerald-950 text-emerald-300'
                          : 'bg-emerald-50 text-emerald-600'
                        : darkMode
                        ? 'bg-slate-800 text-slate-400'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {getInitials(tester.name)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div
                      className={`text-[11px] font-medium truncate ${
                        darkMode ? 'text-slate-300' : 'text-slate-700'
                      }`}
                    >
                      {tester.name}
                    </div>
                    <div className={`text-[8px] truncate ${muted}`}>{tester.email}</div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span
                      className="text-[13px] font-semibold tabular-nums text-emerald-500"
                      title="Tested days"
                    >
                      {tester.testedDays}
                    </span>
                    <span className={`text-[10px] ${muted}`}>/</span>
                    <span
                      className="text-[13px] font-semibold tabular-nums text-red-400"
                      title="Missed days"
                    >
                      {tester.missedDays}
                    </span>
                  </div>

                  <span
                    title={testedToday ? 'Tested today' : 'Not tested today'}
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      testedToday ? 'bg-emerald-500' : 'bg-red-400'
                    }`}
                  />

                  <button
                    onClick={() => openCalendar(tester)}
                    className={`w-7 h-7 rounded-lg flex items-center justify-center transition ${
                      darkMode
                        ? 'text-slate-500 hover:bg-slate-800 hover:text-blue-400'
                        : 'text-slate-400 hover:bg-blue-50 hover:text-blue-600'
                    }`}
                    title="View history"
                  >
                    <CalendarDays size={13} />
                  </button>

                  {activeTesters.includes(tester.email) && (
                    <button
                      onClick={() => removeTesterToday(tester.email)}
                      className={`w-7 h-7 rounded-lg flex items-center justify-center transition ${
                        darkMode
                          ? 'text-slate-600 hover:bg-red-950 hover:text-red-400'
                          : 'text-slate-300 hover:bg-red-50 hover:text-red-500'
                      }`}
                      title="Remove from today's testing"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* ============================================
            MISSED TESTING — nothing computed until chosen
        ============================================ */}

        <section>
          <div className="flex items-center justify-between mb-2.5">
            <div>
              <h2
                className={`text-[15px] font-semibold ${
                  darkMode ? 'text-slate-200' : 'text-slate-800'
                }`}
              >
                Missed testing
              </h2>
              <p className={`text-[10px] mt-0.5 ${muted}`}>Choose a period to check</p>
            </div>

            <div
              className={`flex items-center gap-0.5 p-0.5 rounded-lg border ${
                darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
              }`}
            >
              {[
                ['none', 'None'],
                ['yesterday', 'Yesterday'],
                ['custom', 'Custom'],
              ].map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => setMissedOption(value)}
                  className={`px-2 py-1 rounded-md text-[9px] font-medium transition ${
                    missedOption === value
                      ? 'bg-blue-600 text-white'
                      : darkMode
                      ? 'text-slate-500 hover:text-slate-300'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {missedOption === 'custom' && (
            <div className="mb-2.5">
              <input
                type="date"
                value={missedCustomDate}
                min={START_DATE}
                max={yesterday}
                onChange={(e) => setMissedCustomDate(e.target.value)}
                className={`px-3 py-2 rounded-lg border text-[11px] ${
                  darkMode
                    ? 'bg-slate-900 border-slate-800 text-slate-200'
                    : 'bg-white border-slate-200 text-slate-700'
                }`}
              />
            </div>
          )}

          {missedOption === 'none' ? (
            <div className={`px-4 py-3 rounded-xl border text-[11px] ${card} ${muted}`}>
              Select "Yesterday" or "Custom" to check for missed testing.
            </div>
          ) : missedOption === 'custom' && !missedCustomDate ? (
            <div className={`px-4 py-3 rounded-xl border text-[11px] ${card} ${muted}`}>
              Pick a date to check.
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {missedData.length === 0 ? (
                <div
                  className={`col-span-full px-4 py-3 rounded-xl border text-[11px] ${card} text-emerald-500`}
                >
                  No missed testing on this date.
                </div>
              ) : (
                missedData.map((tester) => (
                  <button
                    key={tester.email}
                    onClick={() => openCalendar(tester)}
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left transition hover:border-red-200 ${card}`}
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-[9px] font-semibold ${
                        darkMode ? 'bg-red-950 text-red-300' : 'bg-red-50 text-red-500'
                      }`}
                    >
                      {getInitials(tester.name)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div
                        className={`text-[11px] font-medium truncate ${
                          darkMode ? 'text-slate-300' : 'text-slate-700'
                        }`}
                      >
                        {tester.name}
                      </div>
                      <div className={`text-[9px] truncate ${muted}`}>{tester.email}</div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-[13px] font-semibold text-red-500">
                        {tester.missedCount}
                      </div>
                      <div className={`text-[8px] ${muted}`}>missed</div>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </section>
      </div>

      {/* ==================================================
          ACTIVE TESTERS MODAL
      ================================================== */}

      {activeModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-3">
          <div
            className={`w-full max-w-md max-h-[85vh] overflow-hidden rounded-2xl ${
              darkMode ? 'bg-[#10151f] text-white' : 'bg-white text-slate-800'
            } shadow-2xl`}
          >
            <div className="px-4 py-3.5 border-b border-slate-200/10 flex items-center justify-between">
              <div>
                <h3 className="text-[15px] font-semibold">Active testers</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Select testers included in reports
                </p>
              </div>

              <button
                onClick={() => setActiveModal(false)}
                className="w-7 h-7 rounded-lg flex items-center justify-center bg-slate-100/10"
              >
                <X size={15} />
              </button>
            </div>

            <div className="p-3 overflow-y-auto max-h-[55vh] space-y-1.5">
              {loadingManage ? (
                <div className="py-8 flex items-center justify-center gap-2 text-[11px] text-slate-400">
                  <RefreshCw size={14} className="animate-spin" />
                  Loading testers...
                </div>
              ) : (
                manageTesterList.map((tester) => {
                  const checked = selectedActive.includes(tester.email);
                  const isSpecial = tester.email === SPECIAL_TESTER;

                  return (
                    <button
                      key={tester.email}
                      onClick={() => toggleActiveTester(tester.email)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl border text-left transition ${
                        checked
                          ? darkMode
                            ? 'border-blue-800 bg-blue-950/30'
                            : 'border-blue-200 bg-blue-50/70'
                          : darkMode
                          ? 'border-slate-800 bg-slate-900/60'
                          : 'border-slate-100 bg-slate-50'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-md flex items-center justify-center border shrink-0 ${
                          checked
                            ? 'bg-blue-600 border-blue-600 text-white'
                            : darkMode
                            ? 'border-slate-700'
                            : 'border-slate-300'
                        }`}
                      >
                        {checked && <Check size={12} />}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div
                          className={`text-[11px] font-medium truncate ${
                            checked
                              ? 'text-blue-600'
                              : darkMode
                              ? 'text-slate-300'
                              : 'text-slate-700'
                          }`}
                        >
                          {tester.name}
                        </div>
                        <div className="text-[9px] text-slate-400 truncate">{tester.email}</div>
                      </div>

                      {isSpecial && (
                        <span className="text-[7px] font-semibold px-1.5 py-1 rounded-md bg-blue-600 text-white">
                          ALWAYS
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>

            <div className="p-3 border-t border-slate-200/10">
              <button
                onClick={saveActiveTesters}
                disabled={savingActive}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold transition"
              >
                {savingActive ? 'Saving...' : `Save · ${selectedActive.length} active`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================
          NOT TESTED MODAL
      ================================================== */}

      {notTestedModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-3">
          <div
            className={`w-full max-w-md max-h-[80vh] overflow-hidden rounded-2xl ${
              darkMode ? 'bg-[#10151f] text-white' : 'bg-white'
            } shadow-2xl`}
          >
            <div className="px-4 py-3.5 flex items-center justify-between border-b border-slate-200/10">
              <div>
                <h3 className="text-[15px] font-semibold">Not tested</h3>
                <p className="text-[10px] text-slate-400">{formatDate(today)}</p>
              </div>

              <button
                onClick={() => setNotTestedModal(false)}
                className="w-7 h-7 rounded-lg flex items-center justify-center bg-slate-100/10"
              >
                <X size={15} />
              </button>
            </div>

            <div className="p-3 overflow-y-auto max-h-[60vh] space-y-1.5">
              {todayNotTested.length === 0 ? (
                <div className="p-7 text-center text-emerald-500 text-[11px] font-medium">
                  Everyone tested today.
                </div>
              ) : (
                todayNotTested.map((tester) => (
                  <div
                    key={tester.email}
                    className={`flex items-center gap-2.5 p-2.5 rounded-xl ${
                      darkMode ? 'bg-red-950/20' : 'bg-red-50'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-full bg-red-100 text-red-500 flex items-center justify-center text-[9px] font-semibold">
                      {getInitials(tester.name)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div
                        className={`text-[11px] font-medium truncate ${
                          darkMode ? 'text-slate-300' : 'text-slate-700'
                        }`}
                      >
                        {tester.name}
                      </div>
                      <div className="text-[9px] text-slate-400 truncate">{tester.email}</div>
                    </div>

                    <span className="text-[9px] text-red-500 font-medium">not tested</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================================================
          TESTER CALENDAR MODAL — real calendar grid, BD time
      ================================================== */}

      {calendarTester && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-3">
          <div
            className={`w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl ${
              darkMode ? 'bg-[#10151f] text-white' : 'bg-white'
            } shadow-2xl flex flex-col`}
          >
            {/* HEADER */}
            <div className="px-4 py-3.5 border-b border-slate-200/10 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-[10px] font-semibold">
                  {getInitials(calendarTester.name)}
                </div>
                <div>
                  <h3 className="text-[14px] font-semibold">{calendarTester.name}</h3>
                  <p className="text-[9px] text-slate-400">{calendarTester.email}</p>
                </div>
              </div>

              <button
                onClick={() => setCalendarTester(null)}
                className="w-7 h-7 rounded-lg flex items-center justify-center bg-slate-100/10"
              >
                <X size={15} />
              </button>
            </div>

            {/* SUMMARY */}
            <div className="grid grid-cols-3 gap-2 p-3 shrink-0">
              <div
                className={`px-2 py-2.5 rounded-xl text-center ${
                  darkMode ? 'bg-blue-950/30' : 'bg-blue-50'
                }`}
              >
                <div className="text-[8px] text-blue-500 font-medium">TESTED</div>
                <div className="text-lg font-semibold text-blue-600">
                  {overallTesterData.find((x) => x.email === calendarTester.email)?.testedDays ?? 0}
                </div>
              </div>

              <div
                className={`px-2 py-2.5 rounded-xl text-center ${
                  darkMode ? 'bg-red-950/30' : 'bg-red-50'
                }`}
              >
                <div className="text-[8px] text-red-500 font-medium">MISSED</div>
                <div className="text-lg font-semibold text-red-500">
                  {overallTesterData.find((x) => x.email === calendarTester.email)?.missedDays ?? 0}
                </div>
              </div>

              <div
                className={`px-2 py-2.5 rounded-xl text-center ${
                  darkMode ? 'bg-emerald-950/30' : 'bg-emerald-50'
                }`}
              >
                <div className="text-[8px] text-emerald-500 font-medium">SINCE</div>
                <div className="text-[11px] font-semibold text-emerald-600 mt-1.5">17 SEP</div>
              </div>
            </div>

            {/* CALENDAR GRID */}
            <div className="px-3 pb-3 overflow-y-auto">
              {calendarMonths.map((monthData) => (
                <div key={`${monthData.year}-${monthData.month}`} className="mb-4">
                  <div
                    className={`text-[11px] font-semibold mb-2 ${
                      darkMode ? 'text-slate-300' : 'text-slate-700'
                    }`}
                  >
                    {monthData.label} {monthData.year}
                  </div>

                  <div className="grid grid-cols-7 gap-1 mb-1">
                    {WEEKDAY_LABELS.map((wd) => (
                      <div
                        key={wd}
                        className={`text-center text-[8px] font-medium py-1 ${muted}`}
                      >
                        {wd}
                      </div>
                    ))}
                  </div>

                  {monthData.weeks.map((week, wIdx) => (
                    <div key={wIdx} className="grid grid-cols-7 gap-1 mb-1">
                      {week.map((cellDate, cIdx) => {
                        if (!cellDate) {
                          return <div key={cIdx} className="aspect-square" />;
                        }

                        const dateStr = toDateStr(cellDate);
                        const inRange = dateStr >= START_DATE && dateStr <= today;

                        if (!inRange) {
                          return (
                            <div
                              key={cIdx}
                              className={`aspect-square rounded-lg flex items-center justify-center text-[9px] ${
                                darkMode ? 'text-slate-700' : 'text-slate-300'
                              }`}
                            >
                              {cellDate.getDate()}
                            </div>
                          );
                        }

                        const { tested, time } = getDayStatus(
                          logs,
                          calendarTester.email,
                          dateStr
                        );
                        const timeLabel = formatTimeBD(time);

                        return (
                          <div
                            key={cIdx}
                            title={dateStr}
                            className={`aspect-square rounded-lg flex flex-col items-center justify-center gap-0.5 border ${
                              tested
                                ? darkMode
                                  ? 'bg-emerald-950/40 border-emerald-900/60'
                                  : 'bg-emerald-100 border-emerald-200'
                                : darkMode
                                ? 'bg-red-950/30 border-red-900/50'
                                : 'bg-red-100 border-red-200'
                            }`}
                          >
                            <span
                              className={`text-[10px] font-semibold ${
                                tested
                                  ? darkMode
                                    ? 'text-emerald-300'
                                    : 'text-emerald-700'
                                  : darkMode
                                  ? 'text-red-300'
                                  : 'text-red-600'
                              }`}
                            >
                              {cellDate.getDate()}
                            </span>
                            {tested && timeLabel && (
                              <span
                                className={`text-[7px] leading-none ${
                                  darkMode ? 'text-emerald-400' : 'text-emerald-600'
                                }`}
                              >
                                {timeLabel}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* LEGEND */}
            <div className="px-4 py-2.5 border-t border-slate-200/10 flex gap-4 text-[9px] shrink-0">
              <span className="flex items-center gap-1 text-emerald-500">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Tested
              </span>
              <span className="flex items-center gap-1 text-red-400">
                <span className="w-2 h-2 rounded-full bg-red-400" />
                Missed
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================
          LOADING
      ================================================== */}

      {loading && (
        <div className="fixed inset-0 z-[60] bg-white/60 dark:bg-black/50 backdrop-blur-sm flex items-center justify-center">
          <div className="flex items-center gap-2.5 bg-white dark:bg-[#10151f] px-4 py-3 rounded-xl shadow-xl text-blue-600">
            <RefreshCw size={16} className="animate-spin" />
            <span className="text-[11px] font-medium">Loading...</span>
          </div>
        </div>
      )}

      {/* HIDE HORIZONTAL SCROLLBAR */}
      <style>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}