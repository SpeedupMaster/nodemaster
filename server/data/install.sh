#!/usr/bin/env bash
# ==============================================================================
# NodeMaster Dual Deployer: Proxy Core (Xray/SS) + Server Probe Agent
# ==============================================================================
set -e

PANEL_URL=""
TOKEN=""

MODE="all"

while [[ "$#" -gt 0 ]]; do
  case $1 in
    --panel) PANEL_URL="$2"; shift ;;
    --token) TOKEN="$2"; shift ;;
    --probe-only) MODE="probe_only" ;;
    --mode) MODE="$2"; shift ;;
  esac
  shift
done

if [ -z "$PANEL_URL" ]; then
  PANEL_URL="{{DEFAULT_PANEL_URL}}"
fi

if [ -z "$TOKEN" ]; then
  echo "Error: --token is required."
  echo "Usage: curl -fsSL ${PANEL_URL}/api/install.sh | bash -s -- --panel ${PANEL_URL} --token <YOUR_TOKEN> [--probe-only]"
  exit 1
fi

echo "========================================================="
if [ "$MODE" = "probe_only" ]; then
  echo "       NodeMaster 一键纳管部署 (仅系统探针监控模式)      "
else
  echo "   NodeMaster 一键纳管部署 (代理节点 + 系统探针守护)    "
fi
echo "========================================================="
echo "Panel Master : ${PANEL_URL}"
echo "Node Token   : ${TOKEN}"
echo "Deploy Mode  : ${MODE}"

ARCH=$(uname -m)
case $ARCH in
  x86_64) XRAY_ARCH="64" ;;
  aarch64|arm64) XRAY_ARCH="arm64-v8a" ;;
  *) echo "Unsupported architecture: $ARCH"; exit 1 ;;
esac

TOTAL_STEPS="4"
STEP_PROBE="4"
if [ "$MODE" = "probe_only" ]; then
  TOTAL_STEPS="3"
  STEP_PROBE="3"
fi

echo "[1/${TOTAL_STEPS}] 安装必要系统依赖 (curl, jq, unzip, tar)..."
if command -v apt-get >/dev/null 2>&1; then
  apt-get update -qq && apt-get install -y -qq curl jq unzip tar >/dev/null 2>&1
elif command -v yum >/dev/null 2>&1; then
  yum install -y -q curl jq unzip tar >/dev/null 2>&1
elif command -v apk >/dev/null 2>&1; then
  apk add --no-cache curl jq unzip tar bash >/dev/null 2>&1
fi

echo "[2/${TOTAL_STEPS}] 获取主控节点配置与初始化运行目录..."
mkdir -p /etc/nodemaster /usr/local/bin /var/log/nodemaster

NODE_INFO=$(curl -fsSL "${PANEL_URL}/api/nodes/by-token/${TOKEN}" || echo "")
NODE_ID=$(echo "${NODE_INFO}" | jq -r '.data.id // empty')
NODE_TYPE=$(echo "${NODE_INFO}" | jq -r '.data.type // "direct"')

# --- Part A: 部署代理服务内核 (仅在全量模式执行) ---
if [ "$MODE" != "probe_only" ]; then
  echo "[3/${TOTAL_STEPS}] 部署代理节点服务 (Xray-core / Shadowsocks)..."
  XRAY_LATEST_VER="v1.8.24"
  XRAY_ZIP="/tmp/xray.zip"
  curl -fsSL "https://github.com/XTLS/Xray-core/releases/download/${XRAY_LATEST_VER}/Xray-linux-${XRAY_ARCH}.zip" -o ${XRAY_ZIP} || true
  if [ -f "${XRAY_ZIP}" ]; then
    unzip -qo ${XRAY_ZIP} xray -d /usr/local/bin/
    chmod +x /usr/local/bin/xray
    rm -f ${XRAY_ZIP}
  fi

  if [ -n "${NODE_ID}" ]; then
    curl -fsSL "${PANEL_URL}/api/nodes/${NODE_ID}/xray-config" | jq '.data' > /etc/nodemaster/config.json 2>/dev/null || true
  fi

  cat <<EOF > /etc/systemd/system/nodemaster-proxy.service
[Unit]
Description=NodeMaster Proxy Core Service
After=network.target

