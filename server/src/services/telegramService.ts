import { db } from "../db/index.js";
import { newId } from "./security.js";
import { DAY, GB, HOUR, MINUTE } from "../constants.js";
import type { NodeItem, TelegramConfig, TelegramAlertType } from "../types/index.js";

// Telegram HTML parse mode rejects the whole message on unescaped <, > or &
const esc = (value: unknown) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const formatDate = (timestamp = Date.now()) => {
  const d = new Date(timestamp);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};

const COOLDOWN_MS: Partial<Record<TelegramAlertType, number>> = { offline: 10 * MINUTE, traffic: 6 * HOUR, renewal: DAY, cpu: 15 * MINUTE, mem: 15 * MINUTE };
const CURRENCY_SYMBOL: Record<string, string> = { USD: "$", EUR: "€" };
const PERIOD_LABEL: Record<string, string> = { annually: "年付", quarterly: "季付" };

interface Alert { title: string; html: string; summary: string }

/** Days until the end of the node's expiry date (negative once expired), or null without a valid date. */
function daysUntilExpiry(node: NodeItem): number | null {
  const target = new Date(`${node.expiresAt}T23:59:59`).getTime();
  return node.expiresAt && !Number.isNaN(target) ? Math.ceil((target - Date.now()) / DAY) : null;
}

/** Message for one alert about `node`; shared by real alerts and the "send a sample" button. */
function buildAlert(type: TelegramAlertType, node: NodeItem, cfg: TelegramConfig): Alert {
  const lines = (title: string, rows: [string, string][], summary: string): Alert => ({
    title,
    html: `<b>${title}</b>\n\n${rows.map(([k, v]) => `<b>${k}:</b> ${v}`).join("\n")}\n<b>时间:</b> ${formatDate()}`,
    summary,
  });
  const name = esc(node.name), ip = `<code>${esc(node.ip)}</code>`;
  switch (type) {
    case "offline": {
      const broken = node.status === "circuit_broken";
      return lines(broken ? "⚠️ 节点熔断告警" : "🔴 节点离线告警", [
        ["节点标识", name],
        ["连接地址", `<code>${esc(node.ip)}:${node.port}</code>`],
        ["节点区域", `${esc(node.countryName || node.country)} (${esc(node.country)})`],
        ["当前状态", broken ? "触发熔断保护 (Circuit Broken)" : "已离线 (Offline)"],
      ], `节点 ${node.name} (${node.ip}) ${broken ? "已熔断" : "已离线"}`);
    }
    case "recovery":
      return lines("🟢 节点恢复上线", [
        ["节点标识", name],
        ["连接地址", `<code>${esc(node.ip)}:${node.port}</code>`],
        ["当前延迟", `${node.latencyMs} ms`],
      ], `节点 ${node.name} (${node.ip}) 已恢复在线`);
    case "traffic": {
      const pct = node.trafficLimitBytes > 0 ? (node.trafficUsedBytes / node.trafficLimitBytes) * 100 : 0;
      return lines("⚠️ 流量额度预警", [
        ["节点标识", name],
        ["已用流量", `${(node.trafficUsedBytes / GB).toFixed(1)} GB / ${(node.trafficLimitBytes / GB).toFixed(0)} GB (<b>${pct.toFixed(1)}%</b>)`],
        ["预警阈值", `${cfg.trafficThresholdPercent}%`],
        ["配额重置", `每月 ${node.trafficResetDay || 1} 日`],
      ], `流量已消耗 ${pct.toFixed(1)}% (阈值: ${cfg.trafficThresholdPercent}%)`);
    }
    case "renewal": {
      const days = daysUntilExpiry(node);
      const remaining = days === null ? "未设置" : days <= 0 ? "已过期" : `剩余 ${days} 天`;
      const cost = node.costAmount
        ? `${CURRENCY_SYMBOL[node.costCurrency || ""] || "¥"}${node.costAmount} / ${PERIOD_LABEL[node.costPeriod || ""] || "月付"}`
        : "未设置费用金额";
      return lines(days !== null && days <= 0 ? "🚨 VPS 已过期提醒" : "📅 VPS 续费到期提醒", [
        ["节点标识", name],
        ["公网 IP", ip],
        ["到期日期", `<code>${esc(node.expiresAt || "-")}</code> (<b>${remaining}</b>)`],
        ["续费周期", cost],
        ["自动续费", node.autoRenew ? "✅ 已开启自动续费" : "⚠️ 未开启自动续费 (请及时手动续期)"],
      ], `${node.name} 到期日 ${node.expiresAt || "-"} (${remaining})`);
    }
    case "cpu":
      return lines("🔥 CPU 占用过高预警", [
        ["节点标识", name],
        ["公网 IP", ip],
        ["当前 CPU", `<b>${node.cpuUsage}%</b> (阈值: ${cfg.cpuThresholdPercent}%)`],
        ["系统负载", node.loadAvg ? node.loadAvg.join(", ") : "N/A"],
        ["在线时长", esc(node.uptime || "N/A")],
      ], `CPU 占用高达 ${node.cpuUsage}% (阈值: ${cfg.cpuThresholdPercent}%)`);
    case "mem":
      return lines("💾 内存耗尽预警", [
        ["节点标识", name],
        ["公网 IP", ip],
        ["当前内存", `<b>${node.memUsage}%</b> (阈值: ${cfg.memThresholdPercent}%)`],
        ["内存使用", node.memTotalBytes ? `${((node.memUsedBytes || 0) / GB).toFixed(1)} GB / ${(node.memTotalBytes / GB).toFixed(1)} GB` : "N/A"],
      ], `内存占用高达 ${node.memUsage}% (阈值: ${cfg.memThresholdPercent}%)`);
    case "test":
      return lines("✅ NodeMaster Telegram 通知测试", [
        ["通知通道", "连接成功"],
        ["已启用", [cfg.offlineAlert && "离线/恢复", cfg.trafficAlert && "流量", cfg.renewalAlert && "续费", cfg.cpuAlert && "CPU", cfg.memAlert && "内存"].filter(Boolean).join("、") || "无"],
      ], "Telegram 通知通道测试");
  }
}

