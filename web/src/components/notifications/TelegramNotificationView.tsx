import React, { useState, useEffect } from "react";
import {
  PaperPlaneTilt,
  ShieldCheck,
  CheckCircle,
  WarningCircle,
  ArrowsClockwise,
  Trash,
  Clock,
  Cpu,
  HardDrive,
  CalendarBlank,
  Eye,
  EyeSlash,
  Play,
  Sparkle,
  X,
  Broadcast,
  Check,
} from "@phosphor-icons/react";
import { TelegramConfig, TelegramAlertLog, NodeItem } from "../../types";
import { Button } from "../common/Button";
import { api } from "../../services/api";
import { Input } from "../common/Input";

interface TelegramNotificationViewProps {
  nodes?: NodeItem[];
}

export const TelegramNotificationView: React.FC<TelegramNotificationViewProps> = ({
  nodes = [],
}) => {
  const [config, setConfig] = useState<TelegramConfig>({
    enabled: false,
    botToken: "",
    chatId: "",
    apiEndpoint: "https://api.telegram.org",
    offlineAlert: true,
    trafficAlert: true,
    trafficThresholdPercent: 80,
    renewalAlert: true,
    renewalDaysAhead: 7,
    cpuAlert: true,
    cpuThresholdPercent: 85,
    memAlert: true,
    memThresholdPercent: 85,
  });

  const [logs, setLogs] = useState<TelegramAlertLog[]>([]);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [simulatingType, setSimulatingType] = useState<string | null>(null);
  const [showToken, setShowToken] = useState(false);
  const [banner, setBanner] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Fetch config and logs
  const fetchData = async () => {
    try {
      const [savedConfig, savedLogs] = await Promise.all([
        api<TelegramConfig>("GET", "/api/telegram/config"),
        api<TelegramAlertLog[]>("GET", "/api/telegram/logs"),
      ]);
      setConfig(savedConfig);
      setLogs(savedLogs);
    } catch (err) {
      console.error("[TelegramNotificationView] Load error:", err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const refreshLogs = () =>
    api<TelegramAlertLog[]>("GET", "/api/telegram/logs")
      .then(setLogs)
      .catch((err) => console.error("[TelegramNotificationView] Logs refresh failed:", err));

  const handleSaveConfig = async (override?: Partial<TelegramConfig>) => {
    setSaving(true);
    const toSave = override ? { ...config, ...override } : config;
    try {
      setConfig(await api<TelegramConfig>("PUT", "/api/telegram/config", toSave));
      setBanner({ type: "success", message: "Telegram 告警配置保存成功！" });
      setTimeout(() => setBanner(null), 4000);
    } catch (err: any) {
      setBanner({ type: "error", message: `保存失败: ${err.message}` });
    } finally {
      setSaving(false);
    }
  };

  const handleTestNotification = async () => {
    if (!config.botToken.trim() || !config.chatId.trim()) {
      setBanner({
        type: "error",
        message: "请先填写 Telegram Bot Token 和 Chat ID",
      });
      return;
    }

    setTesting(true);
    setBanner(null);
    try {
      await api("POST", "/api/telegram/test", config);
      setBanner({
        type: "success",
        message: "测试消息已成功发送至 Telegram，请打开手机或客户端查看！",
      });
    } catch (err: any) {
      setBanner({ type: "error", message: `测试发送失败: ${err.message}` });
    } finally {
      // The attempt is logged either way
      refreshLogs();
      setTesting(false);
    }
  };

  const handleSimulateAlert = async (type: string) => {
    if (!config.botToken.trim() || !config.chatId.trim()) {
      setBanner({
        type: "error",
        message: "请先配置并保存 Bot Token 与 Chat ID 后再进行模拟推送",
      });
      return;
    }

    setSimulatingType(type);
    try {
      await api("POST", "/api/telegram/simulate", { type });
      setBanner({ type: "success", message: "模拟告警已成功推送到 Telegram！" });
      setTimeout(() => setBanner(null), 3000);
    } catch (err: any) {
      setBanner({ type: "error", message: `模拟推送失败: ${err.message}` });
    } finally {
      refreshLogs();
      setSimulatingType(null);
    }
  };

  const handleClearLogs = async () => {
    try {
      await api("DELETE", "/api/telegram/logs");
      setLogs([]);
    } catch (err) {
      console.error(err);
    }
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const h = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    const s = String(d.getSeconds()).padStart(2, "0");
    return `${m}-${day} ${h}:${min}:${s}`;
  };

  const getLogTypeBadge = (type: TelegramAlertLog["type"]) => {
    switch (type) {
      case "offline":
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-500/15 text-red-400 border border-red-500/30">离线故障</span>;
      case "recovery":
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">恢复上线</span>;
      case "traffic":
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/15 text-amber-400 border border-amber-500/30">流量预警</span>;
      case "renewal":
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-500/15 text-purple-400 border border-purple-500/30">续费提醒</span>;
      case "cpu":
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-orange-500/15 text-orange-400 border border-orange-500/30">CPU负载</span>;
      case "mem":
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-sky-500/15 text-sky-400 border border-sky-500/30">内存耗尽</span>;
      case "test":
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-accent/15 text-accent border border-accent/30">连通测试</span>;
      default:
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-paper-3 text-ink-muted border border-rule">系统通知</span>;
    }
  };

  return (
    <div className="space-y-5 sm:space-y-6 animate-fade-in pb-10">
      {/* Floating High-Contrast Toast Notification */}
      {banner && (
        <div
          className={`fixed top-16 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-50 p-3.5 rounded-xl border shadow-2xl flex items-center justify-between text-xs transition-all backdrop-blur-md ${
            banner.type === "success"
              ? "bg-emerald-950/95 border-emerald-500/50 text-emerald-200 shadow-emerald-950/50"
              : "bg-red-950/95 border-red-500/50 text-red-200 shadow-red-950/50"
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0 pr-2">
            {banner.type === "success" ? (
              <CheckCircle className="w-5 h-5 shrink-0 text-emerald-400" />
            ) : (
              <WarningCircle className="w-5 h-5 shrink-0 text-red-400" />
            )}
            <span className="font-medium leading-relaxed">{banner.message}</span>
          </div>
          <button
            onClick={() => setBanner(null)}
            className="p-1.5 -mr-1 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors cursor-pointer shrink-0 touch-manipulation"
            aria-label="关闭提示"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Overview Top Card: Master Switch & Status */}
      <div className="p-4 sm:p-5 rounded-2xl bg-paper-2 border border-rule shadow-sm space-y-4">
        <div className="flex items-start sm:items-center gap-3.5">
          <div
            className={`w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center shrink-0 transition-all ${
              config.enabled
                ? "bg-accent/15 text-accent border border-accent/40 shadow-sm"
                : "bg-paper-3 text-ink-muted border border-rule"
            }`}
          >
            <PaperPlaneTilt weight="fill" className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm sm:text-base font-bold text-ink leading-tight">
                Telegram 实时监控告警推送
              </h2>
              <span
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono border ${
                  config.enabled
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                    : "bg-paper-3 text-ink-muted border-rule"
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    config.enabled ? "bg-emerald-400 animate-pulse" : "bg-ink-muted/50"
                  }`}
                />
                {config.enabled ? "推送已激活" : "推送未开启"}
              </span>
            </div>
            <p className="text-xs text-ink-muted mt-1 leading-relaxed">
              实时监听节点掉线、月度流量用尽、VPS 周期续费到期、CPU 高温过载与内存溢出风险，自动推送至指定 Telegram 会话。
            </p>
          </div>
        </div>

        {/* Master Switch & Actions */}
        <div className="pt-3 border-t border-rule flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          {/* iOS Style Global Toggle */}
          <button
            type="button"
            onClick={() => {
              const nextVal = !config.enabled;
              setConfig((prev) => ({ ...prev, enabled: nextVal }));
              handleSaveConfig({ enabled: nextVal });
            }}
            className={`h-11 sm:h-9 px-3.5 rounded-xl border flex items-center justify-between sm:justify-start gap-3 transition-all cursor-pointer select-none touch-manipulation ${
              config.enabled
                ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/20"
                : "bg-paper border-rule text-ink-muted hover:border-rule-active hover:text-ink-secondary"
            }`}
          >
            <span className="text-xs font-medium">
              {config.enabled ? "全局推送: 已开启" : "全局推送: 已关闭"}
            </span>
            <div
              className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors ${
                config.enabled ? "bg-emerald-500" : "bg-paper-3 border border-rule"
              }`}
            >
              <div
                className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${
                  config.enabled ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </div>
          </button>

          <Button
            variant="secondary"
            size="sm"
            onClick={handleTestNotification}
            loading={testing}
            disabled={!config.botToken || !config.chatId}
            className="text-xs min-h-[44px] sm:min-h-[36px] w-full sm:w-auto touch-manipulation font-medium"
          >
            <Broadcast className="w-4 h-4 mr-1.5" />
            发送测试消息
          </Button>
        </div>
      </div>

      {/* Section 1: Telegram Bot Credentials Card */}
      <div className="p-4 sm:p-5 rounded-2xl bg-paper-2 border border-rule shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-rule">
          <div>
            <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-accent" />
              <span>机器人连接配置 (Bot Connection)</span>
            </h3>
            <p className="text-xs text-ink-muted mt-1 leading-relaxed">
              请填写 Telegram 机器人的 Token 以及需要接收消息的个人 Chat ID 或群组 ID
            </p>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => handleSaveConfig()}
            loading={saving}
            className="min-h-[44px] sm:min-h-[36px] w-full sm:w-auto touch-manipulation font-semibold shrink-0 shadow-sm"
          >
            <Check className="w-4 h-4 mr-1.5" />
            保存配置
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          {/* Bot Token */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-ink-muted">
              Telegram Bot Token *
            </label>
            <div className="relative">
              <Input
                type={showToken ? "text" : "password"}
                value={config.botToken}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, botToken: e.target.value }))
                }
                placeholder="例如: 123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
                className="pr-10 min-h-[44px] sm:min-h-[38px] font-mono text-xs"
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-1 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center text-ink-muted hover:text-ink transition-colors cursor-pointer touch-manipulation"
                title={showToken ? "隐藏 Token" : "显示 Token"}
                aria-label={showToken ? "隐藏 Token" : "显示 Token"}
              >
                {showToken ? (
                  <EyeSlash className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
            <p className="text-[11px] text-ink-muted font-sans leading-relaxed flex items-center gap-1 flex-wrap">
              <span>由官方机器人</span>
              <a
                href="https://t.me/BotFather"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-accent/10 text-accent hover:bg-accent/20 transition-colors font-mono"
              >
                @BotFather
                <span className="text-[10px]">↗</span>
              </a>
              <span>创建并签发的通讯密钥</span>
            </p>
          </div>

          {/* Chat ID */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-ink-muted">
              接收者 Chat ID *
            </label>
            <Input
              value={config.chatId}
              onChange={(e) =>
                setConfig((prev) => ({ ...prev, chatId: e.target.value }))
              }
              placeholder="例如: 987654321 或 -100123456789"
              className="min-h-[44px] sm:min-h-[38px] font-mono text-xs"
            />
            <p className="text-[11px] text-ink-muted font-sans leading-relaxed flex items-center gap-1 flex-wrap">
              <span>接收目标唯一 ID，可私聊</span>
              <a
                href="https://t.me/userinfobot"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-accent/10 text-accent hover:bg-accent/20 transition-colors font-mono"
              >
                @userinfobot
                <span className="text-[10px]">↗</span>
              </a>
              <span>或 @getmyid_bot 获取</span>
            </p>
          </div>

          {/* Custom API Endpoint */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-ink-muted">
              Telegram API 地址 (可选反代)
            </label>
            <Input
              value={config.apiEndpoint || ""}
              onChange={(e) =>
                setConfig((prev) => ({ ...prev, apiEndpoint: e.target.value }))
              }
              placeholder="默认: https://api.telegram.org"
              className="min-h-[44px] sm:min-h-[38px] font-mono text-xs"
            />
            <p className="text-[11px] text-ink-muted font-sans leading-relaxed">
              直连受限网络可填 Cloudflare Worker 或自建反向代理地址
            </p>
          </div>
        </div>
      </div>

      {/* Section 2: 5 Specific Alert Rules Cards */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
            <Sparkle className="w-4 h-4 text-accent" />
            <span>告警事件与阈值规则配置</span>
          </h3>
          <span className="text-[11px] font-mono text-ink-muted">
            修改开关或阈值后即时保存生效
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {/* Card 1: 离线与恢复通知 */}
          <div className="p-4 sm:p-4.5 rounded-xl bg-paper-2 border border-rule flex flex-col justify-between space-y-3 hover:border-rule-active transition-all">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
                  <span className="text-xs font-bold text-ink">
                    节点离线与故障熔断
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const nextVal = !config.offlineAlert;
                    setConfig((prev) => ({ ...prev, offlineAlert: nextVal }));
                    handleSaveConfig({ offlineAlert: nextVal });
                  }}
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center cursor-pointer touch-manipulation -mr-2"
                  aria-label="切换离线熔断告警"
                >
                  <div
                    className={`w-11 h-6 flex items-center rounded-full p-0.5 transition-colors ${
                      config.offlineAlert
                        ? "bg-emerald-500"
                        : "bg-paper-3 border border-rule"
                    }`}
                  >
                    <div
                      className={`bg-white w-5 h-5 rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${
                        config.offlineAlert ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </div>
                </button>
              </div>
              <p className="text-[11px] text-ink-muted mt-1 leading-relaxed">
                当节点由于网络波动、机房故障离线，或当月流量耗尽触发熔断时立即推送告警；当网络恢复在线时发送恢复通知。
              </p>
            </div>

            <div className="pt-3 border-t border-rule flex items-center justify-between text-xs">
              <span className="text-[11px] text-ink-muted font-mono">
                机制: 状态变更监听
              </span>
              <button
                type="button"
                onClick={() => handleSimulateAlert("offline")}
                disabled={simulatingType === "offline"}
                className="px-2.5 py-1.5 rounded-lg bg-paper-3 hover:bg-accent/15 text-accent text-xs font-medium border border-rule hover:border-accent/30 transition-all flex items-center gap-1.5 cursor-pointer touch-manipulation min-h-[36px]"
              >
                <Play weight="fill" className="w-3 h-3" />
                <span>{simulatingType === "offline" ? "模拟中..." : "模拟离线告警"}</span>
              </button>
            </div>
          </div>

          {/* Card 2: 流量额度超标预警 */}
          <div className="p-4 sm:p-4.5 rounded-xl bg-paper-2 border border-rule flex flex-col justify-between space-y-3 hover:border-rule-active transition-all">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                  <span className="text-xs font-bold text-ink">
                    月度流量超额预警
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const nextVal = !config.trafficAlert;
                    setConfig((prev) => ({ ...prev, trafficAlert: nextVal }));
                    handleSaveConfig({ trafficAlert: nextVal });
                  }}
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center cursor-pointer touch-manipulation -mr-2"
                  aria-label="切换月度流量预警"
                >
                  <div
                    className={`w-11 h-6 flex items-center rounded-full p-0.5 transition-colors ${
                      config.trafficAlert
                        ? "bg-emerald-500"
                        : "bg-paper-3 border border-rule"
                    }`}
                  >
                    <div
                      className={`bg-white w-5 h-5 rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${
                        config.trafficAlert ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </div>
                </button>
              </div>
              <p className="text-[11px] text-ink-muted mt-1 leading-relaxed">
                当节点流量消耗比例达到设定预警阈值时推送通知，防止流量超额停机。单节点 6 小时内冷却防刷屏。
              </p>

              {/* Threshold Slider */}
              <div className="mt-3 bg-paper p-2.5 rounded-xl border border-rule space-y-2">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-ink-muted text-[11px]">预警触发百分比:</span>
                  <span className="text-amber-400 font-bold">
                    {config.trafficThresholdPercent}%
                  </span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="98"
                  value={config.trafficThresholdPercent}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      trafficThresholdPercent: Number(e.target.value),
                    }))
                  }
                  onMouseUp={() => handleSaveConfig()}
                  onTouchEnd={() => handleSaveConfig()}
                  className="w-full accent-amber-400 cursor-pointer h-2 bg-paper-3 rounded-lg touch-none"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-rule flex items-center justify-between text-xs">
              <span className="text-[11px] text-ink-muted font-mono">
                阈值: ≥{config.trafficThresholdPercent}%
              </span>
              <button
                type="button"
                onClick={() => handleSimulateAlert("traffic")}
                disabled={simulatingType === "traffic"}
                className="px-2.5 py-1.5 rounded-lg bg-paper-3 hover:bg-amber-500/15 text-amber-400 text-xs font-medium border border-rule hover:border-amber-500/30 transition-all flex items-center gap-1.5 cursor-pointer touch-manipulation min-h-[36px]"
              >
                <Play weight="fill" className="w-3 h-3" />
                <span>{simulatingType === "traffic" ? "模拟中..." : "模拟流量预警"}</span>
              </button>
            </div>
          </div>

          {/* Card 3: VPS 续费到期提醒 */}
          <div className="p-4 sm:p-4.5 rounded-xl bg-paper-2 border border-rule flex flex-col justify-between space-y-3 hover:border-rule-active transition-all">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CalendarBlank className="w-3.5 h-3.5 text-purple-400" />
                  <span className="text-xs font-bold text-ink">
                    VPS 续费到期提醒
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const nextVal = !config.renewalAlert;
                    setConfig((prev) => ({ ...prev, renewalAlert: nextVal }));
                    handleSaveConfig({ renewalAlert: nextVal });
                  }}
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center cursor-pointer touch-manipulation -mr-2"
                  aria-label="切换续费到期提醒"
                >
                  <div
                    className={`w-11 h-6 flex items-center rounded-full p-0.5 transition-colors ${
                      config.renewalAlert
                        ? "bg-emerald-500"
                        : "bg-paper-3 border border-rule"
                    }`}
                  >
                    <div
                      className={`bg-white w-5 h-5 rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${
                        config.renewalAlert ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </div>
                </button>
              </div>
              <p className="text-[11px] text-ink-muted mt-1 leading-relaxed">
                在 VPS 到期日前每日自动发送续期提醒，自动识别并显示自动续费是否开启及账单周期，避免 VPS 被销毁。
              </p>

              {/* Threshold Days Ahead */}
              <div className="mt-3 bg-paper p-2.5 rounded-xl border border-rule space-y-2">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-ink-muted text-[11px]">提前提醒天数:</span>
                  <span className="text-purple-400 font-bold">
                    到期前 {config.renewalDaysAhead} 天
                  </span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[3, 7, 15, 30].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => {
                        setConfig((prev) => ({ ...prev, renewalDaysAhead: d }));
                        handleSaveConfig({ renewalDaysAhead: d });
                      }}
                      className={`text-xs px-3 py-1 min-h-[34px] rounded-lg font-mono border transition-all cursor-pointer touch-manipulation flex-1 sm:flex-initial text-center ${
                        config.renewalDaysAhead === d
                          ? "bg-purple-500/15 text-purple-300 border-purple-500/40 font-bold"
                          : "bg-paper-3 text-ink-muted border-rule hover:text-ink"
                      }`}
                    >
                      {d}天前
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-rule flex items-center justify-between text-xs">
              <span className="text-[11px] text-ink-muted font-mono">
                提前: ≤{config.renewalDaysAhead}天
              </span>
              <button
                type="button"
                onClick={() => handleSimulateAlert("renewal")}
                disabled={simulatingType === "renewal"}
                className="px-2.5 py-1.5 rounded-lg bg-paper-3 hover:bg-purple-500/15 text-purple-400 text-xs font-medium border border-rule hover:border-purple-500/30 transition-all flex items-center gap-1.5 cursor-pointer touch-manipulation min-h-[36px]"
              >
                <Play weight="fill" className="w-3 h-3" />
                <span>{simulatingType === "renewal" ? "模拟中..." : "模拟续费提醒"}</span>
              </button>
            </div>
          </div>

          {/* Card 4: CPU 占用过高预警 */}
          <div className="p-4 sm:p-4.5 rounded-xl bg-paper-2 border border-rule flex flex-col justify-between space-y-3 hover:border-rule-active transition-all">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Cpu className="w-3.5 h-3.5 text-orange-400" />
                  <span className="text-xs font-bold text-ink">
                    CPU 负载过高预警
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const nextVal = !config.cpuAlert;
                    setConfig((prev) => ({ ...prev, cpuAlert: nextVal }));
                    handleSaveConfig({ cpuAlert: nextVal });
                  }}
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center cursor-pointer touch-manipulation -mr-2"
                  aria-label="切换 CPU 负载预警"
                >
                  <div
                    className={`w-11 h-6 flex items-center rounded-full p-0.5 transition-colors ${
                      config.cpuAlert
                        ? "bg-emerald-500"
                        : "bg-paper-3 border border-rule"
                    }`}
                  >
                    <div
                      className={`bg-white w-5 h-5 rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${
                        config.cpuAlert ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </div>
                </button>
              </div>
              <p className="text-[11px] text-ink-muted mt-1 leading-relaxed">
                当节点 CPU 使用率超出设定阈值时发出高负荷预警，警惕代理转发性能瓶颈、死循环或挖矿木马程序。
              </p>

              {/* Threshold Slider */}
              <div className="mt-3 bg-paper p-2.5 rounded-xl border border-rule space-y-2">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-ink-muted text-[11px]">触发 CPU 阈值:</span>
                  <span className="text-orange-400 font-bold">
                    {config.cpuThresholdPercent}%
                  </span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="99"
                  value={config.cpuThresholdPercent}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      cpuThresholdPercent: Number(e.target.value),
                    }))
                  }
                  onMouseUp={() => handleSaveConfig()}
                  onTouchEnd={() => handleSaveConfig()}
                  className="w-full accent-orange-400 cursor-pointer h-2 bg-paper-3 rounded-lg touch-none"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-rule flex items-center justify-between text-xs">
              <span className="text-[11px] text-ink-muted font-mono">
                阈值: ≥{config.cpuThresholdPercent}%
              </span>
              <button
                type="button"
                onClick={() => handleSimulateAlert("cpu")}
                disabled={simulatingType === "cpu"}
                className="px-2.5 py-1.5 rounded-lg bg-paper-3 hover:bg-orange-500/15 text-orange-400 text-xs font-medium border border-rule hover:border-orange-500/30 transition-all flex items-center gap-1.5 cursor-pointer touch-manipulation min-h-[36px]"
              >
                <Play weight="fill" className="w-3 h-3" />
                <span>{simulatingType === "cpu" ? "模拟中..." : "模拟 CPU 预警"}</span>
              </button>
            </div>
          </div>

          {/* Card 5: 内存 (RAM) 耗尽预警 */}
          <div className="p-4 sm:p-4.5 rounded-xl bg-paper-2 border border-rule flex flex-col justify-between space-y-3 hover:border-rule-active transition-all">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <HardDrive className="w-3.5 h-3.5 text-sky-400" />
                  <span className="text-xs font-bold text-ink">
                    内存 (RAM) 耗尽预警
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const nextVal = !config.memAlert;
                    setConfig((prev) => ({ ...prev, memAlert: nextVal }));
                    handleSaveConfig({ memAlert: nextVal });
                  }}
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center cursor-pointer touch-manipulation -mr-2"
                  aria-label="切换内存耗尽预警"
                >
                  <div
                    className={`w-11 h-6 flex items-center rounded-full p-0.5 transition-colors ${
                      config.memAlert
                        ? "bg-emerald-500"
                        : "bg-paper-3 border border-rule"
                    }`}
                  >
                    <div
                      className={`bg-white w-5 h-5 rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${
                        config.memAlert ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </div>
                </button>
              </div>
              <p className="text-[11px] text-ink-muted mt-1 leading-relaxed">
                当节点物理内存占用逼近上限时触发告警，预防因 OOM（Out Of Memory）被 Linux 内核强行杀死 Xray 代理进程。
              </p>

              {/* Threshold Slider */}
              <div className="mt-3 bg-paper p-2.5 rounded-xl border border-rule space-y-2">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-ink-muted text-[11px]">触发内存阈值:</span>
                  <span className="text-sky-400 font-bold">
                    {config.memThresholdPercent}%
                  </span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="99"
                  value={config.memThresholdPercent}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      memThresholdPercent: Number(e.target.value),
                    }))
                  }
                  onMouseUp={() => handleSaveConfig()}
                  onTouchEnd={() => handleSaveConfig()}
                  className="w-full accent-sky-400 cursor-pointer h-2 bg-paper-3 rounded-lg touch-none"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-rule flex items-center justify-between text-xs">
              <span className="text-[11px] text-ink-muted font-mono">
                阈值: ≥{config.memThresholdPercent}%
              </span>
              <button
                type="button"
                onClick={() => handleSimulateAlert("mem")}
                disabled={simulatingType === "mem"}
                className="px-2.5 py-1.5 rounded-lg bg-paper-3 hover:bg-sky-500/15 text-sky-400 text-xs font-medium border border-rule hover:border-sky-500/30 transition-all flex items-center gap-1.5 cursor-pointer touch-manipulation min-h-[36px]"
              >
                <Play weight="fill" className="w-3 h-3" />
                <span>{simulatingType === "mem" ? "模拟中..." : "模拟内存预警"}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Section 3: Notification History Logs */}
      <div className="p-4 sm:p-5 rounded-2xl bg-paper-2 border border-rule shadow-sm space-y-3.5">
        <div className="flex items-center justify-between pb-3 border-b border-rule gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Clock className="w-4 h-4 text-accent shrink-0" />
            <h3 className="text-sm font-semibold text-ink truncate">
              近期推送历史与触发记录
            </h3>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-paper-3 text-ink-muted border border-rule font-mono shrink-0">
              {logs.length} 条
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="secondary"
              size="sm"
              onClick={fetchData}
              className="text-xs min-h-[36px] px-2.5 touch-manipulation"
              title="刷新记录"
            >
              <ArrowsClockwise className="w-3.5 h-3.5 mr-1" />
              刷新
            </Button>
            {logs.length > 0 && (
              <Button
                variant="danger"
                size="sm"
                onClick={handleClearLogs}
                className="text-xs min-h-[36px] px-2.5 touch-manipulation"
                title="清空记录"
              >
                <Trash className="w-3.5 h-3.5 mr-1" />
                清空
              </Button>
            )}
          </div>
        </div>

        {logs.length === 0 ? (
          <div className="py-10 text-center text-xs text-ink-muted font-mono space-y-2">
            <PaperPlaneTilt className="w-10 h-10 mx-auto opacity-30 text-accent" />
            <p className="text-sm text-ink-secondary">暂无推送历史记录</p>
            <p className="text-xs text-ink-muted">当前所有 VPS 节点运行正常，或尚未配置触发推送</p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-rule text-ink-muted font-mono text-[11px]">
                    <th className="py-2.5 px-3">推送时间</th>
                    <th className="py-2.5 px-3">告警类型</th>
                    <th className="py-2.5 px-3">关联节点</th>
                    <th className="py-2.5 px-3">消息内容摘要</th>
                    <th className="py-2.5 px-3 text-right">投递状态</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rule/60 font-mono">
                  {logs.map((log) => (
                    <tr
                      key={log.id}
                      className="hover:bg-paper-hover/40 transition-colors"
                    >
                      <td className="py-2.5 px-3 text-ink-muted text-[11px] whitespace-nowrap">
                        {formatTime(log.timestamp)}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {getLogTypeBadge(log.type)}
                      </td>
                      <td className="py-2.5 px-3 text-ink font-medium whitespace-nowrap">
                        {log.nodeName || "NodeMaster 控制台"}
                      </td>
                      <td className="py-2.5 px-3 text-ink-secondary text-[11px] max-w-md truncate">
                        {log.message}
                      </td>
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        {log.success ? (
                          <span className="text-emerald-400 font-medium text-[11px]">
                            ✓ 已送达
                          </span>
                        ) : (
                          <span
                            className="text-status-danger font-medium text-[11px]"
                            title={log.error}
                          >
                            ✕ 失败 ({log.error?.slice(0, 20)}...)
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Responsive Cards Feed */}
            <div className="md:hidden space-y-3">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="p-3.5 rounded-xl bg-paper border border-rule/80 space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {getLogTypeBadge(log.type)}
                      <span className="text-ink font-semibold truncate font-mono">
                        {log.nodeName || "NodeMaster 控制台"}
                      </span>
                    </div>
                    <div className="shrink-0">
                      {log.success ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                          ✓ 已送达
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-status-danger/10 text-status-danger border border-status-danger/30">
                          ✕ 失败
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="text-ink-secondary text-xs leading-relaxed font-mono bg-paper-2/70 p-2.5 rounded-lg border border-rule/50 break-words">
                    {log.message}
                  </p>

                  <div className="flex items-center justify-between text-[11px] text-ink-muted font-mono pt-1">
                    <span>{formatTime(log.timestamp)}</span>
                    {log.error && (
                      <span className="text-status-danger truncate max-w-[180px]">
                        {log.error}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
