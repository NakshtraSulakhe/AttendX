'use client';

import React from 'react';
import {
  Building2,
  Users,
  Briefcase,
  ChevronRight,
} from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';

export default function DepartmentsPage() {
  const departments = [
    {
      id: '1',
      name: 'General Operations',
      code: 'GEN_OPS',
      headcount: 38,
      shift: 'US Operations Overnight Shift (17:30 - 02:30 IST)',
      activeCount: 22,
      description: 'Core back-office processing and international real-time service operations.',
    },
    {
      id: '2',
      name: 'Technical & Engineering',
      code: 'TECH_ENG',
      headcount: 8,
      shift: 'Flexible / Overnight Support',
      activeCount: 4,
      description: 'Infrastructure, network security, and biometric terminal integration systems.',
    },
    {
      id: '3',
      name: 'Workforce & HR Management',
      code: 'HR_OPS',
      headcount: 4,
      shift: 'General Day & Shift Oversight',
      activeCount: 2,
      description: 'Employee lifecycle, payroll reconciliation, and shift policy administration.',
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
                Departments & Workgroups
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#FAF5F5] text-[#806169] border border-[#E8DFDE]">
                ORGANIZATIONAL TEAMS
              </span>
            </div>
            <p className="text-xs text-[#5E4B50] mt-0.5">
              Workforce teams, shift assignments, and departmental attendance coverage
            </p>
          </div>
        </div>

        {/* Department Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {departments.map((d) => (
            <div
              key={d.id}
              className="card-surface p-6 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between pb-3 border-b border-[#E8DFDE]">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-lg bg-[#FAF5F5] border border-[#E8DFDE] flex items-center justify-center text-[#0E1E27]">
                      <Building2 className="w-5 h-5 text-[#806169]" />
                    </div>
                    <div>
                      <h2 className="text-base font-semibold text-[#0E1E27] leading-tight">
                        {d.name}
                      </h2>
                      <span className="text-xs font-mono text-[#806169]">{d.code}</span>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-[#5E4B50] mt-4 leading-relaxed">
                  {d.description}
                </p>

                <div className="mt-5 p-3.5 rounded-lg bg-[#FAF8F8] border border-[#E8DFDE] space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[#806169]">Total Enrolled:</span>
                    <span className="font-semibold text-[#0E1E27]">{d.headcount} Staff</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#806169]">Currently Active:</span>
                    <span className="font-semibold text-emerald-700">{d.activeCount} Working/Break</span>
                  </div>
                  <div className="pt-2 border-t border-[#E8DFDE] text-[11px] text-[#5E4B50]">
                    <span>Assigned: </span>
                    <strong className="text-[#0E1E27]">{d.shift}</strong>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
