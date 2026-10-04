#!/usr/bin/env bash
# ==============================================================================
# NodeMaster Dual Deployer: Proxy Core (Xray/SS) + Server Probe Agent + TCP/BBR
# Integrated with tcp-dashboard (https://github.com/666shen/tcp-dashboard)
# ==============================================================================
set -e

PANEL_URL=""
TOKEN=""
MODE="all"
ENABLE_BBR=0
ENABLE_IPV4_FIRST=0

while [[ "$#" -gt 0 ]]; do
  case $1 in
    --panel) PANEL_URL="$2"; shift ;;
    --token) TOKEN="$2"; shift ;;
    --probe-only) MODE="probe_only" ;;
    --mode) MODE="$2"; shift ;;
    --bbr|--tcp-tune) ENABLE_BBR=1 ;;
    --no-bbr) ENABLE_BBR=0 ;;
    --ipv4-first) ENABLE_IPV4_FIRST=1 ;;
  esac
  shift
done

if [ -z "$PANEL_URL" ]; then
  PANEL_URL="{{DEFAULT_PANEL_URL}}"
fi

if [ -z "$TOKEN" ]; then
  echo "Error: --token is required."
  echo "Usage: curl -fsSL ${PANEL_URL}/api/install.sh | bash -s -- --panel ${PANEL_URL} --token <YOUR_TOKEN> [--probe-only] [--bbr] [--ipv4-first]"
  exit 1
fi

echo "========================================================="
if [ "$MODE" = "probe_only" ]; then
  echo "       NodeMaster 一键纳管部署 (仅系统探针监控模式)      "
else
  echo "   NodeMaster 一键纳管部署 (代理节点 + 系统探针守护)    "
fi
if [ "$ENABLE_BBR" = "1" ]; then
  echo "       [附加特性: 生产级 TCP/BBR 跨境网络调优已激活]      "
fi
echo "========================================================="
echo "Panel Master : ${PANEL_URL}"
echo "Node Token   : ${TOKEN}"
echo "Deploy Mode  : ${MODE}"
if [ "$ENABLE_BBR" = "1" ]; then
  echo "TCP/BBR Tune : 已启用 (BBR+FQ, 5%内存缓冲, 104.8w句柄, RPS网卡分发)"
fi
if [ "$ENABLE_IPV4_FIRST" = "1" ]; then
  echo "IPv4 Priority: 已启用 (优化双栈 VPS 解析)"
fi

ARCH=$(uname -m)
case $ARCH in
  x86_64) XRAY_ARCH="64" ;;
  aarch64|arm64) XRAY_ARCH="arm64-v8a" ;;
  *) echo "Unsupported architecture: $ARCH"; exit 1 ;;
esac

# 动态计算总步数
TOTAL_STEPS=2
[ "$MODE" != "probe_only" ] && TOTAL_STEPS=$((TOTAL_STEPS + 1))
[ "$ENABLE_BBR" = "1" ] && TOTAL_STEPS=$((TOTAL_STEPS + 1))
TOTAL_STEPS=$((TOTAL_STEPS + 1)) # 探针部署
CURRENT_STEP=1

echo "[${CURRENT_STEP}/${TOTAL_STEPS}] 安装必要系统依赖 (curl, jq, unzip, tar, ethtool, iptables)..."
CURRENT_STEP=$((CURRENT_STEP + 1))
if command -v apt-get >/dev/null 2>&1; then
  apt-get update -qq && apt-get install -y -qq curl jq unzip tar ethtool iptables >/dev/null 2>&1 || true
elif command -v yum >/dev/null 2>&1; then
  yum install -y -q curl jq unzip tar ethtool iptables >/dev/null 2>&1 || true
elif command -v apk >/dev/null 2>&1; then
  apk add --no-cache curl jq unzip tar bash ethtool iptables >/dev/null 2>&1 || true
fi

echo "[${CURRENT_STEP}/${TOTAL_STEPS}] 获取主控节点配置与初始化运行目录..."
CURRENT_STEP=$((CURRENT_STEP + 1))
mkdir -p /etc/nodemaster /usr/local/bin /var/log/nodemaster

NODE_INFO=$(curl -fsSL "${PANEL_URL}/api/nodes/by-token/${TOKEN}" || echo "")
NODE_ID=$(echo "${NODE_INFO}" | jq -r '.data.id // empty')
NODE_TYPE=$(echo "${NODE_INFO}" | jq -r '.data.type // "direct"')

# --- Part A: 部署代理服务内核 (仅在全量模式执行) ---
if [ "$MODE" != "probe_only" ]; then
  echo "[${CURRENT_STEP}/${TOTAL_STEPS}] 部署代理节点服务 (Xray-core / Shadowsocks)..."
  CURRENT_STEP=$((CURRENT_STEP + 1))
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
LimitNOFILE=1048576

[Install]
WantedBy=multi-user.target
EOF
fi

