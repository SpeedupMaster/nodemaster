#!/usr/bin/env bash
# ==============================================================================
# NodeMaster Probe Agent Updater & Hot Sync Activator
# ==============================================================================
set -e

PANEL_URL="{{DEFAULT_PANEL_URL}}"
if [ -f /etc/nodemaster/agent.env ]; then
  . /etc/nodemaster/agent.env
fi

echo "========================================================="
echo "   NodeMaster 探针守护进程升级 (激活全自动配置热同步)   "
echo "========================================================="
echo "控制中心 : ${PANEL_URL}"

if [ -z "${TOKEN}" ]; then
  echo "Error: /etc/nodemaster/agent.env 中未找到 TOKEN，请确保该 VPS 已纳管。"
  exit 1
fi

echo "[1/2] 升级探针至支持全自动热重载版本..."
# 已纳管节点沿用安装时的面板地址；若当时就是明文 HTTP，说明已被显式放行
ALLOW_HTTP=""
case "${PANEL_URL}" in http://*) ALLOW_HTTP="--allow-http" ;; esac
curl -fsSL "${PANEL_URL}/api/install.sh" | bash -s -- --panel "${PANEL_URL}" --token "${TOKEN}" --probe-only ${ALLOW_HTTP}

echo "[2/2] 校验探针运行状态..."
if systemctl is-active --quiet nodemaster-probe; then
  echo "✓ nodemaster-probe 探针守护进程升级成功！"
  echo "✓ 全自动配置热同步已激活！今后在面板修改端口或 SNI 域名，VPS 将在 3 秒内全自动无感生效！"
else
  echo "⚠ 探针状态异常，请执行 systemctl status nodemaster-probe 查看日志"
fi
