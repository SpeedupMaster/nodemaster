import React, { useState, useEffect, useMemo } from "react";
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
  CaretUp,
  CaretDown,
  MagnifyingGlass,
  ArrowsIn,
  ArrowsOut,
  PencilSimple,
  Globe,
  Key,
  ArrowsClockwise,
  FloppyDisk,
  X,
} from "@phosphor-icons/react";

interface SubscriptionViewProps {
  subscriptions: SubscriptionToken[];
  nodes: NodeItem[];
  onUpdateSubscription?: (id: string, updates: Partial<SubscriptionToken>) => Promise<any>;
}

interface PolicyGroupCardData {
  id: string;
  name: string;
  type: "Selector" | "URLTest" | "Fallback";
  icon: string;
  category: "core" | "ai" | "media" | "social";
  defaultSelected: string;
}

const POLICY_GROUPS_CONFIG: PolicyGroupCardData[] = [
  // 核心出口与测速组
  {
    id: "proxy-gate",
    name: "节点选择",
    type: "Selector",
    icon: "https://fastly.jsdelivr.net/gh/Koolson/Qure/IconSet/Color/Final.png",
    category: "core",
    defaultSelected: "自动选择",
  },
  {
    id: "auto-test",
    name: "自动选择",
    type: "URLTest",
    icon: "https://fastly.jsdelivr.net/gh/Koolson/Qure/IconSet/Color/Auto.png",
    category: "core",
    defaultSelected: "HK-BGP-Direct-01",
  },
  {
    id: "us-auto",
    name: "美国节点",
    type: "URLTest",
    icon: "https://fastly.jsdelivr.net/gh/Koolson/Qure/IconSet/Color/United_States.png",
    category: "core",
    defaultSelected: "US-Residential-Unlock-01",
  },
  {
    id: "apac-auto",
    name: "亚太节点",
    type: "URLTest",
    icon: "https://fastly.jsdelivr.net/gh/Koolson/Qure/IconSet/Color/Hong_Kong.png",
    category: "core",
    defaultSelected: "HK-BGP-Direct-01",
  },
  {
    id: "eu-auto",
    name: "欧洲节点",
    type: "URLTest",
    icon: "https://fastly.jsdelivr.net/gh/Koolson/Qure/IconSet/Color/Europe_Map.png",
    category: "core",
    defaultSelected: "UK-London-Unlock-02",
  },
  {
    id: "manual-select",
    name: "手动选择",
    type: "Selector",
    icon: "https://fastly.jsdelivr.net/gh/Koolson/Qure/IconSet/Color/Global.png",
    category: "core",
    defaultSelected: "HK-BGP-Direct-01",
  },
  {
    id: "ad-block",
    name: "广告拦截",
    type: "Selector",
    icon: "https://fastly.jsdelivr.net/gh/Koolson/Qure/IconSet/Color/Reject.png",
    category: "core",
    defaultSelected: "REJECT",
  },

  // AI 大模型专线
  {
    id: "gpt",
    name: "GPT",
    type: "Selector",
    icon: "https://fastly.jsdelivr.net/gh/shindgewongxj/WHATSINStash/icon/openai.png",
    category: "ai",
    defaultSelected: "美国节点",
  },
  {
    id: "gemini",
    name: "Gemini",
    type: "Selector",
    icon: "https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/png/google-gemini.png",
    category: "ai",
    defaultSelected: "美国节点",
  },
  {
    id: "claude",
    name: "Claude",
    type: "Selector",
    icon: "https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/png/anthropic.png",
    category: "ai",
    defaultSelected: "美国节点",
  },
  {
    id: "copilot",
    name: "Copilot",
    type: "Selector",
    icon: "https://fastly.jsdelivr.net/gh/Koolson/Qure/IconSet/Color/Copilot.png",
    category: "ai",
    defaultSelected: "美国节点",
  },
  {
    id: "grok",
    name: "Grok",
    type: "Selector",
    icon: "https://raw.githubusercontent.com/luestr/IconResource/main/App_icon/120px/Grok.png",
    category: "ai",
    defaultSelected: "美国节点",
  },

  // 流媒体视频专线
  {
    id: "youtube",
    name: "油管视频 (YouTube)",
    type: "Selector",
    icon: "https://fastly.jsdelivr.net/gh/Koolson/Qure/IconSet/Color/YouTube.png",
    category: "media",
    defaultSelected: "节点选择",
  },
  {
    id: "netflix",
    name: "Netflix 奈飞",
    type: "Selector",
    icon: "https://fastly.jsdelivr.net/gh/Koolson/Qure/IconSet/Color/Netflix.png",
    category: "media",
    defaultSelected: "节点选择",
  },
  {
    id: "disney",
    name: "Disney+ 迪士尼",
    type: "Selector",
    icon: "https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Disney+.png",
    category: "media",
    defaultSelected: "节点选择",
  },
  {
    id: "spotify",
    name: "Spotify 音乐",
    type: "Selector",
    icon: "https://fastly.jsdelivr.net/gh/Koolson/Qure/IconSet/Color/Spotify.png",
    category: "media",
    defaultSelected: "节点选择",
  },
  {
    id: "tiktok",
    name: "TikTok 国际版",
    type: "Selector",
    icon: "https://fastly.jsdelivr.net/gh/Koolson/Qure/IconSet/Color/TikTok.png",
    category: "media",
    defaultSelected: "节点选择",
  },

  // 社交与常用工具
  {
    id: "google",
    name: "谷歌服务 (Google)",
    type: "Selector",
    icon: "https://fastly.jsdelivr.net/gh/Koolson/Qure/IconSet/Color/Google.png",
    category: "social",
    defaultSelected: "美国节点",
  },
  {
    id: "microsoft",
    name: "微软服务 (Microsoft)",
    type: "Selector",
    icon: "https://fastly.jsdelivr.net/gh/Koolson/Qure/IconSet/Color/Microsoft.png",
    category: "social",
    defaultSelected: "节点选择",
  },
  {
    id: "telegram",
    name: "电报消息 (Telegram)",
    type: "Selector",
    icon: "https://fastly.jsdelivr.net/gh/Koolson/Qure/IconSet/Color/Telegram.png",
    category: "social",
    defaultSelected: "节点选择",
  },
  {
    id: "apple",
    name: "苹果服务 (Apple)",
    type: "Selector",
    icon: "https://fastly.jsdelivr.net/gh/Koolson/Qure/IconSet/Color/Apple.png",
    category: "social",
    defaultSelected: "DIRECT",
  },
  {
    id: "twitter",
    name: "推特/X",
    type: "Selector",
    icon: "https://fastly.jsdelivr.net/gh/shindgewongxj/WHATSINStash/icon/x.png",
    category: "social",
    defaultSelected: "节点选择",
  },
  {
    id: "meta",
    name: "Meta 系 (FB/IG/WA)",
    type: "Selector",
    icon: "https://fastly.jsdelivr.net/gh/Koolson/Qure/IconSet/Color/Facebook.png",
    category: "social",
    defaultSelected: "节点选择",
  },
  {
    id: "github",
    name: "GitHub 代码托管",
    type: "Selector",
    icon: "https://fastly.jsdelivr.net/gh/Koolson/Qure/IconSet/Color/GitHub.png",
    category: "social",
    defaultSelected: "节点选择",
  },
  {
    id: "speedtest",
    name: "网络测速 (Speedtest)",
    type: "Selector",
    icon: "https://fastly.jsdelivr.net/gh/Koolson/Qure/IconSet/Color/Speedtest.png",
    category: "social",
    defaultSelected: "节点选择",
  },
];

