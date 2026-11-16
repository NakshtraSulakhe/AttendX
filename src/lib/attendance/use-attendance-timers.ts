'use client';

import { useState, useEffect, useMemo } from 'react';

export interface EmployeeTimerBaseline {
  id: string;
  currentState: string;
  firstInTime: string | null;
  currentIntervalStart: string | null;
  totalWorkingSeconds: number;
  totalBreakSeconds: number;
  totalElapsedSeconds: number;
}

export interface CalculatedTimerResult {
  elapsedSeconds: number;
  workingSeconds: number;
  breakSeconds: number;
  currentIntervalSeconds: number;
  elapsedFormatted: string;
  workingFormatted: string;
  breakFormatted: string;
  currentIntervalFormatted: string;
  intervalFormatted: string;
}

export function formatSecondsToHHMMSS(seconds: number): string {
  if (!seconds || seconds < 0) return '00:00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function useAttendanceTimers(
  employeesOrServerTime?: EmployeeTimerBaseline[] | string,
  maybeServerTimeUtc?: string
) {
  // Overload handling: support (employees, serverTimeUtc) or (serverTimeUtc)
  const employees: EmployeeTimerBaseline[] = Array.isArray(employeesOrServerTime)
    ? employeesOrServerTime
    : [];

  const serverTimeUtc: string | undefined = typeof employeesOrServerTime === 'string'
    ? employeesOrServerTime
    : maybeServerTimeUtc;

  // Client-server clock offset in ms
  const [clockOffset, setClockOffset] = useState<number>(0);
  const [tick, setTick] = useState<number>(0);

  useEffect(() => {
    if (serverTimeUtc) {
      const serverTimeMs = new Date(serverTimeUtc).getTime();
      const localTimeMs = Date.now();
      setClockOffset(serverTimeMs - localTimeMs);
    }
  }, [serverTimeUtc]);

  useEffect(() => {
    // Single shared 1-second interval ticker for all visible employees
    const interval = setInterval(() => {
      setTick((prev) => (prev + 1) % 1000000);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const getAuthoritativeNowMs = () => Date.now() + clockOffset;

  const calculateTimers = (emp: EmployeeTimerBaseline): CalculatedTimerResult => {
    const nowMs = getAuthoritativeNowMs();
    let elapsed = 0;
    let working = emp.totalWorkingSeconds;
    let breakTime = emp.totalBreakSeconds;
    let currentInterval = 0;

    if (emp.currentState === 'COMPLETED') {
      elapsed = emp.totalElapsedSeconds;
      working = emp.totalWorkingSeconds;
      breakTime = emp.totalBreakSeconds;
      currentInterval = 0;
    } else if (emp.firstInTime) {
      const firstInMs = new Date(emp.firstInTime).getTime();
      elapsed = Math.max(0, Math.floor((nowMs - firstInMs) / 1000));

      if (emp.currentIntervalStart) {
        const intervalStartMs = new Date(emp.currentIntervalStart).getTime();
        const activeSeconds = Math.max(0, Math.floor((nowMs - intervalStartMs) / 1000));
        currentInterval = activeSeconds;

        if (emp.currentState === 'WORKING') {
          working = emp.totalWorkingSeconds + activeSeconds;
        } else if (emp.currentState === 'ON_BREAK') {
          breakTime = emp.totalBreakSeconds + activeSeconds;
        }
      }
    }

    return {
      elapsedSeconds: elapsed,
      workingSeconds: working,
      breakSeconds: breakTime,
      currentIntervalSeconds: currentInterval,
      elapsedFormatted: formatSecondsToHHMMSS(elapsed),
      workingFormatted: formatSecondsToHHMMSS(working),
      breakFormatted: formatSecondsToHHMMSS(breakTime),
      currentIntervalFormatted: formatSecondsToHHMMSS(currentInterval),
      intervalFormatted: formatSecondsToHHMMSS(currentInterval),
    };
  };

  // Pre-calculated map of timers for all passed employees (updates every second)
  const timers = useMemo(() => {
    const map: Record<string, CalculatedTimerResult> = {};
    for (const emp of employees) {
      map[emp.id] = calculateTimers(emp);
    }
    return map;
  }, [employees, tick, clockOffset]);

  return { timers, calculateTimers, tick };
}
