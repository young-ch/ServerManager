import sqlite3
import json
import os
from datetime import datetime

DB_PATH = os.environ.get("OPSPULSE_DB_PATH", os.path.join(os.path.dirname(__file__), "servers.db"))

def get_db():
    conn = sqlite3.connect(DB_PATH, timeout=30.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA busy_timeout = 30000;")
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("PRAGMA journal_mode = WAL;")
    cursor.execute("PRAGMA synchronous = NORMAL;")
    
    # 1. Servers table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS servers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        host TEXT NOT NULL,
        ip_private TEXT,
        ip_public TEXT,
        os_type TEXT NOT NULL,       -- 'linux' or 'windows'
        os_version TEXT,            -- e.g., 'Ubuntu 22.04 LTS', 'Windows Server 2022 Datacenter'
        env TEXT NOT NULL DEFAULT 'PROD', -- 'PROD', 'DEV', 'STG', 'INFRA'
        location TEXT,              -- e.g., '본사 전산실 랙#2', 'AWS ap-northeast-2'
        description TEXT,
        primary_port INTEGER,       -- Linux default 22, Windows default 3389
        web_url TEXT,               -- e.g., 'http://192.168.1.10:8080'
        check_interval INTEGER DEFAULT 30, -- seconds
        status TEXT DEFAULT 'unknown',     -- 'online', 'warning', 'offline', 'unknown'
        last_seen TIMESTAMP,
        cpu_percent REAL DEFAULT 0,
        memory_percent REAL DEFAULT 0,
        memory_total_gb REAL DEFAULT 0,
        memory_used_gb REAL DEFAULT 0,
        disk_percent REAL DEFAULT 0,
        disk_details TEXT,          -- JSON string of drives/mounts
        uptime_text TEXT,
        agent_token TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # Safe migration: add memory_total_gb, memory_used_gb if not exists
    cursor.execute("PRAGMA table_info(servers);")
    columns = [col[1] for col in cursor.fetchall()]
    if "memory_total_gb" not in columns:
        cursor.execute("ALTER TABLE servers ADD COLUMN memory_total_gb REAL DEFAULT 0;")
    if "memory_used_gb" not in columns:
        cursor.execute("ALTER TABLE servers ADD COLUMN memory_used_gb REAL DEFAULT 0;")

    # 2. Server Ports/Services table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS server_ports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        server_id INTEGER NOT NULL,
        port_number INTEGER NOT NULL,
        service_name TEXT NOT NULL, -- 'SSH', 'RDP', 'HTTP', 'HTTPS', 'MySQL', 'MSSQL', 'SMB'
        status TEXT DEFAULT 'unknown', -- 'open', 'closed', 'timeout'
        latency_ms REAL,
        last_checked TIMESTAMP,
        FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
    );
    """)

    # 3. Metrics History table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS metrics_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        server_id INTEGER NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        cpu_percent REAL,
        memory_percent REAL,
        disk_percent REAL,
        latency_ms REAL,
        FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
    );
    """)

    # 4. Alert Logs table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS alert_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        server_id INTEGER,
        server_name TEXT,
        severity TEXT NOT NULL,      -- 'info', 'warning', 'critical'
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        resolved INTEGER DEFAULT 0
    );
    """)

    conn.commit()
    conn.close()

if __name__ == "__main__":
    init_db()
    print("Database initialized successfully at", DB_PATH)
