export interface ServiceDefinition {
  id: string;
  name: string;
  category: "ai" | "streaming" | "social" | "finance" | "gaming";
  categoryName: string;
  description: string;
  tags: string[];
  defaultSelected?: boolean;
}

export const UNLOCK_SERVICES: ServiceDefinition[] = [
  // --- AI 智能模型 ---
  {
    id: "openai",
    name: "OpenAI / ChatGPT",
    category: "ai",
    categoryName: "AI 智能模型",
    description: "ChatGPT, GPT-4o, Sora 视频与官方 API",
    tags: ["OpenAI", "ChatGPT", "Sora"],
    defaultSelected: true,
  },
  {
    id: "anthropic",
    name: "Claude / Anthropic",
    category: "ai",
    categoryName: "AI 智能模型",
    description: "Claude 3.5 Sonnet / Opus 网页与 API",
    tags: ["Claude", "Anthropic"],
    defaultSelected: true,
  },
  {
    id: "gemini",
    name: "Google Gemini",
    category: "ai",
    categoryName: "AI 智能模型",
    description: "Gemini 1.5 Pro, AI Studio 与 Google AI",
    tags: ["Gemini", "Google AI"],
    defaultSelected: true,
  },
  {
    id: "copilot",
    name: "Microsoft Copilot",
    category: "ai",
    categoryName: "AI 智能模型",
    description: "Windows / Edge Copilot 智能助手",
    tags: ["Copilot", "Bing"],
    defaultSelected: true,
  },
  {
    id: "perplexity",
    name: "Perplexity AI",
    category: "ai",
    categoryName: "AI 智能模型",
    description: "Perplexity 智能搜索与 AI 问答平台",
    tags: ["Perplexity"],
    defaultSelected: true,
  },
  {
    id: "midjourney",
    name: "Midjourney",
    category: "ai",
    categoryName: "AI 智能模型",
    description: "Midjourney 图像生成平台与网页端",
    tags: ["Midjourney"],
    defaultSelected: true,
  },

  // --- 全球主流流媒体 ---
  {
    id: "netflix",
    name: "Netflix (网飞)",
    category: "streaming",
    categoryName: "全球主流流媒体",
    description: "网飞原生剧集与 4K 非自制版权影片解锁",
    tags: ["Netflix", "4K HDR"],
    defaultSelected: true,
  },
  {
    id: "disney",
    name: "Disney+ (迪士尼+)",
    category: "streaming",
    categoryName: "全球主流流媒体",
    description: "迪士尼+、皮克斯、漫威、星战与国家地理",
    tags: ["Disney+", "Marvel"],
    defaultSelected: true,
  },
  {
    id: "youtube",
    name: "YouTube / YT Music",
    category: "streaming",
    categoryName: "全球主流流媒体",
    description: "YouTube Premium 会员与免广告原生出口",
    tags: ["YouTube", "Premium"],
    defaultSelected: true,
  },
  {
    id: "tiktok",
    name: "TikTok (海外抖音)",
    category: "streaming",
    categoryName: "全球主流流媒体",
    description: "国际版短视频与直播原生住宅出口",
    tags: ["TikTok", "直播"],
    defaultSelected: true,
  },
  {
    id: "spotify",
    name: "Spotify",
    category: "streaming",
    categoryName: "全球主流流媒体",
    description: "全球音乐流媒体曲库与区域版权",
    tags: ["Spotify", "无损音频"],
    defaultSelected: true,
  },
  {
    id: "hbo",
    name: "Max / HBO Max",
    category: "streaming",
    categoryName: "全球主流流媒体",
    description: "华纳兄弟 Discovery 与 HBO 顶级剧集",
    tags: ["HBO Max", "华纳"],
    defaultSelected: true,
  },
  {
    id: "primevideo",
    name: "Amazon Prime Video",
    category: "streaming",
    categoryName: "全球主流流媒体",
    description: "亚马逊 Prime Video 影视与独播剧集",
    tags: ["Prime Video"],
    defaultSelected: true,
  },
  {
    id: "hulu",
    name: "Hulu",
    category: "streaming",
    categoryName: "全球主流流媒体",
    description: "美国主流流媒体 Hulu 视频与美剧",
    tags: ["Hulu", "美剧"],
    defaultSelected: true,
  },
  {
    id: "appletv",
    name: "Apple TV+ / Apple Music",
    category: "streaming",
    categoryName: "全球主流流媒体",
    description: "苹果自制剧集与高解析无损音乐",
    tags: ["Apple TV+", "无损音频"],
    defaultSelected: true,
  },
  {
    id: "bilibili_overseas",
    name: "哔哩哔哩 (港澳台/东南亚)",
    category: "streaming",
    categoryName: "全球主流流媒体",
    description: "解除 B 站新番仅限港澳台或东南亚播放限制",
    tags: ["Bilibili", "港澳台"],
    defaultSelected: false,
  },
  {
    id: "bahamut",
    name: "巴哈姆特动画疯",
    category: "streaming",
    categoryName: "全球主流流媒体",
    description: "台湾正版二次元动画新番同步流媒体",
    tags: ["动画疯", "台湾原生"],
    defaultSelected: false,
  },

  // --- 海外社交与即时通讯 ---
  {
    id: "telegram",
    name: "Telegram",
    category: "social",
    categoryName: "海外社交与通讯",
    description: "Telegram 专属 IP 直连与大文件快速收发",
    tags: ["Telegram", "即时通讯"],
    defaultSelected: false,
  },
  {
    id: "twitter",
    name: "Twitter / X",
    category: "social",
    categoryName: "海外社交与通讯",
    description: "推特/X 动态浏览与多媒体上传下载",
    tags: ["Twitter", "X"],
    defaultSelected: false,
  },
  {
    id: "discord",
    name: "Discord",
    category: "social",
    categoryName: "海外社交与通讯",
    description: "Discord 社区语音通话与频道聊天",
    tags: ["Discord", "语音"],
    defaultSelected: false,
  },
  {
    id: "reddit",
    name: "Reddit",
    category: "social",
    categoryName: "海外社交与通讯",
    description: "全球最大论坛 Reddit 社区与高清多媒体",
    tags: ["Reddit"],
    defaultSelected: false,
  },
  {
    id: "instagram",
    name: "Instagram / Threads",
    category: "social",
    categoryName: "海外社交与通讯",
    description: "Instagram 照片墙与 Meta Threads 社区",
    tags: ["Instagram", "Threads"],
    defaultSelected: false,
  },

  // --- 跨境支付与金融 ---
  {
    id: "paypal",
    name: "PayPal",
    category: "finance",
    categoryName: "跨境支付与金融",
    description: "PayPal 国际版风控防封号住宅 IP 伪装出口",
    tags: ["PayPal", "风控防护"],
    defaultSelected: false,
  },
  {
    id: "stripe",
    name: "Stripe",
    category: "finance",
    categoryName: "跨境支付与金融",
    description: "全球在线支付结算与商家后台防风控",
    tags: ["Stripe", "在线支付"],
    defaultSelected: false,
  },

  // --- 全球游戏平台 ---
  {
    id: "steam",
    name: "Steam 社区与商店",
    category: "gaming",
    categoryName: "全球游戏平台",
    description: "Steam 外服商店锁区购买与社区讨论区访问",
    tags: ["Steam", "游戏商城"],
    defaultSelected: false,
  },
  {
    id: "epic",
    name: "Epic Games",
    category: "gaming",
    categoryName: "全球游戏平台",
    description: "Epic 商城外服领游戏与账号验证",
    tags: ["Epic", "商城验证"],
    defaultSelected: false,
  },
];

export const SERVICE_CATEGORIES = [
  { id: "ai", name: "AI 智能模型", badge: "6 个服务" },
  { id: "streaming", name: "全球主流流媒体", badge: "11 个服务" },
  { id: "social", name: "海外社交与通讯", badge: "5 个服务" },
  { id: "finance", name: "跨境支付与金融", badge: "2 个服务" },
  { id: "gaming", name: "全球游戏平台", badge: "2 个服务" },
] as const;

export function getServiceById(id: string): ServiceDefinition | undefined {
  return UNLOCK_SERVICES.find((s) => s.id === id);
}

export function getDefaultAiMediaServiceIds(): string[] {
  return UNLOCK_SERVICES.filter((s) => s.defaultSelected).map((s) => s.id);
}

export function getCategoryServiceIds(category: string): string[] {
  return UNLOCK_SERVICES.filter((s) => s.category === category).map((s) => s.id);
}

export function getAllServiceIds(): string[] {
  return UNLOCK_SERVICES.map((s) => s.id);
}
