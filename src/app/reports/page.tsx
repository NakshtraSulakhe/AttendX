'use client';

import React, { useState } from 'react';
import {
  BarChart3,
  Download,
  Calendar,
  Filter,
  CheckCircle2,
  Clock,
  Briefcase,
  Coffee,
} from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';

export default function ReportsAndAnalyticsPage() {
  const [startDate, setStartDate] = useState('2026-10-26');
  const [endDate, setEndDate] = useState('2026-10-29');
  const [department, setDepartment] = useState('ALL');
  const [status, setStatus] = useState('ALL');

  const getExportUrl = () => {
    const params = new URLSearchParams();
    params.set('format', 'csv');
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    if (department !== 'ALL') params.set('department', department);
    if (status !== 'ALL') params.set('status', status);
    return `/api/attendance/reports?${params.toString()}`;
  };

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-1">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="h1 tracking-tight text-[#0E1E27]">
                Attendance Reports & Analytics
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#FAF5F5] text-[#806169] border border-[#E8DFDE]">
                PAYROLL EXPORT
              </span>
            </div>
            <p className="text-xs text-[#5E4B50] mt-0.5">
              Generate attendance exports, working duration summaries, and compliance reports
            </p>
          </div>

          <a
            href={getExportUrl()}
            className="button--primary button--sm"
          >
            <Download className="w-3.5 h-3.5 text-[#E4C5C3]" />
            <span>Generate & Download CSV</span>
          </a>
        </div>

        {/* Report Criteria Card */}
        <div className="card-surface p-6">
          <h2 className="text-sm font-semibold text-[#0E1E27] mb-4 flex items-center gap-2">
            <Filter className="w-4 h-4 text-[#806169]" />
            Report Export Filters
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <div>
              <label className="form-label">
                Start Date (Shift Business Date)
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="form-input font-mono"
              />
            </div>

            <div>
              <label className="form-label">
                End Date (Shift Business Date)
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="form-input font-mono"
              />
            </div>

            <div>
              <label className="form-label">Department</label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="form-input"
              >
                <option value="ALL">All Departments</option>
                <option value="General Operations">General Operations</option>
                <option value="Technical & Engineering">Technical & Engineering</option>
                <option value="Workforce & HR Management">Workforce & HR Management</option>
              </select>
            </div>

            <div>
              <label className="form-label">Attendance Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="form-input"
              >
                <option value="ALL">All Statuses</option>
                <option value="PRESENT">Present</option>
                <option value="ABSENT">Absent</option>
                <option value="HALF_DAY">Half Day</option>
              </select>
            </div>
          </div>
        </div>

        {/* Summary Analytics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="card-surface p-4">
            <span className="text-[11px] font-medium text-[#806169] uppercase tracking-wide block">
              Scheduled Hours
            </span>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-3xl font-semibold font-mono text-[#0E1E27]">
                450.0
              </span>
              <span className="text-xs text-[#806169]">Hrs Total</span>
            </div>
          </div>

          <div className="card-surface p-4">
            <span className="text-[11px] font-medium text-emerald-800 uppercase tracking-wide block">
              Working Hours Logged
            </span>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-3xl font-semibold font-mono text-emerald-700">
                412.5
              </span>
              <span className="text-xs text-[#806169]">Hrs Total</span>
            </div>
          </div>

          <div className="card-surface p-4">
            <span className="text-[11px] font-medium text-amber-800 uppercase tracking-wide block">
              Break Time Logged
            </span>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-3xl font-semibold font-mono text-amber-700">
                37.5
              </span>
              <span className="text-xs text-[#806169]">Hrs Total</span>
            </div>
          </div>

          <div className="card-surface p-4">
            <span className="text-[11px] font-medium text-[#1E40AF] uppercase tracking-wide block">
              Attendance Rate
            </span>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-3xl font-semibold font-mono text-[#1E40AF]">
                96.4%
              </span>
              <span className="text-xs text-emerald-700 font-semibold">On Target</span>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