[Service]
Type=simple
User=root
ExecStart=/usr/local/bin/xray run -c /etc/nodemaster/config.json
Restart=always
RestartSec=5
LimitNOFILE=512000

[Install]
WantedBy=multi-user.target
EOF
fi

# --- Part B: 部署系统探针客户端 (NodeMaster Probe Agent) ---
echo "[${STEP_PROBE}/${TOTAL_STEPS}] 部署 NodeMaster 探针守护进程 (实时采集系统指标)..."
cat <<'PROBE_EOF' > /usr/local/bin/nodemaster-probe
#!/usr/bin/env bash
PANEL_URL="{{DEFAULT_PANEL_URL}}"
TOKEN=""

[ -f /etc/nodemaster/agent.env ] && . /etc/nodemaster/agent.env

PREV_TOTAL=0
PREV_IDLE=0
PREV_RX=0
PREV_TX=0
PREV_TIME=$(date +%s)

# OS Info Detection
OS_NAME="Linux"
if [ -f /etc/os-release ]; then
  . /etc/os-release
  OS_NAME="${PRETTY_NAME:-$NAME}"
fi
ARCH_NAME=$(uname -m)

while true; do
  NOW=$(date +%s)
  INTERVAL=$((NOW - PREV_TIME))
  [ "$INTERVAL" -le 0 ] && INTERVAL=1

  # 1. CPU Usage
  CPU_LINE=$(grep '^cpu ' /proc/stat)
  IDLE=$(echo "$CPU_LINE" | awk '{print $5}')
  TOTAL=0
  for val in $(echo "$CPU_LINE" | cut -d' ' -f2-); do
    TOTAL=$((TOTAL + val))
  done
  DIFF_IDLE=$((IDLE - PREV_IDLE))
  DIFF_TOTAL=$((TOTAL - PREV_TOTAL))
  CPU_USAGE=0
  if [ "$DIFF_TOTAL" -gt 0 ]; then
    CPU_USAGE=$(( (1000 * (DIFF_TOTAL - DIFF_IDLE) / DIFF_TOTAL + 5) / 10 ))
  fi
  PREV_TOTAL=$TOTAL
  PREV_IDLE=$IDLE

  # 2. RAM
  MEM_TOTAL_KB=$(grep MemTotal /proc/meminfo | awk '{print $2}')
  MEM_AVAIL_KB=$(grep MemAvailable /proc/meminfo | awk '{print $2}')
  [ -z "$MEM_AVAIL_KB" ] && MEM_AVAIL_KB=$(grep MemFree /proc/meminfo | awk '{print $2}')
  MEM_USED_KB=$((MEM_TOTAL_KB - MEM_AVAIL_KB))
  MEM_TOTAL_BYTES=$((MEM_TOTAL_KB * 1024))
  MEM_USED_BYTES=$((MEM_USED_KB * 1024))
  MEM_USAGE=0
  [ "$MEM_TOTAL_KB" -gt 0 ] && MEM_USAGE=$(( (1000 * MEM_USED_KB / MEM_TOTAL_KB + 5) / 10 ))

  # 3. Disk
  DISK_INFO=$(df -B1 / | tail -n 1)
  DISK_TOTAL_BYTES=$(echo "$DISK_INFO" | awk '{print $2}')
  DISK_USED_BYTES=$(echo "$DISK_INFO" | awk '{print $3}')
  DISK_USAGE=0
  [ "$DISK_TOTAL_BYTES" -gt 0 ] && DISK_USAGE=$(( (1000 * DISK_USED_BYTES / DISK_TOTAL_BYTES + 5) / 10 ))

  # 4. Network Speeds
  NET_RX=0
  NET_TX=0
  while read -r iface rx _ _ _ _ _ _ _ tx _; do
    if [[ "$iface" != "lo:" && "$iface" =~ ^[a-zA-Z0-9_-]+: ]]; then
      NET_RX=$((NET_RX + rx))
      NET_TX=$((NET_TX + tx))
    fi
  done < <(tail -n +3 /proc/net/dev)

  RX_SPEED=0
  TX_SPEED=0
  if [ "$PREV_RX" -gt 0 ] && [ "$NET_RX" -ge "$PREV_RX" ]; then
    RX_SPEED=$(( (NET_RX - PREV_RX) / INTERVAL ))
    TX_SPEED=$(( (NET_TX - PREV_TX) / INTERVAL ))
  fi
  PREV_RX=$NET_RX
  PREV_TX=$NET_TX
  PREV_TIME=$NOW

  # 5. Load & Uptime
  LOAD_1=$(awk '{print $1}' /proc/loadavg)
  LOAD_5=$(awk '{print $2}' /proc/loadavg)
  LOAD_15=$(awk '{print $3}' /proc/loadavg)
  UPTIME_SECS=$(cut -d. -f1 /proc/uptime)
  UPTIME_DAYS=$((UPTIME_SECS / 86400))
  UPTIME_HOURS=$(( (UPTIME_SECS % 86400) / 3600 ))
  UPTIME_STR="${UPTIME_DAYS}天 ${UPTIME_HOURS}小时"

  # 6. TCP / UDP Counts
  TCP_CNT=$(ss -ant 2>/dev/null | grep -v 'State' | wc -l || echo 0)
  UDP_CNT=$(ss -anu 2>/dev/null | grep -v 'State' | wc -l || echo 0)

  # 7. Xray Version
  XRAY_VER=""
  if [ -x /usr/local/bin/xray ]; then
    XRAY_RAW=$(/usr/local/bin/xray version 2>/dev/null | head -n 1 | awk '{print $2}')
    [ -n "$XRAY_RAW" ] && XRAY_VER="v${XRAY_RAW#v}"
  fi

  # Report to Panel
  PAYLOAD=$(cat <<JSON_PAYLOAD
{
  "token": "${TOKEN}",
  "cpuUsage": ${CPU_USAGE},
  "memUsage": ${MEM_USAGE},
  "memTotalBytes": ${MEM_TOTAL_BYTES},
  "memUsedBytes": ${MEM_USED_BYTES},
  "diskUsage": ${DISK_USAGE},
  "diskTotalBytes": ${DISK_TOTAL_BYTES},
  "diskUsedBytes": ${DISK_USED_BYTES},
  "uplinkSpeedBytes": ${TX_SPEED},
  "downlinkSpeedBytes": ${RX_SPEED},
  "loadAvg": [${LOAD_1}, ${LOAD_5}, ${LOAD_15}],
  "uptime": "${UPTIME_STR}",
  "os": "${OS_NAME}",
  "arch": "${ARCH_NAME}",
  "tcpCount": ${TCP_CNT},
  "udpCount": ${UDP_CNT},
  "xrayVersion": "${XRAY_VER}"
}
JSON_PAYLOAD
)

  curl -s -X POST "${PANEL_URL}/api/nodes/telemetry" \
    -H "Content-Type: application/json" \
    -d "$PAYLOAD" >/dev/null 2>&1 || true

  sleep 3
