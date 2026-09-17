// AdminTestingInfo.jsx

import React, { useEffect, useMemo, useState } from 'react';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { db } from './firebase';

import {
  Check,
  X,
  Filter,
  UserCheck,
  UserX,
  RefreshCw,
  Trash2,
  CalendarDays,
  Moon,
  Sun,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
} from 'lucide-react';

const START_DATE = '2026-09-17';
const SPECIAL_TESTER = 'shuvojitgb@gmail.com';

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

function formatDate(date) {
  const d = dateObj(date);

  return d.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function getDatesBetween(start, end) {
  const result = [];
  let current = dateObj(start);
  const last = dateObj(end);

  while (current <= last) {
    const y = current.getFullYear();
    const m = String(current.getMonth() + 1).padStart(2, '0');
    const d = String(current.getDate()).padStart(2, '0');

    result.push(`${y}-${m}-${d}`);

    current.setDate(current.getDate() + 1);
  }

  return result;
}

function getYesterday() {
  const d = dateObj(getBDDate());
  d.setDate(d.getDate() - 1);

  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');

  return `${y}-${m}-${day}`;
}

function getDayBeforeYesterday() {
  const d = dateObj(getBDDate());
  d.setDate(d.getDate() - 2);

  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');

  return `${y}-${m}-${day}`;
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

export default function AdminTestingInfo() {
  const [apps, setApps] = useState([]);
  const [users, setUsers] = useState([]);
  const [logs, setLogs] = useState({});
  const [activeTesters, setActiveTesters] = useState([]);

  const [loading, setLoading] = useState(true);
  const [savingActive, setSavingActive] = useState(false);

  const [activeModal, setActiveModal] = useState(false);
  const [notTestedModal, setNotTestedModal] = useState(false);

  const [calendarTester, setCalendarTester] = useState(null);

  const [missedFilter, setMissedFilter] = useState('all');

  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('adminTestingDark') === 'true';
  });

  const [selectedActive, setSelectedActive] = useState([]);

  const today = getBDDate();
  const yesterday = getYesterday();

  // --------------------------------------------------
  // LOAD EVERYTHING
  // --------------------------------------------------

  const loadData = async () => {
    setLoading(true);

    try {
      const [appsSnap, usersSnap, logsSnap, settingsSnap] =
        await Promise.all([
          getDocs(collection(db, 'apps')),
          getDocs(collection(db, 'users')),
          getDocs(collection(db, 'testingLogs')),
          getDoc(doc(db, 'testingSettings', 'activeTesters')),
        ]);

      const appsData = appsSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      const usersData = usersSnap.docs
        .map((d) => ({
          id: d.id,
          ...d.data(),
        }))
        .filter((u) => u.email);

      const logsData = {};

      logsSnap.forEach((d) => {
        logsData[d.id] = d.data();
      });

      let savedActive = settingsSnap.exists()
        ? settingsSnap.data().emails || []
        : [];

      if (!savedActive.includes(SPECIAL_TESTER)) {
        savedActive = [...savedActive, SPECIAL_TESTER];

        await setDoc(
          doc(db, 'testingSettings', 'activeTesters'),
          { emails: savedActive },
          { merge: true }
        );
      }

      setApps(appsData);
      setUsers(usersData);
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
  // APP DATA
  // --------------------------------------------------

 
  const appMap = useMemo(() => {
    const map = {};

    apps.forEach((app) => {
      if (app?.id) {
        map[app.id] = app;
      }
    });

    return map;
  }, [apps]);

  // --------------------------------------------------
  // TESTER LIST
  // --------------------------------------------------

  const testerList = useMemo(() => {
    const map = {};

    users.forEach((user) => {
      if (user.email) {
        map[user.email] = {
          email: user.email,
          name: getTesterName(user),
        };
      }
    });

    Object.keys(logs).forEach((email) => {
      if (!map[email]) {
        map[email] = {
          email,
          name: email.split('@')[0],
        };
      }
    });

    if (!map[SPECIAL_TESTER]) {
      map[SPECIAL_TESTER] = {
        email: SPECIAL_TESTER,
        name: 'Shuvojit',
      };
    }

    return Object.values(map);
  }, [users, logs]);

  // --------------------------------------------------
  // TESTING DATA
  // --------------------------------------------------

  const getTestedApps = (email, date) => {
    return Array.isArray(logs[email]?.tested?.[date])
      ? logs[email].tested[date]
      : [];
  };

  const hasTestedSomething = (email, date) => {
    return getTestedApps(email, date).length > 0;
  };

  // --------------------------------------------------
  // TODAY
  // --------------------------------------------------

  const activeTesterData = useMemo(() => {
    return activeTesters
      .map((email) => {
        const user =
          testerList.find((u) => u.email === email) || {
            email,
            name: email.split('@')[0],
          };

        const testedApps = getTestedApps(email, today);
        const testedCount = testedApps.length;

        return {
          ...user,
          testedApps,
          testedCount,
          complete: testedCount > 0,
        };
      })
      .sort((a, b) => {
        if (a.complete !== b.complete) {
          return Number(b.complete) - Number(a.complete);
        }

        return b.testedCount - a.testedCount;
      });
  }, [activeTesters, testerList, logs, today]);

  const todayComplete = activeTesterData.filter(
    (t) => t.complete
  );

  const todayNotTested = activeTesterData.filter(
    (t) => !t.complete
  );

  // --------------------------------------------------
  // MISSED REPORT
  // --------------------------------------------------

  const reportDates = useMemo(() => {
    if (missedFilter === 'yesterday') {
      return [getYesterday()];
    }

    if (missedFilter === 'dayBefore') {
      return [getDayBeforeYesterday()];
    }

    if (dateObj(START_DATE) > dateObj(yesterday)) {
      return [];
    }

    return getDatesBetween(START_DATE, yesterday);
  }, [missedFilter, yesterday]);

  const missedData = useMemo(() => {
    return activeTesters
      .map((email) => {
        const user =
          testerList.find((u) => u.email === email) || {
            email,
            name: email.split('@')[0],
          };

        const missedDates = reportDates.filter(
          (date) => !hasTestedSomething(email, date)
        );

        return {
          ...user,
          missedDates,
          missedCount: missedDates.length,
        };
      })
      .filter((t) => t.missedCount > 0)
      .sort((a, b) => b.missedCount - a.missedCount);
  }, [
    activeTesters,
    testerList,
    reportDates,
    logs,
  ]);

  // --------------------------------------------------
  // OVERALL DATA
  // --------------------------------------------------

  const overallTesterData = useMemo(() => {
    const dates = getDatesBetween(START_DATE, today);

    return activeTesters
      .map((email) => {
        const user =
          testerList.find((u) => u.email === email) || {
            email,
            name: email.split('@')[0],
          };

        const dailyData = dates.map((date) => {
          const testedApps = getTestedApps(email, date);

          return {
            date,
            testedApps,
            tested: testedApps.length > 0,
            complete: testedApps.length > 0,
          };
        });

        const testedDays = dailyData.filter(
          (d) => d.complete
        ).length;

        const missedDays = dailyData.filter(
          (d) => !d.complete
        ).length;

        const totalDays = dates.length;

        const ratio =
          totalDays > 0
            ? testedDays / totalDays
            : 0;

        return {
          ...user,
          dailyData,
          testedDays,
          missedDays,
          totalDays,
          ratio,
        };
      })
      .sort((a, b) => {
        if (b.ratio !== a.ratio) {
          return b.ratio - a.ratio;
        }

        if (a.missedDays !== b.missedDays) {
          return a.missedDays - b.missedDays;
        }

        return b.testedDays - a.testedDays;
      });
  }, [
    activeTesters,
    testerList,
    logs,
    today,
  ]);

  // --------------------------------------------------
  // ACTIVE TESTER SAVE
  // --------------------------------------------------

  const toggleActiveTester = (email) => {
    if (email === SPECIAL_TESTER) return;

    setSelectedActive((prev) =>
      prev.includes(email)
        ? prev.filter((e) => e !== email)
        : [...prev, email]
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
        {
          emails: finalList,
          updatedAt: new Date(),
        },
        { merge: true }
      );

      setActiveTesters(finalList);
      setSelectedActive(finalList);
      setActiveModal(false);
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
    if (
      !window.confirm(
        `Remove ${email} from today's testing?`
      )
    ) {
      return;
    }

    try {
      const logRef = doc(db, 'testingLogs', email);
      const snap = await getDoc(logRef);

      if (!snap.exists()) return;

      const data = snap.data();

      const tested = {
        ...(data.tested || {}),
      };

      tested[today] = [];

      await updateDoc(logRef, {
        tested,
      });

      await loadData();
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

    localStorage.setItem(
      'adminTestingDark',
      String(next)
    );
  };

  // --------------------------------------------------
  // CALENDAR
  // --------------------------------------------------

  const calendarDates = useMemo(() => {
    if (!calendarTester) return [];

    return getDatesBetween(
      START_DATE,
      today
    );
  }, [calendarTester, today]);

  const openCalendar = (tester) => {
    setCalendarTester(tester);
  };

  // --------------------------------------------------
  // STYLES
  // --------------------------------------------------

  const page = darkMode
    ? 'bg-[#080b12] text-slate-200'
    : 'bg-[#f7f9fc] text-slate-700';

  const card = darkMode
    ? 'bg-[#10151f] border-slate-800/80'
    : 'bg-white border-slate-200/80';

  const muted = darkMode
    ? 'text-slate-500'
    : 'text-slate-400';

  // --------------------------------------------------
  // UI
  // --------------------------------------------------

  return (
    <div
      className={`min-h-screen ${page}`}
      style={{
        fontFamily:
          '"Inter", "SF Pro Display", "Segoe UI", sans-serif',
      }}
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
                  darkMode
                    ? 'text-slate-100'
                    : 'text-slate-800'
                }`}
              >
                Testing
              </h1>
            </div>

            <p
              className={`text-[11px] mt-0.5 ${muted}`}
            >
              {formatDate(today)}
            </p>
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
              {darkMode ? (
                <Sun size={15} />
              ) : (
                <Moon size={15} />
              )}
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
          onClick={() => setActiveModal(true)}
          className={`w-full mb-5 px-3.5 py-2.5 rounded-xl border flex items-center justify-between transition ${
            card
          } hover:border-blue-300`}
        >

          <div className="flex items-center gap-2.5 min-w-0">

            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <UserCheck size={14} />
            </div>

            <div className="flex items-center gap-2 min-w-0">

              <span
                className={`text-xs font-medium ${
                  darkMode
                    ? 'text-slate-300'
                    : 'text-slate-600'
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
              darkMode
                ? 'text-slate-500'
                : 'text-slate-400'
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
                    darkMode
                      ? 'text-slate-200'
                      : 'text-slate-800'
                  }`}
                >
                  Tested today
                </h2>

                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-600 font-medium">
                  {todayComplete.length}/{activeTesters.length}
                </span>

              </div>

              <p
                className={`text-[10px] mt-0.5 ${muted}`}
              >
                Tap a tester to view history
              </p>
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

          {/* HORIZONTAL TESTER STRIP */}

          <div
            className={`w-full overflow-x-auto scrollbar-hide ${
              todayComplete.length
                ? ''
                : 'overflow-hidden'
            }`}
            style={{
              WebkitOverflowScrolling: 'touch',
              scrollbarWidth: 'none',
            }}
          >

            <div className="flex gap-2.5 min-w-max pb-1">

              {todayComplete.length === 0 ? (
                <div
                  className={`px-4 py-3 rounded-xl border text-[11px] ${card} ${muted}`}
                >
                  No tester has tested yet today.
                </div>
              ) : (
                todayComplete.map((tester) => (
                  <button
                    key={tester.email}
                    onClick={() =>
                      openCalendar(tester)
                    }
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
                        {getInitials(
                          tester.name
                        )}
                      </div>

                      <span
                        className={`absolute -right-0.5 -bottom-0.5 w-4 h-4 rounded-full flex items-center justify-center border-2 ${
                          darkMode
                            ? 'bg-emerald-500 border-[#10151f]'
                            : 'bg-emerald-500 border-[#f7f9fc]'
                        }`}
                      >
                        <Check
                          size={9}
                          strokeWidth={3}
                          className="text-white"
                        />
                      </span>

                    </div>

                    <span
                      className={`w-full mt-1.5 text-[9px] font-medium text-center truncate ${
                        darkMode
                          ? 'text-slate-300'
                          : 'text-slate-600'
                      }`}
                    >
                      {tester.name}
                    </span>

                    <span className="text-[8px] text-emerald-500 mt-0.5">
                      {tester.testedCount} tested
                    </span>

                  </button>
                ))
              )}

            </div>

          </div>

        </section>

        {/* ============================================
            MISSED TESTING
        ============================================ */}

        <section className="mb-7">

          <div className="flex items-center justify-between mb-2.5">

            <div>
              <h2
                className={`text-[15px] font-semibold ${
                  darkMode
                    ? 'text-slate-200'
                    : 'text-slate-800'
                }`}
              >
                Missed testing
              </h2>

              <p
                className={`text-[10px] mt-0.5 ${muted}`}
              >
                Past days
              </p>
            </div>

            {/* SMALL FILTER */}

            <div
              className={`flex items-center gap-0.5 p-0.5 rounded-lg border ${
                darkMode
                  ? 'bg-slate-900 border-slate-800'
                  : 'bg-white border-slate-200'
              }`}
            >

              <Filter
                size={12}
                className="ml-1 text-slate-400"
              />

              {[
                ['yesterday', 'Yesterday'],
                ['dayBefore', 'Before'],
                ['all', 'All'],
              ].map(([value, label]) => (
                <button
                  key={value}
                  onClick={() =>
                    setMissedFilter(value)
                  }
                  className={`px-2 py-1 rounded-md text-[9px] font-medium transition ${
                    missedFilter === value
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

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">

            {missedData.length === 0 ? (
              <div
                className={`col-span-full px-4 py-3 rounded-xl border text-[11px] ${card} text-emerald-500`}
              >
                No missed testing in this period.
              </div>
            ) : (
              missedData.map((tester) => (
                <button
                  key={tester.email}
                  onClick={() =>
                    openCalendar(tester)
                  }
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left transition hover:border-red-200 ${card}`}
                >

                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-[9px] font-semibold ${
                      darkMode
                        ? 'bg-red-950 text-red-300'
                        : 'bg-red-50 text-red-500'
                    }`}
                  >
                    {getInitials(
                      tester.name
                    )}
                  </div>

                  <div className="flex-1 min-w-0">

                    <div
                      className={`text-[11px] font-medium truncate ${
                        darkMode
                          ? 'text-slate-300'
                          : 'text-slate-700'
                      }`}
                    >
                      {tester.name}
                    </div>

                    <div
                      className={`text-[9px] truncate ${muted}`}
                    >
                      {tester.email}
                    </div>

                  </div>

                  <div className="text-right shrink-0">

                    <div className="text-[13px] font-semibold text-red-500">
                      {tester.missedCount}
                    </div>

                    <div
                      className={`text-[8px] ${muted}`}
                    >
                      missed
                    </div>

                  </div>

                </button>
              ))
            )}

          </div>

        </section>

        {/* ============================================
            ALL TESTERS
        ============================================ */}

        <section>

          <div className="flex items-center justify-between mb-2.5">

            <div>
              <h2
                className={`text-[15px] font-semibold ${
                  darkMode
                    ? 'text-slate-200'
                    : 'text-slate-800'
                }`}
              >
                All testers
              </h2>

              <p
                className={`text-[10px] mt-0.5 ${muted}`}
              >
                Tested / missed · from 17 Sep
              </p>
            </div>

            <span
              className={`text-[10px] ${muted}`}
            >
              {overallTesterData.length} testers
            </span>

          </div>

          {/* CLEAN TESTER LIST */}

          <div
            className={`rounded-xl border overflow-hidden ${card}`}
          >

            {overallTesterData.map(
              (tester, index) => {

                const testedToday =
                  hasTestedSomething(
                    tester.email,
                    today
                  );

                return (
                  <div
                    key={tester.email}
                    className={`group flex items-center gap-2.5 px-3 py-2.5 sm:px-3.5 ${
                      index !==
                      overallTesterData.length - 1
                        ? darkMode
                          ? 'border-b border-slate-800/70'
                          : 'border-b border-slate-100'
                        : ''
                    }`}
                  >

                    {/* SMALL INDEX */}

                    <span
                      className={`w-4 text-center text-[9px] font-medium ${muted}`}
                    >
                      {index + 1}
                    </span>

                    {/* AVATAR */}

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
                      {getInitials(
                        tester.name
                      )}
                    </div>

                    {/* NAME */}

                    <div className="flex-1 min-w-0">

                      <div
                        className={`text-[11px] font-medium truncate ${
                          darkMode
                            ? 'text-slate-300'
                            : 'text-slate-700'
                        }`}
                      >
                        {tester.name}
                      </div>

                      <div
                        className={`text-[8px] truncate ${muted}`}
                      >
                        {tester.email}
                      </div>

                    </div>

                    {/* TESTED / MISSED RATIO */}

                    <div className="flex items-center gap-1.5 shrink-0">

                      <span
                        className="text-[13px] font-semibold tabular-nums text-emerald-500"
                        title="Tested days"
                      >
                        {tester.testedDays}
                      </span>

                      <span
                        className={`text-[10px] ${muted}`}
                      >
                        /
                      </span>

                      <span
                        className="text-[13px] font-semibold tabular-nums text-red-400"
                        title="Missed days"
                      >
                        {tester.missedDays}
                      </span>

                    </div>

                    {/* TODAY DOT */}

                    <span
                      title={
                        testedToday
                          ? 'Tested today'
                          : 'Not tested today'
                      }
                      className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                        testedToday
                          ? 'bg-emerald-500'
                          : 'bg-red-400'
                      }`}
                    />

                    {/* CALENDAR */}

                    <button
                      onClick={() =>
                        openCalendar(tester)
                      }
                      className={`w-7 h-7 rounded-lg flex items-center justify-center transition ${
                        darkMode
                          ? 'text-slate-500 hover:bg-slate-800 hover:text-blue-400'
                          : 'text-slate-400 hover:bg-blue-50 hover:text-blue-600'
                      }`}
                      title="View history"
                    >
                      <CalendarDays size={13} />
                    </button>

                    {/* REMOVE */}

                    {activeTesters.includes(
                      tester.email
                    ) && (
                      <button
                        onClick={() =>
                          removeTesterToday(
                            tester.email
                          )
                        }
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
              }
            )}

          </div>

        </section>

      </div>

      {/* ==================================================
          ACTIVE TESTERS MODAL
      ================================================== */}

      {activeModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-3">

          <div
            className={`w-full max-w-md max-h-[85vh] overflow-hidden rounded-2xl ${
              darkMode
                ? 'bg-[#10151f] text-white'
                : 'bg-white text-slate-800'
            } shadow-2xl`}
          >

            <div className="px-4 py-3.5 border-b border-slate-200/10 flex items-center justify-between">

              <div>
                <h3 className="text-[15px] font-semibold">
                  Active testers
                </h3>

                <p className="text-[10px] text-slate-400 mt-0.5">
                  Select testers included in reports
                </p>
              </div>

              <button
                onClick={() =>
                  setActiveModal(false)
                }
                className="w-7 h-7 rounded-lg flex items-center justify-center bg-slate-100/10"
              >
                <X size={15} />
              </button>

            </div>

            <div className="p-3 overflow-y-auto max-h-[55vh] space-y-1.5">

              {testerList.map((tester) => {

                const checked =
                  selectedActive.includes(
                    tester.email
                  );

                const isSpecial =
                  tester.email ===
                  SPECIAL_TESTER;

                return (
                  <button
                    key={tester.email}
                    onClick={() =>
                      toggleActiveTester(
                        tester.email
                      )
                    }
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
                      {checked && (
                        <Check size={12} />
                      )}
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

                      <div className="text-[9px] text-slate-400 truncate">
                        {tester.email}
                      </div>

                    </div>

                    {isSpecial && (
                      <span className="text-[7px] font-semibold px-1.5 py-1 rounded-md bg-blue-600 text-white">
                        ALWAYS
                      </span>
                    )}

                  </button>
                );
              })}

            </div>

            <div className="p-3 border-t border-slate-200/10">

              <button
                onClick={saveActiveTesters}
                disabled={savingActive}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold transition"
              >
                {savingActive
                  ? 'Saving...'
                  : `Save · ${selectedActive.length} active`}
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
              darkMode
                ? 'bg-[#10151f] text-white'
                : 'bg-white'
            } shadow-2xl`}
          >

            <div className="px-4 py-3.5 flex items-center justify-between border-b border-slate-200/10">

              <div>
                <h3 className="text-[15px] font-semibold">
                  Not tested
                </h3>

                <p className="text-[10px] text-slate-400">
                  {formatDate(today)}
                </p>
              </div>

              <button
                onClick={() =>
                  setNotTestedModal(false)
                }
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
                      darkMode
                        ? 'bg-red-950/20'
                        : 'bg-red-50'
                    }`}
                  >

                    <div className="w-8 h-8 rounded-full bg-red-100 text-red-500 flex items-center justify-center text-[9px] font-semibold">
                      {getInitials(
                        tester.name
                      )}
                    </div>

                    <div className="flex-1 min-w-0">

                      <div
                        className={`text-[11px] font-medium truncate ${
                          darkMode
                            ? 'text-slate-300'
                            : 'text-slate-700'
                        }`}
                      >
                        {tester.name}
                      </div>

                      <div className="text-[9px] text-slate-400 truncate">
                        {tester.email}
                      </div>

                    </div>

                    <span className="text-[9px] text-red-500 font-medium">
                      not tested
                    </span>

                  </div>
                ))
              )}

            </div>

          </div>

        </div>
      )}

      {/* ==================================================
          TESTER CALENDAR MODAL
      ================================================== */}

      {calendarTester && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-3">

          <div
            className={`w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl ${
              darkMode
                ? 'bg-[#10151f] text-white'
                : 'bg-white'
            } shadow-2xl`}
          >

            {/* HEADER */}

            <div className="px-4 py-3.5 border-b border-slate-200/10 flex items-center justify-between">

              <div className="flex items-center gap-2.5">

                <div className="w-9 h-9 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-[10px] font-semibold">
                  {getInitials(
                    calendarTester.name
                  )}
                </div>

                <div>

                  <h3 className="text-[14px] font-semibold">
                    {calendarTester.name}
                  </h3>

                  <p className="text-[9px] text-slate-400">
                    {calendarTester.email}
                  </p>

                </div>

              </div>

              <button
                onClick={() =>
                  setCalendarTester(null)
                }
                className="w-7 h-7 rounded-lg flex items-center justify-center bg-slate-100/10"
              >
                <X size={15} />
              </button>

            </div>

            {/* SUMMARY */}

            <div className="grid grid-cols-3 gap-2 p-3">

              <div
                className={`px-2 py-2.5 rounded-xl text-center ${
                  darkMode
                    ? 'bg-blue-950/30'
                    : 'bg-blue-50'
                }`}
              >

                <div className="text-[8px] text-blue-500 font-medium">
                  TESTED
                </div>

                <div className="text-lg font-semibold text-blue-600">
                  {overallTesterData.find(
                    (x) =>
                      x.email ===
                      calendarTester.email
                  )?.testedDays ?? 0}
                </div>

              </div>

              <div
                className={`px-2 py-2.5 rounded-xl text-center ${
                  darkMode
                    ? 'bg-red-950/30'
                    : 'bg-red-50'
                }`}
              >

                <div className="text-[8px] text-red-500 font-medium">
                  MISSED
                </div>

                <div className="text-lg font-semibold text-red-500">
                  {overallTesterData.find(
                    (x) =>
                      x.email ===
                      calendarTester.email
                  )?.missedDays ?? 0}
                </div>

              </div>

              <div
                className={`px-2 py-2.5 rounded-xl text-center ${
                  darkMode
                    ? 'bg-emerald-950/30'
                    : 'bg-emerald-50'
                }`}
              >

                <div className="text-[8px] text-emerald-500 font-medium">
                  SINCE
                </div>

                <div className="text-[11px] font-semibold text-emerald-600 mt-1.5">
                  17 SEP
                </div>

              </div>

            </div>

            {/* CALENDAR */}

            <div className="px-3 pb-3 overflow-y-auto max-h-[55vh]">

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5">

                {calendarDates.map((date) => {

                  const testedApps =
                    getTestedApps(
                      calendarTester.email,
                      date
                    );

                  const tested =
                    testedApps.length > 0;

                  return (
                    <div
                      key={date}
                      className={`p-2.5 rounded-xl border ${
                        tested
                          ? darkMode
                            ? 'bg-emerald-950/20 border-emerald-900/60'
                            : 'bg-emerald-50/60 border-emerald-100'
                          : darkMode
                          ? 'bg-red-950/20 border-red-900/50'
                          : 'bg-red-50/60 border-red-100'
                      }`}
                    >

                      <div className="flex items-center justify-between">

                        <span className="text-[9px] font-medium text-slate-400">
                          {formatDate(date)}
                        </span>

                        {tested ? (
                          <CheckCircle2
                            size={13}
                            className="text-emerald-500"
                          />
                        ) : (
                          <X
                            size={13}
                            className="text-red-400"
                          />
                        )}

                      </div>

                      <div
                        className={`mt-1.5 text-[10px] font-medium ${
                          tested
                            ? 'text-emerald-500'
                            : 'text-red-500'
                        }`}
                      >
                        {tested
                          ? `${testedApps.length} ${
                              testedApps.length ===
                              1
                                ? 'app'
                                : 'apps'
                            }`
                          : 'Missed'}
                      </div>

                      {tested && (
                        <div className="mt-1.5 space-y-0.5">

                          {testedApps.map(
                            (appId) => (
                              <div
                                key={appId}
                                className="text-[8px] text-slate-400 truncate"
                              >
                                ✓{' '}
                                {appMap[appId]
                                  ?.appName ||
                                  appId}
                              </div>
                            )
                          )}

                        </div>
                      )}

                    </div>
                  );
                })}

              </div>

            </div>

            {/* LEGEND */}

            <div className="px-4 py-2.5 border-t border-slate-200/10 flex gap-4 text-[9px]">

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

            <RefreshCw
              size={16}
              className="animate-spin"
            />

            <span className="text-[11px] font-medium">
              Loading...
            </span>

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