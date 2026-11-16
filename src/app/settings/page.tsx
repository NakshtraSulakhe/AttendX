'use client';

import React, { useState } from 'react';
import {
  Settings,
  Shield,
  Key,
  Clock,
  HardDrive,
  CheckCircle2,
  Lock,
  Save,
} from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';

export default function SettingsPage() {
  const [saved, setSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <AppShell>
      <div className="space-y-6 max-w-4xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-1">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="h1 tracking-tight text-[#0E1E27]">
                System Settings & Policy
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#FAF5F5] text-[#806169] border border-[#E8DFDE]">
                PREFERENCES
              </span>
            </div>
            <p className="text-xs text-[#5E4B50] mt-0.5">
              Attendance session closure rules, sync parameters, and security tokens
            </p>
          </div>
        </div>

        {saved && (
          <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-300 text-xs font-semibold text-emerald-900 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            System preferences and policies updated successfully.
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-6 text-xs">
          {/* Card 1: Attendance Session & Break Rules */}
          <div className="card-surface p-6 space-y-4">
            <h2 className="text-sm font-semibold text-[#0E1E27] flex items-center gap-2 pb-2 border-b border-[#E8DFDE]">
              <Clock className="w-4 h-4 text-[#806169]" />
              Session Closure & Break Policy Rules
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="form-label">
                  Unreturned Break Auto-Closure Grace (Hours)
                </label>
                <input
                  type="number"
                  defaultValue={4}
                  className="form-input font-mono"
                />
                <p className="text-[11px] text-[#806169] mt-1">
                  After 4 hours of inactivity during an OUT punch, session finalizes as COMPLETED.
                </p>
              </div>

              <div>
                <label className="form-label">
                  Missing OUT Cutoff Threshold (Hours from First IN)
                </label>
                <input
                  type="number"
                  defaultValue={14}
                  className="form-input font-mono"
                />
                <p className="text-[11px] text-[#806169] mt-1">
                  If an employee does not check out after 14 hours, flagged as MISSING_OUT.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="form-label">
                  Primary Shift Reference Timezone
                </label>
                <input
                  type="text"
                  defaultValue="Asia/Kolkata (IST +05:30)"
                  disabled
                  className="form-input bg-[#FAF8F8] font-mono text-[#5E4B50]"
                />
              </div>

              <div>
                <label className="form-label">
                  Night Shift Transition Cutoff Time
                </label>
                <input
                  type="text"
                  defaultValue="12:00:00 (Local Noon)"
                  disabled
                  className="form-input bg-[#FAF8F8] font-mono text-[#5E4B50]"
                />
              </div>
            </div>
          </div>

          {/* Card 2: Biometric Terminal Configuration */}
          <div className="card-surface p-6 space-y-4">
            <h2 className="text-sm font-semibold text-[#0E1E27] flex items-center gap-2 pb-2 border-b border-[#E8DFDE]">
              <HardDrive className="w-4 h-4 text-[#806169]" />
              Biometric Hardware Terminal Network Config
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="form-label">Terminal LAN IP Address</label>
                <input
                  type="text"
                  defaultValue="192.168.200.200"
                  className="form-input font-mono"
                />
              </div>

              <div>
                <label className="form-label">HTTP ISAPI Port</label>
                <input
                  type="number"
                  defaultValue={80}
                  className="form-input font-mono"
                />
              </div>

              <div>
                <label className="form-label">Polling Interval (Seconds)</label>
                <input
                  type="number"
                  defaultValue={10}
                  className="form-input font-mono"
                />
              </div>
            </div>
          </div>

          {/* Card 3: Security & Audit Retention */}
          <div className="card-surface p-6 space-y-4">
            <h2 className="text-sm font-semibold text-[#0E1E27] flex items-center gap-2 pb-2 border-b border-[#E8DFDE]">
              <Lock className="w-4 h-4 text-[#806169]" />
              Audit Trail & Authentication Integrity
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="form-label">Biometric Audit Retention Period</label>
                <select defaultValue="365" className="form-input">
                  <option value="90">90 Days</option>
                  <option value="180">180 Days</option>
                  <option value="365">1 Year (Compliant)</option>
                  <option value="730">2 Years</option>
                </select>
              </div>

              <div>
                <label className="form-label">HR Manual Correction Justification</label>
                <select defaultValue="mandatory" className="form-input">
                  <option value="mandatory">Strict Mandatory Justification</option>
                  <option value="optional">Optional Note</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="button--primary"
            >
              <Save className="w-3.5 h-3.5 text-[#E4C5C3]" />
              <span>Save System Settings</span>
            </button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
