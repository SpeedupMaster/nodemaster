import React, { useState, useEffect } from "react";
import { SubscriptionToken, NodeItem } from "../../types";
import { Button } from "../common/Button";
import {
  LinkSimple,
  Copy,
  Check,
  DownloadSimple,
  Sparkle,
  Eye,
  Code,
  ShieldCheck,
  Robot,
  Television,
  ChatCircleDots,
  ArrowsSplit,
  Globe,
  Sliders,
  Pulse,
} from "@phosphor-icons/react";

interface SubscriptionViewProps {
  subscriptions: SubscriptionToken[];
  nodes: NodeItem[];
}

interface ServiceRulePreview {
  id: string;
  name: string;
  label: string;
  category: "ai" | "media" | "social";
  icon: string;
  defaultGroup: "美国节点" | "亚太节点" | "欧洲节点" | "手动选择" | "PROXY-Gate" | "DIRECT";
  desc: string;
}

const SERVICE_PREVIEWS: ServiceRulePreview[] = [
  // AI 大模型专线
  {
    id: "gpt",
    name: "GPT",
    label: "OpenAI / ChatGPT",
    category: "ai",
    icon: "https://fastly.jsdelivr.net/gh/shindgewongxj/WHATSINStash/icon/openai.png",
    defaultGroup: "美国节点",
    desc: "chatgpt.com, openai.com, API 接口与客户端",
  },
  {
    id: "claude",
    name: "Claude",
    label: "Anthropic / Claude",
    category: "ai",
    icon: "https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/png/anthropic.png",
    defaultGroup: "美国节点",
    desc: "claude.ai, anthropic.com 专线分流",
  },
  {
    id: "gemini",
    name: "Gemini",
    label: "Google Gemini",
    category: "ai",
    icon: "https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/png/google-gemini.png",
    defaultGroup: "美国节点",
    desc: "gemini.google.com, Google AI Studio",
  },
  {
    id: "copilot",
    name: "Copilot",
    label: "Microsoft Copilot",
    category: "ai",
    icon: "https://cdn.jsdelivr.net/gh/Hawaiine/Oasisic-Icons@main/icons/Microsoft/Copilot-1.png",
    defaultGroup: "美国节点",
    desc: "copilot.microsoft.com 微软 AI",
  },
  {
    id: "grok",
    name: "Grok",
    label: "xAI / Grok",
    category: "ai",
    icon: "https://raw.githubusercontent.com/luestr/IconResource/main/App_icon/120px/Grok.png",
    defaultGroup: "美国节点",
    desc: "grok.com, x.ai 马斯克 AI",
  },

  // 流媒体视频专线
  {
    id: "youtube",
    name: "YouTube",
    label: "YouTube 视频与音乐",
    category: "media",
    icon: "https://fastly.jsdelivr.net/gh/Koolson/Qure/IconSet/Color/YouTube.png",
    defaultGroup: "亚太节点",
    desc: "youtube.com, googlevideo.com 高清 CDN",
  },
  {
    id: "netflix",
    name: "Netflix",
    label: "Netflix 奈飞",
    category: "media",
    icon: "https://fastly.jsdelivr.net/gh/Koolson/Qure/IconSet/Color/Netflix.png",
    defaultGroup: "亚太节点",
    desc: "netflix.com, nflxvideo.net 全球片库",
  },
  {
    id: "disney",
    name: "Disney+",
    label: "Disney+ 迪士尼",
    category: "media",
    icon: "https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Disney+.png",
    defaultGroup: "亚太节点",
    desc: "disneyplus.com, dssott.com 流媒体",
  },
  {
    id: "spotify",
    name: "Spotify",
    label: "Spotify 音乐",
    category: "media",
    icon: "https://fastly.jsdelivr.net/gh/Koolson/Qure/IconSet/Color/Spotify.png",
    defaultGroup: "亚太节点",
    desc: "spotify.com, spclient.wg 音频流",
  },
  {
    id: "tiktok",
    name: "TikTok",
    label: "TikTok 国际版",
    category: "media",
    icon: "https://fastly.jsdelivr.net/gh/Koolson/Qure/IconSet/Color/TikTok.png",
    defaultGroup: "亚太节点",
    desc: "tiktok.com, byteoversea 短视频 CDN",
  },
  {
    id: "twitch",
    name: "Twitch",
    label: "Twitch 游戏直播",
    category: "media",
    icon: "https://fastly.jsdelivr.net/gh/Koolson/Qure/IconSet/Color/Twitch.png",
    defaultGroup: "亚太节点",
    desc: "twitch.tv, ttvnw.net 低延迟直播流",
  },

  // 社交与常用工具
  {
    id: "google",
    name: "Google",
    label: "Google 全家桶",
    category: "social",
    icon: "https://fastly.jsdelivr.net/gh/Koolson/Qure/IconSet/Color/Google.png",
    defaultGroup: "亚太节点",
    desc: "google.com, gmail.com, gstatic",
  },
  {
    id: "telegram",
    name: "Telegram",
    label: "Telegram 电报",
    category: "social",
    icon: "https://fastly.jsdelivr.net/gh/Koolson/Qure/IconSet/Color/Telegram.png",
    defaultGroup: "亚太节点",
    desc: "telegram.org 及官方专属 IP-CIDR",
  },
  {
    id: "x",
    name: "X",
    label: "X (Twitter 推特)",
    category: "social",
    icon: "https://fastly.jsdelivr.net/gh/shindgewongxj/WHATSINStash/icon/x.png",
    defaultGroup: "美国节点",
    desc: "x.com, twitter.com, twimg.com",
  },
  {
    id: "github",
    name: "Github",
    label: "GitHub 代码托管",
    category: "social",
    icon: "https://fastly.jsdelivr.net/gh/Koolson/Qure/IconSet/Color/GitHub.png",
    defaultGroup: "美国节点",
    desc: "github.com, raw.githubusercontent.com",
  },
  {
    id: "facebook",
    name: "Facebook",
    label: "Facebook 脸书",
    category: "social",
    icon: "https://fastly.jsdelivr.net/gh/Koolson/Qure/IconSet/Color/Facebook.png",
    defaultGroup: "亚太节点",
    desc: "facebook.com, fbcdn.net 社交图谱",
  },
  {
    id: "instagram",
    name: "Instagram",
    label: "Instagram 照片墙",
    category: "social",
    icon: "https://fastly.jsdelivr.net/gh/Koolson/Qure/IconSet/Color/Instagram.png",
    defaultGroup: "亚太节点",
    desc: "instagram.com, cdninstagram 媒体流",
  },
  {
    id: "whatsapp",
    name: "WhatsApp",
    label: "WhatsApp 通讯",
    category: "social",
    icon: "https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/png/whatsapp.png",
    defaultGroup: "亚太节点",
    desc: "whatsapp.com, wa.me 即时通讯",
  },
  {
    id: "speedtest",
    name: "Speedtest",
    label: "Ookla 网络测速",
    category: "social",
    icon: "https://cdn.jsdelivr.net/gh/Koolson/Qure/IconSet/Color/Speedtest.png",
    defaultGroup: "亚太节点",
    desc: "speedtest.net, ookla 全球测速点",
  },
];

