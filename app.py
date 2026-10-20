import json
import secrets
import os
from datetime import datetime
from flask import Flask, render_template, request, jsonify, Response, send_file
from database import init_db, get_db
from monitor import check_single_server, check_all_servers, BackgroundMonitorThread

app = Flask(__name__)
app.config["SECRET_KEY"] = secrets.token_hex(16)
app.config["JSON_AS_ASCII"] = False  # Ensure JSON returns readable UTF-8 Korean characters

# Initialize DB on start
init_db()

# Start background monitor thread (polls every 30s)
monitor_thread = BackgroundMonitorThread(interval=30)
monitor_thread.start()

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/overview")
def get_overview():
    conn = get_db()
    cursor = conn.cursor()
    
    servers = cursor.execute("SELECT * FROM servers").fetchall()
    
    total = len(servers)
    online = sum(1 for s in servers if s["status"] == "online")
    warning = sum(1 for s in servers if s["status"] == "warning")
    offline = sum(1 for s in servers if s["status"] == "offline")
    unknown = sum(1 for s in servers if s["status"] not in ["online", "warning", "offline"])
    
    linux_count = sum(1 for s in servers if s["os_type"] == "linux")
    windows_count = sum(1 for s in servers if s["os_type"] == "windows")
    
    active_servers = [s for s in servers if s["status"] in ["online", "warning"]]
    avg_cpu = round(sum(s["cpu_percent"] or 0 for s in active_servers) / max(len(active_servers), 1), 1)
    avg_mem = round(sum(s["memory_percent"] or 0 for s in active_servers) / max(len(active_servers), 1), 1)
    
    # Recent alerts
    recent_alerts = cursor.execute(
        "SELECT * FROM alert_logs ORDER BY id DESC LIMIT 5"
    ).fetchall()
    
    conn.close()
    
    return jsonify({
        "total": total,
        "online": online,
        "warning": warning,
        "offline": offline,
        "unknown": unknown,
        "linux_count": linux_count,
        "windows_count": windows_count,
        "avg_cpu": avg_cpu,
        "avg_mem": avg_mem,
        "recent_alerts": [dict(a) for a in recent_alerts]
    })

@app.route("/api/servers", methods=["GET"])
def list_servers():
    conn = get_db()
    cursor = conn.cursor()
    
    servers = cursor.execute("SELECT * FROM servers ORDER BY id ASC").fetchall()
    results = []
    
    for s in servers:
        item = dict(s)
        # Parse disk_details JSON
        if item.get("disk_details"):
            try:
                item["disk_details"] = json.loads(item["disk_details"])
            except Exception:
                item["disk_details"] = []
        else:
            item["disk_details"] = []
            
        # Get ports
        ports = cursor.execute(
            "SELECT * FROM server_ports WHERE server_id = ?", (s["id"],)
        ).fetchall()
        item["ports"] = [dict(p) for p in ports]
        results.append(item)
        
    conn.close()
    return jsonify(results)

@app.route("/api/servers/<int:server_id>", methods=["GET"])
def get_server_detail(server_id):
    conn = get_db()
    cursor = conn.cursor()
    
    server = cursor.execute("SELECT * FROM servers WHERE id = ?", (server_id,)).fetchone()
    if not server:
        conn.close()
        return jsonify({"error": "Server not found"}), 404
        
    item = dict(server)
    if item.get("disk_details"):
        try:
            item["disk_details"] = json.loads(item["disk_details"])
        except Exception:
            item["disk_details"] = []
    else:
        item["disk_details"] = []
        
    ports = cursor.execute("SELECT * FROM server_ports WHERE server_id = ?", (server_id,)).fetchall()
    item["ports"] = [dict(p) for p in ports]
    
    # Recent metrics history (last 15 points)
    history = cursor.execute(
        "SELECT * FROM metrics_history WHERE server_id = ? ORDER BY id DESC LIMIT 15", 
        (server_id,)
    ).fetchall()
    item["metrics_history"] = [dict(h) for h in reversed(history)]
    
    # Alerts
    alerts = cursor.execute(
        "SELECT * FROM alert_logs WHERE server_id = ? ORDER BY id DESC LIMIT 10",
        (server_id,)
    ).fetchall()
    item["alerts"] = [dict(a) for a in alerts]
    
    conn.close()
    return jsonify(item)

