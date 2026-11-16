-- Migration 001: Initial Baseline Schema (AttendX Core)
-- Documents the original 15 tables to guarantee full data preservation

CREATE TABLE IF NOT EXISTS departments (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    code VARCHAR(30) NOT NULL UNIQUE,
    description TEXT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS shift_configurations (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50) NOT NULL UNIQUE,
    is_overnight BOOLEAN NOT NULL DEFAULT 0,
    shift_start_local VARCHAR(16) NOT NULL,
    shift_end_local VARCHAR(16) NOT NULL,
    timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Kolkata',
    duration_minutes INT NOT NULL DEFAULT 540,
    grace_late_minutes INT NOT NULL DEFAULT 15,
    grace_early_exit_minutes INT NOT NULL DEFAULT 15,
    overtime_min_minutes INT NOT NULL DEFAULT 30,
    is_default BOOLEAN NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT 1,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS employees (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    employee_code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    email VARCHAR(191) NULL UNIQUE,
    phone VARCHAR(30) NULL,
    department_id BIGINT NULL,
    designation VARCHAR(100) NULL,
    biometric_number VARCHAR(50) NOT NULL UNIQUE,
    status ENUM('ACTIVE', 'ON_LEAVE', 'PROBATION', 'TERMINATED', 'RESIGNED') NOT NULL DEFAULT 'ACTIVE',
    shift_id BIGINT NULL,
    date_of_joining DATE NOT NULL DEFAULT (CURRENT_DATE),
    profile_image VARCHAR(500) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    INDEX idx_emp_biometric (biometric_number),
    INDEX idx_emp_dept (department_id),
    INDEX idx_emp_shift (shift_id),
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
    FOREIGN KEY (shift_id) REFERENCES shift_configurations(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS users (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(191) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(150) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'EMPLOYEE',
    employee_id BIGINT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT 1,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS biometric_devices (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    model VARCHAR(100) NOT NULL DEFAULT 'DS-K1T343EFWX',
    ip_address VARCHAR(64) NOT NULL,
    port INT NOT NULL DEFAULT 80,
    use_https BOOLEAN NOT NULL DEFAULT 0,
    timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Kolkata',
    sync_interval_seconds INT NOT NULL DEFAULT 10,
    connection_method VARCHAR(30) NOT NULL DEFAULT 'ISAPI_STREAM',
    status ENUM('ONLINE', 'OFFLINE', 'WARNING', 'ERROR') NOT NULL DEFAULT 'OFFLINE',
    serial_number VARCHAR(100) NULL UNIQUE,
    firmware_version VARCHAR(100) NULL,
    last_connected_at DATETIME(6) NULL,
    last_sync_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS device_credentials (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    device_id BIGINT NOT NULL UNIQUE,
    username VARCHAR(100) NOT NULL,
    encrypted_password VARCHAR(255) NOT NULL,
    auth_type VARCHAR(30) NOT NULL DEFAULT 'DIGEST',
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    FOREIGN KEY (device_id) REFERENCES biometric_devices(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS device_sync_checkpoints (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    device_id BIGINT NOT NULL UNIQUE,
    last_sync_time VARCHAR(50) NOT NULL,
    last_serial_no INT NOT NULL DEFAULT 0,
    total_records_synced INT NOT NULL DEFAULT 0,
    sync_status VARCHAR(30) NOT NULL DEFAULT 'SUCCESS',
    last_error TEXT NULL,
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    FOREIGN KEY (device_id) REFERENCES biometric_devices(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS biometric_raw_events (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    device_id BIGINT NULL,
    serial_no INT NOT NULL,
    event_time_utc DATETIME(6) NOT NULL,
    event_time_device VARCHAR(40) NOT NULL,
    employee_no_string VARCHAR(50) NOT NULL,
    employee_id BIGINT NULL,
    card_no VARCHAR(50) NULL,
    verify_mode VARCHAR(30) NULL,
    major_code INT NULL,
    minor_code INT NULL,
    attendance_status VARCHAR(30) NULL,
    raw_payload JSON NULL,
    ingestion_source VARCHAR(20) NOT NULL DEFAULT 'stream',
    is_processed BOOLEAN NOT NULL DEFAULT 1,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    UNIQUE KEY unique_device_event (serial_no, event_time_device, employee_no_string),
    INDEX idx_raw_emp_time (employee_no_string, event_time_utc),
    INDEX idx_raw_time (event_time_utc),
    FOREIGN KEY (device_id) REFERENCES biometric_devices(id) ON DELETE SET NULL,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS attendance_sessions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    employee_id BIGINT NOT NULL,
    shift_id BIGINT NULL,
    business_date DATE NOT NULL,
    first_in_time DATETIME(6) NULL,
    last_in_time DATETIME(6) NULL,
    last_out_time DATETIME(6) NULL,
    current_interval_start DATETIME(6) NULL,
    in_count INT NOT NULL DEFAULT 0,
    out_count INT NOT NULL DEFAULT 0,
    completed_break_count INT NOT NULL DEFAULT 0,
    total_working_seconds INT NOT NULL DEFAULT 0,
    total_break_seconds INT NOT NULL DEFAULT 0,
    total_elapsed_seconds INT NOT NULL DEFAULT 0,
    total_work_minutes INT NOT NULL DEFAULT 0,
    late_minutes INT NOT NULL DEFAULT 0,
    early_exit_minutes INT NOT NULL DEFAULT 0,
    overtime_minutes INT NOT NULL DEFAULT 0,
    status VARCHAR(30) NOT NULL DEFAULT 'NOT_CHECKED_IN',
    completion_status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    is_inferred BOOLEAN NOT NULL DEFAULT 0,
    is_overnight BOOLEAN NOT NULL DEFAULT 1,
    is_manual_correction BOOLEAN NOT NULL DEFAULT 0,
    notes TEXT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    UNIQUE KEY unique_emp_business_date (employee_id, business_date),
    INDEX idx_sess_date_status (business_date, status),
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (shift_id) REFERENCES shift_configurations(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS attendance_intervals (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    session_id BIGINT NOT NULL,
    employee_id BIGINT NOT NULL,
    interval_type ENUM('WORK', 'BREAK', 'UNKNOWN') NOT NULL DEFAULT 'WORK',
    start_time DATETIME(6) NOT NULL,
    end_time DATETIME(6) NULL,
    duration_seconds INT NOT NULL DEFAULT 0,
    start_event_id BIGINT NULL,
    end_event_id BIGINT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    INDEX idx_inv_session_time (session_id, start_time),
    FOREIGN KEY (session_id) REFERENCES attendance_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (start_event_id) REFERENCES biometric_raw_events(id) ON DELETE SET NULL,
    FOREIGN KEY (end_event_id) REFERENCES biometric_raw_events(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS attendance_corrections (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    session_id BIGINT NOT NULL,
    employee_id BIGINT NOT NULL,
    business_date DATE NOT NULL,
    previous_in_time DATETIME(6) NULL,
    new_in_time DATETIME(6) NULL,
    previous_out_time DATETIME(6) NULL,
    new_out_time DATETIME(6) NULL,
    reason TEXT NOT NULL,
    requested_by BIGINT NOT NULL,
    approved_by BIGINT NULL,
    status ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'APPROVED',
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    INDEX idx_corr_emp_date (employee_id, business_date),
    FOREIGN KEY (session_id) REFERENCES attendance_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    actor_id BIGINT NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(60) NOT NULL,
    entity_id VARCHAR(60) NULL,
    details JSON NULL,
    ip_address VARCHAR(45) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    INDEX idx_audit_entity (entity_type, entity_id),
    INDEX idx_audit_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
