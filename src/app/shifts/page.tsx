'use client';

import React, { useState, useEffect } from 'react';
import {
  CalendarDays,
  Clock,
  CheckCircle2,
  Moon,
  Sun,
  Shield,
  Plus,
  Users,
  X,
  Loader2,
} from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';

interface ShiftItem {
  id: string;
  name: string;
  code: string;
  isOvernight: boolean;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  timezone: string;
  graceLateMinutes: number;
  graceEarlyExitMinutes: number;
  overtimeMinMinutes: number;
  isDefault: boolean;
  isActive: boolean;
  assignedCount: number;
  status: string;
}

export default function ShiftManagementPage() {
  const [shifts, setShifts] = useState<ShiftItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [isOvernight, setIsOvernight] = useState(false);
  const [startTime, setStartTime] = useState('10:00:00');
  const [endTime, setEndTime] = useState('19:00:00');
  const [graceLate, setGraceLate] = useState(15);
  const [graceEarly, setGraceEarly] = useState(15);
  const [overtimeMin, setOvertimeMin] = useState(30);
  const [submitting, setSubmitting] = useState(false);

  const fetchShifts = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/shifts');
      const data = await res.json();
      if (data.success) {
        setShifts(data.data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShifts();
  }, []);

  const handleCreateShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !code) return;

    try {
      setSubmitting(true);
      const res = await fetch('/api/shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          code,
          isOvernight,
          startTime,
          endTime,
          graceLateMinutes: Number(graceLate),
          graceEarlyExitMinutes: Number(graceEarly),
          overtimeMinMinutes: Number(overtimeMin),
        }),
      });

      if (res.ok) {
        setIsAddModalOpen(false);
        setName('');
        setCode('');
        await fetchShifts();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-1">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="h1 tracking-tight text-[#0E1E27] dark:text-white">
                Shift Configurations & Policies
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#FAF5F5] dark:bg-slate-800 text-[#806169] dark:text-slate-400 border border-[#E8DFDE] dark:border-slate-700">
                MULTI-SHIFT ENGINE
              </span>
            </div>
            <p className="text-xs text-[#5E4B50] dark:text-slate-400 mt-0.5">
              Dynamic shift windows, overnight cross-midnight date anchoring, and automated grace periods
            </p>
          </div>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="button--primary button--sm bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Shift Policy</span>
          </button>
        </div>

        {/* Shift Cards Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {loading ? (
            <div className="col-span-2 text-center py-12 text-slate-500">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
              <span>Loading shift schedules from database...</span>
            </div>
          ) : (
            shifts.map((s) => (
              <div
                key={s.id}
                className="card-surface p-5 rounded-2xl border border-[#E8DFDE] dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm relative overflow-hidden flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        {s.isOvernight ? (
                          <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                            <Moon className="w-4 h-4" />
                          </div>
                        ) : (
                          <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
                            <Sun className="w-4 h-4" />
                          </div>
                        )}
                        <h2 className="text-base font-bold text-[#0E1E27] dark:text-white">{s.name}</h2>
                      </div>
                      <p className="font-mono text-[11px] text-slate-400 mt-1">{s.code}</p>
                    </div>

                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                        s.isDefault
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800'
                          : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      {s.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3.5 my-4 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-xs">
                    <div>
                      <span className="text-slate-400 block text-[10px]">Shift Start:</span>
                      <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                        {s.startTime}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Shift End:</span>
                      <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                        {s.endTime} {s.isOvernight ? '(+1 Day)' : ''}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Late Arrival Grace:</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {s.graceLateMinutes} Minutes
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Overtime Threshold:</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        +{s.overtimeMinMinutes} Minutes
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
                  <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                    <Users className="w-3.5 h-3.5" />
                    <span>{s.assignedCount} Employees Assigned</span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400">{s.timezone}</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Modal: Add Shift */}
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl">
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                  Add Shift Configuration
                </h3>
                <button
                  onClick={() => setIsAddModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateShift} className="space-y-4 text-xs">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Shift Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. European Operations Shift"
                    required
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Shift Code
                  </label>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="e.g. EU_OPS_IST"
                    required
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 font-mono"
                  />
                </div>

                <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800">
                  <input
                    type="checkbox"
                    id="isOvernight"
                    checked={isOvernight}
                    onChange={(e) => setIsOvernight(e.target.checked)}
                    className="rounded text-indigo-600"
                  />
                  <label htmlFor="isOvernight" className="font-medium text-slate-700 dark:text-slate-300">
                    Overnight Shift (Cross-Midnight Anchoring)
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Start Time (Local)
                    </label>
                    <input
                      type="time"
                      value={startTime.slice(0, 5)}
                      onChange={(e) => setStartTime(e.target.value + ':00')}
                      required
                      className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                      End Time (Local)
                    </label>
                    <input
                      type="time"
                      value={endTime.slice(0, 5)}
                      onChange={(e) => setEndTime(e.target.value + ':00')}
                      required
                      className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Late Grace (Mins)
                    </label>
                    <input
                      type="number"
                      value={graceLate}
                      onChange={(e) => setGraceLate(Number(e.target.value))}
                      className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Overtime Min (Mins)
                    </label>
                    <input
                      type="number"
                      value={overtimeMin}
                      onChange={(e) => setOvertimeMin(Number(e.target.value))}
                      className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl flex items-center gap-1.5 cursor-pointer"
                  >
                    {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Save Shift</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
