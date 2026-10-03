import { db } from "../db/index.js";
import { NodeItem, TelegramConfig, TelegramAlertLog } from "../types/index.js";

class TelegramService {
  private lastKnownStatus = new Map<string, string>(); // nodeId -> status
  private alertCooldowns = new Map<string, number>(); // key -> timestamp

  // Helper to format date
  private formatDate(timestamp: number = Date.now()): string {
    const d = new Date(timestamp);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const h = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    const s = String(d.getSeconds()).padStart(2, "0");
    return `${y}-${m}-${day} ${h}:${min}:${s}`;
  }

  // Core send function
  public async sendMessage(
    text: string,
    overrideConfig?: Partial<TelegramConfig>
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    const config = { ...db.getTelegramConfig(), ...overrideConfig };

    if (!config.botToken || !config.chatId) {
      return { success: false, error: "未配置 Telegram Bot Token 或 Chat ID" };
    }

    const endpoint = (config.apiEndpoint || "https://api.telegram.org").replace(/\/+$/, "");
    const url = `${endpoint}/bot${config.botToken}/sendMessage`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: config.chatId,
          text,
          parse_mode: "HTML",
          disable_web_page_preview: true,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);
      const data = await response.json() as any;

      if (!response.ok || !data.ok) {
        const errorMsg = data?.description || `HTTP ${response.status} ${response.statusText}`;
        return { success: false, error: errorMsg };
      }