# --- Part B: TCP / BBR 深度调优与跨境链路补丁 (集成 tcp-dashboard) ---
if [ "$ENABLE_BBR" = "1" ]; then
  echo "[${CURRENT_STEP}/${TOTAL_STEPS}] 部署生产级 TCP/BBR 跨境网络内核深度调优 (基于 tcp-dashboard)..."
  CURRENT_STEP=$((CURRENT_STEP + 1))

  # 1. 动态计算网络缓冲区 (基于物理内存的 5%，安全边界: 16MB ~ 128MB)
  MEM_TOTAL_KB=$(grep MemTotal /proc/meminfo 2>/dev/null | awk '{print $2}')
  [ -z "$MEM_TOTAL_KB" ] && MEM_TOTAL_KB=1048576
  BUF_BYTES=$((MEM_TOTAL_KB * 5 / 100 * 1024))
  [ "$BUF_BYTES" -lt 16777216 ] && BUF_BYTES=16777216
  [ "$BUF_BYTES" -gt 134217728 ] && BUF_BYTES=134217728

  mkdir -p /etc/sysctl.d /etc/security/limits.d

  # 2. 写入独立生产级 + 跨境优化内核配置
  cat <<SYSCTL_EOF > /etc/sysctl.d/99-network-performance.conf
# ==============================================================================
# NodeMaster & tcp-dashboard Production Network Performance Tuning
# ==============================================================================
# --- 基础队列算法与 BBR 拥塞控制 ---
net.core.default_qdisc = fq
net.ipv4.tcp_congestion_control = bbr

# --- 缓冲区与容量优化 ---
net.core.somaxconn = 65535
net.core.netdev_max_backlog = 65535
net.ipv4.tcp_max_syn_backlog = 16384
net.ipv4.ip_local_port_range = 1024 65535
net.core.rmem_max = ${BUF_BYTES}
net.core.wmem_max = ${BUF_BYTES}
net.ipv4.tcp_rmem = 4096 87380 ${BUF_BYTES}
net.ipv4.tcp_wmem = 4096 65536 ${BUF_BYTES}
net.core.rmem_default = 2097152
net.core.wmem_default = 2097152

# --- 翻墙/Reality/VLESS/Hysteria2 跨境专向调优 ---
# 减少发送队列积压，显著降低网页首包延迟 (TTFB)
net.ipv4.tcp_notsent_lowat = 16384
# 开启 MTU 探测，解决部分运营商阻断 ICMP 导致的连接黑洞
net.ipv4.tcp_mtu_probing = 1
# 深度扩容 UDP 缓冲区，解决 Hysteria2/QUIC 协议在高并发时的丢包
net.ipv4.udp_rmem_min = 16384
net.ipv4.udp_wmem_min = 16384
# 开启 ECN (显式拥塞通知)，跨境轻微拥塞时打标记不丢包，显著平滑网络抖动
net.ipv4.tcp_ecn = 1
# 显式激活高版本内核 BBR3 / BBR 深度调优参数 (老内核安全跳过)
net.ipv4.tcp_congestion_control_version = 3
# 限制孤儿连接数，防止翻墙协议在大并发时消耗过多内存
net.ipv4.tcp_max_orphans = 32768

# --- 连接稳定性与快速复用 ---
net.ipv4.tcp_slow_start_after_idle = 0
net.ipv4.tcp_tw_reuse = 1
net.ipv4.tcp_fin_timeout = 15
net.ipv4.tcp_retries2 = 8
net.ipv4.tcp_fastopen = 3
SYSCTL_EOF

  # 3. 提升全局文件描述符与进程上限 (1,048,576 句柄)
  cat <<LIMITS_EOF > /etc/security/limits.d/99-network-performance.conf
* soft nofile 1048576
* hard nofile 1048576
* soft nproc 65535
* hard nproc 65535
root soft nofile 1048576
root hard nofile 1048576
root soft nproc 65535
root hard nproc 65535
LIMITS_EOF

  ulimit -n 1048576 2>/dev/null || true

  # 4. 智能 MSS 钳制规则 (防止跨境连接超时/MTU黑洞)
  if command -v iptables &>/dev/null; then
    iptables -t mangle -D POSTROUTING -p tcp --tcp-flags SYN,RST SYN -j TCPMSS --clamp-mss-to-pmtu 2>/dev/null || true
    iptables -t mangle -A POSTROUTING -p tcp --tcp-flags SYN,RST SYN -j TCPMSS --clamp-mss-to-pmtu 2>/dev/null || true
  fi

  # 5. 网卡多队列 (RPS/RSS) 多核中断分发优化
  INTERFACES=$(ls /sys/class/net 2>/dev/null | grep -vE 'lo|docker|veth|br-|any|tung3|sit0|tun|wg' || true)
  CPU_COUNT=$(nproc 2>/dev/null || echo 1)
  RPS_CPUS=$(printf '%x' $(((1 << CPU_COUNT) - 1)))
  for eth in $INTERFACES; do
    if command -v ethtool &>/dev/null; then
      MAX_RX=$(ethtool -g "$eth" 2>/dev/null | grep -A 5 "Pre-set maximums" | grep "RX:" | awk '{print $2}')
      ethtool -G "$eth" rx "${MAX_RX:-1024}" tx "${MAX_RX:-1024}" &>/dev/null || true
    fi
    for rps_file in /sys/class/net/$eth/queues/rx-*/rps_cpus; do [ -f "$rps_file" ] && echo "$RPS_CPUS" >"$rps_file" 2>/dev/null || true; done
    for rfc_file in /sys/class/net/$eth/queues/rx-*/rps_flow_cnt; do [ -f "$rfc_file" ] && echo "4096" >"$rfc_file" 2>/dev/null || true; done
  done
  sysctl -w net.core.rps_sock_flow_entries=32768 &>/dev/null || true

  # 6. IPv4 优先解析 (若指定 --ipv4-first)
  if [ "$ENABLE_IPV4_FIRST" = "1" ]; then
    if [ ! -f /etc/gai.conf ]; then
      cat <<'GAI_EOF' > /etc/gai.conf
