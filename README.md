# Real-Time Hikvision Biometric Attendance System (Next.js + ISAPI)

A complete, production-ready biometric attendance management system built with **Next.js App Router**, **TypeScript**, **Tailwind CSS**, and **Native MySQL 8 (mysql2/promise - Zero ORM)**, directly integrated with a **Hikvision DS-K1T343EFWX** face recognition and fingerprint terminal.

---

## 1. Biometric Hardware Specifications & Discovered Details

- **Device Model:** Hikvision `DS-K1T343EFWX`
- **Firmware:** `V3.21.0 build 241225`
- **Subnet IP:** `192.168.200.200` *(Discovered live via SADP protocol)*
- **MAC Address:** `70-c9-12-ee-6b-c3`
- **Capacity:** 1,500 Faces | 3,000 Fingerprints | 150,000 Events
- **Current Event Storage:** ~144,331 / 150,000 (>96% full - historical sync engine safely backs up events without deleting enrollment data)

---

## 2. System Architecture

```text
       OFFICE LOCAL NETWORK (LAN)                  REMOTE VPS / CLOUD
┌──────────────────────────────────────┐     ┌────────────────────────────────┐
│  Hikvision Biometric Machine         │     │                                │
│  DS-K1T343EFWX (192.168.200.200:80)  │     │  NEXT.JS APP ROUTER BACKEND    │
│                 │                    │     │   - POST /api/biometric/events │
│                 │ ISAPI (Digest Auth)│     │   - GET  /api/attendance/live  │
│                 ▼                    │     │   - GET  /api/attendance/today │
│  LOCAL CONNECTOR DAEMON (Node.js)    │     │                 │              │
│   - Persistent Alert Stream (Live)   │     │                 ▼              │
│   - Incremental Polling (Fallback)   │     │  MYSQL 8 DATABASE (Native SQL) │
│   - Deduplication & Checkpointing    │     │   - Connection Pooling         │
│                 │                    │     │   - Parameterized Queries      │
│                 │ Outbound HTTPS     │     │   - Explicit Transactions      │
│                 └────────────────────┼────►│                 │              │
│                   x-connector-secret │     │  LIVE ENTERPRISE DASHBOARD     │
│                                      │     │   - Real-time SSE updates      │
│                                      │     │   - Dual IST & EST Clocks      │
└──────────────────────────────────────┘     └────────────────────────────────┘
```

---

## 3. Shift Logic & Flexible Calendars

The system dynamically calculates attendance according to assigned employee shift schedules:

### 1. US Operations Overnight Shift (Default)
- **Timezone:** `Asia/Kolkata`
- **Shift Window:** 5:30 PM IST → 2:30 AM IST (Following calendar day)
- **Business Date Rule:** All punches within the shift window (including punches after midnight between 12:00 AM and 02:30 AM) are anchored to the calendar date on which the shift started.
- **Reference Time:** Automatically converts and displays corresponding US Eastern Time (`America/New_York`) with full Daylight Saving Time (DST) support.

### 2. Day General Shift
- **Shift Window:** 10:00 AM IST → 7:00 PM IST
- **Business Date Rule:** Aligned with same calendar day.

### 3. Metric Calculations
- **Late Arrival:** Punch IN > Shift Start + Grace Late Minutes (Default: 15 mins).
- **Early Exit:** Total Work Minutes < Shift Duration - Grace Early Exit Minutes.
- **Overtime:** Total Work Minutes > Shift Duration + 30 mins.
- **Missing Out:** Shift ended with only a single IN punch recorded.

---

## 4. Quick Start & Local Development

### Prerequisites
- Node.js 20+
- MySQL 8

### Step 1: Install Dependencies & Setup Environment
```bash
cp .env.example .env
npm install
```

### Step 2: Initialize Database (Native SQL Migrations)
```bash
npm run db:migrate
npm run db:seed
```

### Step 3: Run Device Discovery & Diagnostics
To test connectivity with the Hikvision machine at `192.168.200.200`:
```bash
# SADP network discovery:
node node_modules/tsx/dist/cli.mjs connector/src/discover.ts

# Run diagnostic tool:
node node_modules/tsx/dist/cli.mjs connector/src/test-device.ts
```

### Step 4: Run the Local Connector Daemon
In an office terminal on the local LAN:
```bash
npm run connector
# or: node node_modules/tsx/dist/cli.mjs connector/src/index.ts
```

### Step 5: Start Next.js Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the live dashboard.

---

## 5. Docker VPS Deployment

Deploying on Ubuntu Linux with Docker and Docker Compose:

```bash
# On your Linux VPS:
git clone <repo-url>
cd Biometric

# Configure production environment:
cp .env.example .env
nano .env

# Build and start services:
docker compose up -d --build

# Verify container health:
docker compose ps
```

Services running:
- `biometric_mysql`: MySQL 8 with persistent storage volume
- `biometric_app`: Next.js production server on port 3000
- `biometric_nginx`: Reverse proxy with SSE streaming buffer optimization

---

## 6. ISAPI Protocol Endpoints Reference

| Endpoint | Method | Description |
|---|---|---|
| `/ISAPI/System/deviceInfo` | GET | Device model, firmware, serial number |
| `/ISAPI/System/time` | GET | Device local time and timezone synchronization |
| `/ISAPI/AccessControl/AcsEvent?format=json` | POST | Historical paginated attendance search |
| `/ISAPI/Event/notification/alertStream` | GET | Multipart chunked live event stream |
