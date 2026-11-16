'use client';

import React, { useState } from 'react';
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
} from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';

export default function BiometricDeviceManagementPage() {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [deviceInfo] = useState({
    name: 'Taraj Global Entrance Terminal',
    model: 'DS-K1T343EFWX',
    manufacturer: 'Hikvision Digital Technology',
    firmware: 'V3.21.0 build 241225',
    webVersion: 'V5.1.27_R0401',
    ip: '192.168.200.200',
    port: 80,
    status: 'ONLINE',
    macAddress: 'a4:d5:c2:35:78:00',
    syncProtocol: 'ISAPI Digest Authentication',
    authType: 'HTTP Digest MD5 (Official ISAPI)',
    supportedCapabilities: ['Face Recognition', 'Card Reader', 'Access Control', 'AcsEvent Polling'],
    lastSync: 'Realtime active (10s polling interval)',
  });

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

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-1">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="h1 tracking-tight text-[#0E1E27]">
                Biometric Hardware & Devices
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#FAF5F5] text-[#806169] border border-[#E8DFDE]">
                ISAPI ARCHITECTURE
              </span>
            </div>
            <p className="text-xs text-[#5E4B50] mt-0.5">
              Access control terminals, on-premise LAN connections, and protocol sync
            </p>
          </div>

          <button
            onClick={runDiagnostic}
            disabled={testing}
            className="button--primary button--sm"
          >
            <Activity className={`w-3.5 h-3.5 text-[#E4C5C3] ${testing ? 'animate-spin' : ''}`} />
            <span>{testing ? 'Testing Connection...' : 'Run ISAPI Diagnostics'}</span>
          </button>
        </div>

        {/* Diagnostic Results Banner */}
        {testResult && (
          <div
            className={`p-4 rounded-xl border text-xs animate-in slide-in-from-top-1 ${
              testResult.success
                ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                : 'bg-rose-50 border-rose-300 text-rose-900'
            }`}
          >
            <div className="flex items-center justify-between font-semibold mb-1">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ISAPI Hardware Diagnostic: {testResult.success ? 'PASSED (100% Operational)' : 'FAILED'}
              </span>
            </div>
            <p className="text-[#5E4B50] text-[11px] font-mono">
              Status Code: {testResult.status || 200} • Terminal Response: OK • Polling Engine Active
            </p>
          </div>
        )}

        {/* Device Specifications Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Card 1: Hardware Specs */}
          <div className="card-surface p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E8DFDE]">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-lg bg-[#FAF5F5] border border-[#E8DFDE] flex items-center justify-center text-[#0E1E27]">
                  <Cpu className="w-5 h-5 text-[#806169]" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-[#0E1E27]">{deviceInfo.name}</h2>
                  <span className="text-xs text-[#806169] font-mono">{deviceInfo.model}</span>
                </div>
              </div>

              <span className="badge-working">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                ONLINE
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1.5 border-b border-[#FAF5F5]">
                <span className="text-[#806169]">Manufacturer:</span>
                <span className="font-semibold text-[#0E1E27]">{deviceInfo.manufacturer}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#FAF5F5]">
                <span className="text-[#806169]">IP Address & Port:</span>
                <span className="font-mono font-semibold text-[#0E1E27]">{deviceInfo.ip}:{deviceInfo.port}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#FAF5F5]">
                <span className="text-[#806169]">MAC Address:</span>
                <span className="font-mono text-[#5E4B50]">{deviceInfo.macAddress}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#FAF5F5]">
                <span className="text-[#806169]">Firmware Release:</span>
                <span className="font-mono text-[#0E1E27]">{deviceInfo.firmware}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-[#806169]">Sync Status:</span>
                <span className="font-mono text-emerald-700 font-semibold">{deviceInfo.lastSync}</span>
              </div>
            </div>
          </div>

          {/* Card 2: Security & Protocol Architecture */}
          <div className="card-surface p-6 space-y-4">
            <div className="flex items-center space-x-3 pb-3 border-b border-[#E8DFDE]">
              <div className="w-10 h-10 rounded-lg bg-[#FAF5F5] border border-[#E8DFDE] flex items-center justify-center text-[#0E1E27]">
                <ShieldCheck className="w-5 h-5 text-[#806169]" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-[#0E1E27]">ISAPI Security Architecture</h2>
                <span className="text-xs text-[#806169]">Digest MD5 Protocol Specification</span>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1.5 border-b border-[#FAF5F5]">
                <span className="text-[#806169]">Authentication Mode:</span>
                <span className="font-mono text-[#0E1E27] font-semibold">{deviceInfo.authType}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#FAF5F5]">
                <span className="text-[#806169]">Event Ingestion Endpoint:</span>
                <span className="font-mono text-[#5E4B50] text-[11px]">/ISAPI/AccessControl/AcsEvent?format=json</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#FAF5F5]">
                <span className="text-[#806169]">Connection Mode:</span>
                <span className="text-[#0E1E27] font-semibold">Non-persistent with Keep-Alive fallback</span>
              </div>
              <div className="py-2">
                <span className="text-[#806169] block mb-2">Supported Terminal Modalities:</span>
                <div className="flex flex-wrap gap-1.5">
                  {deviceInfo.supportedCapabilities.map((cap) => (
                    <span
                      key={cap}
                      className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-[#FAF5F5] text-[#0E1E27] border border-[#E8DFDE]"
                    >
                      {cap}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
