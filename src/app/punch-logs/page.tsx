'use client';

import React, { useState, useEffect } from 'react';
import {
  Clock,
  Search,
  RefreshCw,
  Download,
  ScanFace,
  CreditCard,
  ShieldCheck,
} from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';

interface LogItem {
  sequence: number;
  id: string;
  serialNo: number;
  timeUtc: string;
  timeDevice: string;
  timeIst: string;
  dateIst: string;
  employeeName: string;
  employeeCode: string;
  biometricNumber: string;
  department: string;
  verifyMode: string;
  attendanceStatus: string;
  deviceName: string;
  source: string;
  isProcessed: boolean;
}

export default function PunchLogsPage() {
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const fetchLogs = async () => {
    try {
      const res = await fetch(`/api/biometric/logs?limit=150&search=${encodeURIComponent(search)}`, {
        cache: 'no-store',
      });
      const data = await res.json();
      if (data.success) {
        setLogs(data.events || []);
      }
    } catch (e) {
      console.error('Failed to load punch logs:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLogs();

    // SSE Listener for real-time punch logs
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource('/api/attendance/live');
      const handleLivePulse = () => {
        fetchLogs();
      };
      eventSource.addEventListener('new_punch', handleLivePulse);
      eventSource.addEventListener('attendance_updated', handleLivePulse);
      eventSource.onmessage = handleLivePulse;
    } catch (e) {
      // Non-critical
    }

    const pollInterval = setInterval(() => {
      fetchLogs();
    }, 12000);

    return () => {
      if (eventSource) eventSource.close();
      clearInterval(pollInterval);
    };
  }, [search]);

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-1">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="h1 tracking-tight text-[#0E1E27]">
                Biometric Punch Audit Logs
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#FAF5F5] text-[#806169] border border-[#E8DFDE]">
                ISAPI STREAM
              </span>
            </div>
            <p className="text-xs text-[#5E4B50] mt-0.5">
              Immutable chronological biometric events from Hikvision DS-K1T343EFWX terminal
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={async () => {
                setRefreshing(true);
                try {
                  await fetch('/api/attendance/sync-now', { method: 'POST' });
                } catch {}
                await fetchLogs();
              }}
              disabled={refreshing}
              className="button--secondary button--sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-[#806169]' : 'text-[#806169]'}`} />
              <span>Sync & Refresh</span>
            </button>

            <a
              href="/api/attendance/reports?format=csv"
              className="button--primary button--sm"
            >
              <Download className="w-3.5 h-3.5 text-[#E4C5C3]" />
              <span>Export CSV</span>
            </a>
          </div>
        </div>

        {/* Search Toolbar */}
        <div className="card-surface p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full max-w-md">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#806169]" />
            <input
              type="text"
              placeholder="Search by employee name, bio #, or serial..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#FAF8F8] border border-[#E8DFDE] rounded-md pl-8 pr-3 py-1.5 text-xs text-[#0E1E27] placeholder-[#806169]/70 focus:outline-none focus:border-[#BD8D8B] focus:bg-white transition-all"
            />
          </div>

          <span className="text-xs font-mono font-medium text-[#806169]">
            {logs.length} Logged Events
          </span>
        </div>

        {/* Audit Table */}
        <div className="table-surface">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="table-header">
                <tr>
                  <th className="px-5 py-3">#</th>
                  <th className="px-4 py-3 font-mono">Timestamp (IST)</th>
                  <th className="px-4 py-3 font-mono">Date</th>
                  <th className="px-5 py-3">Employee Name</th>
                  <th className="px-3 py-3 font-mono">Bio ID</th>
                  <th className="px-3 py-3 text-center">Direction</th>
                  <th className="px-4 py-3">Verification</th>
                  <th className="px-4 py-3">Device Source</th>
                  <th className="px-4 py-3 font-mono text-right">Serial No</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8DFDE] bg-white font-sans">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="text-center py-12 text-[#806169] text-xs">
                      Loading raw event stream...
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-12 text-[#806169] text-xs">
                      No punch events matching the criteria.
                    </td>
                  </tr>
                ) : (
                  logs.map((item) => {
                    const isCheckIn = item.attendanceStatus === 'IN';
                    return (
                      <tr key={item.id} className="table-row-hover">
                        <td className="px-5 py-2.5 text-[#806169] font-mono">{item.sequence}</td>

                        <td className="px-4 py-2.5 font-mono font-semibold text-[#0E1E27]">
                          {item.timeIst}
                        </td>

                        <td className="px-4 py-2.5 text-[#5E4B50] font-mono">{item.dateIst}</td>

                        <td className="px-5 py-2.5 font-semibold text-[#0E1E27]">
                          {item.employeeName}
                        </td>

                        <td className="px-3 py-2.5 font-mono font-medium text-[#0E1E27]">
                          #{item.biometricNumber}
                        </td>

                        <td className="px-3 py-2.5 text-center">
                          {isCheckIn ? (
                            <span className="badge-working">IN</span>
                          ) : (
                            <span className="badge-break">OUT</span>
                          )}
                        </td>

                        <td className="px-4 py-2.5 text-[#5E4B50] capitalize">
                          <div className="flex items-center gap-1.5">
                            {item.verifyMode.includes('face') ? (
                              <ScanFace className="w-3.5 h-3.5 text-[#806169]" />
                            ) : (
                              <CreditCard className="w-3.5 h-3.5 text-[#806169]" />
                            )}
                            <span>{item.verifyMode}</span>
                          </div>
                        </td>

                        <td className="px-4 py-2.5 text-[#806169] text-[11px] font-mono">
                          {item.deviceName}
                        </td>

                        <td className="px-4 py-2.5 font-mono text-[#806169] text-right text-[11px]">
                          #{item.serialNo}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
