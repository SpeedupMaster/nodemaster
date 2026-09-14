# NodeMaster — 多 VPS 节点管理与智能分流控制系统

基于 **Hallmark** 设计系统规范（Modern-Minimal / Utilitarian 工程师暗黑控制台风格）、**GSAP** 高性能微交互与拓扑流光动效、以及 **Phosphor Icons** 构建的下一代多 VPS 节点生命周期管理、流量精准统计、中转链路组装与自适应订阅分发系统。

---

## ✨ 核心特性

- **现代极客工程美学**：遵循 Hallmark Modern-Minimal 规范，基于 OKLCH 调色盘与冷灰基底构建，无 AI 假框装饰，Roman 字重与等宽数据混排，高密度信息呈现。
- **GSAP 高性能动效**：
  - 实时遥测数字翻牌动效（Rolling Counter，平滑展示带宽与流量递增）。
  - 节点卡片交错弹性入场（Staggered reveals）。
  - 中转链路 SVG 动态数据流流光动画（Flowing cables & packet pulses）。
  - 在线状态呼吸灯与超额熔断警示。
- **全协议代理底座**：
  - 原生支持 **VLESS-Reality** 免证书协议（免域名配置、借用微软/苹果网站伪装、抗封锁、开箱即用）。
  - 支持 **Dokodemo-door** 链式中转转发（前置优化机端口转发至海外落地机 Reality）。
  - 自动生成服务端 `config.json` 与客户端标准 `vless://` URI。
- **全客户端自适应智能订阅**：
  - 订阅接口 `/api/sub/:token` 自动依据客户端 `User-Agent` 动态分流输出：
    - **Clash Meta / Mihomo**：自动装配策略组（🚀 节点选择、♻️ 自动选择、🤖 AI Service、📺 流媒体视频、🎯 全球直连、🐟 漏网之鱼）及精细规则集。
    - **Sing-box**：标准 JSON 出站与规则配置。
    - **Shadowrocket / V2RayN / 通用**：Base64 编码的节点列表。
  - 支持一键快捷导入 (`clash://install-config?url=...`) 与二维码直扫。
- **30 秒一键纳管**：
  - 添加节点后自动生成专属安全 Token 的 `curl -fsSL .../install.sh | bash` 命令。
  - 自动识别 VPS 系统与架构 (x86_64 / arm64)，拉取 Xray-core 并注册守护服务。
- **流量计量与自动熔断**：
  - 周期性上报节点实时出入带宽与累计流量。
  - 达到月度阈值（如 98%）自动触发熔断阻断入站，防止高额超额账单。

---

## 🛠️ 技术栈

- **前端控制台**：React 19 + Vite + TypeScript + Tailwind CSS
- **动效引擎**：GSAP 3 + `@gsap/react` (`useGSAP` hook)
- **图标系统**：`@phosphor-icons/react`
- **设计规范**：Hallmark 1.1.0 (`modern-minimal`, `tokens.css`, 8-state components)
- **后端服务**：Node.js 24 + TypeScript + Express + WebSocket (`ws`) + SQLite/JSON 嵌入式持久化
- **工程结构**：pnpm Workspace Monorepo

---

## 🚀 启动与运行

### 1. 一键启动全栈服务 (生产模式)

服务端已集成托管前端打包后的静态资源：

```bash
cd "F:\代码\nodemaster"
pnpm start
```

浏览器访问：**http://localhost:3880**

### 2. 本地开发模式 (支持前端热重载)

同时启动 Vite 开发服务器 (5173 端口) 与后端 API 服务 (3880 端口)：

```bash
cd "F:\代码\nodemaster"
pnpm dev
```

- 前端开发地址：**http://localhost:5173** (通过代理自动反向代理 API 与 WebSocket)
- 后端服务地址：**http://localhost:3880**

---

## 📁 目录结构

```
F:\代码\nodemaster/
├── package.json              # Monorepo 根配置
├── pnpm-workspace.yaml
├── web/                      # 前端控制台 (React 19 + Vite + GSAP)
│   ├── src/
│   │   ├── styles/tokens.css # Hallmark OKLCH 变量与现代暗黑设计代币
│   │   ├── components/
│   │   │   ├── layout/       # Sidebar (N3), Header, Footer (Ft2)
│   │   │   ├── dashboard/    # 概览大屏、流量进度、安装脚本
│   │   │   ├── nodes/        # 节点卡片、配置查看、添加弹窗
│   │   │   ├── topology/     # GSAP 中转拓扑图与链式流光
│   │   │   ├── subscription/ # 自适应订阅分享与导出
│   │   │   └── common/       # 8-state 按钮、徽章、数字翻牌
│   │   ├── hooks/useData.ts  # WebSocket 双向遥测与 REST API
│   │   └── App.tsx
└── server/                   # 后端核心服务 (Express + WS + SQLite)
    └── src/
        ├── db/               # 数据存储层与初始节点
        ├── services/
        │   ├── xrayConfig.ts # Reality 密钥生成与 Xray 配置组装
        │   ├── subscription.ts # Clash/Sing-box/Base64 自适应订阅引擎
        │   └── wsHub.ts      # WebSocket 双向通信与心跳遥测
        ├── routes/api.ts     # REST API 与 install.sh 脚本下发
        └── index.ts          # 入口服务 (3880端口)
```
