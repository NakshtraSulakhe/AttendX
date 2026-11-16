'use client';

import React from 'react';
import {
  CalendarDays,
  Clock,
  CheckCircle2,
  Moon,
  Sun,
  Shield,
} from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';

export default function ShiftManagementPage() {
  const shifts = [
    {
      id: '1',
      name: 'US Operations Overnight Shift',
      code: 'US_OVERNIGHT_IST',
      isOvernight: true,
      startTime: '5:30 PM IST (17:30)',
      endTime: '2:30 AM IST (02:30 next day)',
      duration: '9 Hours (540 mins)',
      timezone: 'Asia/Kolkata',
      graceLate: '15 Minutes',
      graceEarly: '15 Minutes',
      overtimeMin: '30 Minutes',
      status: 'PRIMARY ACTIVE SHIFT',
      assignedCount: 50,
      notes: 'Punches after midnight up to 6:30 AM anchor strictly to the previous shift start date.',
    },
    {
      id: '2',
      name: 'General Day Shift',
      code: 'DAY_GENERAL_IST',
      isOvernight: false,
      startTime: '10:00 AM IST (10:00)',
      endTime: '7:00 PM IST (19:00)',
      duration: '9 Hours (540 mins)',
      timezone: 'Asia/Kolkata',
      graceLate: '15 Minutes',
      graceEarly: '15 Minutes',
      overtimeMin: '30 Minutes',
      status: 'STANDBY SCHEDULE',
      assignedCount: 0,
      notes: 'Standard daytime schedule with 15-minute arrival grace window.',
    },
  ];

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-1">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="h1 tracking-tight text-[#0E1E27]">
                Shift Configurations & Policies
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#FAF5F5] text-[#806169] border border-[#E8DFDE]">
                SCHEDULE LOGIC
              </span>
            </div>
            <p className="text-xs text-[#5E4B50] mt-0.5">
              Overnight business date anchoring, grace thresholds, and working time policies
            </p>
          </div>
        </div>

        {/* Shift Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {shifts.map((s) => (
            <div
              key={s.id}
              className="card-surface p-6 flex flex-col justify-between space-y-5"
            >
              <div>
                <div className="flex items-start justify-between pb-4 border-b border-[#E8DFDE]">
                  <div className="flex items-center space-x-3">
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm ${
                        s.isOvernight
                          ? 'bg-[#0E1E27] text-[#E4C5C3]'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {s.isOvernight ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                    </div>
                    <div>
                      <h2 className="text-base font-semibold text-[#0E1E27]">{s.name}</h2>
                      <span className="text-xs font-mono text-[#806169]">{s.code}</span>
                    </div>
                  </div>

                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                      s.isOvernight
                        ? 'badge-working'
                        : 'badge-neutral'
                    }`}
                  >
                    {s.status}
                  </span>
                </div>

                <div className="mt-4 space-y-2.5 text-xs">
                  <div className="flex justify-between py-1.5 border-b border-[#FAF5F5]">
                    <span className="text-[#806169]">Shift Hours:</span>
                    <span className="font-semibold text-[#0E1E27]">{s.startTime} → {s.endTime}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-[#FAF5F5]">
                    <span className="text-[#806169]">Nominal Duration:</span>
                    <span className="font-semibold text-[#0E1E27]">{s.duration}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-[#FAF5F5]">
                    <span className="text-[#806169]">Arrival Grace Window:</span>
                    <span className="font-mono text-[#0E1E27]">{s.graceLate}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-[#FAF5F5]">
                    <span className="text-[#806169]">Overtime Minimum:</span>
                    <span className="font-mono text-[#0E1E27]">{s.overtimeMin}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-[#FAF5F5]">
                    <span className="text-[#806169]">Assigned Staff:</span>
                    <span className="font-semibold text-[#0E1E27]">{s.assignedCount} Employees</span>
                  </div>
                </div>

                <div className="mt-4 p-3 rounded-lg bg-[#FAF5F5] border border-[#E8DFDE] text-xs text-[#5E4B50] flex items-start gap-2">
                  <Shield className="w-4 h-4 text-[#806169] flex-shrink-0 mt-0.5" />
                  <span>{s.notes}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
