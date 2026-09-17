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
  Users,
  CalendarDays,
  Moon,
  Sun,
  Filter,
  UserCheck,
  UserX,
  RefreshCw,
  Trash2,
  Clock,
  CheckCircle2,
  AlertCircle,
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
  const [calendarDate, setCalendarDate] = useState(getBDDate());

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

      let savedActive =
        settingsSnap.exists()
          ? settingsSnap.data().emails || []
          : [];

      // Shuvojit is always active
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
  // ACTIVE ONGOING APPS
  // --------------------------------------------------

  const ongoingApps = useMemo(() => {
    return apps.filter((app) => {
      const status = typeof app?.status === 'string' ? app.status.trim() : '';
      return status === 'Ongoing';
    });
  }, [apps]);

  const ongoingCount = ongoingApps.length;

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

  // Tested if at least 1 app was tested on that date
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
  // MISSED REPORT (PAST DAYS ONLY: YESTERDAY, DAY BEFORE, TILL NOW)
  // --------------------------------------------------

  const reportDates = useMemo(() => {
    if (missedFilter === 'yesterday') {
      return [getYesterday()];
    }

    if (missedFilter === 'dayBefore') {
      return [getDayBeforeYesterday()];
    }

    // "Till now" strictly counts completed days up to yesterday
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
  }, [activeTesters, testerList, reportDates, logs]);

  // --------------------------------------------------
  // OVERALL RANKING (UP TO TODAY)
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
  }, [activeTesters, testerList, logs, today]);

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
  // REMOVE TESTER FROM TODAY
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
    localStorage.setItem('adminTestingDark', String(next));
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
    setCalendarDate(today);
  };

  // --------------------------------------------------
  // UI
  // --------------------------------------------------

  return (
    <div
      className={`font-sans ${
        darkMode
          ? 'min-h-screen bg-slate-950 text-white'
          : 'min-h-screen bg-slate-50 text-slate-900'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">

        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">

          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Testing Report
            </h1>

            <p
              className={
                darkMode
                  ? 'text-slate-400 mt-1'
                  : 'text-slate-500 mt-1'
              }
            >
              Daily tester activity from 17 September
            </p>
          </div>

          <div className="flex gap-2">

            <button
              onClick={toggleDark}
              className={`p-2.5 rounded-xl border transition ${
                darkMode
                  ? 'border-slate-700 bg-slate-900 hover:bg-slate-800'
                  : 'border-blue-100 bg-white hover:bg-blue-50'
              }`}
              title="Toggle night mode"
            >
              {darkMode ? (
                <Sun size={18} />
              ) : (
                <Moon size={18} />
              )}
            </button>

            <button
              onClick={loadData}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700"
            >
              <RefreshCw size={16} />
              Refresh
            </button>

          </div>
        </div>

        {/* TOP CONTROL BAR */}
        <div className="grid md:grid-cols-2 gap-4 mb-6">

          {/* ACTIVE TESTERS */}
          <button
            onClick={() => setActiveModal(true)}
            className={`text-left p-5 rounded-2xl border transition ${
              darkMode
                ? 'bg-slate-900 border-slate-800 hover:border-blue-500'
                : 'bg-white border-blue-100 hover:border-blue-300 shadow-sm'
            }`}
          >
            <div className="flex items-center justify-between">

              <div>
                <div className="flex items-center gap-2 text-blue-500 font-bold text-sm">
                  <UserCheck size={17} />
                  ACTIVE TESTERS
                </div>

                <div className="text-3xl font-extrabold mt-1">
                  {activeTesters.length}
                </div>

                <div
                  className={
                    darkMode
                      ? 'text-slate-400 text-sm'
                      : 'text-slate-500 text-sm'
                  }
                >
                  testers included in reports
                </div>
              </div>

              <Filter
                size={25}
                className="text-blue-500"
              />

            </div>
          </button>

          {/* ONGOING APPS */}
          <div
            className={`p-5 rounded-2xl border ${
              darkMode
                ? 'bg-slate-900 border-slate-800'
                : 'bg-white border-blue-100 shadow-sm'
            }`}
          >
           
          </div>

        </div>

        {/* TODAY HEADER */}
        <div className="flex items-center justify-between mb-4">

          <div>
            <h2 className="text-xl font-extrabold">
              Tested Today
            </h2>

            <p
              className={
                darkMode
                  ? 'text-slate-400 text-sm'
                  : 'text-slate-500 text-sm'
              }
            >
              {formatDate(today)}
            </p>
          </div>

          <button
            onClick={() => setNotTestedModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-red-200 text-red-600 font-bold text-sm hover:bg-red-50"
          >
            <UserX size={16} />
            Not Tested
            <span className="bg-red-100 px-2 py-0.5 rounded-full">
              {todayNotTested.length}
            </span>
          </button>

        </div>

        {/* TESTED TODAY CIRCLES */}
        <div className="flex flex-wrap gap-4 mb-8">

          {todayComplete.length === 0 && (
            <div
              className={`w-full p-6 rounded-2xl border text-center ${
                darkMode
                  ? 'bg-slate-900 border-slate-800 text-slate-400'
                  : 'bg-white border-blue-100 text-slate-500'
              }`}
            >
              No tester has completed testing yet today.
            </div>
          )}

          {todayComplete.map((tester) => (
            <div
              key={tester.email}
              className="flex flex-col items-center"
            >
              <button
                onClick={() => openCalendar(tester)}
                className="relative w-20 h-20 rounded-full bg-blue-600 text-white flex items-center justify-center font-extrabold text-lg shadow-lg hover:scale-105 transition"
              >
                {tester.name
                  .split(' ')
                  .map((x) => x[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase()}

                <span className="absolute -right-1 -bottom-1 w-7 h-7 rounded-full bg-emerald-500 border-4 border-white flex items-center justify-center">
                  <Check size={14} />
                </span>
              </button>

              <span className="mt-2 text-sm font-bold text-center max-w-[100px] truncate">
                {tester.name}
              </span>

              <span className="text-xs text-emerald-500 font-semibold">
                {tester.testedCount} {tester.testedCount === 1 ? 'app' : 'apps'} tested
              </span>
            </div>
          ))}

        </div>

        {/* TESTING MISSED */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">

          <div>
            <h2 className="text-xl font-extrabold">
              Testing Missed
            </h2>

            <p
              className={
                darkMode
                  ? 'text-slate-400 text-sm'
                  : 'text-slate-500 text-sm'
              }
            >
              Testers who missed tests (past dates only)
            </p>
          </div>

          <div className="flex flex-wrap gap-2">

            {[
              ['yesterday', 'Yesterday'],
              ['dayBefore', 'Day before'],
              ['all', 'Till now'],
            ].map(([value, label]) => (
              <button
                key={value}
                onClick={() => setMissedFilter(value)}
                className={`px-3 py-2 rounded-lg text-xs font-bold border ${
                  missedFilter === value
                    ? 'bg-blue-600 text-white border-blue-600'
                    : darkMode
                    ? 'bg-slate-900 border-slate-700 text-slate-300'
                    : 'bg-white border-blue-100 text-slate-600'
                }`}
              >
                {label}
              </button>
            ))}

          </div>
        </div>

        {/* MISSED CARDS */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-8">

          {missedData.length === 0 && (
            <div
              className={`col-span-full p-6 rounded-2xl border text-center ${
                darkMode
                  ? 'bg-slate-900 border-slate-800 text-slate-400'
                  : 'bg-white border-blue-100 text-slate-500'
              }`}
            >
              No missed testing in this period.
            </div>
          )}

          {missedData.map((tester) => (
            <button
              key={tester.email}
              onClick={() => openCalendar(tester)}
              className={`text-left p-4 rounded-2xl border transition ${
                darkMode
                  ? 'bg-slate-900 border-slate-800 hover:border-blue-500'
                  : 'bg-white border-blue-100 hover:border-blue-300 shadow-sm'
              }`}
            >
              <div className="flex items-center justify-between">

                <div className="flex items-center gap-3">

                  <div className="w-11 h-11 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                    {tester.name
                      .split(' ')
                      .map((x) => x[0])
                      .slice(0, 2)
                      .join('')
                      .toUpperCase()}
                  </div>

                  <div>
                    <div className="font-bold">
                      {tester.name}
                    </div>

                    <div className="text-xs text-slate-400">
                      {tester.email}
                    </div>
                  </div>

                </div>

                <div className="text-red-500 font-extrabold">
                  {tester.missedCount} {tester.missedCount === 1 ? 'day' : 'days'}
                </div>

              </div>
            </button>
          ))}

        </div>

        {/* ALL TESTERS */}
        <div className="flex items-center justify-between mb-4">

          <div>
            <h2 className="text-xl font-extrabold">
              All Testers
            </h2>

            <p
              className={
                darkMode
                  ? 'text-slate-400 text-sm'
                  : 'text-slate-500 text-sm'
              }
            >
              Performance from 17 September
            </p>
          </div>

          <div className="flex items-center gap-2 text-sm text-blue-500 font-bold">
            <Clock size={16} />
            {formatDate(START_DATE)}
          </div>

        </div>

        <div className="space-y-3">

          {overallTesterData.map((tester, index) => (

            <div
              key={tester.email}
              className={`p-4 rounded-2xl border ${
                darkMode
                  ? 'bg-slate-900 border-slate-800'
                  : 'bg-white border-blue-100 shadow-sm'
              }`}
            >

              <div className="flex flex-col lg:flex-row lg:items-center gap-4">

                {/* RANK + NAME */}
                <div className="flex items-center gap-3 lg:w-[280px]">

                  <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-extrabold text-sm">
                    {index + 1}
                  </div>

                  <div className="w-11 h-11 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
                    {tester.name
                      .split(' ')
                      .map((x) => x[0])
                      .slice(0, 2)
                      .join('')
                      .toUpperCase()}
                  </div>

                  <div className="min-w-0">
                    <div className="font-extrabold truncate">
                      {tester.name}
                    </div>

                    <div className="text-xs text-slate-400 truncate">
                      {tester.email}
                    </div>
                  </div>

                </div>

                {/* PROGRESS */}
                <div className="flex-1">

                  <div className="flex items-center justify-between mb-2">

                    <span className="text-xs font-bold text-slate-400">
                      DAILY COMPLETION
                    </span>

                    <span
                      className={`text-sm font-extrabold ${
                        tester.missedDays === 0
                          ? 'text-emerald-500'
                          : 'text-blue-600'
                      }`}
                    >
                      {tester.testedDays}/{tester.totalDays}
                    </span>

                  </div>

                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden">

                    <div
                      className="h-full bg-blue-600 rounded-full transition-all"
                      style={{
                        width: `${Math.max(
                          0,
                          Math.min(
                            tester.ratio * 100,
                            100
                          )
                        )}%`,
                      }}
                    />

                  </div>

                  <div className="flex gap-3 mt-2 text-xs">

                    <span className="text-emerald-500 font-bold">
                      {tester.testedDays} completed
                    </span>

                    <span className="text-red-500 font-bold">
                      {tester.missedDays} missed
                    </span>

                  </div>

                </div>

                {/* TODAY */}
                <div className="flex items-center gap-2">

                  {hasTestedSomething(tester.email, today) ? (
                    <span className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-50 text-emerald-600 text-xs font-bold">
                      <CheckCircle2 size={15} />
                      Tested today
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-50 text-red-600 text-xs font-bold">
                      <AlertCircle size={15} />
                      Not tested
                    </span>
                  )}

                  <button
                    onClick={() => openCalendar(tester)}
                    className="p-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100"
                    title="View calendar"
                  >
                    <CalendarDays size={17} />
                  </button>

                  {activeTesters.includes(tester.email) && (
                    <button
                      onClick={() =>
                        removeTesterToday(tester.email)
                      }
                      className="p-2 rounded-lg bg-red-50 text-red-500 hover:bg-red-100"
                      title="Remove from today's testing"
                    >
                      <Trash2 size={17} />
                    </button>
                  )}

                </div>

              </div>

            </div>

          ))}

        </div>

      </div>

      {/* ==================================================
          ACTIVE TESTERS MODAL
      ================================================== */}

      {activeModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">

          <div
            className={`w-full max-w-lg max-h-[85vh] overflow-hidden rounded-3xl ${
              darkMode
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-900'
            } shadow-2xl`}
          >

            <div className="p-5 border-b border-slate-200/10 flex items-center justify-between">

              <div>
                <h3 className="text-xl font-extrabold">
                  Active Testers
                </h3>

                <p className="text-sm text-slate-400">
                  Select testers used in reports
                </p>
              </div>

              <button
                onClick={() => setActiveModal(false)}
                className="p-2 rounded-lg bg-slate-100/10"
              >
                <X size={18} />
              </button>

            </div>

            <div className="p-5 overflow-y-auto max-h-[55vh] space-y-2">

              {testerList.map((tester) => {

                const checked =
                  selectedActive.includes(
                    tester.email
                  );

                const isSpecial =
                  tester.email === SPECIAL_TESTER;

                return (
                  <button
                    key={tester.email}
                    onClick={() =>
                      toggleActiveTester(
                        tester.email
                      )
                    }
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition ${
                      checked
                        ? 'border-blue-500 bg-blue-50 text-blue-900'
                        : darkMode
                        ? 'border-slate-700 bg-slate-800'
                        : 'border-slate-100 bg-slate-50'
                    }`}
                  >

                    <div
                      className={`w-6 h-6 rounded-md flex items-center justify-center border ${
                        checked
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : 'border-slate-300'
                      }`}
                    >
                      {checked && (
                        <Check size={15} />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">

                      <div className="font-bold truncate">
                        {tester.name}
                      </div>

                      <div className="text-xs text-slate-400 truncate">
                        {tester.email}
                      </div>

                    </div>

                    {isSpecial && (
                      <span className="text-[10px] font-extrabold px-2 py-1 rounded-full bg-blue-600 text-white">
                        ALWAYS ACTIVE
                      </span>
                    )}

                  </button>
                );
              })}

            </div>

            <div className="p-5 border-t border-slate-200/10">

              <button
                onClick={saveActiveTesters}
                disabled={savingActive}
                className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold"
              >
                {savingActive
                  ? 'Saving...'
                  : `Save Active Testers (${selectedActive.length})`}
              </button>

            </div>

          </div>

        </div>
      )}

      {/* ==================================================
          NOT TESTED MODAL
      ================================================== */}

      {notTestedModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">

          <div
            className={`w-full max-w-md max-h-[80vh] overflow-hidden rounded-3xl ${
              darkMode
                ? 'bg-slate-900 text-white'
                : 'bg-white'
            } shadow-2xl`}
          >

            <div className="p-5 flex items-center justify-between border-b border-slate-200/10">

              <div>
                <h3 className="text-xl font-extrabold">
                  Not Tested Today
                </h3>

                <p className="text-sm text-slate-400">
                  {formatDate(today)}
                </p>
              </div>

              <button
                onClick={() =>
                  setNotTestedModal(false)
                }
                className="p-2 rounded-lg bg-slate-100/10"
              >
                <X size={18} />
              </button>

            </div>

            <div className="p-4 overflow-y-auto max-h-[60vh] space-y-2">

              {todayNotTested.length === 0 ? (
                <div className="p-8 text-center text-emerald-500 font-bold">
                  Everyone completed testing today.
                </div>
              ) : (
                todayNotTested.map((tester) => (
                  <div
                    key={tester.email}
                    className="p-4 rounded-xl bg-red-50 border border-red-100"
                  >

                    <div className="font-bold text-slate-800">
                      {tester.name}
                    </div>

                    <div className="text-xs text-slate-400">
                      {tester.email}
                    </div>

                    <div className="mt-2 text-sm font-bold text-red-600">
                      {tester.testedCount} apps tested
                    </div>

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
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">

          <div
            className={`w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-3xl ${
              darkMode
                ? 'bg-slate-900 text-white'
                : 'bg-white'
            } shadow-2xl`}
          >

            {/* CALENDAR HEADER */}
            <div className="p-5 border-b border-slate-200/10 flex items-center justify-between">

              <div>

                <h3 className="text-xl font-extrabold">
                  {calendarTester.name}
                </h3>

                <p className="text-xs text-slate-400">
                  {calendarTester.email}
                </p>

              </div>

              <button
                onClick={() =>
                  setCalendarTester(null)
                }
                className="p-2 rounded-lg bg-slate-100/10"
              >
                <X size={18} />
              </button>

            </div>

            {/* SUMMARY */}
            <div className="grid grid-cols-3 gap-2 p-4">

              <div className="p-3 rounded-xl bg-blue-50 text-center">
                <div className="text-xs text-blue-500 font-bold">
                  TESTED
                </div>

                <div className="text-xl font-extrabold text-blue-700">
                  {calendarTester.dailyData?.filter(
                    (d) => d.complete
                  ).length ??
                    overallTesterData.find(
                      (x) =>
                        x.email ===
                        calendarTester.email
                    )?.testedDays ??
                    0}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-red-50 text-center">
                <div className="text-xs text-red-500 font-bold">
                  MISSED
                </div>

                <div className="text-xl font-extrabold text-red-600">
                  {overallTesterData.find(
                    (x) =>
                      x.email ===
                      calendarTester.email
                  )?.missedDays ?? 0}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-emerald-50 text-center">
                <div className="text-xs text-emerald-500 font-bold">
                  FROM
                </div>

                <div className="text-sm font-extrabold text-emerald-700 mt-1">
                  17 SEP
                </div>
              </div>

            </div>

            {/* CALENDAR */}
            <div className="p-5 overflow-y-auto max-h-[55vh]">

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">

                {calendarDates.map((date) => {

                  const testedApps =
                    getTestedApps(
                      calendarTester.email,
                      date
                    );

                  const tested = testedApps.length > 0;

                  return (
                    <div
                      key={date}
                      className={`p-3 rounded-xl border ${
                        tested
                          ? 'bg-emerald-50 border-emerald-200'
                          : 'bg-red-50 border-red-200'
                      }`}
                    >

                      <div className="flex items-center justify-between">

                        <span className="text-xs font-bold text-slate-500">
                          {formatDate(date)}
                        </span>

                        {tested ? (
                          <CheckCircle2
                            size={17}
                            className="text-emerald-500"
                          />
                        ) : (
                          <X
                            size={17}
                            className="text-red-500"
                          />
                        )}

                      </div>

                      <div
                        className={`mt-2 text-sm font-extrabold ${
                          tested
                            ? 'text-emerald-600'
                            : 'text-red-600'
                        }`}
                      >
                        {tested
                          ? `${testedApps.length} ${testedApps.length === 1 ? 'app' : 'apps'} tested`
                          : 'Missed'}
                      </div>

                      {tested && (
                        <div className="mt-2 space-y-1">

                          {testedApps.map(
                            (appId) => (
                              <div
                                key={appId}
                                className="text-[10px] text-slate-500 truncate"
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
            <div className="p-4 border-t border-slate-200/10 flex flex-wrap gap-4 text-xs font-bold">

              <span className="flex items-center gap-1 text-emerald-500">
                <span className="w-3 h-3 rounded bg-emerald-500" />
                Tested
              </span>

              <span className="flex items-center gap-1 text-red-500">
                <span className="w-3 h-3 rounded bg-red-500" />
                Missed
              </span>

            </div>

          </div>

        </div>
      )}

      {/* LOADING */}
      {loading && (
        <div className="fixed inset-0 z-[60] bg-white/70 backdrop-blur-sm flex items-center justify-center">

          <div className="flex items-center gap-3 bg-white px-5 py-4 rounded-2xl shadow-xl text-blue-600 font-bold">
            <RefreshCw
              size={20}
              className="animate-spin"
            />
            Loading testing data...
          </div>

        </div>
      )}

    </div>
  );
}