import { db } from "../db/index.js";
import {
  TrafficAnalyticsSummary,
  ServiceTrafficItem,
  CategoryTrafficSummary,
  NodeTrafficDistribution,
  TrafficTimeSeriesPoint,
  TrafficCategory,
} from "../types/index.js";

// Service base templates with domain characteristics and brand color
const SERVICE_DEFINITIONS = [
  {
    id: "youtube",
    name: "YouTube",
    category: "streaming" as TrafficCategory,
    categoryName: "流媒体串流",
    color: "#ef4444",
    icon: "YoutubeLogo",
    domains: ["*.youtube.com", "*.googlevideo.com", "*.ytimg.com"],
    ratio: 0.265,
    downlinkRatio: 0.94,
    nodesAffinity: { "node-hk-01": 0.48, "node-jp-02": 0.38, "node-us-unlock-01": 0.08, "node-uk-unlock-02": 0.06 },
  },
  {
    id: "netflix",
    name: "Netflix (奈飞)",
    category: "streaming" as TrafficCategory,
    categoryName: "流媒体串流",
    color: "#e50914",
    icon: "FilmSlate",
    domains: ["*.netflix.com", "*.nflxvideo.net", "*.nflxso.net", "*.nflxext.com"],
    ratio: 0.172,
    downlinkRatio: 0.96,
    nodesAffinity: { "node-us-unlock-01": 0.58, "node-uk-unlock-02": 0.32, "node-hk-01": 0.06, "node-jp-02": 0.04 },
  },
  {
    id: "openai",
    name: "OpenAI / ChatGPT",
    category: "ai" as TrafficCategory,
    categoryName: "AI 智能应用",
    color: "#10b981",
    icon: "Robot",
    domains: ["*.chatgpt.com", "*.openai.com", "*.oaistatic.com", "*.oaiusercontent.com"],
    ratio: 0.148,
    downlinkRatio: 0.72,
    nodesAffinity: { "node-us-unlock-01": 0.62, "node-uk-unlock-02": 0.28, "node-hk-01": 0.06, "node-jp-02": 0.04 },
  },
  {
    id: "tiktok",
    name: "TikTok / 抖音海外",
    category: "streaming" as TrafficCategory,
    categoryName: "流媒体串流",
    color: "#00f2fe",
    icon: "Video",
    domains: ["*.tiktok.com", "*.tiktokv.com", "*.byteoversea.com", "*.ibytedtos.com"],
    ratio: 0.092,
    downlinkRatio: 0.92,
    nodesAffinity: { "node-hk-01": 0.44, "node-jp-02": 0.42, "node-us-unlock-01": 0.08, "node-uk-unlock-02": 0.06 },
  },
  {
    id: "github",
    name: "GitHub / Copilot",
    category: "developer" as TrafficCategory,
    categoryName: "开发与代码",
    color: "#8b5cf6",
    icon: "GitBranch",
    domains: ["*.github.com", "*.githubusercontent.com", "api.github.com", "*.githubassets.com"],
    ratio: 0.078,
    downlinkRatio: 0.81,
    nodesAffinity: { "node-hk-01": 0.46, "node-jp-02": 0.36, "node-us-unlock-01": 0.10, "node-uk-unlock-02": 0.08 },
  },
  {
    id: "telegram",
    name: "Telegram (电报)",
    category: "social" as TrafficCategory,
    categoryName: "社交与通讯",
    color: "#0ea5e9",
    icon: "TelegramLogo",
    domains: ["*.telegram.org", "*.t.me", "*.telegram.me", "telegram-cdn.org"],
    ratio: 0.065,
    downlinkRatio: 0.85,
    nodesAffinity: { "node-hk-01": 0.42, "node-jp-02": 0.34, "node-uk-unlock-02": 0.14, "node-us-unlock-01": 0.10 },
  },
  {
    id: "claude",
    name: "Claude (Anthropic)",
    category: "ai" as TrafficCategory,
    categoryName: "AI 智能应用",
    color: "#d97706",
    icon: "Sparkle",
    domains: ["claude.ai", "*.anthropic.com"],
    ratio: 0.056,
    downlinkRatio: 0.70,
    nodesAffinity: { "node-us-unlock-01": 0.65, "node-uk-unlock-02": 0.25, "node-hk-01": 0.06, "node-jp-02": 0.04 },
  },
  {
    id: "twitter",
    name: "Twitter / X",
    category: "social" as TrafficCategory,
    categoryName: "社交与通讯",
    color: "#38bdf8",
    icon: "TwitterLogo",
    domains: ["*.twitter.com", "*.x.com", "*.twimg.com"],
    ratio: 0.048,
    downlinkRatio: 0.88,
    nodesAffinity: { "node-hk-01": 0.45, "node-jp-02": 0.35, "node-us-unlock-01": 0.12, "node-uk-unlock-02": 0.08 },
  },
  {
    id: "disney",
    name: "Disney+ (迪士尼)",
    category: "streaming" as TrafficCategory,
    categoryName: "流媒体串流",
    color: "#3b82f6",
    icon: "Television",
    domains: ["*.disneyplus.com", "*.bamgrid.com", "*.disney-portal.my.onetrust.com"],
    ratio: 0.032,
    downlinkRatio: 0.96,
    nodesAffinity: { "node-us-unlock-01": 0.52, "node-uk-unlock-02": 0.38, "node-hk-01": 0.06, "node-jp-02": 0.04 },
  },
  {
    id: "spotify",
    name: "Spotify 音乐",
    category: "streaming" as TrafficCategory,
    categoryName: "流媒体串流",
    color: "#22c55e",
    icon: "MusicNotes",
    domains: ["*.spotify.com", "*.scdn.co", "*.audio-ak-spotify-com.akamaized.net"],
    ratio: 0.021,
    downlinkRatio: 0.95,
    nodesAffinity: { "node-hk-01": 0.35, "node-jp-02": 0.35, "node-us-unlock-01": 0.18, "node-uk-unlock-02": 0.12 },
  },
  {
    id: "apple",
    name: "Apple 服务 (App Store / iCloud)",
    category: "system" as TrafficCategory,
    categoryName: "系统服务",
    color: "#94a3b8",
    icon: "AppleLogo",
    domains: ["*.apple.com", "*.icloud.com", "*.mzstatic.com", "*.aaplimg.com"],
    ratio: 0.018,
    downlinkRatio: 0.82,
    nodesAffinity: { "node-hk-01": 0.40, "node-jp-02": 0.40, "node-us-unlock-01": 0.10, "node-uk-unlock-02": 0.10 },
  },
  {
    id: "google",
    name: "Google 搜索与服务",
    category: "system" as TrafficCategory,
    categoryName: "系统服务",
    color: "#4285f4",
    icon: "Google",
    domains: ["*.google.com", "*.googleapis.com", "*.1e100.net"],
    ratio: 0.045,
    downlinkRatio: 0.85,
    nodesAffinity: { "node-hk-01": 0.40, "node-jp-02": 0.40, "node-us-unlock-01": 0.12, "node-uk-unlock-02": 0.08 },
  },
  {
    id: "gemini",
    name: "Google Gemini",
    category: "ai" as TrafficCategory,
    categoryName: "AI 智能应用",
    color: "#8e75b2",
    icon: "Googlegemini",
    domains: ["gemini.google.com", "generativelanguage.googleapis.com"],
    ratio: 0.035,
    downlinkRatio: 0.74,
    nodesAffinity: { "node-us-unlock-01": 0.60, "node-uk-unlock-02": 0.30, "node-hk-01": 0.05, "node-jp-02": 0.05 },
  },
  {
    id: "microsoft",
    name: "Microsoft (Office / OneDrive)",
    category: "system" as TrafficCategory,
    categoryName: "系统服务",
    color: "#00a4ef",
    icon: "Microsoft",
    domains: ["*.microsoft.com", "*.live.com", "*.office.com", "*.onedrive.com"],
    ratio: 0.028,
    downlinkRatio: 0.80,
    nodesAffinity: { "node-hk-01": 0.42, "node-jp-02": 0.38, "node-us-unlock-01": 0.10, "node-uk-unlock-02": 0.10 },
  },
  {
    id: "discord",
    name: "Discord 语音社区",
    category: "social" as TrafficCategory,
    categoryName: "社交与通讯",
    color: "#5865f2",
    icon: "Discord",
    domains: ["*.discord.com", "*.discord.gg", "*.discordapp.com"],
    ratio: 0.022,
    downlinkRatio: 0.82,
    nodesAffinity: { "node-hk-01": 0.45, "node-jp-02": 0.35, "node-us-unlock-01": 0.10, "node-uk-unlock-02": 0.10 },
  },
  {
    id: "steam",
    name: "Steam 游戏与下载",
    category: "streaming" as TrafficCategory,
    categoryName: "流媒体串流",
    color: "#66c0f4",
    icon: "Steam",
    domains: ["*.steampowered.com", "*.steamcommunity.com", "*.steamcontent.com"],
    ratio: 0.020,
    downlinkRatio: 0.97,
    nodesAffinity: { "node-hk-01": 0.48, "node-jp-02": 0.42, "node-us-unlock-01": 0.05, "node-uk-unlock-02": 0.05 },
  },
  {
    id: "direct",
    name: "国内直连出站",
    category: "direct" as TrafficCategory,
    categoryName: "直连出站",
    color: "#059669",
    icon: "Globe",
    domains: ["*.bilibili.com", "*.baidu.com", "*.qq.com", "国内直连 IP 规则"],
    ratio: 0.015,
    downlinkRatio: 0.88,
    nodesAffinity: { "node-hk-01": 0.50, "node-jp-02": 0.50, "node-us-unlock-01": 0.0, "node-uk-unlock-02": 0.0 },
  },
  {
    id: "other",
    name: "其他常规网页 / 漏网之鱼",
    category: "other" as TrafficCategory,
    categoryName: "其他流量",
    color: "#64748b",
    icon: "Browsers",
    domains: ["*.wikipedia.org", "*.duckduckgo.com", "未知域名及常规 HTTP/HTTPS"],
    ratio: 0.020,
    downlinkRatio: 0.85,
    nodesAffinity: { "node-hk-01": 0.35, "node-jp-02": 0.35, "node-us-unlock-01": 0.15, "node-uk-unlock-02": 0.15 },
  },
];

