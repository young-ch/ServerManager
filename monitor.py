import socket
import time
import urllib.request
import urllib.error
import threading
from datetime import datetime
from database import get_db

def check_tcp_port(host, port, timeout=2.5):
    """
    Test TCP port connectivity and measure latency in milliseconds.
    Works for both Linux (SSH:22) and Windows (RDP:3389, SMB:445, etc.)
    """
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(timeout)
    start_time = time.time()
    try:
        s.connect((host, int(port)))
        latency = (time.time() - start_time) * 1000.0
        s.close()
        return True, round(latency, 1)
    except Exception as e:
        return False, None

def check_http_service(url, timeout=3.0):
    """Test HTTP/HTTPS web application endpoint."""
    if not url:
        return None, None
    try:
        start_time = time.time()
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "OpsPulse-Monitor/1.0"}
        )
        with urllib.request.urlopen(req, timeout=timeout) as response:
            latency = (time.time() - start_time) * 1000.0
            return response.status, round(latency, 1)
    except urllib.error.HTTPError as e:
        return e.code, None
    except Exception:
        return None, None

def check_single_server(server_id):
    """Perform health checks on a specific server and update database."""
    conn = get_db()
    cursor = conn.cursor()
    try:
        server_row = cursor.execute("SELECT * FROM servers WHERE id = ?", (server_id,)).fetchone()
        if not server_row:
            return None
        
        server = dict(server_row)
        host = server["host"]
        primary_port = server["primary_port"]
        
        # Check primary port
        is_primary_open = False
        primary_latency = None
        if primary_port:
            is_primary_open, primary_latency = check_tcp_port(host, primary_port)
        
        # Check registered service ports
        ports = cursor.execute("SELECT * FROM server_ports WHERE server_id = ?", (server_id,)).fetchall()
        any_port_down = False
        for p in ports:
            is_open, lat = check_tcp_port(host, p["port_number"])
            status_text = "open" if is_open else "closed"
            cursor.execute("""
                UPDATE server_ports 
                SET status = ?, latency_ms = ?, last_checked = CURRENT_TIMESTAMP
                WHERE id = ?
            """, (status_text, lat, p["id"]))
            if not is_open:
                any_port_down = True
                
        # Check Web URL if defined
        web_status = None
        if server.get("web_url"):
            code, lat = check_http_service(server["web_url"])
            if code and code < 400:
                web_status = "ok"
            else:
                web_status = "error"
                
        # Check if agent reported recently (within 180 seconds)
        # Note: last_seen is ONLY updated when the real agent sends a report to /api/agent/report
        is_agent_alive = False
        if server.get("last_seen") and server.get("uptime_text"):
            try:
                last_dt = datetime.strptime(str(server["last_seen"]).split(".")[0], "%Y-%m-%d %H:%M:%S")
                if (datetime.now() - last_dt).total_seconds() < 180:
                    is_agent_alive = True
            except Exception:
                pass

        # Determine overall status
        new_status = "offline"
        
        if primary_port:
            # If primary port is configured:
            if is_primary_open:
                new_status = "online"
                # Mark warning if resources high or secondary port / web check failed
                if (server.get("cpu_percent") and server["cpu_percent"] >= 85) or \
                   (server.get("memory_percent") and server["memory_percent"] >= 90) or \
                   (server.get("disk_percent") and server["disk_percent"] >= 90) or \
                   (any_port_down and len(ports) > 1) or \
                   (web_status == "error"):
                    new_status = "warning"
            else:
                # Primary port is closed
                if is_agent_alive:
                    new_status = "warning"  # Machine alive via agent, but primary port is down
                else:
                    new_status = "offline"  # No port response & no agent -> completely offline
        else:
            # No primary port specified: rely on secondary ports or agent
            if is_agent_alive or (len(ports) > 0 and not any_port_down):
                new_status = "online"
            else:
                new_status = "offline"

        cursor.execute("""
            UPDATE servers 
            SET status = ?
            WHERE id = ?
        """, (new_status, server_id))
        
        # Record metrics history if online/warning
        if new_status in ["online", "warning"]:
            cursor.execute("""
                INSERT INTO metrics_history (server_id, cpu_percent, memory_percent, disk_percent, latency_ms)
                VALUES (?, ?, ?, ?, ?)
            """, (server_id, server.get("cpu_percent") or 0, server.get("memory_percent") or 0, server.get("disk_percent") or 0, primary_latency or 0))

        conn.commit()
        
        return {
            "server_id": server_id,
            "status": new_status,
            "primary_port_open": is_primary_open,
            "agent_alive": is_agent_alive,
            "latency_ms": primary_latency
        }
    finally:
        conn.close()

def check_all_servers():
    """Run health checks on all registered servers concurrently."""
    from concurrent.futures import ThreadPoolExecutor, as_completed
    
    conn = get_db()
    cursor = conn.cursor()
    server_rows = cursor.execute("SELECT id FROM servers").fetchall()
    conn.close()
    
    server_ids = [s["id"] for s in server_rows]
    if not server_ids:
        return []

    results = []
    # Concurrently check up to 10 servers at once
    with ThreadPoolExecutor(max_workers=min(10, len(server_ids))) as executor:
        future_map = {executor.submit(check_single_server, sid): sid for sid in server_ids}
        for future in as_completed(future_map):
            try:
                res = future.result()
                if res:
                    results.append(res)
            except Exception as e:
                print(f"[Check Server Error] Server {future_map[future]}: {e}")
                
    return results

class BackgroundMonitorThread(threading.Thread):
    """Periodic health-checker thread."""
    def __init__(self, interval=30):
        super().__init__(daemon=True)
        self.interval = interval
        self.running = True

    def run(self):
        while self.running:
            try:
                check_all_servers()
            except Exception as e:
                print(f"[Monitor Worker Error] {e}")
            time.sleep(self.interval)

    def stop(self):
        self.running = False