interface GroupProxyOption {
  name: string;
  type: string;
}

const formatProtocol = (proto?: string) => {
  if (!proto) return "Node";
  if (proto === "vless-reality") return "VLESS";
  if (proto === "ss") return "SS";
  if (proto === "vmess") return "VMess";
  if (proto === "trojan") return "Trojan";
  if (proto === "hysteria2") return "Hy2";
  return proto.toUpperCase();
};

const isUSNode = (n: NodeItem) => {
  const name = n.name || "";
  const country = (n.country || "").toUpperCase();
  if (country === "US" || country === "USA") return true;
  return /(\bUS\b|\bUSA\b|\[US\]|United States|美国|洛杉矶|硅谷|旧金山|西雅图|纽约|达拉斯|芝加哥|凤凰城|波特兰)/i.test(name);
};

const isAPACNode = (n: NodeItem) => {
  const name = n.name || "";
  const country = (n.country || "").toUpperCase();
  if (["HK", "JP", "SG", "TW", "KR", "MO"].includes(country)) return true;
  return /(\bHK\b|\bJP\b|\bSG\b|\bTW\b|\bKR\b|\[HK\]|\[JP\]|\[SG\]|\[TW\]|\[KR\]|香港|日本|东京|大阪|新加坡|狮城|台湾|台北|韩国|首尔|亚太|Hong Kong|Japan|Singapore|Taiwan|Korea)/i.test(name);
};