const CATEGORY_META: Record<TrafficCategory, { name: string; color: string }> = {
  streaming: { name: "流媒体串流", color: "#ef4444" },
  ai: { name: "AI 智能应用", color: "#10b981" },
  social: { name: "社交与通讯", color: "#0ea5e9" },
  developer: { name: "开发与代码", color: "#8b5cf6" },
  system: { name: "系统服务", color: "#94a3b8" },
  direct: { name: "直连出站", color: "#059669" },
  other: { name: "其他流量", color: "#64748b" },
};

export class TrafficService {
  /**
   * Calculate full traffic analytics summary according to nodes and selected timeRange
   */
  public getTrafficAnalytics(timeRange: "today" | "7d" | "30d" | "month" | "all" = "today"): TrafficAnalyticsSummary {
    const nodes = db.getNodes();
    const liveTotalNodesTraffic = nodes.reduce((sum, n) => sum + (n.trafficUsedBytes || 0), 0);

    // Scale base traffic volume according to time range
    let rangeMultiplier = 1;
    switch (timeRange) {
      case "today":
        rangeMultiplier = 0.12; // ~12% of total traffic occurred today
        break;
      case "7d":
        rangeMultiplier = 0.48;
        break;
      case "30d":
      case "month":
        rangeMultiplier = 1.0;
        break;
      case "all":
        rangeMultiplier = 2.4;
        break;
    }

    // Baseline fallback if initial database has very little traffic
    const effectiveTotalBytes = Math.max(
      Math.floor(liveTotalNodesTraffic * rangeMultiplier),
      Math.floor(256 * 1024 * 1024 * 1024 * rangeMultiplier) // At least ~30GB for today, ~256GB for month
    );

    let totalUplinkBytes = 0;
    let totalDownlinkBytes = 0;
    let totalRequests = 0;

    // 1. Calculate Service items
    const services: ServiceTrafficItem[] = SERVICE_DEFINITIONS.map((def) => {
      const serviceBytes = Math.floor(effectiveTotalBytes * def.ratio);
      const downlinkBytes = Math.floor(serviceBytes * def.downlinkRatio);
      const uplinkBytes = serviceBytes - downlinkBytes;

      totalDownlinkBytes += downlinkBytes;
      totalUplinkBytes += uplinkBytes;

      // Realistic requests count (approx 1 request per 150KB - 800KB)
      const avgReqSize = def.category === "streaming" ? 600 * 1024 : 180 * 1024;
      const requestsCount = Math.floor(serviceBytes / avgReqSize);
      totalRequests += requestsCount;

      // Active live stream connections estimate
      const activeConnections = Math.max(1, Math.round(requestsCount / 2200));

      // Calculate node distributions for this service
      const nodeDistribution = nodes.map((node) => {
        const affinityMap = def.nodesAffinity as Record<string, number>;
        let factor = affinityMap[node.id];
        if (factor === undefined) {
          factor = 1 / nodes.length;
        }
        const nodeBytes = Math.floor(serviceBytes * factor);
        return {
          nodeId: node.id,
          nodeName: node.name,
          bytes: nodeBytes,
          percentage: +(factor * 100).toFixed(1),
        };
      });

      return {
        id: def.id,
        name: def.name,
        category: def.category,
        categoryName: def.categoryName,
        color: def.color,
        icon: def.icon,
        domains: def.domains,
        downlinkBytes,
        uplinkBytes,
        totalBytes: serviceBytes,
        percentage: +(def.ratio * 100).toFixed(1),
        activeConnections,
        requestsCount,
        nodeDistribution,
      };
    });

    // 2. Calculate Category Summaries
    const categoryMap = new Map<TrafficCategory, { totalBytes: number; servicesCount: number }>();
    for (const s of services) {
      const existing = categoryMap.get(s.category) || { totalBytes: 0, servicesCount: 0 };
      existing.totalBytes += s.totalBytes;
      existing.servicesCount += 1;
      categoryMap.set(s.category, existing);
    }

    const categories: CategoryTrafficSummary[] = Array.from(categoryMap.entries()).map(
      ([cat, data]) => ({
        category: cat,
        categoryName: CATEGORY_META[cat]?.name || cat,
        color: CATEGORY_META[cat]?.color || "#64748b",
        totalBytes: data.totalBytes,
        percentage: +((data.totalBytes / effectiveTotalBytes) * 100).toFixed(1),
        servicesCount: data.servicesCount,
      })
    ).sort((a, b) => b.totalBytes - a.totalBytes);

    // 3. Calculate Node Distributions
    const nodeDistributions: NodeTrafficDistribution[] = nodes.map((node) => {
      let nodeBytesSum = 0;
      const serviceContributions: { serviceId: string; serviceName: string; bytes: number; color: string }[] = [];

      for (const s of services) {
        const found = s.nodeDistribution.find((nd) => nd.nodeId === node.id);
        if (found && found.bytes > 0) {
          nodeBytesSum += found.bytes;
          serviceContributions.push({
            serviceId: s.id,
            serviceName: s.name,
            bytes: found.bytes,
            color: s.color,
          });
        }
      }

      serviceContributions.sort((a, b) => b.bytes - a.bytes);

      return {
        nodeId: node.id,
        nodeName: node.name,
        country: node.country,
        countryName: node.countryName,
        totalBytes: nodeBytesSum,
        percentage: +((nodeBytesSum / effectiveTotalBytes) * 100).toFixed(1),
        topServices: serviceContributions.slice(0, 4),
      };
    }).sort((a, b) => b.totalBytes - a.totalBytes);

    // 4. Generate Time Series Points
    const timeSeries = this.generateTimeSeries(timeRange, effectiveTotalBytes);

    return {
      timeRange,
      totalRecordedBytes: effectiveTotalBytes,
      totalUplinkBytes,
      totalDownlinkBytes,
      totalRequests,
      activeStreams: Math.floor(services.reduce((acc, s) => acc + s.activeConnections, 0)),
      services,
      categories,
      nodeDistributions,
      timeSeries,
      updatedAt: Date.now(),
    };
  }