      return { success: true, message: "消息已成功送达 Telegram" };
    } catch (err: any) {
      clearTimeout(timeout);
      const isTimeout = err.name === "AbortError";
      const errorMsg = isTimeout ? "请求 Telegram API 超时 (10s)，请检查网络或配置反代地址" : err.message;
      return { success: false, error: errorMsg };
    }
  }

  // Record an alert log
  private logAlert(log: Omit<TelegramAlertLog, "id">) {
    const id = `tglog_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    db.addTelegramLog({ ...log, id });
  }

  // Check cooldown helper (cooldownMs: e.g. 15min = 900000, 6h = 21600000, 24h = 86400000)
  private isCoolingDown(key: string, cooldownMs: number): boolean {
    const last = this.alertCooldowns.get(key);
    if (!last) return false;
    return Date.now() - last < cooldownMs;
  }

  private setCooldown(key: string) {
    this.alertCooldowns.set(key, Date.now());
  }

  // Periodic Telemetry Alerts Check
  public async checkNodeAlerts(nodes: NodeItem[]) {
    const config = db.getTelegramConfig();
    if (!config.enabled || !config.botToken || !config.chatId) return;

    for (const node of nodes) {
      const prevStatus = this.lastKnownStatus.get(node.id) || "online";
      this.lastKnownStatus.set(node.id, node.status);

      // 1. 离线通知 / 恢复在线通知 (Offline / Recovery)
      if (config.offlineAlert) {
        if (prevStatus === "online" && (node.status === "offline" || node.status === "circuit_broken")) {
          const isCircuit = node.status === "circuit_broken";
          const title = isCircuit ? "⚠️ 节点熔断告警" : "🔴 节点离线告警";
          const msg = `<b>${title}</b>\n\n` +
            `<b>节点标识:</b> ${node.name}\n` +
            `<b>连接地址:</b> <code>${node.ip}:${node.port}</code>\n` +
            `<b>节点区域:</b> ${node.countryName || node.country} (${node.country})\n` +
            `<b>当前状态:</b> ${isCircuit ? "触发熔断保护 (Circuit Broken)" : "已离线 (Offline)"}\n` +
            `<b>告警时间:</b> ${this.formatDate()}`;

          const res = await this.sendMessage(msg);
          this.logAlert({
            type: "offline",
            nodeId: node.id,
            nodeName: node.name,
            title,
            message: `节点 ${node.name} (${node.ip}) ${isCircuit ? "已熔断" : "已离线"}`,
            timestamp: Date.now(),
            success: res.success,
            error: res.error,
          });
        } else if ((prevStatus === "offline" || prevStatus === "circuit_broken") && node.status === "online") {
          const title = "🟢 节点恢复上线";
          const msg = `<b>${title}</b>\n\n` +
            `<b>节点标识:</b> ${node.name}\n` +
            `<b>连接地址:</b> <code>${node.ip}:${node.port}</code>\n` +
            `<b>当前延迟:</b> ${node.latencyMs} ms\n` +
            `<b>恢复时间:</b> ${this.formatDate()}`;

          const res = await this.sendMessage(msg);
          this.logAlert({
            type: "recovery",
            nodeId: node.id,
            nodeName: node.name,
            title,
            message: `节点 ${node.name} (${node.ip}) 已恢复在线`,
            timestamp: Date.now(),
            success: res.success,
            error: res.error,
          });
        }
      }

      // If node is offline, skip live hardware metric alerts
      if (node.status !== "online") continue;

      // 2. 流量超额预警 (Traffic Warning)
      if (config.trafficAlert && node.trafficLimitBytes > 0) {
        const pct = (node.trafficUsedBytes / node.trafficLimitBytes) * 100;
        const cooldownKey = `traffic:${node.id}`;
        if (pct >= config.trafficThresholdPercent && !this.isCoolingDown(cooldownKey, 6 * 3600 * 1000)) {
          this.setCooldown(cooldownKey);
          const usedGB = (node.trafficUsedBytes / (1024 * 1024 * 1024)).toFixed(1);
          const limitGB = (node.trafficLimitBytes / (1024 * 1024 * 1024)).toFixed(0);
          const title = "⚠️ 流量额度预警";
          const msg = `<b>${title}</b>\n\n` +
            `<b>节点标识:</b> ${node.name}\n` +
            `<b>已用流量:</b> ${usedGB} GB / ${limitGB} GB (<b>${pct.toFixed(1)}%</b>)\n` +
            `<b>预警阈值:</b> ${config.trafficThresholdPercent}%\n` +
            `<b>配额重置:</b> 每月 ${node.trafficResetDay || 1} 日\n` +
            `<b>告警时间:</b> ${this.formatDate()}`;

          const res = await this.sendMessage(msg);
          this.logAlert({
            type: "traffic",
            nodeId: node.id,
            nodeName: node.name,
            title,
            message: `流量已消耗 ${pct.toFixed(1)}% (阈值: ${config.trafficThresholdPercent}%)`,
            timestamp: Date.now(),
            success: res.success,
            error: res.error,
          });
        }
      }

      // 3. VPS 续费到期提醒 (Renewal Alert)
      if (config.renewalAlert && node.expiresAt) {
        const target = new Date(node.expiresAt + "T23:59:59");
        if (!isNaN(target.getTime())) {
          const diffDays = Math.ceil((target.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          const cooldownKey = `renewal:${node.id}`;
          if (diffDays <= config.renewalDaysAhead && !this.isCoolingDown(cooldownKey, 24 * 3600 * 1000)) {
            this.setCooldown(cooldownKey);
            const isExpired = diffDays <= 0;
            const title = isExpired ? "🚨 VPS 已过期提醒" : "📅 VPS 续费到期提醒";
            const costStr = node.costAmount
              ? `${node.costCurrency === "USD" ? "$" : node.costCurrency === "EUR" ? "€" : "¥"}${node.costAmount} / ${node.costPeriod === "annually" ? "年付" : node.costPeriod === "quarterly" ? "季付" : "月付"}`
              : "未设置费用金额";

            const msg = `<b>${title}</b>\n\n` +
              `<b>节点标识:</b> ${node.name}\n` +
              `<b>公网 IP:</b> <code>${node.ip}</code>\n` +
              `<b>到期日期:</b> <code>${node.expiresAt}</code> (<b>${isExpired ? "已过期" : `剩余 ${diffDays} 天`}</b>)\n` +
              `<b>续费周期:</b> ${costStr}\n` +
              `<b>自动续费:</b> ${node.autoRenew ? "✅ 已开启自动续费" : "⚠️ 未开启自动续费 (请及时手动续期)"}\n` +
              `<b>提醒时间:</b> ${this.formatDate()}`;

            const res = await this.sendMessage(msg);
            this.logAlert({
              type: "renewal",
              nodeId: node.id,
              nodeName: node.name,
              title,
              message: `${node.name} 到期日 ${node.expiresAt} (${isExpired ? "已过期" : `剩余 ${diffDays} 天`})`,
              timestamp: Date.now(),
              success: res.success,
              error: res.error,
            });
          }
        }
      }

      // 4. CPU 占用率过高预警 (CPU Usage Alert)
      if (config.cpuAlert) {
        const cooldownKey = `cpu:${node.id}`;
        if (node.cpuUsage >= config.cpuThresholdPercent && !this.isCoolingDown(cooldownKey, 15 * 60 * 1000)) {
          this.setCooldown(cooldownKey);
          const title = "🔥 CPU 占用过高预警";
          const msg = `<b>${title}</b>\n\n` +
            `<b>节点标识:</b> ${node.name}\n` +
            `<b>公网 IP:</b> <code>${node.ip}</code>\n` +
            `<b>当前 CPU:</b> <b>${node.cpuUsage}%</b> (阈值: ${config.cpuThresholdPercent}%)\n` +
            `<b>系统负载:</b> ${node.loadAvg ? node.loadAvg.join(", ") : "N/A"}\n` +
            `<b>在线时长:</b> ${node.uptime || "N/A"}\n` +
            `<b>告警时间:</b> ${this.formatDate()}`;

          const res = await this.sendMessage(msg);
          this.logAlert({
            type: "cpu",
            nodeId: node.id,
            nodeName: node.name,
            title,
            message: `CPU 占用高达 ${node.cpuUsage}% (阈值: ${config.cpuThresholdPercent}%)`,
            timestamp: Date.now(),
            success: res.success,
            error: res.error,
          });
        }
      }

      // 5. 内存占用预警 (RAM Usage Alert)
      if (config.memAlert) {
        const cooldownKey = `mem:${node.id}`;
        if (node.memUsage >= config.memThresholdPercent && !this.isCoolingDown(cooldownKey, 15 * 60 * 1000)) {
          this.setCooldown(cooldownKey);
          const memTotalGB = ((node.memTotalBytes || 2147483648) / (1024 * 1024 * 1024)).toFixed(1);
          const memUsedGB = ((node.memUsedBytes || 0) / (1024 * 1024 * 1024)).toFixed(1);
          const title = "💾 内存耗尽预警";
          const msg = `<b>${title}</b>\n\n` +
            `<b>节点标识:</b> ${node.name}\n` +
            `<b>公网 IP:</b> <code>${node.ip}</code>\n` +
            `<b>当前内存:</b> <b>${node.memUsage}%</b> (阈值: ${config.memThresholdPercent}%)\n` +
            `<b>内存使用:</b> ${memUsedGB} GB / ${memTotalGB} GB\n` +
            `<b>告警时间:</b> ${this.formatDate()}`;

          const res = await this.sendMessage(msg);
          this.logAlert({
            type: "mem",
            nodeId: node.id,
            nodeName: node.name,
            title,
            message: `内存占用高达 ${node.memUsage}% (阈值: ${config.memThresholdPercent}%)`,
            timestamp: Date.now(),
            success: res.success,
            error: res.error,
          });
        }
      }
    }
  }

  // Simulation method for UI testing
  public async simulateAlert(type: string, nodeId?: string): Promise<{ success: boolean; message?: string; error?: string }> {
    const node = (nodeId ? db.getNodeById(nodeId) : null) || db.getNodes()[0] || {
      id: "demo-node-01",
      name: "HK-BGP-Direct-Demo",
      ip: "103.21.244.88",
      port: 443,
      country: "HK",
      countryName: "中国香港",
      status: "online",
      cpuUsage: 93.4,
      memUsage: 89.1,
      trafficUsedBytes: 860 * 1024 * 1024 * 1024,
      trafficLimitBytes: 1000 * 1024 * 1024 * 1024,
      expiresAt: "2026-10-10",
      autoRenew: false,
      costAmount: 38,
      costCurrency: "CNY",
      costPeriod: "monthly",
    };

    let title = "";
    let msg = "";

    switch (type) {
      case "offline":
        title = "🔴 节点离线告警 (测试模拟)";
        msg = `<b>${title}</b>\n\n` +
          `<b>节点标识:</b> ${node.name}\n` +
          `<b>连接地址:</b> <code>${node.ip}:${node.port}</code>\n` +
          `<b>节点区域:</b> ${node.countryName || node.country}\n` +
          `<b>当前状态:</b> 离线 (Offline - 模拟已掉线)\n` +
          `<b>告警时间:</b> ${this.formatDate()}`;
        break;

      case "traffic":
        title = "⚠️ 流量额度预警 (测试模拟)";
        msg = `<b>${title}</b>\n\n` +
          `<b>节点标识:</b> ${node.name}\n` +
          `<b>已用流量:</b> 860 GB / 1000 GB (<b>86.0%</b>)\n` +
          `<b>预警阈值:</b> 80%\n` +
          `<b>重置日期:</b> 每月 1 日\n` +
          `<b>告警时间:</b> ${this.formatDate()}`;
        break;

      case "renewal":
        title = "📅 VPS 续费到期提醒 (测试模拟)";
        msg = `<b>${title}</b>\n\n` +
          `<b>节点标识:</b> ${node.name}\n` +
          `<b>公网 IP:</b> <code>${node.ip}</code>\n` +
          `<b>到期日期:</b> <code>${node.expiresAt || "2026-10-10"}</code> (<b>剩余 7 天</b>)\n` +
          `<b>续费周期:</b> ¥38 / 月付\n` +
          `<b>自动续费:</b> ⚠️ 未开启自动续费 (请及时手动续期)\n` +
          `<b>提醒时间:</b> ${this.formatDate()}`;
        break;

      case "cpu":
        title = "🔥 CPU 占用过高预警 (测试模拟)";
        msg = `<b>${title}</b>\n\n` +
          `<b>节点标识:</b> ${node.name}\n` +
          `<b>公网 IP:</b> <code>${node.ip}</code>\n` +
          `<b>当前 CPU:</b> <b>93.4%</b> (预警阈值: 85%)\n` +
          `<b>系统负载:</b> 2.14, 1.85, 1.20\n` +
          `<b>在线时长:</b> 28天 14小时\n` +
          `<b>告警时间:</b> ${this.formatDate()}`;
        break;

      case "mem":
        title = "💾 内存耗尽预警 (测试模拟)";
        msg = `<b>${title}</b>\n\n` +
          `<b>节点标识:</b> ${node.name}\n` +
          `<b>公网 IP:</b> <code>${node.ip}</code>\n` +
          `<b>当前内存:</b> <b>89.1%</b> (预警阈值: 85%)\n` +
          `<b>内存使用:</b> 1.78 GB / 2.00 GB\n` +
          `<b>告警时间:</b> ${this.formatDate()}`;
        break;

      default:
        title = "✅ NodeMaster Telegram 通知测试";
        msg = `<b>${title}</b>\n\n` +
          `恭喜！NodeMaster 与 Telegram Bot 通知通道链路测试成功！\n\n` +
          `• 离线通知：已就绪\n` +
          `• 流量预警：已就绪\n` +
          `• 续费到期提醒：已就绪\n` +
          `• CPU / 内存高负载预警：已就绪\n\n` +
          `<b>测试时间:</b> ${this.formatDate()}`;
    }

    const res = await this.sendMessage(msg);
    this.logAlert({
      type: type as any,
      nodeId: node.id,
      nodeName: node.name,
      title,
      message: res.success ? `成功推送模拟告警: ${title}` : `推送失败: ${res.error}`,
      timestamp: Date.now(),
      success: res.success,
      error: res.error,
    });

    return res;
  }
}

export const telegramService = new TelegramService();