const isEUNode = (n: NodeItem) => {
  const name = n.name || "";
  const country = (n.country || "").toUpperCase();
  if (["UK", "GB", "DE", "FR", "RU", "NL", "IT", "ES", "SE", "CH"].includes(country)) return true;
  // 必须严格使用单词边界 \b，绝不裸写 DE/FR/NL 避免误匹配 Residential 里的 de
  return /(\bUK\b|\bGB\b|\bDE\b|\bFR\b|\bRU\b|\bNL\b|\bEUR\b|\[UK\]|\[GB\]|\[DE\]|\[FR\]|\[RU\]|\[NL\]|英国|伦敦|德国|法兰克福|法国|巴黎|俄罗斯|莫斯科|荷兰|阿姆斯特丹|欧洲|Britain|London|Germany|Frankfurt|France|Paris|Russia|Moscow|Netherlands)/i.test(name);
};

export const SubscriptionView: React.FC<SubscriptionViewProps> = ({
  subscriptions,
  nodes,
  onUpdateSubscription,
}) => {
  const [selectedSubToken, setSelectedSubToken] = useState<string>("");
  const [format, setFormat] = useState<"clash" | "singbox" | "egern" | "base64">("clash");
  const [viewMode, setViewMode] = useState<"visual" | "code">("visual");
  const [previewContent, setPreviewContent] = useState<string>("");
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedContent, setCopiedContent] = useState(false);
  const [activeCategory, setActiveCategory] = useState<"all" | "core" | "ai" | "media" | "social">("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Custom subscription URL editing state
  const [isEditingUrl, setIsEditingUrl] = useState(false);
  const [customHostInput, setCustomHostInput] = useState("");
  const [customTokenInput, setCustomTokenInput] = useState("");
  const [customNameInput, setCustomNameInput] = useState("");
  const [isSavingUrl, setIsSavingUrl] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);

  // Store user-selected proxy for each group
  const [selectedMap, setSelectedMap] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    POLICY_GROUPS_CONFIG.forEach((g) => {
      init[g.id] = g.defaultSelected;
    });
    return init;
  });

  // Store collapsed state for groups (default empty = all groups expanded)
  const [collapsedSet, setCollapsedSet] = useState<Set<string>>(new Set());

  const activeSub =
    subscriptions.find((s) => s.token === selectedSubToken) ||
    subscriptions[0];

  useEffect(() => {
    if (subscriptions.length > 0 && !selectedSubToken) {
      setSelectedSubToken(subscriptions[0].token);
    }
  }, [subscriptions, selectedSubToken]);

  // Sync inputs when activeSub changes
  useEffect(() => {
    if (activeSub) {
      setCustomHostInput(activeSub.customHost || "");
      setCustomTokenInput(activeSub.token || "");
      setCustomNameInput(activeSub.name || "");
      setUrlError(null);
    }
  }, [activeSub?.id, activeSub?.token, activeSub?.customHost, activeSub?.name]);

  const baseUrl = (activeSub?.customHost || window.location.origin).replace(/\/+$/, "");
  const subUrl = activeSub
    ? `${baseUrl}/api/sub/${activeSub.token}`
    : "";

  // Fetch preview when activeSub or format changes
  useEffect(() => {
    if (!activeSub?.token) return;
    setLoadingPreview(true);
    fetch(`/api/sub/${activeSub.token}?format=${format}`)
      .then((r) => r.text())
      .then((txt) => setPreviewContent(txt))
      .catch((e) => console.error(e))
      .finally(() => setLoadingPreview(false));
  }, [activeSub?.token, format]);

  const handleOpenEdit = () => {
    if (activeSub) {
      setCustomHostInput(activeSub.customHost || "");
      setCustomTokenInput(activeSub.token || "");
      setCustomNameInput(activeSub.name || "");
      setUrlError(null);
      setIsEditingUrl(true);
    }
  };

  const handleGenerateRandomToken = () => {
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    let rand = "";
    for (let i = 0; i < 24; i++) {
      rand += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setCustomTokenInput(`sub_${rand}`);
  };

  const handleSaveCustomUrl = async () => {
    if (!activeSub) return;
    const cleanToken = customTokenInput.trim();
    if (!cleanToken) {
      setUrlError("订阅 Token 标识不能为空");
      return;
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(cleanToken)) {
      setUrlError("Token 仅支持英文字母、数字、下划线(_)与中划线(-)");
      return;
    }

    let cleanHost = customHostInput.trim();
    if (cleanHost) {
      if (!cleanHost.startsWith("http://") && !cleanHost.startsWith("https://")) {
        cleanHost = `https://${cleanHost}`;
      }
      cleanHost = cleanHost.replace(/\/+$/, "");
    }

    setIsSavingUrl(true);
    setUrlError(null);
    try {
      if (onUpdateSubscription) {
        const res = await onUpdateSubscription(activeSub.id, {
          name: customNameInput.trim() || activeSub.name,
          token: cleanToken,
          customHost: cleanHost,
        });
        if (res && !res.success) {
          setUrlError(res.message || "保存失败");
          return;
        }
      }
      setSelectedSubToken(cleanToken);
      setIsEditingUrl(false);
    } catch (err: any) {
      setUrlError(err.message || "网络请求异常，保存失败");
    } finally {
      setIsSavingUrl(false);
    }
  };

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
    const ext = format === "clash" || format === "egern" ? "yaml" : format === "singbox" ? "json" : "txt";
    const blob = new Blob([previewContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nodemaster_${format}_${activeSub?.name || "config"}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const oneClickClashUrl = `clash://install-config?url=${encodeURIComponent(subUrl)}&name=${encodeURIComponent(activeSub?.name || "NodeMaster")}`;
  const egernSubUrl = subUrl ? `${subUrl}?format=egern` : "";
  const oneClickEgernUrl = `egern:/profiles/new?name=${encodeURIComponent(activeSub?.name || "NodeMaster")}&url=${encodeURIComponent(egernSubUrl)}`;

  const toggleCollapse = (id: string) => {
    setCollapsedSet((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const collapseAll = () => {
    setCollapsedSet(new Set(POLICY_GROUPS_CONFIG.map((g) => g.id)));
  };

  const expandAll = () => {
    setCollapsedSet(new Set());
  };

  // Build the list of sub-proxies for a group
  const getGroupProxies = (group: PolicyGroupCardData): GroupProxyOption[] => {
    // 1. 自动选择 (URL-Test): 全部实体代理节点，绝不包含 DIRECT（避免直连导致测速偏差和漏IP）
    if (group.id === "auto-test") {
      return nodes.map((n) => ({
        name: n.name,
        type: formatProtocol(n.protocol),
      }));
    }

    // 2. 手动选择 (Selector): 用户可自由选择任意单个实体节点，亦可手动切 DIRECT
    if (group.id === "manual-select") {
      return [
        ...nodes.map((n) => ({
          name: n.name,
          type: formatProtocol(n.protocol),
        })),
        { name: "DIRECT", type: "Direct" },
      ];
    }

    // 3. 美国节点 (URL-Test): 仅包含真实美国实体代理节点，不包含 DIRECT
    if (group.id === "us-auto") {
      const usList = nodes.filter(isUSNode);
      return usList.map((n) => ({
        name: n.name,
        type: formatProtocol(n.protocol),
      }));
    }

    // 4. 亚太节点 (URL-Test): 仅包含真实亚太实体代理节点，不包含 DIRECT
    if (group.id === "apac-auto") {
      const apacList = nodes.filter(isAPACNode);
      return apacList.map((n) => ({
        name: n.name,
        type: formatProtocol(n.protocol),
      }));
    }

    // 5. 欧洲节点 (EU-Auto): 仅包含真实欧洲实体代理节点，严格排除美国住宅等误匹配，不包含 DIRECT
    if (group.id === "eu-auto") {
      const euList = nodes.filter(isEUNode);
      return euList.map((n) => ({
        name: n.name,
        type: formatProtocol(n.protocol),
      }));
    }

    // 6. 广告拦截
    if (group.id === "ad-block") {
      return [
        { name: "REJECT", type: "Reject" },
        { name: "DIRECT", type: "Direct" },
        { name: "节点选择", type: "Selector" },
      ];
    }

    // 7. 顶级总出口（节点选择）：包含各大核心策略分类
    if (group.id === "proxy-gate") {
      return [
        { name: "自动选择", type: "URL-Test" },
        { name: "美国节点", type: "URL-Test" },
        { name: "亚太节点", type: "URL-Test" },
        { name: "欧洲节点", type: "URL-Test" },
        { name: "手动选择", type: "Selector" },
        { name: "DIRECT", type: "Direct" },
        { name: "REJECT", type: "Reject" },
      ];
    }

    // 8. AI 专线组 (GPT, Gemini, Claude, Copilot, Grok) 与 谷歌服务 (Google)：默认首选美国节点
    if (group.category === "ai" || group.id === "google") {
      return [
        { name: "美国节点", type: "URL-Test" },
        { name: "自动选择", type: "URL-Test" },
        { name: "亚太节点", type: "URL-Test" },
        { name: "欧洲节点", type: "URL-Test" },
        { name: "手动选择", type: "Selector" },
        { name: "节点选择", type: "Selector" },
        { name: "DIRECT", type: "Direct" },
        { name: "REJECT", type: "Reject" },
      ];
    }

    // 9. 苹果服务 (Apple)：默认首选 DIRECT，可灵活切换各区域节点
    if (group.id === "apple") {
      return [
        { name: "DIRECT", type: "Direct" },
        { name: "自动选择", type: "URL-Test" },
        { name: "亚太节点", type: "URL-Test" },
        { name: "美国节点", type: "URL-Test" },
        { name: "欧洲节点", type: "URL-Test" },
        { name: "手动选择", type: "Selector" },
        { name: "节点选择", type: "Selector" },
        { name: "REJECT", type: "Reject" },
      ];
    }

    // 10. 微软服务 (Microsoft)：默认首选「节点选择」
    if (group.id === "microsoft") {
      return [
        { name: "节点选择", type: "Selector" },
        { name: "自动选择", type: "URL-Test" },
        { name: "DIRECT", type: "Direct" },
        { name: "亚太节点", type: "URL-Test" },
        { name: "美国节点", type: "URL-Test" },
        { name: "欧洲节点", type: "URL-Test" },
        { name: "手动选择", type: "Selector" },
        { name: "REJECT", type: "Reject" },
      ];
    }

    // 11. 推特/X 与 GitHub 代码托管：首选「节点选择」
    if (group.id === "twitter" || group.id === "github") {
      return [
        { name: "节点选择", type: "Selector" },
        { name: "自动选择", type: "URL-Test" },
        { name: "美国节点", type: "URL-Test" },
        { name: "亚太节点", type: "URL-Test" },
        { name: "欧洲节点", type: "URL-Test" },
        { name: "手动选择", type: "Selector" },
        { name: "DIRECT", type: "Direct" },
        { name: "REJECT", type: "Reject" },
      ];
    }

    // 12. 流媒体与社交专线（TikTok、YouTube、Netflix、Disney+、Spotify、Telegram、Meta、Speedtest）：首选「节点选择」
    return [
      { name: "节点选择", type: "Selector" },
      { name: "自动选择", type: "URL-Test" },
      { name: "亚太节点", type: "URL-Test" },
      { name: "美国节点", type: "URL-Test" },
      { name: "欧洲节点", type: "URL-Test" },
      { name: "手动选择", type: "Selector" },
      { name: "DIRECT", type: "Direct" },
      { name: "REJECT", type: "Reject" },
    ];
  };

  const filteredGroups = useMemo(() => {
    return POLICY_GROUPS_CONFIG.filter((g) => {
      if (activeCategory !== "all" && g.category !== activeCategory) return false;
      if (searchQuery && !g.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [activeCategory, searchQuery]);

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
              服务端依据客户端的 User-Agent 自动自适应下发对应配置（Clash Meta / Mihomo、Sing-box、Egern、Shadowrocket）。包含自动选择、美国节点、亚太节点、欧洲节点与独立服务专线。
            </p>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
            <a
              href={oneClickClashUrl}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-md bg-accent text-paper font-semibold text-xs hover:bg-accent-hover transition-colors shadow-sm"
            >
              <Sparkle weight="fill" className="w-3.5 h-3.5" />
              一键导入 Clash
            </a>
            <a
              href={oneClickEgernUrl}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-md bg-paper-3 text-ink font-semibold text-xs border border-rule hover:bg-paper-2 hover:border-accent/40 transition-colors shadow-sm"
            >
              <Sparkle weight="fill" className="w-3.5 h-3.5 text-accent" />
              一键导入 Egern
            </a>
          </div>
        </div>

        {/* URL Box & Custom Editor */}
        {!isEditingUrl ? (
          <div className="mt-4 p-3 rounded-lg bg-paper border border-rule flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className="text-xs font-mono text-ink-secondary truncate select-all">
                {subUrl || "加载中..."}
              </span>
              {activeSub?.customHost && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-accent/10 text-accent border border-accent/20 flex-shrink-0" title={`已指定域名/前缀: ${activeSub.customHost}`}>
                  自定义域名
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleOpenEdit}
                icon={<PencilSimple className="w-3.5 h-3.5 text-accent" />}
              >
                自定义链接
              </Button>
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
        ) : (
          <div className="mt-4 p-4 rounded-xl bg-paper border border-accent/40 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-rule pb-2.5">
              <div className="flex items-center gap-2">
                <PencilSimple weight="bold" className="w-4 h-4 text-accent" />
                <h3 className="text-xs font-semibold text-ink">自定义订阅链接配置</h3>
                <span className="text-[11px] text-ink-muted">（个性化订阅域名与路径 Token）</span>
              </div>
              <button
                type="button"
                onClick={() => setIsEditingUrl(false)}
                className="text-ink-muted hover:text-ink p-1 rounded transition-colors"
                title="取消编辑"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Custom Host / Domain */}
              <div className="space-y-1.5">
                <label className="flex items-center justify-between text-xs font-medium text-ink">
                  <span className="flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-accent" />
                    自定义域名 / 服务端 Host
                  </span>
                  <span className="text-[10px] text-ink-muted">选填</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={customHostInput}
                    onChange={(e) => setCustomHostInput(e.target.value)}
                    placeholder={`例如 https://sub.mydomain.com (当前: ${window.location.origin})`}
                    className="w-full px-3 py-2 text-xs font-mono rounded-md bg-paper-2 border border-rule text-ink placeholder:text-ink-muted/60 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all"
                  />
                </div>
                <p className="text-[11px] text-ink-muted">
                  留空默认使用当前浏览器地址。适合反向代理、公网 IP 或 Cloudflare 域名。
                </p>
              </div>

              {/* Custom Token / Suffix */}
              <div className="space-y-1.5">
                <label className="flex items-center justify-between text-xs font-medium text-ink">
                  <span className="flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-accent" />
                    订阅 Token / 路径标识符
                  </span>
                  <span className="text-[10px] text-accent font-medium">必填</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={customTokenInput}
                    onChange={(e) => setCustomTokenInput(e.target.value)}
                    placeholder="例如 my_secret_token_888"
                    className="flex-1 px-3 py-2 text-xs font-mono rounded-md bg-paper-2 border border-rule text-ink placeholder:text-ink-muted/60 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleGenerateRandomToken}
                    icon={<ArrowsClockwise className="w-3.5 h-3.5" />}
                    title="生成随机高安全度 Token"
                  >
                    随机生成
                  </Button>
                </div>
                <p className="text-[11px] text-ink-muted">
                  仅限英文字母、数字、下划线及连字符。修改后旧订阅链接将立即失效。
                </p>
              </div>
            </div>

            {/* Real-time URL preview banner */}
            <div className="p-2.5 rounded-lg bg-paper-2 border border-rule flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[11px] font-semibold text-accent flex-shrink-0">实时生成预览:</span>
                <span className="text-xs font-mono text-ink-secondary truncate select-all">
                  {`${(customHostInput.trim() || window.location.origin).replace(/\/+$/, "")}/api/sub/${customTokenInput.trim() || "token"}`}
                </span>
              </div>
              {urlError && (
                <span className="text-xs text-rose-500 font-medium flex-shrink-0">
                  {urlError}
                </span>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-end gap-2 pt-1 border-t border-rule">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setIsEditingUrl(false)}
                disabled={isSavingUrl}
              >
                取消
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={handleSaveCustomUrl}
                loading={isSavingUrl}
                icon={<FloppyDisk className="w-3.5 h-3.5" />}
              >
                保存并应用
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Subscription Format & View Mode Switcher */}
      <div className="p-6 rounded-xl bg-paper-2 border border-rule space-y-4">
        {/* Top Header & Actions Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-rule">
          <div className="flex items-center gap-1 bg-paper p-1 rounded-md border border-rule">
            {[
              { id: "clash", label: "Clash Meta / Mihomo (YAML)" },
              { id: "singbox", label: "Sing-box (JSON)" },
              { id: "egern", label: "Egern (YAML)" },
              { id: "base64", label: "Shadowrocket / 通用 (Base64)" },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setFormat(item.id as any);
                  if (item.id !== "clash" && item.id !== "egern") setViewMode("code");
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
            {/* View Mode Switcher */}
            {(format === "clash" || format === "egern") && (
              <div className="flex items-center gap-1 bg-paper p-1 rounded-md border border-rule mr-1">
                <button
                  type="button"
                  onClick={() => setViewMode("visual")}
                  className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded transition-all font-medium ${
                    viewMode === "visual"
                      ? "bg-accent/15 text-accent border border-accent/40 shadow-sm font-semibold"
                      : "text-ink-secondary hover:text-ink hover:bg-paper-2"
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>策略组面板</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("code")}
                  className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded transition-all font-medium ${
                    viewMode === "code"
                      ? "bg-accent/15 text-accent border border-accent/40 shadow-sm font-semibold"
                      : "text-ink-secondary hover:text-ink hover:bg-paper-2"
                  }`}
                >
                  <Code className="w-3.5 h-3.5" />
                  <span>源码预览</span>
                </button>
              </div>
            )}

            {format === "egern" && (
              <a
                href={oneClickEgernUrl}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-accent text-paper font-semibold text-xs hover:bg-accent-hover transition-colors shadow-sm"
              >
                <Sparkle weight="fill" className="w-3.5 h-3.5" />
                导入 Egern
              </a>
            )}
            {format === "clash" && (
              <a
                href={oneClickClashUrl}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-accent text-paper font-semibold text-xs hover:bg-accent-hover transition-colors shadow-sm"
              >
                <Sparkle weight="fill" className="w-3.5 h-3.5" />
                导入 Clash
              </a>
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

        {/* 1. CLASH & EGERN POLICY GROUP DASHBOARD */}
        {viewMode === "visual" && (format === "clash" || format === "egern") ? (
          <div className="space-y-4">
            {/* Filter and Fold Controls Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg bg-paper border border-rule text-xs">
              {/* Category Filter Tabs */}
              <div className="flex items-center gap-1 bg-paper-3/60 p-1 rounded-md border border-rule">
                {[
                  { id: "all", label: `全部策略组 (${POLICY_GROUPS_CONFIG.length})` },
                  { id: "core", label: "核心出口 (7)" },
                  { id: "ai", label: "🤖 AI 服务 (5)" },
                  { id: "media", label: "📺 流媒体 (5)" },
                  { id: "social", label: "🌐 常用社交 (8)" },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveCategory(tab.id as any)}
                    className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
                      activeCategory === tab.id
                        ? "bg-accent/15 text-accent border border-accent/30 shadow-sm font-semibold"
                        : "text-ink-muted hover:text-ink"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Search & Collapse Controls */}
              <div className="flex items-center gap-2">
                <div className="relative">
                  <MagnifyingGlass className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="搜索策略组..."
                    className="w-36 sm:w-44 pl-8 pr-2.5 py-1 text-xs rounded bg-paper-2 border border-rule text-ink placeholder:text-ink-muted focus:outline-none focus:border-accent"
                  />
                </div>

                <button
                  type="button"
                  onClick={expandAll}
                  className="flex items-center gap-1 px-2 py-1 rounded bg-paper-2 border border-rule hover:bg-paper-hover text-ink-muted hover:text-ink text-xs transition-colors"
                  title="展开全部卡片"
                >
                  <ArrowsOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">展开全部</span>
                </button>
                <button
                  type="button"
                  onClick={collapseAll}
                  className="flex items-center gap-1 px-2 py-1 rounded bg-paper-2 border border-rule hover:bg-paper-hover text-ink-muted hover:text-ink text-xs transition-colors"
                  title="折叠全部卡片"
                >
                  <ArrowsIn className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">折叠全部</span>
                </button>
              </div>
            </div>

            {/* 2-Column Responsive Policy Group Cards Grid (Equal row heights) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
              {filteredGroups.map((group) => {
                const isCollapsed = collapsedSet.has(group.id);
                const proxyList = getGroupProxies(group);
                const isProxyValid = (val?: string) => Boolean(val && proxyList.some((p) => p.name === val));
                const currentSelected = isProxyValid(selectedMap[group.id])
                  ? (selectedMap[group.id] as string)
                  : (isProxyValid(group.defaultSelected) ? group.defaultSelected : (proxyList[0]?.name ?? "DIRECT"));

                return (
                  <div
                    key={group.id}
                    className={`p-3.5 rounded-xl bg-paper border border-rule shadow-sm hover:border-rule-active transition-all flex flex-col w-full ${
                      isCollapsed ? "!h-fit self-start" : "h-full"
                    }`}
                  >
                    {/* Top: Header and Currently Selected Proxy */}
                    <div>
                      {/* Card Header (Icon, Name, Type, and Collapse Toggle) */}
                      <div
                        className="flex items-center justify-between gap-2 cursor-pointer select-none group/hdr"
                        onClick={() => toggleCollapse(group.id)}
                      >
                        {/* Left: Icon, Title & Type */}
                        <div className="flex items-center gap-2.5 min-w-0">
                          <img
                            src={group.icon}
                            alt={group.name}
                            className="w-5 h-5 rounded-full object-contain shrink-0 bg-paper-2 p-0.5 border border-rule/60"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = "none";
                            }}
                          />
                          <div className="flex items-baseline gap-1.5 truncate">
                            <span className="text-xs font-semibold text-ink group-hover/hdr:text-accent transition-colors truncate">
                              {group.name}
                            </span>
                            <span className="text-[10px] text-ink-muted font-mono">
                              : {group.type} ({proxyList.length})
                            </span>
                          </div>
                        </div>

                        {/* Right: Collapse Arrow Button */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            className="p-1 rounded hover:bg-paper-2 text-ink-muted group-hover/hdr:text-ink transition-colors"
                            aria-label={isCollapsed ? "展开" : "折叠"}
                          >
                            {isCollapsed ? (
                              <CaretDown weight="bold" className="w-3.5 h-3.5" />
                            ) : (
                              <CaretUp weight="bold" className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Selected Proxy Row */}
                      <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-ink-secondary font-mono truncate">
                        <span className="text-accent text-[12px] shrink-0">⊙</span>
                        <span className="text-ink-muted shrink-0">当前选择:</span>
                        <span className="text-accent font-medium truncate">{currentSelected}</span>
                      </div>
                    </div>

                    {/* Fixed-position Divider: Perfectly aligned across all cards in the row */}
                    {!isCollapsed && (
                      <div className="my-2.5 border-t border-rule/60 w-full shrink-0" />
                    )}

                    {/* Expanded state: Proxy Tiles Grid (Aligns from top under divider, no sinking) */}
                    {!isCollapsed && (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 flex-1 content-start">
                        {proxyList.map((p) => {
                          const isSelected = currentSelected === p.name;
                          return (
                            <button
                              key={p.name}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedMap((prev) => ({ ...prev, [group.id]: p.name }));
                              }}
                              className={`h-11 px-2.5 py-1.5 rounded-md border text-left transition-all flex flex-col justify-between select-none ${
                                isSelected
                                  ? "bg-accent/15 border-accent text-accent shadow-sm ring-1 ring-accent/30"
                                  : "bg-paper-2 border-rule text-ink hover:bg-paper-hover hover:border-rule-active"
                              }`}
                            >
                              {/* Top: Proxy Name */}
                              <span
                                className={`text-[11px] truncate block leading-tight ${
                                  isSelected ? "text-accent font-semibold" : "text-ink font-medium"
                                }`}
                                title={p.name}
                              >
                                {p.name}
                              </span>

                              {/* Bottom: Type only */}
                              <span
                                className={`text-[9px] font-mono block truncate leading-none ${
                                  isSelected ? "text-accent/75" : "text-ink-muted"
                                }`}
                              >
                                {p.type}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* 2. RAW CONFIGURATION SOURCE PREVIEW (YAML / JSON) */
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
