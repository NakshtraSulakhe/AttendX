'use client';

import React, { useState, useEffect } from 'react';
import {
  Clock,
  Coffee,
  Briefcase,
  CheckCircle2,
  AlertTriangle,
  History,
  ShieldCheck,
  ArrowRight,
  ScanFace,
  CreditCard,
  X,
  ChevronUp,
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
  employeeId: string;
  onClose: () => void;
}

function formatDuration(sec: number): string {
  if (!sec || sec < 0) sec = 0;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function InlineEmployeeDetailPanel({ employeeId, onClose }: Props) {
  const [data, setData] = useState<EmployeeDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'punches' | 'intervals'>('punches');

  // HR Correction state
  const [showCorrectionForm, setShowCorrectionForm] = useState(false);
  const [correctionAction, setCorrectionAction] = useState<'RESOLVE_MISSING_OUT' | 'MANUAL_IN' | 'MANUAL_OUT'>('RESOLVE_MISSING_OUT');
  const [correctionTime, setCorrectionTime] = useState('');
  const [correctionReason, setCorrectionReason] = useState('');
  const [submittingCorrection, setSubmittingCorrection] = useState(false);

  const fetchEmployeeData = () => {
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

  useEffect(() => {
    fetchEmployeeData();
  }, [employeeId]);

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

  if (loading) {
    return (
      <div className="p-6 bg-[#FAF5F5] border-y border-[#E8DFDE] text-center text-xs text-[#806169] animate-pulse">
        Loading authoritative punch logs & calculated intervals...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-4 bg-[#FAF5F5] border-y border-[#E8DFDE] text-xs text-[#806169] flex justify-between items-center">
        <span>No punch records found for this shift.</span>
        <button onClick={onClose} className="button--secondary button--sm">Close</button>
      </div>
    );
  }

  const emp = data.employee;
  const session = data.session;
  const punches = data.punchHistory || [];
  const intervals = data.intervals || [];

  return (
    <div className="bg-[#FAF5F5] border-y-2 border-[#E4C5C3] p-5 shadow-inner text-[#0E1E27] animate-in fade-in duration-150">
      {/* Top Banner: Employee Context & Quick Stats Strip */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-[#E8DFDE]">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-[#0E1E27] text-white flex items-center justify-center font-semibold text-sm">
            {emp.name.substring(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-semibold text-sm text-[#0E1E27]">{emp.name}</span>
              <span className="text-[11px] font-mono bg-white px-2 py-0.5 rounded border border-[#E8DFDE] text-[#5E4B50]">
                {emp.code} • #{emp.biometricNumber}
              </span>
              <span className="text-xs text-[#806169]">
                ({emp.department} • {emp.designation})
              </span>
            </div>
            <div className="text-[11px] text-[#5E4B50] mt-0.5 flex items-center gap-3">
              <span>Shift: <strong className="text-[#0E1E27]">{emp.shiftHours}</strong></span>
              <span>•</span>
              <span>First IN: <strong className="font-mono text-[#0E1E27]">{session?.firstInTime ? new Date(session.firstInTime).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }) : '-'}</strong></span>
              <span>•</span>
              <span>Latest OUT: <strong className="font-mono text-[#0E1E27]">{session?.lastOutTime ? new Date(session.lastOutTime).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }) : '-'}</strong></span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowCorrectionForm(!showCorrectionForm)}
            className="button--secondary button--sm"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-[#806169]" />
            <span>{showCorrectionForm ? 'Hide HR Form' : 'HR Correction'}</span>
          </button>

          <button
            onClick={onClose}
            className="button--tertiary button--sm flex items-center gap-1"
            title="Collapse detail view"
          >
            <ChevronUp className="w-4 h-4" />
            <span>Collapse</span>
          </button>
        </div>
      </div>

      {/* Collapsible HR Manual Correction Form */}
      {showCorrectionForm && (
        <div className="my-4 p-4 rounded-xl bg-white border border-[#E8DFDE] shadow-xs text-xs">
          <div className="flex items-center justify-between mb-3">
            <span className="font-semibold text-[#0E1E27] flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#806169]" /> Authorized Attendance Adjustment
            </span>
            <span className="text-[11px] text-[#806169] bg-[#FAF8F8] px-2 py-0.5 rounded border border-[#E8DFDE]">
              Audit Logged
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
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
          <div className="mb-3">
            <label className="form-label">Mandatory Correction Reason</label>
            <input
              type="text"
              placeholder="e.g. Employee forgot to punch out due to sudden site visit"
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

      {/* Main Content: Two Distinct Sections Side-by-Side */}
      <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Section: Chronological Punch Log Timeline */}
        <div className="bg-white rounded-xl p-4 border border-[#E8DFDE] shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-[#E8DFDE] mb-3">
            <h4 className="text-xs font-semibold text-[#0E1E27] flex items-center gap-1.5 uppercase tracking-wide">
              <History className="w-4 h-4 text-[#806169]" />
              Today's Biometric Punch Trail ({punches.length})
            </h4>
            <span className="text-[11px] font-mono text-[#806169]">
              {session?.inCount || 0} IN / {session?.outCount || 0} OUT
            </span>
          </div>

          {punches.length === 0 ? (
            <div className="text-center py-6 text-xs text-[#806169]">
              No punch records logged for this shift.
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {punches.map((punch) => {
                const isCheckIn = punch.punchType === 'IN';
                return (
                  <div
                    key={punch.id}
                    className="p-2.5 rounded-lg border border-[#E8DFDE] bg-[#FAF8F8] flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center space-x-3">
                      <span className="text-[11px] font-mono font-medium text-[#806169]">
                        #{punch.sequence}
                      </span>
                      <span className={isCheckIn ? 'badge-working' : 'badge-break'}>
                        {isCheckIn ? 'IN' : 'OUT'}
                      </span>
                      <div>
                        <span className="font-mono font-semibold text-[#0E1E27] block text-xs">
                          {punch.timeIst}
                        </span>
                        <span className="text-[10px] text-[#806169] capitalize">
                          {punch.verifyMode} • {punch.deviceName}
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] font-mono text-[#806169] block">
                        Serial #{punch.serialNo}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Section: Intervals & Work Breakdown */}
        <div className="bg-white rounded-xl p-4 border border-[#E8DFDE] shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-[#E8DFDE] mb-3">
            <h4 className="text-xs font-semibold text-[#0E1E27] flex items-center gap-1.5 uppercase tracking-wide">
              <Clock className="w-4 h-4 text-[#806169]" />
              Calculated Intervals & Breaks ({intervals.length})
            </h4>
            <span className="text-[11px] text-[#806169]">
              {session?.completedBreakCount || 0} Completed Breaks
            </span>
          </div>

          {intervals.length === 0 ? (
            <div className="text-center py-6 text-xs text-[#806169]">
              No intervals calculated for this shift.
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {intervals.map((inv) => {
                const isWork = inv.type === 'WORK';
                const startStr = new Date(inv.startTime).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' });
                const endStr = inv.endTime
                  ? new Date(inv.endTime).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })
                  : 'Ongoing...';

                return (
                  <div
                    key={inv.id}
                    className={`p-2.5 rounded-lg border flex items-center justify-between text-xs ${
                      isWork
                        ? 'bg-emerald-50/40 border-emerald-200 text-emerald-900'
                        : 'bg-amber-50/40 border-amber-200 text-amber-900'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5">
                      <div
                        className={`w-6 h-6 rounded flex items-center justify-center ${
                          isWork ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {isWork ? <Briefcase className="w-3.5 h-3.5" /> : <Coffee className="w-3.5 h-3.5" />}
                      </div>
                      <div>
                        <div className="font-semibold text-[11px] uppercase">
                          {isWork ? 'Work Interval' : 'Break'} #{inv.sequence}
                        </div>
                        <div className="text-[11px] font-mono text-[#5E4B50] flex items-center gap-1">
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
                      <span className="text-[10px] text-[#806169] capitalize font-sans">{inv.status.toLowerCase()}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
