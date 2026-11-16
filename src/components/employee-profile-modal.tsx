'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  User,
  Clock,
  Briefcase,
  Coffee,
  CheckCircle2,
  Calendar,
  History,
  Building2,
  Cpu,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';

interface IntervalItem {
  id: string;
  sequence: number;
  type: 'WORK' | 'BREAK';
  startTime: string;
  endTime: string | null;
  durationSeconds: number;
  status: string;
}

interface PunchHistoryItem {
  sequence: number;
  id: string;
  serialNo: number;
  timestampUtc: string;
  timestampDevice: string;
  timeIst: string;
  timeEst: string;
  punchType: string;
  verifyMode: string;
  deviceName: string;
  source: string;
  intervalType: string;
}

interface EmployeeDetailData {
  employee: {
    id: string;
    code: string;
    name: string;
    email: string | null;
    phone: string | null;
    department: string;
    designation: string;
    biometricNumber: string;
    shiftName: string;
    shiftHours: string;
  };
  session: {
    id: string;
    businessDate: string;
    currentState: string;
    completionStatus: string;
    firstInTime: string | null;
    lastInTime: string | null;
    lastOutTime: string | null;
    currentIntervalStart: string | null;
    inCount: number;
    outCount: number;
    completedBreakCount: number;
    totalWorkingSeconds: number;
    totalBreakSeconds: number;
    totalElapsedSeconds: number;
  } | null;
  intervals: IntervalItem[];
  punchHistory: PunchHistoryItem[];
  serverTimeUtc: string;
}

interface Props {
  employeeId: string | null;
  onClose: () => void;
}

