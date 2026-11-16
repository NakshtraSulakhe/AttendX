'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Search,
  Filter,
  Briefcase,
  Coffee,
  CheckCircle2,
  Clock,
  User,
  ChevronRight,
} from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { EmployeeProfileModal } from '@/components/employee-profile-modal';

interface EmployeeItem {
  id: string;
  employeeCode: string;
  name: string;
  department: string;
  designation: string;
  biometricNumber: string;
  shiftName: string;
  currentState: string;
  inCount?: number;
  outCount?: number;
}

export default function EmployeesDirectoryPage() {
  const [employees, setEmployees] = useState<EmployeeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/attendance/today')
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setEmployees(d.employees || []);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const departments = useMemo(() => {
    const set = new Set<string>();
    employees.forEach((e) => {
      if (e.department) set.add(e.department);
    });
    return Array.from(set);
  }, [employees]);

  // Operational counts
  const totalCount = employees.length;
  const workingCount = employees.filter((e) => e.currentState === 'WORKING').length;
  const breakCount = employees.filter((e) => e.currentState === 'ON_BREAK').length;
  const completedCount = employees.filter((e) => e.currentState === 'COMPLETED').length;
  const pendingCount = employees.filter((e) => e.currentState === 'NOT_CHECKED_IN').length;

  const filtered = useMemo(() => {
    return employees.filter((e) => {
      const matchSearch =
        e.name.toLowerCase().includes(search.toLowerCase()) ||
        e.employeeCode.toLowerCase().includes(search.toLowerCase()) ||
        e.biometricNumber.includes(search);
      const matchDept = deptFilter === 'ALL' || e.department === deptFilter;
      return matchSearch && matchDept;
    });
  }, [employees, search, deptFilter]);

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-1">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="h1 tracking-tight text-[#0E1E27]">
                Employee Workforce Directory
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#FAF5F5] text-[#806169] border border-[#E8DFDE]">
                STAFF REGISTRY
              </span>
            </div>
            <p className="text-xs text-[#5E4B50] mt-0.5">
              Enrolled biometric profiles, department assignments, shift status, and punch metrics
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-3 py-1.5 rounded-md bg-white text-[#0E1E27] border border-[#E8DFDE] shadow-xs">
              {totalCount} Enrolled Staff
            </span>
          </div>
        </div>

        {/* Operational Attendance Counts Strip */}
        <div className="card-surface p-4">
          <div className="grid grid-cols-2 sm:grid-cols-5 divide-y sm:divide-y-0 sm:divide-x divide-[#E8DFDE]">
            {/* Total Enrolled */}
            <div className="px-4 py-1.5 first:pl-0">
              <span className="text-[11px] font-medium text-[#806169] block">Total Enrolled</span>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-2xl font-semibold font-mono text-[#0E1E27]">{totalCount}</span>
                <span className="text-[11px] text-[#806169]">Employees</span>
              </div>
            </div>

            {/* Currently Working */}
            <div className="px-4 py-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-[#065F46] flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Working Today
                </span>
                <span className="text-[11px] font-semibold text-emerald-700">
                  {totalCount > 0 ? Math.round((workingCount / totalCount) * 100) : 0}%
                </span>
              </div>
              <div className="mt-1">
                <span className="text-2xl font-semibold font-mono text-emerald-700">{workingCount}</span>
              </div>
            </div>

            {/* On Break */}
            <div className="px-4 py-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-amber-800 flex items-center gap-1.5">
                  <Coffee className="w-3 h-3 text-amber-600" />
                  On Break
                </span>
                <span className="text-[11px] font-semibold text-amber-700">
                  {totalCount > 0 ? Math.round((breakCount / totalCount) * 100) : 0}%
                </span>
              </div>
              <div className="mt-1">
                <span className="text-2xl font-semibold font-mono text-amber-700">{breakCount}</span>
              </div>
            </div>

            {/* Completed */}
            <div className="px-4 py-1.5">
              <span className="text-[11px] font-medium text-[#1E40AF] block">Shift Completed</span>
              <div className="mt-1">
                <span className="text-2xl font-semibold font-mono text-[#1E40AF]">{completedCount}</span>
              </div>
            </div>

            {/* Pending / Off */}
            <div className="px-4 py-1.5 last:pr-0">
              <span className="text-[11px] font-medium text-[#806169] block">Not Checked In</span>
              <div className="mt-1">
                <span className="text-2xl font-semibold font-mono text-[#5E4B50]">{pendingCount}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Search & Filters Toolbar */}
        <div className="card-surface p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full max-w-md">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#806169]" />
            <input
              type="text"
              placeholder="Search by name, employee code, or bio #..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#FAF8F8] border border-[#E8DFDE] rounded-md pl-8 pr-3 py-1.5 text-xs text-[#0E1E27] placeholder-[#806169]/70 focus:outline-none focus:border-[#BD8D8B] focus:bg-white transition-all"
            />
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="bg-white border border-[#E8DFDE] rounded-md px-3 py-1.5 text-xs text-[#0E1E27] focus:outline-none focus:border-[#BD8D8B]"
            >
              <option value="ALL">All Departments ({departments.length})</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>

            <span className="text-xs text-[#806169] whitespace-nowrap">
              Showing <strong>{filtered.length}</strong> of {totalCount}
            </span>
          </div>
        </div>

        {/* Directory Table */}
        <div className="table-surface">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="table-header">
                <tr>
                  <th className="px-5 py-3">Employee Name</th>
                  <th className="px-4 py-3 font-mono">Employee Code</th>
                  <th className="px-4 py-3 font-mono">Biometric ID</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3">Designation</th>
                  <th className="px-4 py-3 text-center font-mono">Punches Today</th>
                  <th className="px-4 py-3">Assigned Shift</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8DFDE] bg-white font-sans">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="text-center py-12 text-[#806169] text-xs">
                      Loading employee workforce directory...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-12 text-[#806169] text-xs">
                      No employees match your search criteria.
                    </td>
                  </tr>
                ) : (
                  filtered.map((emp) => (
                    <tr
                      key={emp.id}
                      onClick={() => setSelectedEmployeeId(emp.id)}
                      className="table-row-hover cursor-pointer"
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-md bg-[#FAF5F5] border border-[#E8DFDE] flex items-center justify-center font-semibold text-xs text-[#0E1E27] flex-shrink-0">
                            {emp.name.substring(0, 2).toUpperCase()}
                          </div>
                          <span className="font-semibold text-[#0E1E27]">
                            {emp.name}
                          </span>
                        </div>
                      </td>

                      <td className="px-4 py-3 font-mono text-[#5E4B50]">
                        {emp.employeeCode}
                      </td>

                      <td className="px-4 py-3 font-mono font-semibold text-[#0E1E27]">
                        #{emp.biometricNumber}
                      </td>

                      <td className="px-4 py-3 text-[#5E4B50]">
                        {emp.department}
                      </td>

                      <td className="px-4 py-3 text-[#5E4B50]">
                        {emp.designation || 'Staff'}
                      </td>

                      <td className="px-4 py-3 text-center font-mono text-[#5E4B50]">
                        <span className="text-emerald-700 font-semibold">{emp.inCount || 0} IN</span> / <span className="text-amber-700 font-semibold">{emp.outCount || 0} OUT</span>
                      </td>

                      <td className="px-4 py-3 text-[#5E4B50] font-mono text-[11px]">
                        {emp.shiftName || 'US Operations Overnight'}
                      </td>

                      <td className="px-4 py-3 text-center">
                        {emp.currentState === 'WORKING' && (
                          <span className="badge-working">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Working
                          </span>
                        )}
                        {emp.currentState === 'ON_BREAK' && (
                          <span className="badge-break">
                            ☕ On Break
                          </span>
                        )}
                        {emp.currentState === 'COMPLETED' && (
                          <span className="badge-completed">
                            ✓ Completed
                          </span>
                        )}
                        {emp.currentState === 'MISSING_OUT' && (
                          <span className="badge-missing">
                            ⚠ Missing OUT
                          </span>
                        )}
                        {emp.currentState === 'NOT_CHECKED_IN' && (
                          <span className="badge-neutral">
                            Not In
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-3 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedEmployeeId(emp.id);
                          }}
                          className="button--secondary button--sm"
                        >
                          <User className="w-3.5 h-3.5 text-[#806169]" />
                          <span>Profile</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Centered Employee Profile Dossier Modal (NOT a drawer) */}
      <EmployeeProfileModal
        employeeId={selectedEmployeeId}
        onClose={() => setSelectedEmployeeId(null)}
      />
    </AppShell>
  );
}
