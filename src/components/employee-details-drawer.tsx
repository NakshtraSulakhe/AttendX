'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Clock,
  Coffee,
  Briefcase,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  History,
  Building2,
  ShieldCheck,
  ArrowRight,
  User,
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

export function EmployeeDetailsDrawer({ employeeId, onClose }: Props) {
  const [data, setData] = useState<EmployeeDetailData | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'punches' | 'intervals'>('punches');

  // Live ticking values for the drawer
  const [liveWorking, setLiveWorking] = useState(0);
  const [liveBreak, setLiveBreak] = useState(0);
  const [liveElapsed, setLiveElapsed] = useState(0);
  const [liveInterval, setLiveInterval] = useState(0);

  // HR Correction state
  const [showCorrectionForm, setShowCorrectionForm] = useState(false);
  const [correctionAction, setCorrectionAction] = useState<'RESOLVE_MISSING_OUT' | 'MANUAL_IN' | 'MANUAL_OUT'>('RESOLVE_MISSING_OUT');
  const [correctionTime, setCorrectionTime] = useState('');
  const [correctionReason, setCorrectionReason] = useState('');
  const [submittingCorrection, setSubmittingCorrection] = useState(false);

  const fetchEmployeeData = () => {
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
  };

  const handleApplyCorrection = async () => {
    if (!employeeId || !data?.session?.businessDate || !correctionReason) return;
    setSubmittingCorrection(true);
    try {
      const res = await fetch('/api/attendance/correction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId,
          businessDate: data.session.businessDate,
          action: correctionAction,
          punchTimeUtc: correctionTime ? new Date(correctionTime).toISOString() : new Date().toISOString(),
          reason: correctionReason,
        }),
      });
      const resJson = await res.json();
      if (resJson.success) {
        setShowCorrectionForm(false);
        setCorrectionReason('');
        fetchEmployeeData();
      } else {
        alert(resJson.error || 'Failed to apply correction');
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSubmittingCorrection(false);
    }
  };

  useEffect(() => {
    fetchEmployeeData();
  }, [employeeId]);

  // Live 1-second timer tick in drawer
  useEffect(() => {
    if (!data?.session) return;

    const session = data.session;
    const ticker = setInterval(() => {
      const now = Date.now();

      if (session.firstInTime) {
        const firstIn = new Date(session.firstInTime).getTime();
        setLiveElapsed(Math.max(0, Math.floor((now - firstIn) / 1000)));
      } else {
        setLiveElapsed(0);
      }

      if (session.currentIntervalStart) {
        const currentStart = new Date(session.currentIntervalStart).getTime();
        const activeSeconds = Math.max(0, Math.floor((now - currentStart) / 1000));
        setLiveInterval(activeSeconds);

        if (session.currentState === 'WORKING') {
          setLiveWorking(session.totalWorkingSeconds + activeSeconds);
          setLiveBreak(session.totalBreakSeconds);
        } else if (session.currentState === 'ON_BREAK') {
          setLiveWorking(session.totalWorkingSeconds);
          setLiveBreak(session.totalBreakSeconds + activeSeconds);
        } else {
          setLiveWorking(session.totalWorkingSeconds);
          setLiveBreak(session.totalBreakSeconds);
        }
      } else {
        setLiveInterval(0);
        setLiveWorking(session.totalWorkingSeconds);
        setLiveBreak(session.totalBreakSeconds);
      }
    }, 1000);

    return () => clearInterval(ticker);
  }, [data]);

  if (!employeeId) return null;

  const emp = data?.employee;
  const session = data?.session;
  const currentState = session?.currentState || 'NOT_CHECKED_IN';

  const getStatusBadge = (st: string) => {
    switch (st) {
      case 'WORKING':
        return (
          <span className="badge-working">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Currently Working
          </span>
        );
      case 'ON_BREAK':
        return (
          <span className="badge-break">
            <Coffee className="w-3 h-3" />
            On Break
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="badge-completed">
            <CheckCircle2 className="w-3 h-3" />
            Shift Completed
          </span>
        );
      case 'MISSING_OUT':
        return (
          <span className="badge-missing">
            <AlertTriangle className="w-3 h-3" />
            Missing Final OUT
          </span>
        );
      default:
        return (
          <span className="badge-neutral">
            Not Checked In
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-[#0E1E27]/40 backdrop-blur-xs flex justify-end animate-in fade-in duration-150">
      <div className="w-full max-w-2xl bg-white border-l border-[#E8DFDE] h-full flex flex-col shadow-xl text-[#0E1E27]">
        {/* Drawer Header */}
        <div className="p-6 border-b border-[#E8DFDE] bg-[#FAF8F8] flex items-start justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 rounded-lg bg-[#0E1E27] text-white flex items-center justify-center font-semibold text-base shadow-xs">
              {emp?.name ? emp.name.substring(0, 2).toUpperCase() : 'EM'}
            </div>
            <div>
              <div className="flex items-center space-x-2.5">
                <h2 className="text-lg font-semibold text-[#0E1E27] tracking-tight">{emp?.name || 'Loading profile...'}</h2>
                <span className="text-xs font-mono font-medium bg-[#FAF5F5] text-[#5E4B50] px-2 py-0.5 rounded border border-[#E8DFDE]">
                  {emp?.code || 'EMP0000'}
                </span>
              </div>
              <p className="text-xs text-[#5E4B50] mt-1">
                {emp?.designation || 'Staff'} • {emp?.department || 'Operations'} • Biometric ID:{' '}
                <strong className="text-[#0E1E27] font-mono">#{emp?.biometricNumber}</strong>
              </p>
              <div className="mt-2.5 flex items-center gap-2 flex-wrap">
                {getStatusBadge(currentState)}
                <span className="text-[11px] text-[#806169] bg-white px-2 py-0.5 rounded border border-[#E8DFDE]">
                  Shift: {emp?.shiftHours || '17:30 - 02:30'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowCorrectionForm(!showCorrectionForm)}
              className="button--secondary button--sm"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-[#806169]" />
              <span>HR Action</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-[#806169] hover:text-[#0E1E27] hover:bg-[#F5E1E0]/50 rounded-md transition-colors"
              title="Close Panel"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* HR Manual Correction Form (Collapsible) */}
        {showCorrectionForm && (
          <div className="p-5 bg-[#FAF5F5] border-b border-[#E8DFDE] animate-in slide-in-from-top-1 text-xs">
            <div className="flex items-center justify-between mb-3.5">
              <span className="font-semibold text-[#0E1E27] flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#806169]" /> Authorized Attendance Adjustment
              </span>
              <span className="text-[11px] text-[#806169] bg-white px-2 py-0.5 rounded border border-[#E8DFDE]">
                Audit Logged
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="form-label">Correction Action</label>
                <select
                  value={correctionAction}
                  onChange={(e) => setCorrectionAction(e.target.value as any)}
                  className="form-input"
                >
                  <option value="RESOLVE_MISSING_OUT">Resolve Missing OUT (Clock Out)</option>
                  <option value="MANUAL_IN">Add Manual Punch IN</option>
                  <option value="MANUAL_OUT">Add Manual Punch OUT</option>
                </select>
              </div>
              <div>
                <label className="form-label">Punch Time (Local IST)</label>
                <input
                  type="datetime-local"
                  value={correctionTime}
                  onChange={(e) => setCorrectionTime(e.target.value)}
                  className="form-input font-mono"
                />
              </div>
            </div>
            <div className="mb-4">
              <label className="form-label">Mandatory Correction Reason</label>
              <input
                type="text"
                placeholder="e.g. Employee forgot to punch out due to sudden client call"
                value={correctionReason}
                onChange={(e) => setCorrectionReason(e.target.value)}
                className="form-input"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCorrectionForm(false)}
                className="button--tertiary button--sm"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submittingCorrection || !correctionReason}
                onClick={handleApplyCorrection}
                className="button--primary button--sm"
              >
                {submittingCorrection ? 'Saving...' : 'Apply Correction'}
              </button>
            </div>
          </div>
        )}

        {/* Live Timers Banner */}
        <div className="p-6 bg-white border-b border-[#E8DFDE]">
          <div className="grid grid-cols-4 gap-3 text-center">
            {/* Elapsed */}
            <div className="bg-[#FAF8F8] rounded-lg p-3 border border-[#E8DFDE]">
              <span className="text-[10px] uppercase font-semibold text-[#806169] block tracking-wider">Elapsed</span>
              <span className="text-base font-mono font-semibold text-[#0E1E27] mt-1 block">
                {formatDuration(liveElapsed)}
              </span>
            </div>

            {/* Working */}
            <div className="bg-emerald-50/50 rounded-lg p-3 border border-emerald-200">
              <span className="text-[10px] uppercase font-semibold text-emerald-800 block tracking-wider flex items-center justify-center gap-1">
                <Briefcase className="w-3 h-3 text-emerald-600" />
                <span>Working</span>
              </span>
              <span className="text-base font-mono font-semibold text-emerald-700 mt-1 block">
                {formatDuration(liveWorking)}
              </span>
            </div>

            {/* Break */}
            <div className="bg-amber-50/50 rounded-lg p-3 border border-amber-200">
              <span className="text-[10px] uppercase font-semibold text-amber-800 block tracking-wider flex items-center justify-center gap-1">
                <Coffee className="w-3 h-3 text-amber-600" />
                <span>Break</span>
              </span>
              <span className="text-base font-mono font-semibold text-amber-700 mt-1 block">
                {formatDuration(liveBreak)}
              </span>
            </div>

            {/* Current State Duration */}
            <div className="bg-[#FAF5F5] rounded-lg p-3 border border-[#E8DFDE]">
              <span className="text-[10px] uppercase font-semibold text-[#5E4B50] block tracking-wider flex items-center justify-center gap-1">
                <Clock className="w-3 h-3 text-[#806169]" />
                <span>Current</span>
              </span>
              <span className="text-base font-mono font-semibold text-[#0E1E27] mt-1 block">
                {formatDuration(liveInterval)}
              </span>
            </div>
          </div>

          {/* Session Punch Metrics Grid */}
          <div className="grid grid-cols-4 gap-2.5 mt-3.5 pt-3.5 border-t border-[#E8DFDE] text-xs">
            <div className="bg-[#FAF8F8] p-2 rounded-md border border-[#E8DFDE]">
              <span className="text-[10px] text-[#806169] block uppercase">First IN</span>
              <strong className="text-[#0E1E27] font-mono text-xs mt-0.5 block">
                {session?.firstInTime ? new Date(session.firstInTime).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }) : '-'}
              </strong>
            </div>
            <div className="bg-[#FAF8F8] p-2 rounded-md border border-[#E8DFDE]">
              <span className="text-[10px] text-[#806169] block uppercase">Latest OUT</span>
              <strong className="text-[#0E1E27] font-mono text-xs mt-0.5 block">
                {session?.lastOutTime ? new Date(session.lastOutTime).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }) : '-'}
              </strong>
            </div>
            <div className="bg-[#FAF8F8] p-2 rounded-md border border-[#E8DFDE]">
              <span className="text-[10px] text-[#806169] block uppercase">Punches</span>
              <strong className="text-[#0E1E27] font-mono text-xs mt-0.5 block">
                <span className="text-emerald-700">{session?.inCount || 0} IN</span> / <span className="text-amber-700">{session?.outCount || 0} OUT</span>
              </strong>
            </div>
            <div className="bg-[#FAF8F8] p-2 rounded-md border border-[#E8DFDE]">
              <span className="text-[10px] text-[#806169] block uppercase">Completed Breaks</span>
              <strong className="text-[#0E1E27] font-mono text-xs mt-0.5 block">
                {session?.completedBreakCount || 0}
              </strong>
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="px-6 pt-3 border-b border-[#E8DFDE] bg-[#FAF8F8] flex items-center space-x-6">
          <button
            onClick={() => setActiveTab('punches')}
            className={`pb-2.5 text-xs font-semibold transition-colors border-b-2 flex items-center space-x-1.5 ${
              activeTab === 'punches'
                ? 'border-[#0E1E27] text-[#0E1E27]'
                : 'border-transparent text-[#806169] hover:text-[#0E1E27]'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Punch History ({data?.punchHistory.length || 0})</span>
          </button>

          <button
            onClick={() => setActiveTab('intervals')}
            className={`pb-2.5 text-xs font-semibold transition-colors border-b-2 flex items-center space-x-1.5 ${
              activeTab === 'intervals'
                ? 'border-[#0E1E27] text-[#0E1E27]'
                : 'border-transparent text-[#806169] hover:text-[#0E1E27]'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Intervals & Breaks ({data?.intervals.length || 0})</span>
          </button>
        </div>

        {/* Tab Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {loading ? (
            <div className="text-center py-12 text-[#806169] text-xs">
              Loading biometric events...
            </div>
          ) : activeTab === 'punches' ? (
            <div className="space-y-3">
              {data?.punchHistory.length === 0 ? (
                <div className="text-center py-12 text-[#806169] text-xs">
                  No punch records recorded for this shift business date.
                </div>
              ) : (
                <div className="table-surface">
                  <table className="w-full text-left text-xs">
                    <thead className="table-header">
                      <tr>
                        <th className="px-4 py-2.5">#</th>
                        <th className="px-4 py-2.5">Time (IST)</th>
                        <th className="px-4 py-2.5">Type</th>
                        <th className="px-4 py-2.5">Device</th>
                        <th className="px-4 py-2.5">Method</th>
                        <th className="px-4 py-2.5">Serial</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E8DFDE] font-mono">
                      {data?.punchHistory.map((punch) => {
                        const isCheckIn = punch.punchType === 'IN';
                        return (
                          <tr key={punch.id} className="table-row-hover">
                            <td className="px-4 py-2.5 text-[#806169]">{punch.sequence}</td>
                            <td className="px-4 py-2.5 font-semibold text-[#0E1E27]">{punch.timeIst}</td>
                            <td className="px-4 py-2.5 font-sans">
                              {isCheckIn ? (
                                <span className="badge-working">IN</span>
                              ) : (
                                <span className="badge-break">OUT</span>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-[#5E4B50] font-sans">{punch.deviceName}</td>
                            <td className="px-4 py-2.5 text-[#5E4B50] font-sans capitalize">{punch.verifyMode}</td>
                            <td className="px-4 py-2.5 text-[#806169] text-[11px]">#{punch.serialNo}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            /* Intervals Timeline View */
            <div className="space-y-3">
              {data?.intervals.length === 0 ? (
                <div className="text-center py-12 text-[#806169] text-xs">
                  No calculated intervals for this shift.
                </div>
              ) : (
                data?.intervals.map((inv) => {
                  const isWork = inv.type === 'WORK';
                  const startStr = new Date(inv.startTime).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' });
                  const endStr = inv.endTime
                    ? new Date(inv.endTime).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })
                    : 'Ongoing...';

                  return (
                    <div
                      key={inv.id}
                      className={`p-3.5 rounded-lg border transition-all ${
                        isWork
                          ? 'bg-emerald-50/40 border-emerald-200 text-emerald-900'
                          : 'bg-amber-50/40 border-amber-200 text-amber-900'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div
                            className={`w-8 h-8 rounded-md flex items-center justify-center ${
                              isWork ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                            }`}
                          >
                            {isWork ? <Briefcase className="w-4 h-4" /> : <Coffee className="w-4 h-4" />}
                          </div>
                          <div>
                            <div className="font-semibold text-xs uppercase tracking-wide">
                              {isWork ? 'Work Interval' : 'Break Interval'} #{inv.sequence}
                            </div>
                            <div className="text-xs font-mono text-[#5E4B50] mt-0.5 flex items-center space-x-1.5">
                              <span>{startStr}</span>
                              <ArrowRight className="w-3 h-3 text-[#806169]" />
                              <span>{endStr}</span>
                            </div>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-xs font-mono font-semibold block text-[#0E1E27]">
                            {inv.durationSeconds > 0 ? formatDuration(inv.durationSeconds) : 'Active'}
                          </span>
                          <span className="text-[10px] text-[#806169] capitalize font-sans">{inv.status.toLowerCase()}</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