@app.route("/api/servers", methods=["POST"])
def create_server():
    data = request.json or {}
    name = data.get("name", "").strip()
    host = data.get("host", "").strip()
    os_type = data.get("os_type", "linux").lower()
    os_version = data.get("os_version", "")
    env = data.get("env", "PROD").upper()
    location = data.get("location", "")
    ip_private = data.get("ip_private", "")
    ip_public = data.get("ip_public", "")
    description = data.get("description", "")
    web_url = data.get("web_url", "")
    
    if not name or not host:
        return jsonify({"error": "서버명과 호스트/IP 주소는 필수입니다."}), 400
        
    # Default primary port
    primary_port = int(data.get("primary_port") or (3389 if os_type == "windows" else 22))
    agent_token = secrets.token_hex(12)
    
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("""
        INSERT INTO servers (
            name, host, ip_private, ip_public, os_type, os_version, env,
            location, description, primary_port, web_url, agent_token, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'unknown')
    """, (name, host, ip_private, ip_public, os_type, os_version, env,
          location, description, primary_port, web_url, agent_token))
    server_id = cursor.lastrowid
    
    # Add default ports based on OS
    if os_type == "windows":
        cursor.execute("INSERT INTO server_ports (server_id, port_number, service_name) VALUES (?, ?, ?)",
                       (server_id, 3389, "RDP"))
        cursor.execute("INSERT INTO server_ports (server_id, port_number, service_name) VALUES (?, ?, ?)",
                       (server_id, 445, "SMB"))
        if web_url:
            cursor.execute("INSERT INTO server_ports (server_id, port_number, service_name) VALUES (?, ?, ?)",
                           (server_id, 80, "HTTP"))
    else:
        cursor.execute("INSERT INTO server_ports (server_id, port_number, service_name) VALUES (?, ?, ?)",
                       (server_id, 22, "SSH"))
        if web_url:
            cursor.execute("INSERT INTO server_ports (server_id, port_number, service_name) VALUES (?, ?, ?)",
                           (server_id, 80, "HTTP"))
            
    conn.commit()
    conn.close()
    
    # Immediately trigger a check
    check_single_server(server_id)
    
    return jsonify({"success": True, "server_id": server_id, "token": agent_token}), 201

@app.route("/api/servers/<int:server_id>", methods=["PUT"])
def update_server(server_id):
    data = request.json or {}
    conn = get_db()
    cursor = conn.cursor()
    
    name = data.get("name")
    host = data.get("host")
    ip_private = data.get("ip_private")
    ip_public = data.get("ip_public")
    os_type = data.get("os_type")
    os_version = data.get("os_version")
    env = data.get("env")
    location = data.get("location")
    description = data.get("description")
    primary_port = int(data["primary_port"]) if data.get("primary_port") else None
    web_url = data.get("web_url")
    
    cursor.execute("""
        UPDATE servers SET
            name = COALESCE(?, name),
            host = COALESCE(?, host),
            ip_private = ?,
            ip_public = ?,
            os_type = COALESCE(?, os_type),
            os_version = ?,
            env = COALESCE(?, env),
            location = ?,
            description = ?,
            primary_port = COALESCE(?, primary_port),
            web_url = ?
        WHERE id = ?
    """, (
        name, host, ip_private, ip_public, os_type, os_version,
        env, location, description, primary_port, web_url, server_id
    ))
    
    if primary_port:
        port_service = "RDP" if (os_type == "windows") else "SSH"
        existing_port = cursor.execute(
            "SELECT id FROM server_ports WHERE server_id = ? AND service_name IN ('SSH', 'RDP')", (server_id,)
        ).fetchone()
        if existing_port:
            cursor.execute(
                "UPDATE server_ports SET port_number = ?, service_name = ? WHERE id = ?",
                (primary_port, port_service, existing_port["id"])
            )
        else:
            cursor.execute(
                "INSERT INTO server_ports (server_id, port_number, service_name) VALUES (?, ?, ?)",
                (server_id, primary_port, port_service)
            )

    conn.commit()
    conn.close()

    # Trigger health check immediately after updating
    check_single_server(server_id)

    return jsonify({"success": True})