function formatDuration(sec: number): string {
  if (!sec || sec < 0) sec = 0;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function EmployeeProfileModal({ employeeId, onClose }: Props) {
  const [data, setData] = useState<EmployeeDetailData | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'punches' | 'intervals'>('profile');

  useEffect(() => {
    if (!employeeId) return;
    setLoading(true);
    fetch(`/api/attendance/employee/${employeeId}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.success) {
          setData(json);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [employeeId]);

  if (!employeeId) return null;

  const emp = data?.employee;
  const session = data?.session;
  const punches = data?.punchHistory || [];
  const intervals = data?.intervals || [];

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0E1E27]/50 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl bg-white border border-[#E8DFDE] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-[#0E1E27] animate-in zoom-in-95 duration-150"
      >
        {/* Header Modal Banner */}
        <div className="p-6 bg-[#FAF8F8] border-b border-[#E8DFDE] flex items-start justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 rounded-xl bg-[#0E1E27] text-white flex items-center justify-center font-semibold text-base shadow-xs">
              {emp?.name ? emp.name.substring(0, 2).toUpperCase() : 'EM'}
            </div>
            <div>
              <div className="flex items-center space-x-2.5">
                <h3 className="h3 font-semibold text-lg text-[#0E1E27]">{emp?.name || 'Loading profile...'}</h3>
                <span className="text-xs font-mono font-medium bg-white px-2 py-0.5 rounded border border-[#E8DFDE] text-[#5E4B50]">
                  {emp?.code || 'EMP'}
                </span>
                <span className="font-mono text-xs font-semibold text-[#0E1E27] bg-[#F5E1E0] px-2 py-0.5 rounded">
                  Bio #{emp?.biometricNumber}
                </span>
              </div>
              <p className="text-xs text-[#5E4B50] mt-1">
                {emp?.designation || 'Staff'} • {emp?.department || 'Operations'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-[#806169] hover:text-[#0E1E27] hover:bg-[#F5E1E0]/50 rounded-lg transition-colors"
            title="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Tab Switcher */}
        <div className="px-6 pt-3 bg-[#FAF8F8] border-b border-[#E8DFDE] flex items-center space-x-6 text-xs">
          <button
            onClick={() => setActiveTab('profile')}
            className={`pb-2.5 font-semibold transition-colors border-b-2 flex items-center space-x-1.5 ${
              activeTab === 'profile'
                ? 'border-[#0E1E27] text-[#0E1E27]'
                : 'border-transparent text-[#806169] hover:text-[#0E1E27]'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Profile & Shifts</span>
          </button>

          <button
            onClick={() => setActiveTab('punches')}
            className={`pb-2.5 font-semibold transition-colors border-b-2 flex items-center space-x-1.5 ${
              activeTab === 'punches'
                ? 'border-[#0E1E27] text-[#0E1E27]'
                : 'border-transparent text-[#806169] hover:text-[#0E1E27]'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Today's Punches ({punches.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('intervals')}
            className={`pb-2.5 font-semibold transition-colors border-b-2 flex items-center space-x-1.5 ${
              activeTab === 'intervals'
                ? 'border-[#0E1E27] text-[#0E1E27]'
                : 'border-transparent text-[#806169] hover:text-[#0E1E27]'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Intervals & Breaks ({intervals.length})</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {loading ? (
            <div className="text-center py-12 text-xs text-[#806169] animate-pulse">
              Loading employee dossier...
            </div>
          ) : activeTab === 'profile' ? (
            <div className="space-y-4 text-xs">
              {/* Identity & Shift Grid */}
              <div className="p-4 rounded-xl bg-[#FAF8F8] border border-[#E8DFDE] space-y-2.5">
                <h4 className="font-semibold text-[#0E1E27] text-xs uppercase tracking-wide">
                  Biometric Terminal Binding
                </h4>
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <span className="text-[#806169] block">Hardware Biometric ID:</span>
                    <strong className="font-mono text-[#0E1E27] text-sm">#{emp?.biometricNumber}</strong>
                  </div>
                  <div>
                    <span className="text-[#806169] block">Assigned Terminal:</span>
                    <strong className="text-[#0E1E27]">DS-K1T343EFWX (192.168.200.200)</strong>
                  </div>
                  <div>
                    <span className="text-[#806169] block">Assigned Shift Schedule:</span>
                    <strong className="text-[#0E1E27]">{emp?.shiftName || 'US Operations Overnight'}</strong>
                  </div>
                  <div>
                    <span className="text-[#806169] block">Nominal Shift Hours:</span>
                    <strong className="text-[#0E1E27]">{emp?.shiftHours || '17:30 - 02:30 IST'}</strong>
                  </div>
                </div>
              </div>

              {/* Today's Shift Metrics Summary */}
              <div className="p-4 rounded-xl border border-[#E8DFDE] bg-white space-y-3">
                <h4 className="font-semibold text-[#0E1E27] text-xs uppercase tracking-wide">
                  Active Shift Attendance Summary
                </h4>
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="p-2.5 rounded-lg bg-[#FAF8F8] border border-[#E8DFDE]">
                    <span className="text-[10px] uppercase text-[#806169] block">Punches Today</span>
                    <strong className="font-mono text-sm text-[#0E1E27] mt-0.5 block">
                      {session?.inCount || 0} IN / {session?.outCount || 0} OUT
                    </strong>
                  </div>
                  <div className="p-2.5 rounded-lg bg-emerald-50/50 border border-emerald-200">
                    <span className="text-[10px] uppercase text-emerald-800 block">Working Time</span>
                    <strong className="font-mono text-sm text-emerald-700 mt-0.5 block">
                      {formatDuration(session?.totalWorkingSeconds || 0)}
                    </strong>
                  </div>
                  <div className="p-2.5 rounded-lg bg-amber-50/50 border border-amber-200">
                    <span className="text-[10px] uppercase text-amber-800 block">Break Time</span>
                    <strong className="font-mono text-sm text-amber-700 mt-0.5 block">
                      {formatDuration(session?.totalBreakSeconds || 0)}
                    </strong>
                  </div>
                  <div className="p-2.5 rounded-lg bg-[#FAF5F5] border border-[#E8DFDE]">
                    <span className="text-[10px] uppercase text-[#5E4B50] block">Elapsed Total</span>
                    <strong className="font-mono text-sm text-[#0E1E27] mt-0.5 block">
                      {formatDuration(session?.totalElapsedSeconds || 0)}
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          ) : activeTab === 'punches' ? (
            <div>
              {punches.length === 0 ? (
                <div className="text-center py-8 text-xs text-[#806169]">
                  No punch records recorded for this shift business date.
                </div>
              ) : (
                <div className="table-surface">
                  <table className="w-full text-left text-xs">
                    <thead className="table-header">
                      <tr>
                        <th className="px-4 py-2.5">#</th>
                        <th className="px-4 py-2.5 font-mono">Time (IST)</th>
                        <th className="px-4 py-2.5">Type</th>
                        <th className="px-4 py-2.5">Method</th>
                        <th className="px-4 py-2.5">Device Source</th>
                        <th className="px-4 py-2.5 font-mono text-right">Serial</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E8DFDE] bg-white font-sans">
                      {punches.map((p) => {
                        const isCheckIn = p.punchType === 'IN';
                        return (
                          <tr key={p.id} className="table-row-hover">
                            <td className="px-4 py-2.5 font-mono text-[#806169]">{p.sequence}</td>
                            <td className="px-4 py-2.5 font-mono font-semibold text-[#0E1E27]">{p.timeIst}</td>
                            <td className="px-4 py-2.5">
                              {isCheckIn ? <span className="badge-working">IN</span> : <span className="badge-break">OUT</span>}
                            </td>
                            <td className="px-4 py-2.5 text-[#5E4B50] capitalize">{p.verifyMode}</td>
                            <td className="px-4 py-2.5 text-[#806169] text-[11px]">{p.deviceName}</td>
                            <td className="px-4 py-2.5 font-mono text-right text-[#806169]">#{p.serialNo}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <div>
              {intervals.length === 0 ? (
                <div className="text-center py-8 text-xs text-[#806169]">
                  No intervals calculated for this shift.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {intervals.map((inv) => {
                    const isWork = inv.type === 'WORK';
                    const startStr = new Date(inv.startTime).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' });
                    const endStr = inv.endTime
                      ? new Date(inv.endTime).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })
                      : 'Ongoing...';

                    return (
                      <div
                        key={inv.id}
                        className={`p-3 rounded-lg border flex items-center justify-between text-xs ${
                          isWork
                            ? 'bg-emerald-50/40 border-emerald-200 text-emerald-900'
                            : 'bg-amber-50/40 border-amber-200 text-amber-900'
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          <div
                            className={`w-7 h-7 rounded flex items-center justify-center ${
                              isWork ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                            }`}
                          >
                            {isWork ? <Briefcase className="w-4 h-4" /> : <Coffee className="w-4 h-4" />}
                          </div>
                          <div>
                            <div className="font-semibold text-xs uppercase">
                              {isWork ? 'Work Interval' : 'Break Interval'} #{inv.sequence}
                            </div>
                            <div className="text-[11px] font-mono text-[#5E4B50] flex items-center gap-1.5 mt-0.5">
                              <span>{startStr}</span>
                              <ArrowRight className="w-3 h-3 text-[#806169]" />
                              <span>{endStr}</span>
                            </div>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="font-mono font-semibold text-xs text-[#0E1E27] block">
                            {inv.durationSeconds > 0 ? formatDuration(inv.durationSeconds) : 'Active'}
                          </span>
                          <span className="text-[10px] text-[#806169] capitalize">{inv.status.toLowerCase()}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-[#FAF8F8] border-t border-[#E8DFDE] flex justify-end">
          <button onClick={onClose} className="button--secondary button--sm">
            Close Dialog
          </button>
        </div>
      </div>
    </div>
  );
}
