'use client';

import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  RefreshCw,
  Lock,
} from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';

interface CorrectionItem {
  id: string;
  employeeName: string;
  employeeCode: string;
  biometricNumber: string;
  department: string;
  businessDate: string;
  previousInTime: string;
  newInTime: string;
  previousOutTime: string;
  newOutTime: string;
  reason: string;
  createdAt: string;
}

export default function CorrectionsAuditPage() {
  const [corrections, setCorrections] = useState<CorrectionItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCorrections = async () => {
    try {
      const res = await fetch('/api/attendance/corrections');
      const data = await res.json();
      if (data.success) {
        setCorrections(data.corrections || []);
      }
    } catch (e) {
      console.error('Failed to load corrections:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCorrections();
  }, []);

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-1">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="h1 tracking-tight text-[#0E1E27]">
                Attendance Corrections & Audit Log
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#FAF5F5] text-[#806169] border border-[#E8DFDE]">
                IMMUTABLE AUDIT
              </span>
            </div>
            <p className="text-xs text-[#5E4B50] mt-0.5">
              Mandatory audit records of all authorized HR adjustments and missing OUT resolutions
            </p>
          </div>

          <button
            onClick={fetchCorrections}
            className="button--secondary button--sm"
          >
            <RefreshCw className="w-3.5 h-3.5 text-[#806169]" />
            <span>Refresh</span>
          </button>
        </div>

        {/* Security Alert Banner */}
        <div className="p-4 rounded-xl bg-[#FAF5F5] border border-[#E8DFDE] flex items-start gap-3 text-xs text-[#5E4B50]">
          <Lock className="w-4 h-4 text-[#806169] flex-shrink-0 mt-0.5" />
          <div>
            <strong className="font-semibold text-[#0E1E27] block mb-0.5">Audit Trail Integrity Enforcement</strong>
            Original raw biometric event logs from the Hikvision terminal remain permanently unmodified. Any manual HR adjustment creates a separate timestamped audit entry with mandatory justification.
          </div>
        </div>

        {/* Audit Table */}
        <div className="table-surface">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="table-header">
                <tr>
                  <th className="px-5 py-3 font-mono">Logged At (IST)</th>
                  <th className="px-5 py-3">Employee</th>
                  <th className="px-4 py-3 font-mono">Shift Date</th>
                  <th className="px-4 py-3 font-mono">Previous Stamp</th>
                  <th className="px-4 py-3 font-mono">Adjusted Stamp</th>
                  <th className="px-6 py-3">Mandatory Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8DFDE] bg-white font-sans">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-[#806169] text-xs">
                      Loading audit records...
                    </td>
                  </tr>
                ) : corrections.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-[#806169] text-xs">
                      No manual attendance corrections have been applied.
                    </td>
                  </tr>
                ) : (
                  corrections.map((item) => (
                    <tr key={item.id} className="table-row-hover">
                      <td className="px-5 py-3 font-mono text-[#0E1E27]">
                        {new Date(item.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                      </td>
                      <td className="px-5 py-3 font-semibold text-[#0E1E27]">
                        {item.employeeName}
                        <span className="block text-[11px] text-[#806169] font-mono font-normal">
                          {item.employeeCode} • #{item.biometricNumber}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-[#5E4B50]">{item.businessDate}</td>
                      <td className="px-4 py-3 font-mono text-[#806169]">
                        {item.previousOutTime ? new Date(item.previousOutTime).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }) : '-'}
                      </td>
                      <td className="px-4 py-3 font-mono font-semibold text-emerald-700">
                        {item.newOutTime ? new Date(item.newOutTime).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }) : '-'}
                      </td>
                      <td className="px-6 py-3 text-[#5E4B50]">
                        <span className="bg-[#FAF8F8] px-2.5 py-1 rounded border border-[#E8DFDE] text-xs block">
                          {item.reason}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
