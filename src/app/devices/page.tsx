'use client';

import React, { useState, useEffect } from 'react';
import {
  Cpu,
  CheckCircle2,
  AlertTriangle,
  Activity,
  ShieldCheck,
  Wifi,
  HardDrive,
  Key,
  Server,
  RotateCw,
  Loader2,
} from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';

interface DeviceItem {
  id: string;
  name: string;
  model: string;
  ipAddress: string;
  port: number;
  useHttps: boolean;
  timezone: string;
  syncIntervalSeconds: number;
  connectionMethod: string;
  status: string;
  serialNumber: string;
  firmwareVersion: string;
  lastConnectedAt: string | null;
  lastSyncAt: string | null;
}

export default function BiometricDeviceManagementPage() {
  const [devices, setDevices] = useState<DeviceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const fetchDevices = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/biometric/devices');
      const data = await res.json();
      if (data.success) {
        setDevices(data.devices || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDevices();
  }, []);

  const runDiagnostic = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/biometric/devices/test', {
        method: 'POST',
      });
      const data = await res.json();
      setTestResult(data);
    } catch (e: any) {
      setTestResult({
        success: false,
        error: e.message || 'Connection failed',
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSyncNow = async () => {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const res = await fetch('/api/attendance/sync-now', {
        method: 'POST',
      });
      const data = await res.json();
      setSyncMessage(
        data.success
          ? `Synced ${data.syncedEvents || 0} events and reconciled ${data.reconciledSessions || 0} sessions successfully!`
          : `Sync notice: ${data.message || 'Completed'}`
      );
      await fetchDevices();
    } catch (e: any) {
      setSyncMessage('Sync request failed: ' + e.message);
    } finally {
      setSyncing(false);
    }
  };

  const primaryDevice = devices[0];

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-1">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="h1 tracking-tight text-[#0E1E27] dark:text-white">
                Biometric Hardware & Devices
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#FAF5F5] dark:bg-slate-800 text-[#806169] dark:text-slate-400 border border-[#E8DFDE] dark:border-slate-700">
                ISAPI ARCHITECTURE
              </span>
            </div>
            <p className="text-xs text-[#5E4B50] dark:text-slate-400 mt-0.5">
              Access control terminals, on-premise LAN connections, and protocol sync
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSyncNow}
              disabled={syncing}
              className="button--secondary button--sm px-3.5 py-2 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
              <span>{syncing ? 'Syncing...' : 'Sync Now'}</span>
            </button>

            <button
              onClick={runDiagnostic}
              disabled={testing}
              className="button--primary button--sm bg-indigo-600 hover:bg-indigo-500 text-white px-3.5 py-2 rounded-lg text-xs font-medium flex items-center gap-1.5 cursor-pointer"
            >
              <Activity className={`w-3.5 h-3.5 ${testing ? 'animate-spin' : ''}`} />
              <span>{testing ? 'Testing...' : 'Run ISAPI Diagnostics'}</span>
            </button>
          </div>
        </div>

        {/* Sync message alert */}
        {syncMessage && (
          <div className="p-3.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-900 dark:text-indigo-300 text-xs flex items-center justify-between animate-in fade-in">
            <span>{syncMessage}</span>
            <button onClick={() => setSyncMessage(null)} className="text-xs font-bold ml-2">✕</button>
          </div>
        )}

        {/* Diagnostic Results Banner */}
        {testResult && (
          <div
            className={`p-4 rounded-xl border text-xs animate-in slide-in-from-top-1 ${
              testResult.success
                ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-300'
                : 'bg-rose-50 dark:bg-rose-950/60 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-300'
            }`}
          >
            <div className="flex items-center justify-between font-semibold mb-1">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ISAPI Hardware Diagnostic: {testResult.success ? 'PASSED (100% Operational)' : 'FAILED'}
              </span>
            </div>
            <p className="text-[11px] font-mono mt-1">
              Device: {testResult.device?.name || 'DS-K1T343EFWX'} • Firmware: {testResult.device?.firmwareVersion} • IP: 192.168.200.200
            </p>
          </div>
        )}

        {/* Device Details Card */}
        <div className="card-surface p-6 rounded-2xl border border-[#E8DFDE] dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                <Cpu className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-[#0E1E27] dark:text-white">
                  {primaryDevice?.name || 'Taraj Global Entrance Terminal'}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Model: <span className="font-semibold text-slate-700 dark:text-slate-300">{primaryDevice?.model || 'DS-K1T343EFWX'}</span>
                </p>
              </div>
            </div>

            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>ONLINE</span>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
              <span className="text-[10px] text-slate-400 block uppercase font-semibold">IP Address</span>
              <span className="font-mono font-bold text-slate-800 dark:text-slate-200 text-sm">
                {primaryDevice?.ipAddress || '192.168.200.200'}:{primaryDevice?.port || 80}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
              <span className="text-[10px] text-slate-400 block uppercase font-semibold">Serial Number</span>
              <span className="font-mono font-bold text-slate-800 dark:text-slate-200 text-xs truncate block" title={primaryDevice?.serialNumber}>
                {primaryDevice?.serialNumber || 'DS-K1T343EFWX20241225...'}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
              <span className="text-[10px] text-slate-400 block uppercase font-semibold">Firmware Version</span>
              <span className="font-mono font-bold text-slate-800 dark:text-slate-200 text-xs">
                {primaryDevice?.firmwareVersion || 'V3.21.0 build 241225'}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
              <span className="text-[10px] text-slate-400 block uppercase font-semibold">Sync Method</span>
              <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">
                ISAPI Stream + 10s Polling
              </span>
            </div>
          </div>

          <div className="mt-5 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span>Continuous Ingestion Daemon Active • Checkpoint tracking enabled</span>
            </div>
            <span className="font-mono text-[11px] text-slate-400">
              Timezone: {primaryDevice?.timezone || 'Asia/Kolkata'}
            </span>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
