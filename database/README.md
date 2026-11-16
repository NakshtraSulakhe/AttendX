# AttendX Enterprise Database Architecture
**Engine:** MySQL 8.0 / MariaDB 10.4+  
**Access Model:** Native SQL via `mysql2/promise` (Strictly Zero ORM)  
**Encoding:** UTF-8 Unicode (`utf8mb4`, `utf8mb4_unicode_ci`)  

---

## Architecture Overview

The AttendX persistence layer eliminates all ORM abstractions, providing high-throughput raw SQL execution, atomic transaction boundaries, zero client-side schema generation latency, and deterministic memory utilization.

```
database/
├── migrations/
│   ├── 001_initial_schema.sql         # Original 15 core baseline tables (preserved without modification)
│   └── 002_enterprise_expansion.sql   # Non-destructive enterprise expansion (RBAC, Leave, Overtime)
├── schema/
│   └── schema.sql                     # Master declarative enterprise schema definition
└── seeds/
    └── 001_initial_seed.sql           # Roles, granular permissions, leave quotas & enterprise metadata
```

## Migration Execution Procedures

### Running Migrations
To execute version-controlled migrations safely against the configured MySQL server:
```bash
npm run db:migrate
```

### Running Seeds
To seed system roles, default leave quotas, and initial company branches:
```bash
npm run db:seed
```

## Core Safety Rules & Invariants
1. **Zero Destructive Alterations:** Never execute `DROP TABLE` or `TRUNCATE` against production datasets.
2. **Strict Parameterization:** Never concatenate dynamic user values into query strings. Use `?` placeholders at all times.
3. **Transaction Discipline:** All multi-step mutations (e.g. session interval reconciliation, attendance correction approvals, employee onboarding) must be orchestrated inside `withTransaction()`.
4. **Timezone Normalization:** The connection pool enforces `timezone: '+00:00'` at the driver level to standardize UTC storage, while DATE fields (`business_date`, `start_date`) are preserved using `dateStrings: ['DATE']` to avoid calendar date shift anomalies.