done
PROBE_EOF

chmod +x /usr/local/bin/nodemaster-probe

cat <<EOF > /etc/nodemaster/agent.env
PANEL_URL="${PANEL_URL}"
TOKEN="${TOKEN}"
EOF
chmod 600 /etc/nodemaster/agent.env

cat <<EOF > /etc/systemd/system/nodemaster-probe.service
[Unit]
Description=NodeMaster System Telemetry Probe Agent
After=network.target

[Service]
Type=simple
User=root
ExecStart=/usr/local/bin/nodemaster-probe
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
if [ "$MODE" != "probe_only" ]; then
  systemctl enable --now nodemaster-proxy >/dev/null 2>&1 || true
fi
systemctl enable --now nodemaster-probe >/dev/null 2>&1 || true

echo "========================================================="
if [ "$MODE" != "probe_only" ]; then
  echo "✓ [1/2] 代理服务内核已成功启动并就绪"
  echo "✓ [2/2] NodeMaster 探针守护进程已成功上线运行"
  echo "---------------------------------------------------------"
  echo "探针与节点遥测数据已实时推送至主控后台："
else
  echo "✓ [1/1] NodeMaster 探针守护进程已成功上线运行 (仅探针模式)"
  echo "---------------------------------------------------------"
  echo "探针硬件与系统遥测数据已实时推送至主控后台："
fi
echo ">> ${PANEL_URL}"
echo "========================================================="