  /**
   * Helper to build realistic timeline curve points (with diurnal human proxy usage cycles)
   */
  private generateTimeSeries(
    timeRange: "today" | "7d" | "30d" | "month" | "all",
    totalBytes: number
  ): TrafficTimeSeriesPoint[] {
    const points: TrafficTimeSeriesPoint[] = [];
    const now = Date.now();

    if (timeRange === "today") {
      // 24 hours of today: 00:00 to 23:00 with smooth continuous diurnal curve
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      // Smooth human activity profile throughout 24 hours (strictly continuous, zero random jitter):
      // - 00:00~05:00: Midnight winding down (0.80 -> 0.55 -> 0.38 -> 0.22 -> 0.16 -> 0.18)
      // - 06:00~11:00: Morning rise (0.28 -> 0.50 -> 0.85 -> 1.15 -> 1.30 -> 1.40)
      // - 12:00~17:00: Afternoon work (1.25 -> 1.35 -> 1.50 -> 1.55 -> 1.50 -> 1.45)
      // - 18:00~23:00: Evening prime (1.70 -> 2.05 -> 2.40 -> 2.35 -> 2.00 -> 1.30)
      const hourlyFactors = [
        0.80, 0.55, 0.38, 0.22, 0.16, 0.18,
        0.28, 0.50, 0.85, 1.15, 1.30, 1.40,
        1.25, 1.35, 1.50, 1.55, 1.50, 1.45,
        1.70, 2.05, 2.40, 2.35, 2.00, 1.30,
      ];
      const sumFactor = hourlyFactors.reduce((a, b) => a + b, 0);

      for (let h = 0; h < 24; h++) {
        const timeStr = `${String(h).padStart(2, "0")}:00`;
        const timestamp = startOfDay.getTime() + h * 3600 * 1000;
        const hourBase = totalBytes * (hourlyFactors[h] / sumFactor);

        // Category breakdown smoothly attuned to time of day
        let streamR = 0.55;
        let aiR = 0.22;
        let socR = 0.13;
        let devR = 0.10;

        if (h >= 9 && h <= 17) {
          // Work hours: higher Dev & AI
          streamR = 0.35;
          aiR = 0.32;
          socR = 0.15;
          devR = 0.18;
        } else if (h >= 19 && h <= 23) {
          // Evening leisure: higher Streaming
          streamR = 0.65;
          aiR = 0.15;
          socR = 0.13;
          devR = 0.07;
        }

        points.push({
          time: timeStr,
          timestamp,
          totalBytes: Math.floor(hourBase),
          streamingBytes: Math.floor(hourBase * streamR),
          aiBytes: Math.floor(hourBase * aiR),
          socialBytes: Math.floor(hourBase * socR),
          devBytes: Math.floor(hourBase * devR),
          otherBytes: 0,
        });
      }
    } else {
      // Days-based intervals (7 days or 30 days)
      const count = timeRange === "7d" ? 7 : timeRange === "30d" || timeRange === "month" ? 30 : 12;
      for (let i = count - 1; i >= 0; i--) {
        const d = new Date(now - i * 86400 * 1000);
        const timeStr = `${d.getMonth() + 1}/${d.getDate()}`;
        const timestamp = d.getTime();

        const weekendFactor = d.getDay() === 0 || d.getDay() === 6 ? 1.35 : 0.95;
        const dayWave = 1 + 0.12 * Math.sin((i / count) * Math.PI * 2);
        const dayBase = (totalBytes / count) * weekendFactor * dayWave;

        points.push({
          time: timeStr,
          timestamp,
          totalBytes: Math.floor(dayBase),
          streamingBytes: Math.floor(dayBase * 0.55),
          aiBytes: Math.floor(dayBase * 0.22),
          socialBytes: Math.floor(dayBase * 0.13),
          devBytes: Math.floor(dayBase * 0.10),
          otherBytes: 0,
        });
      }
    }

    return points;
  }
}

export const trafficService = new TrafficService();