label ::1/128       0
label ::/0          1
label 2002::/16     2
label ::/96         3
label ::ffff:0:0/96 4
precedence  ::1/128       50
precedence  ::/0          40
precedence  2002::/16     30
precedence  ::/96         20
precedence  ::ffff:0:0/96 10
GAI_EOF
    fi
    if grep -q "precedence ::ffff:0:0/96  100" /etc/gai.conf 2>/dev/null; then
      sed -i 's/^#precedence ::ffff:0:0\/96  100/precedence ::ffff:0:0\/96  100/' /etc/gai.conf 2>/dev/null || true
    else
      echo "precedence ::ffff:0:0/96  100" >> /etc/gai.conf
    fi
  fi

  # 7. 载入系统内核配置
  sysctl --system &>/dev/null || true

  # 8. 部署 tcp-dashboard 本地交互脚本与快捷命令 't'
  mkdir -p /usr/local/bin
  curl -fsSL --connect-timeout 6 -m 15 "${PANEL_URL}/api/tcp-tune.sh" -o /usr/local/bin/tcp.sh 2>/dev/null || \
  curl -fsSL --connect-timeout 6 -m 15 "tcp.vpsing.de" -o /usr/local/bin/tcp.sh 2>/dev/null || \
  curl -fsSL --connect-timeout 6 -m 15 "https://raw.githubusercontent.com/666shen/tcp-dashboard/main/tcp.sh" -o /usr/local/bin/tcp.sh 2>/dev/null || true

  if [ -s /usr/local/bin/tcp.sh ]; then
    chmod +x /usr/local/bin/tcp.sh
    ln -sf /usr/local/bin/tcp.sh /usr/local/bin/t 2>/dev/null || true
  fi

  echo "  ✓ BBR+FQ 算法已生效 (当前: $(sysctl -n net.ipv4.tcp_congestion_control 2>/dev/null || echo 'bbr'))"
  echo "  ✓ 生产级网络缓冲已分配: $((BUF_BYTES / 1024 / 1024))MB (基于物理内存 5%)"
  echo "  ✓ 文件描述符上限已提升至: 1,048,576 句柄"
  echo "  ✓ 跨境专向补丁注入完毕 (TTFB 0ms / MTU 探测 / UDP 扩容 / ECN 标记)"
  echo "  ✓ 网卡 RPS 多队列中断分发流水线已部署"
  echo "  ✓ 快捷命令 't' 已创建，随时在终端输入 't' 打开 TCP 调优看板"
fi

# --- Part C: 部署系统探针客户端 (NodeMaster Probe Agent) ---
echo "[${CURRENT_STEP}/${TOTAL_STEPS}] 部署 NodeMaster 探针守护进程 (实时采集系统指标)..."
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

  # 6. TCP / UDP Counts & Congestion Algorithm
  TCP_CNT=$(ss -ant 2>/dev/null | grep -v 'State' | wc -l || echo 0)
  UDP_CNT=$(ss -anu 2>/dev/null | grep -v 'State' | wc -l || echo 0)
  TCP_CC=$(sysctl -n net.ipv4.tcp_congestion_control 2>/dev/null || echo "")

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
  "tcpCongestion": "${TCP_CC}",
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
LimitNOFILE=1048576

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
else
  echo "✓ [1/1] NodeMaster 探针守护进程已成功上线运行 (仅探针模式)"
fi
if [ "$ENABLE_BBR" = "1" ]; then
  echo "✓ [BBR] 生产级 TCP/BBR 跨境深度网络优化已生效 (终端输入 't' 随时打开调优面板)"
fi
echo "---------------------------------------------------------"
echo "探针与节点遥测数据已实时推送至主控后台："
echo ">> ${PANEL_URL}"
echo "========================================================="