export const SubscriptionView: React.FC<SubscriptionViewProps> = ({
  subscriptions,
  nodes,
}) => {
  const [selectedSubToken, setSelectedSubToken] = useState<string>("");
  const [format, setFormat] = useState<"clash" | "singbox" | "base64">("clash");
  const [viewMode, setViewMode] = useState<"visual" | "code">("visual");
  const [previewContent, setPreviewContent] = useState<string>("");
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedContent, setCopiedContent] = useState(false);
  const [activeCategory, setActiveCategory] = useState<"all" | "ai" | "media" | "social">("all");
  const [mockSelectedGate, setMockSelectedGate] = useState<string>("美国节点");

  const activeSub =
    subscriptions.find((s) => s.token === selectedSubToken) ||
    subscriptions[0];

  useEffect(() => {
    if (subscriptions.length > 0 && !selectedSubToken) {
      setSelectedSubToken(subscriptions[0].token);
    }
  }, [subscriptions, selectedSubToken]);

  const subUrl = activeSub
    ? `${window.location.origin}/api/sub/${activeSub.token}`
    : "";

  // Fetch preview when activeSub or format changes
  useEffect(() => {
    if (!activeSub) return;
    setLoadingPreview(true);
    fetch(`/api/sub/${activeSub.token}?format=${format}`)
      .then((r) => r.text())
      .then((txt) => setPreviewContent(txt))
      .catch((e) => console.error(e))
      .finally(() => setLoadingPreview(false));
  }, [activeSub, format]);

  const handleCopyLink = () => {
    if (!subUrl) return;
    navigator.clipboard.writeText(subUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyContent = () => {
    if (!previewContent) return;
    navigator.clipboard.writeText(previewContent);
    setCopiedContent(true);
    setTimeout(() => setCopiedContent(false), 2000);
  };

  const handleDownload = () => {
    const ext = format === "clash" ? "yaml" : format === "singbox" ? "json" : "txt";
    const blob = new Blob([previewContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nodemaster_${activeSub?.name || "nodes"}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const oneClickClashUrl = `clash://install-config?url=${encodeURIComponent(subUrl)}&name=${encodeURIComponent("NodeMaster")}`;

  // Filter nodes into regions based on name, country, and countryName
  const usNodes = nodes.filter(
    (n) =>
      /(US|USA|United States|美国)/i.test(n.name) ||
      /US/i.test(n.country || "") ||
      /美国/i.test(n.countryName || "")
  );
  const apacNodes = nodes.filter(
    (n) =>
      /(HK|Hong Kong|香港|JP|Japan|日本|SG|Singapore|新加坡|TW|Taiwan|台湾|KR|Korea|韩国|亚太)/i.test(n.name) ||
      /(HK|JP|SG|TW|KR)/i.test(n.country || "") ||
      /(香港|日本|新加坡|台湾|韩国)/i.test(n.countryName || "")
  );
  const euNodes = nodes.filter(
    (n) =>
      /(UK|Britain|英国|伦敦|DE|Germany|德国|FR|France|法国|RU|Russia|俄罗斯|NL|Netherlands|荷兰|欧洲|EUR|GB)/i.test(
        n.name
      ) ||
      /(GB|UK|DE|FR|RU|NL)/i.test(n.country || "") ||
      /(英国|德国|法国|俄罗斯|荷兰|欧洲)/i.test(n.countryName || "")
  );

  const filteredServices =
    activeCategory === "all"
      ? SERVICE_PREVIEWS
      : SERVICE_PREVIEWS.filter((s) => s.category === activeCategory);

  return (
    <div className="space-y-6">
      {/* Universal Subscription Hero Card */}
      <div className="p-6 rounded-xl bg-paper-2 border border-rule relative overflow-hidden shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <LinkSimple weight="bold" className="w-5 h-5 text-accent" />
              <h2 className="text-base font-semibold text-ink">
                全客户端通用智能订阅链接
              </h2>
            </div>
            <p className="text-xs text-ink-muted mt-1 max-w-xl">
              服务端依据客户端的 User-Agent 自动自适应下发对应的配置（Clash Meta / Mihomo、Sing-box、Shadowrocket），内置精细化服务分类与四大节点出口策略。
            </p>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <a
              href={oneClickClashUrl}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-md bg-accent text-paper font-semibold text-xs hover:bg-accent-hover transition-colors shadow-sm"
            >
              <Sparkle weight="fill" className="w-3.5 h-3.5" />
              一键导入 Clash / Mihomo
            </a>
          </div>
        </div>

        {/* URL Box */}
        <div className="mt-4 p-3 rounded-lg bg-paper border border-rule flex items-center justify-between gap-3">
          <span className="text-xs font-mono text-ink-secondary truncate select-all">
            {subUrl || "加载中..."}
          </span>

          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleCopyLink}
              icon={copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            >
              {copiedLink ? "已复制链接" : "复制订阅链接"}
            </Button>
          </div>
        </div>
      </div>

      {/* Subscription Format & View Mode Switcher */}
      <div className="p-6 rounded-xl bg-paper-2 border border-rule space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-rule">
          <div className="flex items-center gap-1 bg-paper p-1 rounded-md border border-rule">
            {[
              { id: "clash", label: "Clash Meta / Mihomo (YAML)" },
              { id: "singbox", label: "Sing-box (JSON)" },
              { id: "base64", label: "Shadowrocket / 通用 (Base64)" },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setFormat(item.id as any);
                  if (item.id !== "clash") setViewMode("code");
                }}
                className={`px-3 py-1 text-xs rounded font-medium transition-colors ${
                  format === item.id
                    ? "bg-paper-2 text-ink shadow-sm border border-rule"
                    : "text-ink-muted hover:text-ink"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            {/* 视图模式切换 */}
            {format === "clash" && (
              <div className="flex items-center gap-1 bg-paper p-1 rounded-md border border-rule mr-1">
                <button
                  type="button"
                  onClick={() => setViewMode("visual")}
                  className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded transition-all font-medium ${
                    viewMode === "visual"
                      ? "bg-accent/15 text-accent border border-accent/40 shadow-sm"
                      : "text-ink-secondary hover:text-ink hover:bg-paper-2"
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>策略组可视化预览</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("code")}
                  className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded transition-all font-medium ${
                    viewMode === "code"
                      ? "bg-accent/15 text-accent border border-accent/40 shadow-sm"
                      : "text-ink-secondary hover:text-ink hover:bg-paper-2"
                  }`}
                >
                  <Code className="w-3.5 h-3.5" />
                  <span>配置源码 (YAML)</span>
                </button>
              </div>
            )}

            <Button
              variant="secondary"
              size="sm"
              onClick={handleCopyContent}
              icon={copiedContent ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            >
              {copiedContent ? "已复制配置内容" : "复制内容"}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleDownload}
              icon={<DownloadSimple className="w-3.5 h-3.5" />}
            >
              下载配置文件
            </Button>
          </div>
        </div>

        {/* 1. VISUAL POLICY GROUP PREVIEW */}
        {viewMode === "visual" && format === "clash" ? (
          <div className="space-y-5">
            {/* Top Specs Status Bar */}
            <div className="p-3.5 rounded-lg bg-paper-3/50 border border-rule flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-1.5 text-ink-secondary">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>分流模板: <strong className="text-ink font-semibold">服务分类高阶版</strong></span>
                </div>
                <div className="flex items-center gap-1.5 text-ink-secondary">
                  <Pulse className="w-4 h-4 text-accent" />
                  <span>内核机制: <span className="font-mono text-ink">TUN / Fake-IP (198.18.0.1/16)</span></span>
                </div>
                <div className="flex items-center gap-1.5 text-ink-secondary">
                  <Globe className="w-4 h-4 text-indigo-400" />
                  <span>DNS 防泄漏: <span className="font-mono text-ink">阿里 / 腾讯 / Cloudflare DoH</span></span>
                </div>
              </div>
              <span className="text-[11px] text-ink-muted">
                共聚合 {nodes.length} 台 VPS 节点 • 19 个独立服务分流通道
              </span>
            </div>

            {/* Section 1: PROXY-Gate & 4 Main Regional Groups */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-ink flex items-center gap-1.5">
                  <Sliders className="w-4 h-4 text-accent" />
                  总出口策略组 (PROXY-Gate) 与四大节点出口
                </span>
                <span className="text-[11px] text-ink-muted">
                  默认代理总闸门，未命中独立服务规则时走此出口
                </span>
              </div>

              {/* Master Gate Card */}
              <div className="p-4 rounded-xl bg-paper border border-rule space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-rule">
                  <div className="flex items-center gap-2">
                    <img
                      src="https://fastly.jsdelivr.net/gh/Koolson/Qure/IconSet/Color/Final.png"
                      alt="PROXY-Gate"
                      className="w-5 h-5 rounded-full object-contain"
                    />
                    <span className="text-sm font-semibold text-ink">PROXY-Gate</span>
                    <span className="text-[11px] text-ink-muted font-mono">(主出口策略组 · Select)</span>
                  </div>
                  <div className="text-xs text-ink-secondary">
                    当前模拟默认出口: <span className="text-accent font-semibold">{mockSelectedGate}</span>
                  </div>
                </div>

                {/* 5 Main Egress Options */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {[
                    { name: "美国节点", icon: "🇺🇸", desc: "自动优选 (低延迟测速)" },
                    { name: "亚太节点", icon: "🌏", desc: "自动优选 (香港/日本等)" },
                    { name: "欧洲节点", icon: "🇪🇺", desc: "自动优选 (英国/欧洲等)" },
                    { name: "手动选择", icon: "🎯", desc: "自选具体单个 VPS" },
                    { name: "DIRECT", icon: "⚡", desc: "全球直连 (不走代理)" },
                  ].map((egress) => {
                    const isSelected = mockSelectedGate === egress.name;
                    return (
                      <button
                        key={egress.name}
                        type="button"
                        onClick={() => setMockSelectedGate(egress.name)}
                        className={`p-2.5 rounded-lg border text-left transition-all ${
                          isSelected
                            ? "bg-accent/15 border-accent text-accent shadow-sm ring-1 ring-accent/30"
                            : "bg-paper-2 border-rule text-ink-secondary hover:text-ink hover:bg-paper-hover"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold flex items-center gap-1.5">
                            <span>{egress.icon}</span>
                            <span>{egress.name}</span>
                          </span>
                          {isSelected && <Check weight="bold" className="w-3.5 h-3.5 text-accent" />}
                        </div>
                        <div className="text-[10px] text-ink-muted mt-1 truncate">{egress.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 4 Regional Node Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-1">
                {/* 1. 美国节点 */}
                <div className="p-3.5 rounded-lg bg-paper border border-rule space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-ink flex items-center gap-1.5">
                      <span>🇺🇸</span>
                      <span>美国节点</span>
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 font-mono border border-blue-500/20">
                      URL-Test 测速
                    </span>
                  </div>
                  <div className="text-[11px] text-ink-muted leading-relaxed">
                    智能聚合所有美国原生 / 住宅与中继解锁链路，自动选择延迟最低节点。
                  </div>
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[10px] text-ink-muted font-mono block">包含 VPS ({usNodes.length}):</span>
                    {usNodes.length > 0 ? (
                      usNodes.map((n) => (
                        <div
                          key={n.id}
                          className="px-2 py-1 rounded bg-paper-2 border border-rule text-[11px] font-mono flex items-center justify-between"
                        >
                          <span className="truncate text-ink-secondary">{n.name}</span>
                          <span className="text-[10px] text-emerald-400 shrink-0">{n.latencyMs}ms</span>
                        </div>
                      ))
                    ) : (
                      <span className="text-[11px] text-ink-muted italic">暂无美国节点 (自动 DIRECT 保底)</span>
                    )}
                  </div>
                </div>

                {/* 2. 亚太节点 */}
                <div className="p-3.5 rounded-lg bg-paper border border-rule space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-ink flex items-center gap-1.5">
                      <span>🌏</span>
                      <span>亚太节点</span>
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono border border-emerald-500/20">
                      URL-Test 测速
                    </span>
                  </div>
                  <div className="text-[11px] text-ink-muted leading-relaxed">
                    聚合香港、日本、新加坡、台湾等低延迟节点，适合流媒体与高速浏览。
                  </div>
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[10px] text-ink-muted font-mono block">包含 VPS ({apacNodes.length}):</span>
                    {apacNodes.length > 0 ? (
                      apacNodes.map((n) => (
                        <div
                          key={n.id}
                          className="px-2 py-1 rounded bg-paper-2 border border-rule text-[11px] font-mono flex items-center justify-between"
                        >
                          <span className="truncate text-ink-secondary">{n.name}</span>
                          <span className="text-[10px] text-emerald-400 shrink-0">{n.latencyMs}ms</span>
                        </div>
                      ))
                    ) : (
                      <span className="text-[11px] text-ink-muted italic">暂无亚太节点 (自动 DIRECT 保底)</span>
                    )}
                  </div>
                </div>

                {/* 3. 欧洲节点 */}
                <div className="p-3.5 rounded-lg bg-paper border border-rule space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-ink flex items-center gap-1.5">
                      <span>🇪🇺</span>
                      <span>欧洲节点</span>
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 font-mono border border-purple-500/20">
                      URL-Test 测速
                    </span>
                  </div>
                  <div className="text-[11px] text-ink-muted leading-relaxed">
                    聚合英国、德国、法国、荷兰等欧洲地区节点，适合特定地区版权与服务。
                  </div>
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[10px] text-ink-muted font-mono block">包含 VPS ({euNodes.length}):</span>
                    {euNodes.length > 0 ? (
                      euNodes.map((n) => (
                        <div
                          key={n.id}
                          className="px-2 py-1 rounded bg-paper-2 border border-rule text-[11px] font-mono flex items-center justify-between"
                        >
                          <span className="truncate text-ink-secondary">{n.name}</span>
                          <span className="text-[10px] text-emerald-400 shrink-0">{n.latencyMs}ms</span>
                        </div>
                      ))
                    ) : (
                      <span className="text-[11px] text-ink-muted italic">暂无欧洲节点 (自动 DIRECT 保底)</span>
                    )}
                  </div>
                </div>

                {/* 4. 手动选择 */}
                <div className="p-3.5 rounded-lg bg-paper border border-rule space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-ink flex items-center gap-1.5">
                      <span>🎯</span>
                      <span>手动选择</span>
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 font-mono border border-amber-500/20">
                      全量单选 · Select
                    </span>
                  </div>
                  <div className="text-[11px] text-ink-muted leading-relaxed">
                    列出纳管的所有 VPS 节点，方便在客户端手动固定锁定某台具体服务器。
                  </div>
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[10px] text-ink-muted font-mono block">支持节点 ({nodes.length} 台):</span>
                    <div className="max-h-24 overflow-y-auto space-y-1 pr-1">
                      {nodes.map((n) => (
                        <div
                          key={n.id}
                          className="px-2 py-0.5 rounded bg-paper-2 border border-rule text-[10px] font-mono flex items-center justify-between"
                        >
                          <span className="truncate text-ink-secondary">{n.name}</span>
                          <span className="text-[9px] text-ink-muted uppercase">{n.protocol}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2: 19 Service-Dedicated Routing Channels */}
            <div className="space-y-3 pt-2 border-t border-rule">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <ArrowsSplit className="w-4 h-4 text-accent" />
                  <span className="text-xs font-semibold text-ink">
                    19 个精细化独立服务分流通道 (互不串流)
                  </span>
                </div>

                {/* Filter Tabs */}
                <div className="flex items-center gap-1 bg-paper p-0.5 rounded-md border border-rule text-xs">
                  {[
                    { id: "all", label: "全部服务 (19)" },
                    { id: "ai", label: "🤖 AI 大模型 (5)" },
                    { id: "media", label: "📺 流媒体 (6)" },
                    { id: "social", label: "🌐 社交与开发 (8)" },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveCategory(tab.id as any)}
                      className={`px-2.5 py-0.5 rounded text-[11px] font-medium transition-colors ${
                        activeCategory === tab.id
                          ? "bg-accent/15 text-accent"
                          : "text-ink-muted hover:text-ink"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Service Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredServices.map((svc) => (
                  <div
                    key={svc.id}
                    className="p-3.5 rounded-lg bg-paper border border-rule flex flex-col justify-between gap-2.5 hover:border-rule-active transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img
                          src={svc.icon}
                          alt={svc.name}
                          className="w-6 h-6 rounded-md object-contain shrink-0 bg-paper-3 p-0.5"
                          onError={(e) => {
                            // Fallback if image blocked
                            (e.target as HTMLElement).style.display = "none";
                          }}
                        />
                        <div className="min-w-0">
                          <span className="text-xs font-semibold text-ink block truncate">{svc.label}</span>
                          <span className="text-[10px] text-ink-muted truncate block">{svc.desc}</span>
                        </div>
                      </div>

                      <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-medium shrink-0 ${
                        svc.defaultGroup === "美国节点"
                          ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                          : svc.defaultGroup === "亚太节点"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                      }`}>
                        ➔ {svc.defaultGroup}
                      </span>
                    </div>

                    <div className="pt-2 border-t border-rule/60 flex items-center justify-between text-[10px] text-ink-muted">
                      <span>可选出口:</span>
                      <span className="font-mono text-ink-secondary truncate">
                        美国节点 · 亚太节点 · 欧洲节点 · 手动 · 直连
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* 2. RAW CONFIGURATION SOURCE PREVIEW */
          <div className="relative rounded-md bg-paper border border-rule overflow-hidden">
            <div className="px-4 py-2 bg-paper-3/40 border-b border-rule flex items-center justify-between text-[11px] font-mono text-ink-muted">
              <span>实时渲染结果 ({format.toUpperCase()})</span>
              <span>自适应规则分流 • TUN/Fake-IP 预设</span>
            </div>

            <pre className="p-4 text-xs font-mono text-ink-secondary overflow-x-auto max-h-[500px] leading-relaxed select-all">
              {loadingPreview ? "正在生成配置预览..." : previewContent}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};