class TelegramService {
  private lastKnownStatus = new Map<string, string>(); // nodeId -> status
  private lastSent = new Map<string, number>(); // `${type}:${nodeId}` -> timestamp
  private offlineNotified = new Set<string>(); // nodes whose offline alert was sent, so recovery is paired
  private running = false;

  public async sendMessage(text: string, overrideConfig?: Partial<TelegramConfig>): Promise<{ success: boolean; message?: string; error?: string }> {
    const config = { ...db.getTelegramConfig(), ...overrideConfig };
    if (!config.botToken || !config.chatId) return { success: false, error: "未配置 Telegram Bot Token 或 Chat ID" };

    const endpoint = (config.apiEndpoint || "https://api.telegram.org").replace(/\/+$/, "");
    try {
      const response = await fetch(`${endpoint}/bot${config.botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: config.chatId, text, parse_mode: "HTML", disable_web_page_preview: true }),
        signal: AbortSignal.timeout(10_000),
      });
      const data = (await response.json().catch(() => null)) as { ok?: boolean; description?: string } | null;
      if (!response.ok || !data?.ok) return { success: false, error: data?.description || `HTTP ${response.status} ${response.statusText}` };
      return { success: true, message: "消息已成功送达 Telegram" };
    } catch (err: any) {
      const error = err.name === "TimeoutError" ? "请求 Telegram API 超时 (10s)，请检查网络或配置反代地址" : err.message;
      return { success: false, error };
    }
  }

  private async deliver(type: TelegramAlertType, node: NodeItem | undefined, alert: Alert, overrideConfig?: Partial<TelegramConfig>) {
    const res = await this.sendMessage(alert.html, overrideConfig);
    db.addTelegramLog({
      id: newId("tglog"),
      type,
      nodeId: node?.id,
      nodeName: node?.name,
      title: alert.title,
      message: res.success ? alert.summary : `推送失败: ${res.error}`,
      timestamp: Date.now(),
      success: res.success,
      error: res.error,
    });
    return res;
  }

  /** Sends `type` for `node` unless the same alert went out within its cooldown. */
  private async alert(type: TelegramAlertType, node: NodeItem, cfg: TelegramConfig) {
    const key = `${type}:${node.id}`;
    const cooldown = COOLDOWN_MS[type] ?? 0;
    if (Date.now() - (this.lastSent.get(key) ?? 0) < cooldown) return false;
    this.lastSent.set(key, Date.now());
    await this.deliver(type, node, buildAlert(type, node, cfg));
    return true;
  }

  /** Runs on every heartbeat; overlapping runs are skipped because sends can take up to 10s. */
  public async checkNodeAlerts(nodes: NodeItem[]) {
    const cfg = db.getTelegramConfig();
    if (this.running || !cfg.enabled || !cfg.botToken || !cfg.chatId) return;
    this.running = true;
    try {
      for (const node of nodes) await this.checkNode(node, cfg);
    } finally {
      this.running = false;
    }
  }

  private async checkNode(node: NodeItem, cfg: TelegramConfig) {
    // First sighting (e.g. after a restart) only records the baseline; it is not a transition.
    const prevStatus = this.lastKnownStatus.get(node.id) ?? node.status;
    this.lastKnownStatus.set(node.id, node.status);

    if (cfg.offlineAlert) {
      if (prevStatus === "online" && node.status !== "online") {
        // A flapping node alerts at most once per cooldown; recovery is only sent for an alerted outage
        if (await this.alert("offline", node, cfg)) this.offlineNotified.add(node.id);
      } else if (prevStatus !== "online" && node.status === "online" && this.offlineNotified.delete(node.id)) {
        await this.alert("recovery", node, cfg);
      }
    }
    if (node.status !== "online") return;

    if (cfg.trafficAlert && node.trafficLimitBytes > 0 && (node.trafficUsedBytes / node.trafficLimitBytes) * 100 >= cfg.trafficThresholdPercent) {
      await this.alert("traffic", node, cfg);
    }
    const days = daysUntilExpiry(node);
    if (cfg.renewalAlert && days !== null && days <= cfg.renewalDaysAhead) await this.alert("renewal", node, cfg);
    if (cfg.cpuAlert && node.cpuUsage >= cfg.cpuThresholdPercent) await this.alert("cpu", node, cfg);
    if (cfg.memAlert && node.memUsage >= cfg.memThresholdPercent) await this.alert("mem", node, cfg);
  }

  /**
   * Sends a sample of `type` built from a real node's current values (no cooldown). `overrideConfig`
   * lets the settings page test credentials before saving them.
   */
  public async simulateAlert(type: TelegramAlertType, nodeId?: string, overrideConfig?: Partial<TelegramConfig>) {
    const node = (nodeId ? db.getNodeById(nodeId) : undefined) ?? db.getNodes()[0];
    if (!node && type !== "test") return { success: false, error: "暂无节点，无法生成该类告警示例" };
    const cfg = { ...db.getTelegramConfig(), ...overrideConfig };
    const alert = buildAlert(type, node ?? ({} as NodeItem), cfg);
    const sample = type === "test" ? alert : { ...alert, title: `${alert.title} (测试)`, html: `🧪 <i>测试消息，非真实告警</i>\n\n${alert.html}` };
    return this.deliver(type, node, sample, overrideConfig);
  }
}

export const telegramService = new TelegramService();
