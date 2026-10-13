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
- **后端服务**：Node.js 24 + TypeScript + Express + WebSocket (`ws`) + 原子 JSON 持久化
- **工程结构**：pnpm Workspace Monorepo

---

## 🚀 启动与运行

### 1. 一键启动全栈服务 (生产模式)

服务端已集成托管前端打包后的静态资源：

```bash
cd "F:\代码\nodemaster"
pnpm install
pnpm build
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
└── server/                   # 后端核心服务 (Express + WS + JSON)
    └── src/
        ├── db/               # 数据存储层与初始节点
        ├── services/
        │   ├── xrayConfig.ts # Reality 密钥生成与 Xray 配置组装
        │   ├── subscription.ts # Clash/Sing-box/Base64 自适应订阅引擎
        │   └── wsHub.ts      # WebSocket 双向通信与心跳遥测
        ├── routes/api.ts     # REST API 与 install.sh 脚本下发
        └── index.ts          # 入口服务 (3880端口)
```


## 安全迁移与真实遥测（2026-10-13）

- 安装依赖、执行 `pnpm test` 和 `pnpm build`，再启动服务。Node.js 24；VPS 探针需要 Linux、systemd、Python 3。
- 新部署不再插入示例节点、固定订阅或默认密码。可通过服务端环境变量 `NODEMASTER_ADMIN_PASSWORD` 设置至少 12 位的首次密码；否则生成随机密码写入数据目录的 `bootstrap-admin.txt`（登录后修改并删除该文件）。
- 旧数据库启动时保留节点、链路和订阅；迁移固定 JWT 密钥及旧默认密码，旧会话全部失效。迁移会从已有 Reality 私钥重新派生正确公钥，需要客户端重新获取订阅。
- 数据目录默认 `server/data`，可通过 `NODEMASTER_DATA_DIR` 覆盖。写入使用同目录临时文件和原子替换，并保存 `.bak`。数据库损坏时停止启动，保留原文件；由管理员核实备份后恢复。不要将真实数据库、备份或凭证文件提交到 Git；已经被 Git 跟踪的数据库需在保留本地文件的前提下移出版本管理，并处理历史中的旧凭证。
- **已有 VPS 必须更新探针**：执行面板的探针升级命令，或在 VPS 上运行 `curl -fsSL "$PANEL_URL/api/update-probe.sh" | bash`，其中 `PANEL_URL` 为可访问的面板地址。旧 Bash 探针不支持新计数、停止指令与升级确认。
- 新探针使用累计网卡计数与启动标识去重；首次接入或重启的首个样本建立基线，不补造缺失流量。断网期间的累计差值在恢复上报时计入恢复时段。旧模拟累计量会保留，核实后可在面板手动重置。
- 心跳超过 30 秒标记离线。达到额度阈值后下发停止代理指令并移除入站；探针确认配置版本后才显示同步成功。月度重置按服务端本地时区，31 日在短月取当月最后一天；重置后下发恢复配置。
- 历史数据来自真实采样，保留最近 35 天。网卡计数包含主机网络流量，不等同于 Xray 按用户计费；业务分类、请求数和活跃流没有采集时显示未采集，不再生成模拟曲线。延迟任务由 VPS 探针实际执行 TCP/ICMP 测量。
- 订阅 `expireAt` 使用 Unix 秒，过期或已记录用量达到额度后拒绝下载。订阅访问限制不是独立用户计费，也不会撤销已经导出的共享节点凭证；该项目不提供按订阅用户的流量归属。
- Xray 升级接口只排队，HTTP/WS 探针取得任务并确认真实版本后才完成；失败保留错误，管理员可重试。升级过程校验二进制版本和现有配置，启动失败回滚原二进制。配置重载失败同样恢复上一份配置。
- 登出撤销当前管理员的全部会话，改密亦撤销旧会话。反向代理部署时应正确转发 HTTPS，并为面板和 VPS 通信提供 HTTPS。

验证命令：`pnpm test`、`pnpm build`、`python -m unittest discover -s server/test -p '*_test.py'`；安装脚本可用 `bash -n server/data/install.sh` 与 `bash -n server/data/xray-upgrade.sh` 检查。

## Reality / Xray 版本核对（2026-10-13）

- Reality 由 Xray-core 提供；本项目的 `server/data/install.sh` 是自有部署脚本。官方 GitHub `XTLS/Xray-core/releases/latest` 本次返回正式版 `v26.3.27`（UTC 发布时间：2026-03-27 17:51:11），安装时动态查询，不固定该版本。
- 安装及升级均校验官方 `.dgst` 文件中的 SHA-256、二进制实际版本；安装使用独立临时目录，在替换二进制前验证配置。升级通过服务重启生效，会短暂中断连接。
- 版本查询缓存 15 分钟；查询失败不再冒充实时成功，`checkedAt` 表示成功查询时间。批量升级只处理已上报且低于目标版本的节点，跳过未知版本并避免降级。
- 本地数据库的版本记录不等于 VPS 当前实况；请以探针的新上报或 VPS 执行 `/usr/local/bin/xray version` 的结果为准。
