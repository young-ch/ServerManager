#!/usr/bin/env bash
# ==============================================================================
# OpsPulse Linux Server Lightweight Monitoring Agent
# Compatible with: Ubuntu, Debian, CentOS, Rocky Linux, RHEL
# Usage: ./agent_linux.sh [DASHBOARD_URL] [SERVER_ID] [TOKEN]
# Can be run via crontab: * * * * * /opt/opspulse/agent_linux.sh http://dashboard-ip:9500/api/agent/report 2 SECRET_TOKEN > /dev/null 2>&1
# ==============================================================================

DASHBOARD_URL="${1:-http://localhost:9500/api/agent/report}"
SERVER_ID="${2:-2}"
AGENT_TOKEN="${3:-SECRET_TOKEN}"

# 1. CPU Usage (%)
CPU_IDLE=$(top -bn1 | grep "Cpu(s)" | sed "s/.*, *\([0-9.]*\)%* id.*/\1/" | awk '{print 100 - $1}')
if [ -z "$CPU_IDLE" ]; then
    CPU_IDLE=$(grep 'cpu ' /proc/stat | awk '{usage=($2+$4)*100/($2+$4+$5)} END {print usage}')
fi
CPU_PERCENT=$(printf "%.1f" "$CPU_IDLE" 2>/dev/null || echo "0.0")

# 2. Memory Usage (%)
MEM_TOTAL=$(free -m | awk '/Mem:/ {print $2}')
MEM_AVAILABLE=$(free -m | awk '/Mem:/ {print $7}')
if [ -z "$MEM_AVAILABLE" ]; then
    MEM_FREE=$(free -m | awk '/Mem:/ {print $4}')
    MEM_BUFF=$(free -m | awk '/Mem:/ {print $6}')
    MEM_AVAILABLE=$((MEM_FREE + MEM_BUFF))
fi
MEM_USED=$((MEM_TOTAL - MEM_AVAILABLE))
MEM_PERCENT=$(awk "BEGIN {printf \"%.1f\", ($MEM_USED / $MEM_TOTAL) * 100}")

# 3. Disk Usage (Root filesystem & mounts)
ROOT_DISK_PCT=$(df -P / | awk 'NR==2 {print $5}' | tr -d '%')
DISKS_JSON="["
FIRST=1
while read -r fs total used avail pct mnt; do
    [ "$FIRST" -eq 1 ] && FIRST=0 || DISKS_JSON="${DISKS_JSON},"
    TOTAL_GB=$(awk "BEGIN {printf \"%.1f\", $total / 1048576}")
    FREE_GB=$(awk "BEGIN {printf \"%.1f\", $avail / 1048576}")
    USED_GB=$(awk "BEGIN {printf \"%.1f\", $used / 1048576}")
    CLEAN_PCT=$(echo "$pct" | tr -d '%')
    DISKS_JSON="${DISKS_JSON}{\"name\":\"$mnt\",\"total_gb\":$TOTAL_GB,\"free_gb\":$FREE_GB,\"used_gb\":$USED_GB,\"percent\":$CLEAN_PCT}"
done < <(df -P -x tmpfs -x devtmpfs -x squashfs -x overlay | awk 'NR>1')
DISKS_JSON="${DISKS_JSON}]"

# 4. Uptime text
UPTIME_TEXT=$(uptime -p 2>/dev/null || uptime | awk -F'( |,|:)+' '{print $6,$7",",$8,"hours"}')

# 5. OS Release
OS_VERSION=$(grep PRETTY_NAME /etc/os-release 2>/dev/null | cut -d= -f2 | tr -d '"')
[ -z "$OS_VERSION" ] && OS_VERSION=$(uname -sr)

# 6. Payload JSON
PAYLOAD=$(cat <<EOF
{
  "server_id": $SERVER_ID,
  "token": "$AGENT_TOKEN",
  "cpu_percent": $CPU_PERCENT,
  "memory_percent": $MEM_PERCENT,
  "disk_percent": $ROOT_DISK_PCT,
  "disk_details": $DISKS_JSON,
  "uptime_text": "$UPTIME_TEXT",
  "os_version": "$OS_VERSION"
}
EOF
)

# 7. Send via curl
curl -s -X POST "$DASHBOARD_URL" \
     -H "Content-Type: application/json" \
     -d "$PAYLOAD" \
     --connect-timeout 5 \
     --max-time 10

echo ""