@app.route("/api/servers/<int:server_id>", methods=["DELETE"])
def delete_server(server_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM servers WHERE id = ?", (server_id,))
    cursor.execute("DELETE FROM server_ports WHERE server_id = ?", (server_id,))
    cursor.execute("DELETE FROM metrics_history WHERE server_id = ?", (server_id,))
    cursor.execute("DELETE FROM alert_logs WHERE server_id = ?", (server_id,))
    conn.commit()
    conn.close()
    return jsonify({"success": True})

@app.route("/api/servers/<int:server_id>/check", methods=["POST"])
def check_server_now(server_id):
    result = check_single_server(server_id)
    if not result:
        return jsonify({"error": "Server not found"}), 404
    return jsonify(result)

@app.route("/api/servers/check-all", methods=["POST"])
def check_all_now():
    results = check_all_servers()
    return jsonify({"success": True, "count": len(results)})

@app.route("/api/agent/report", methods=["POST"])
def agent_report():
    data = request.json or {}
    server_id = data.get("server_id")
    token = data.get("token")
    
    if not server_id:
        return jsonify({"error": "Missing server_id"}), 400
        
    conn = get_db()
    cursor = conn.cursor()
    server = cursor.execute("SELECT * FROM servers WHERE id = ?", (server_id,)).fetchone()
    
    if not server:
        conn.close()
        return jsonify({"error": "Unknown server"}), 404
        
    cpu = float(data.get("cpu_percent", 0))
    memory = float(data.get("memory_percent", 0))
    disk = float(data.get("disk_percent", 0))
    disks_raw = data.get("disk_details", [])
    uptime = data.get("uptime_text", "")
    os_ver = data.get("os_version") or server["os_version"]
    
    disks_json = json.dumps(disks_raw) if isinstance(disks_raw, list) else str(disks_raw)
    
    # Status calculation
    status = "online"
    if cpu >= 85 or memory >= 90 or disk >= 90:
        status = "warning"
        
        # Log alert if warning
        cursor.execute("""
            INSERT INTO alert_logs (server_id, server_name, severity, title, message)
            VALUES (?, ?, 'warning', '자원 사용량 임계치 초과', ?)
        """, (server_id, server["name"], f"CPU: {cpu}%, RAM: {memory}%, Disk: {disk}%"))

    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    cursor.execute("""
        UPDATE servers SET
            cpu_percent = ?,
            memory_percent = ?,
            disk_percent = ?,
            disk_details = ?,
            uptime_text = ?,
            os_version = ?,
            status = ?,
            last_seen = ?
        WHERE id = ?
    """, (cpu, memory, disk, disks_json, uptime, os_ver, status, now_str, server_id))
    
    cursor.execute("""
        INSERT INTO metrics_history (server_id, cpu_percent, memory_percent, disk_percent, latency_ms)
        VALUES (?, ?, ?, ?, ?)
    """, (server_id, cpu, memory, disk, 0))
    
    conn.commit()
    conn.close()
    
    return jsonify({"status": "received", "server_id": server_id})

@app.route("/api/servers/<int:server_id>/rdp")
def download_rdp(server_id):
    """Generates a downloadable Windows .rdp file for instant connection."""
    conn = get_db()
    cursor = conn.cursor()
    server = cursor.execute("SELECT * FROM servers WHERE id = ?", (server_id,)).fetchone()
    conn.close()
    
    if not server:
        return "Server not found", 404
        
    target_ip = server["ip_private"] or server["host"]
    port = server["primary_port"] or 3389
    
    rdp_content = f"""screen mode id:i:2
use multimon:i:0
desktopwidth:i:1920
desktopheight:i:1080
session bpp:i:32
winposstr:s:0,3,0,0,800,600
full address:s:{target_ip}:{port}
compression:i:1
keyboardhook:i:2
audiomode:i:0
redirectprinters:i:0
redirectcomports:i:0
redirectsmartcards:i:0
redirectclipboard:i:1
redirectposdevices:i:0
displayconnectionbar:i:1
autoreconnection enabled:i:1
authentication level:i:2
prompt for credentials:i:1
negotiate security layer:i:1
remoteapplicationmode:i:0
    import urllib.parse
    encoded_filename = urllib.parse.quote(f"{server['name']}.rdp")
    return Response(
        rdp_content,
        mimetype="application/x-rdp; charset=utf-8",
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}"
        }
    )

@app.route("/agents/<path:filename>")
def serve_agent(filename):
    from flask import send_from_directory
    agents_dir = os.path.join(os.path.dirname(__file__), "agents")
    return send_from_directory(agents_dir, filename)

if __name__ == "__main__":
    port = int(os.environ.get("OPSPULSE_PORT", 9500))
    print("=" * 60)
    print("OpsPulse - Server Unified Operations Center")
    print(f"Web Dashboard: http://localhost:{port}")
    print("=" * 60)
    app.run(host="0.0.0.0", port=port, debug=False)
