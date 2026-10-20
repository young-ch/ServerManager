import json
from database import init_db, get_db

def seed_sample_data():
    init_db()
    conn = get_db()
    cursor = conn.cursor()
    
    # Check if data already exists
    count = cursor.execute("SELECT COUNT(*) FROM servers").fetchone()[0]
    if count > 0:
        print("Data already exists. Skipping seed.")
        conn.close()
        return

    servers = [
        {
            "name": "PRD-WEB-WAS01",
            "host": "192.168.10.11",
            "ip_private": "192.168.10.11",
            "ip_public": "211.234.120.45",
            "os_type": "linux",
            "os_version": "Ubuntu 22.04.4 LTS",
            "env": "PROD",
            "location": "본사 전산실 랙 #01 (A-04)",
            "description": "메인 웹/WAS 운영 서버 (Nginx + Gunicorn)",
            "primary_port": 22,
            "web_url": "http://192.168.10.11:80",
            "status": "online",
            "cpu_percent": 28.4,
            "memory_percent": 54.2,
            "disk_percent": 42.0,
            "disk_details": json.dumps([
                {"name": "/", "total_gb": 120.0, "free_gb": 69.6, "used_gb": 50.4, "percent": 42.0},
                {"name": "/data", "total_gb": 500.0, "free_gb": 320.0, "used_gb": 180.0, "percent": 36.0}
            ]),
            "uptime_text": "45일 12시간 30분",
            "agent_token": "tok_linux_was01",
            "ports": [
                {"port_number": 22, "service_name": "SSH", "status": "open", "latency_ms": 1.2},
                {"port_number": 80, "service_name": "HTTP", "status": "open", "latency_ms": 2.4},
                {"port_number": 443, "service_name": "HTTPS", "status": "open", "latency_ms": 2.1}
            ]
        },
        {
            "name": "PRD-DB-MYSQL01",
            "host": "192.168.10.20",
            "ip_private": "192.168.10.20",
            "ip_public": "",
            "os_type": "linux",
            "os_version": "Rocky Linux 9.3",
            "env": "PROD",
            "location": "본사 전산실 랙 #01 (A-08)",
            "description": "메인 데이터베이스 서버 (MySQL 8.0 Master)",
            "primary_port": 22,
            "web_url": "",
            "status": "online",
            "cpu_percent": 41.5,
            "memory_percent": 76.8,
            "disk_percent": 68.5,
            "disk_details": json.dumps([
                {"name": "/", "total_gb": 100.0, "free_gb": 65.0, "used_gb": 35.0, "percent": 35.0},
                {"name": "/var/lib/mysql", "total_gb": 1000.0, "free_gb": 315.0, "used_gb": 685.0, "percent": 68.5}
            ]),
            "uptime_text": "88일 04시간 15분",
            "agent_token": "tok_linux_db01",
            "ports": [
                {"port_number": 22, "service_name": "SSH", "status": "open", "latency_ms": 0.9},
                {"port_number": 3306, "service_name": "MySQL", "status": "open", "latency_ms": 1.4}
            ]
        },
        {
            "name": "PRD-ERP-WIN01",
            "host": "192.168.10.31",
            "ip_private": "192.168.10.31",
            "ip_public": "211.234.120.48",
            "os_type": "windows",
            "os_version": "Windows Server 2022 Datacenter",
            "env": "PROD",
            "location": "본사 전산실 랙 #02 (B-02)",
            "description": "사내 ERP & 회계 솔루션 운영 서버 (IIS + .NET)",
            "primary_port": 3389,
            "web_url": "http://192.168.10.31:8080",
            "status": "online",
            "cpu_percent": 35.2,
            "memory_percent": 64.0,
            "disk_percent": 55.4,
            "disk_details": json.dumps([
                {"name": "C:", "total_gb": 150.0, "free_gb": 66.9, "used_gb": 83.1, "percent": 55.4},
                {"name": "D:", "total_gb": 800.0, "free_gb": 410.0, "used_gb": 390.0, "percent": 48.8}
            ]),
            "uptime_text": "21일 18시간 10분",
            "agent_token": "tok_win_erp01",
            "ports": [
                {"port_number": 3389, "service_name": "RDP", "status": "open", "latency_ms": 1.5},
                {"port_number": 445, "service_name": "SMB", "status": "open", "latency_ms": 1.1},
                {"port_number": 8080, "service_name": "IIS-App", "status": "open", "latency_ms": 3.2}
            ]
        },
        {
            "name": "AD-DC-PRIMARY",
            "host": "192.168.10.5",
            "ip_private": "192.168.10.5",
            "ip_public": "",
            "os_type": "windows",
            "os_version": "Windows Server 2019 Standard",
            "env": "INFRA",
            "location": "본사 전산실 랙 #02 (B-05)",
            "description": "사내 액티브 디렉토리(AD) 도메인 컨트롤러 & 사내 DNS",
            "primary_port": 3389,
            "web_url": "",
            "status": "online",
            "cpu_percent": 14.8,
            "memory_percent": 42.1,
            "disk_percent": 38.0,
            "disk_details": json.dumps([
                {"name": "C:", "total_gb": 120.0, "free_gb": 74.4, "used_gb": 45.6, "percent": 38.0}
            ]),
            "uptime_text": "112일 06시간 40분",
            "agent_token": "tok_win_ad01",
            "ports": [
                {"port_number": 3389, "service_name": "RDP", "status": "open", "latency_ms": 0.8},
                {"port_number": 53, "service_name": "DNS", "status": "open", "latency_ms": 0.5},
                {"port_number": 389, "service_name": "LDAP", "status": "open", "latency_ms": 0.9}
            ]
        },
        {
            "name": "BKP-NAS-STORAGE",
            "host": "192.168.10.99",
            "ip_private": "192.168.10.99",
            "ip_public": "",
            "os_type": "linux",
            "os_version": "CentOS 7.9 Linux",
            "env": "INFRA",
            "location": "본사 전산실 랙 #03 (C-01)",
            "description": "야간 DB/WAS 통합 백업 스토리지 서버",
            "primary_port": 22,
            "web_url": "",
            "status": "warning",
            "cpu_percent": 22.0,
            "memory_percent": 51.2,
            "disk_percent": 93.4,  # Warning trigger
            "disk_details": json.dumps([
                {"name": "/", "total_gb": 100.0, "free_gb": 45.0, "used_gb": 55.0, "percent": 55.0},
                {"name": "/backup", "total_gb": 4000.0, "free_gb": 264.0, "used_gb": 3736.0, "percent": 93.4}
            ]),
            "uptime_text": "34일 09시간 22분",
            "agent_token": "tok_linux_nas01",
            "ports": [
                {"port_number": 22, "service_name": "SSH", "status": "open", "latency_ms": 1.8},
                {"port_number": 873, "service_name": "RSYNC", "status": "open", "latency_ms": 2.0}
            ]
        },
        {
            "name": "DEV-WIN-TEST",
            "host": "192.168.20.50",
            "ip_private": "192.168.20.50",
            "ip_public": "",
            "os_type": "windows",
            "os_version": "Windows Server 2022 Standard",
            "env": "DEV",
            "location": "개발실 테스트 벤치",
            "description": "차기 빌드 검증용 윈도우 가상머신 (현재 정기 점검 중)",
            "primary_port": 3389,
            "web_url": "",
            "status": "offline",
            "cpu_percent": 0.0,
            "memory_percent": 0.0,
            "disk_percent": 0.0,
            "disk_details": json.dumps([]),
            "uptime_text": "-",
            "agent_token": "tok_win_dev01",
            "ports": [
                {"port_number": 3389, "service_name": "RDP", "status": "closed", "latency_ms": None}
            ]
        }
    ]

    for s in servers:
        cursor.execute("""
            INSERT INTO servers (
                name, host, ip_private, ip_public, os_type, os_version, env,
                location, description, primary_port, web_url, status,
                cpu_percent, memory_percent, disk_percent, disk_details,
                uptime_text, agent_token, last_seen
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        """, (
            s["name"], s["host"], s["ip_private"], s["ip_public"], s["os_type"],
            s["os_version"], s["env"], s["location"], s["description"],
            s["primary_port"], s["web_url"], s["status"], s["cpu_percent"],
            s["memory_percent"], s["disk_percent"], s["disk_details"],
            s["uptime_text"], s["agent_token"]
        ))
        server_id = cursor.lastrowid
        
        for p in s["ports"]:
            cursor.execute("""
                INSERT INTO server_ports (server_id, port_number, service_name, status, latency_ms, last_checked)
                VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            """, (server_id, p["port_number"], p["service_name"], p["status"], p["latency_ms"]))

    # Seed alert logs
    cursor.execute("""
        INSERT INTO alert_logs (server_id, server_name, severity, title, message)
        VALUES (5, 'BKP-NAS-STORAGE', 'warning', '스토리지 디스크 용량 경고 (93.4%)', '/backup 마운트 잔여 용량 264GB 이하로 떨어졌습니다.')
    """)
    cursor.execute("""
        INSERT INTO alert_logs (server_id, server_name, severity, title, message)
        VALUES (6, 'DEV-WIN-TEST', 'critical', '서버 응답 없음 (오프라인)', 'RDP 포트(3389) 연결 실패 및 핑 타임아웃')
    """)

    conn.commit()
    conn.close()
    print("Sample server records successfully seeded!")

if __name__ == "__main__":
    seed_sample_data()
