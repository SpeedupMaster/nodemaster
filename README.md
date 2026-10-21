# NodeMaster — 多 VPS 节点全生命周期管理与自适应分流控制系统

<p align="center">
  <img src="https://img.shields.io/badge/React-19.0-61DAFB?logo=react&logoColor=black" alt="React 19" />
  <img src="https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/TailwindCSS-3.4-38B2AC?logo=tailwindcss&logoColor=white" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/GSAP-3.12-88CE02?logo=greensock&logoColor=white" alt="GSAP" />
  <img src="https://img.shields.io/badge/Node.js-24.x-339933?logo=nodedotjs&logoColor=white" alt="Node.js 24" />
  <img src="https://img.shields.io/badge/Xray--core-Reality-1E90FF" alt="Xray Reality" />
  <img src="https://img.shields.io/badge/Docker-ghcr.io-blue?logo=docker&logoColor=white" alt="Docker GHCR" />
  <img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License MIT" />
  <a href="https://github.com/SpeedupMaster/nodemaster/actions/workflows/docker-publish.yml">
    <img src="https://github.com/SpeedupMaster/nodemaster/actions/workflows/docker-publish.yml/badge.svg" alt="Build and Publish Docker Image" />
  </a>
</p>

**NodeMaster** 是一套专为运维工程师与高阶极客打造的下一代分布式 VPS 节点集中管控平台。遵循 **Hallmark Modern-Minimal** 工程控制台设计哲学，基于高性能 **GSAP 3** 拓扑流光与微交互引擎，实现多台云服务器硬件工况真实遥测、**VLESS-Reality** 免证书协议组网、**Dokodemo-door** 链式中转隧道、全客户端自适应智能订阅分发、多维度 Telegram 自动化告警与流量月度智能熔断。

---

## 📸 系统大屏与界面体验

- **桌面端控制大屏**：高信息密度暗黑工况仪表盘、实时网络吞吐双向滚浪计数（Rolling Counter）、中转拓扑动态数据包流动链路。
- **移动端沉浸式体验**：全新沉浸式无边框登录网关、严格遵循 **WCAG 2.2 AA** 高对比度无障碍标准、iOS 防自动缩放（16px+）、44px+ 拇指安全触控热区、原生底部抽屉（Bottom Sheet）密码恢复指引。
- **PWA 渐进式 Web 应用**：支持一键安装至桌面端与手机主屏幕（Standalone 模式），离线 SPA 壳层秒开、状态栏沉浸融合、离线网络中断感知与新版本热更新提示。

---

## ✨ 核心特性

### 1. 🛡️ 零信任安全网关与双模自适应登录
- **单向 PBKDF2 强哈希**：密码采用 100,000 轮 PBKDF2 + 独立 Salt 单向散列，杜绝明文风险。
- **原子隔离 JWT 会话**：基于 HMAC-SHA256 签名，密码修改或主动登出时触发 `sessionVersion` 原子递增，旧会话立即全网吊销。
- **移动端与桌面端双模界面**：
  - **移动端**：无物理卡片框边界的深邃网格全屏沉浸设计，配合触控友好的原生上滑底部抽屉（Bottom Sheet）。
  - **桌面端**：典雅的 24px 毛玻璃悬浮卡片、双向鉴权状态指示与精致微光反馈。
- **WCAG 2.2 AA 无障碍对比度**：输入框占位符（Placeholder）与图标对比度达 5.1:1，统一加粗视觉权重，支持全键盘（Tab/Enter/Space）无障碍对焦切换。

### 2. ⚡ 全协议底座与 30 秒自动化纳管
- **原生 VLESS-Reality**：原生支持免证书 Reality 伪装（借用 Microsoft、Apple 等主流网站 SNI），抗主动探测与长城封锁，开箱即用。
- **链式中转与落地保护**：支持 Dokodemo-door 端口转发与链式隧道组装，由国内/前置优化机接入并中转至海外落地机，保护落地 IP 安全。
- **极速一键部署脚本**：
  - 后台添加节点后即刻生成专有 Token 的轻量纳管指令：`curl -fsSL .../install.sh | bash`。
  - 自动识别操作系统架构（x86_64 / arm64），校验官方 SHA-256 二进制签名，自动部署守护服务。
- **零中断热同步**：修改节点端口、监听参数或 SNI 伪装域名后，探针触发毫秒级平滑热重载，无需停机。

### 3. 📊 真实硬件遥测与多节点探针矩阵
- **真实网卡计数采集**：Python 3 轻量级守护探针直接读取 Linux `/proc/net/dev` 真实硬件流量，绝不使用模拟假数据。
- **全维度节点工况监控**：实时呈现每台 VPS 的 CPU 占用率、物理内存用量、磁盘使用率、系统负载（Load Average）、TCP 活跃连接数与开机时长。
- **三大运营商网络测速矩阵**：VPS 探针周期性发起针对中国电信、中国联通、中国移动全国多个主流节点测速，绘制真实 TCP / ICMP 延迟时序变化曲线。

### 4. 🌐 客户端自适应智能订阅分发
通过统一接入点 `/api/sub/:token`，系统根据客户端发起的 `User-Agent` 动态分流并自动渲染对应格式：
- **Clash Meta / Mihomo**：自动组装策略组（🚀 节点选择、♻️ 自动选择、🤖 AI 专用服务、📺 流媒体分流、🎯 全球直连、🐟 漏网之鱼）及规则集。
- **Sing-box**：渲染标准 JSON 出站配置、DNS 路由与出站分流规则。
- **Shadowrocket / V2RayN / 通用客户端**：Base64 动态安全节点编码流。
- **一键导入与配额管控**：支持 `clash://install-config?url=...` 快速唤醒、二维码直扫导入，可按订阅设置到期日（`expireAt`）与独立流量额度。

### 5. 🤖 Telegram 自动化告警中心
- **节点离线即时推报**：节点探针心跳中断（超 30 秒无遥测）自动推发 Telegram 报警。
- **月度额度阈值预警**：流量用量达到预设阈值（如 80%、90%）即时下发推送提醒。
- **VPS 续费到期提醒**：根据配置的服务器到期日提前 7 天每日告警，避免服务器因未续费被销毁。
- **系统高负载告警**：支持 CPU 或内存超标（如 > 85%）持续告警。

### 6. 🛑 流量精准计量与超额自动熔断保护
- **全自动熔断器**：当月度总流量达到设定的阈值（例如 98%）时，自动下发断开入站指令，切断节点代理流量，防止产生巨额超额账单。
- **智能月度重置日**：支持指定每月任意日期（如每月 1 日）定时重置，遇到 31 日在小月自动取当月最后一天，重置后自动恢复节点代理。

---

## 🛠️ 技术架构

```
┌─────────────────────────────────────────────────────────────┐
│                 NodeMaster 控制中台 (Web UI)                │
│    React 19 + TypeScript + Tailwind CSS + GSAP 3 (Phosphor) │
└──────────────────────────────┬──────────────────────────────┘
                               │  REST API + WebSocket (双向遥测)
┌──────────────────────────────▼──────────────────────────────┐
│                NodeMaster API Server (Node.js 24)           │
│        Express + ws Hub + PBKDF2/JWT + 原子持久化存储        │
└──────────────┬──────────────────────────────┬───────────────┘
               │ 智能订阅分发                 │ 探针接入/指令下发
               ▼                              ▼
    ┌────────────────────┐         ┌─────────────────────────┐
    │ 客户端自适应矩阵   │         │ VPS 节点矩阵 (Linux)    │
    │  • Clash Meta      │         │  • Python 3 硬件探针    │
    │  • Sing-box        │         │  • Xray-core (Reality)  │
    │  • Shadowrocket    │         │  • Dokodemo-door 中转   │
    └────────────────────┘         └─────────────────────────┘
```

---

## 🚀 快速启动与部署

### 🐳 方式一：Docker 一键部署（极力推荐）

官方预编译镜像托管于 GitHub Container Registry (GHCR)，原生支持 `linux/amd64` 与 `linux/arm64` 双架构。

#### 1. 使用 Docker 运行

```bash
docker run -d \
  --name nodemaster \
  --restart unless-stopped \
  -p 3880:3880 \
  -v nodemaster_data:/app/server/data \
  -e NODEMASTER_ADMIN_PASSWORD="YourStrongPassword123" \
  ghcr.io/speedupmaster/nodemaster:latest
```

#### 2. 使用 Docker Compose

仓库已内置 `docker-compose.yml`：

```bash
# 启动容器集群
docker-compose up -d

# 查看运行状态与日志
docker-compose logs -f
```

---

### 💻 方式二：源码安装运行

#### 环境要求
- **服务端**：Node.js >= 22.0.0（推荐 Node.js 24 LTS）、pnpm >= 9.0.0
- **VPS 节点**：Linux（Debian 11+/Ubuntu 20.04+/CentOS 8+）、systemd、Python >= 3.6

#### 1. 本地构建与生产模式运行

服务端已内置静态资源托管，打包后仅需单端口对外开放：

```bash
# 1. 克隆代码仓库
git clone https://github.com/SpeedupMaster/nodemaster.git
cd nodemaster

# 2. 安装 Workspace 依赖
pnpm install

# 3. 编译前端与后端
pnpm build

# 4. 启动服务 (默认端口 3880)
pnpm start
```

服务就绪后，在浏览器中访问：**`http://localhost:3880`**。

#### 2. 本地开发模式 (支持前端热重载)

同时启动 Vite 开发服务器（5173 端口）与后端 API（3880 端口）：

```bash
pnpm dev
```
- 前端热更新地址：**`http://localhost:5173`**
- 后端 API 服务地址：**`http://localhost:3880`**

---

## ⚙️ 环境变量与安全配置

支持通过根目录 `.env` 或系统环境变量调整配置：

| 环境变量 | 默认值 | 作用说明 |
| :--- | :--- | :--- |
| `PORT` | `3880` | 服务端监听端口 |
| `HOST` | `0.0.0.0` | 绑定的监听 IP 地址 |
| `NODEMASTER_DATA_DIR` | `server/data` | 运行时数据目录（数据库、遥测历史、初始凭据），需持久化 |
| `NODEMASTER_ASSETS_DIR` | `server/data` | 随版本发布的安装脚本、探针与订阅模板目录（Docker 镜像中为 `/app/server/assets`，无需挂载） |
| `NODEMASTER_ADMIN_PASSWORD` | *(自动生成随机)* | **仅首次部署**时的管理员密码（长度至少 8 位）；若未设置，密码将保存至 `data/bootstrap-admin.txt` |
| `NODEMASTER_RESET_ADMIN_PASSWORD` | *(空)* | 忘记密码时使用：启动时将管理员密码重置为该值并注销所有会话，**生效后请立即删除** |
| `TRUST_PROXY` | *(关闭)* | 部署在 nginx / Caddy 等反向代理之后时设置（如 `1` 或 `loopback`），使登录限流与脚本中的面板地址获取真实客户端 IP 与 HTTPS 协议 |

会话签名密钥由服务端首次启动时自动生成强随机值，并保存在数据库中，无需手动配置。

### 🔒 反向代理与 HTTPS（强烈建议）

管理员密码、探针 Token 与 Reality 私钥都会经过面板传输，公网部署请务必启用 HTTPS。以 nginx 为例：

```nginx
server {
    listen 443 ssl http2;
    server_name panel.example.com;
    # ssl_certificate / ssl_certificate_key ...

    location / {
        proxy_pass http://127.0.0.1:3880;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        # WebSocket (/ws)
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

同时为 NodeMaster 设置 `TRUST_PROXY=1`（或代理所在 IP），并将端口仅绑定到本机（如 Docker 使用 `-p 127.0.0.1:3880:3880`）。Caddy 用户只需 `reverse_proxy 127.0.0.1:3880`，同样需要设置 `TRUST_PROXY`。

---

## 🔑 管理员账户与凭据恢复

NodeMaster 遵循零信任安全原则，数据库绝不保存明文密码，且不提供公网邮件找回渠道。

- **初始管理员账号**：`admin`
- **获取初次密码**：
  若启动时未配置 `NODEMASTER_ADMIN_PASSWORD` 环境变量，首次启动会在数据目录生成初始强随机凭据文件：
  ```bash
  cat server/data/bootstrap-admin.txt
  ```
  *初次登录后，请立即在右上角控制台菜单中修改密码，系统将自动失效并清理旧凭据。*
- **忘记管理密码恢复**：
  若遗忘密码，设置 `NODEMASTER_RESET_ADMIN_PASSWORD` 并重启服务，密码会被重置且所有已登录会话失效：
  ```bash
  NODEMASTER_RESET_ADMIN_PASSWORD="YourNewStrongPassword" pnpm start
  ```
  Docker 用户可将其临时加入 `environment` 后重建容器。**登录成功后请删除该变量并再次重启**，否则之后在界面中修改的密码会在下次重启时被重置回该值。

---

## 🖥️ 节点纳管与探针运行机制

1. **添加节点**：在 Web 界面点击 **“添加节点”**，输入 VPS 名称、公网 IP、目标端口及 Reality 伪装域名（如 `www.apple.com`）。
2. **复制纳管指令**：系统自动生成独占 Token 的安装命令，如：
   ```bash
   curl -fsSL "https://your-panel-domain.com/api/install.sh?token=xxx" | bash
   ```
3. **探针工作流**：
   - 自动检测主机架构并安全拉取对应平台的最新 Xray-core 二进制。
   - 注册系统 `systemd` 守护服务 `nodemaster-probe`。
   - 探针以 10 秒为周期上报网卡吞吐差值，并与面板建立毫秒级双向 WebSocket 长连接。

---

## 📁 目录结构

```text
nodemaster/
├── package.json              # Monorepo 根配置
├── pnpm-workspace.yaml       # pnpm 多模块工作区配置
├── web/                      # 前端控制台 (React 19 + Vite + Tailwind + GSAP)
│   ├── src/
│   │   ├── components/
│   │   │   ├── auth/         # 登录网关、凭据找回底部抽屉、改密弹窗
│   │   │   ├── dashboard/    # 概览大屏、流量进度统计、脚本配置
│   │   │   ├── layout/       # 响应式侧边栏、顶部导航、页脚
│   │   │   ├── nodes/        # 节点卡片、配置查看、添加节点弹窗
│   │   │   ├── notifications/# Telegram 自动化报警配置面板
│   │   │   ├── ping/         # 国内运营商多点延迟时序图表
│   │   │   ├── probe/        # VPS 真实硬件工况探针卡片
│   │   │   ├── subscription/ # 自适应客户端订阅分发与二维码
│   │   │   ├── topology/     # GSAP 中转拓扑图与链路流光动效
│   │   │   └── traffic/      # 全局业务流量统计与节点带宽分析
│   │   ├── hooks/useData.ts  # 双向遥测、REST 聚合请求管理
│   │   └── styles/           # Hallmark 设计代币与全局样式
│   └── index.html
└── server/                   # 后端核心引擎 (Node.js 24 + Express + ws)
    ├── src/
    │   ├── db/               # JSON 原子持久化与数据迁移
    │   ├── routes/           # REST API 路由与自动化下发
    │   ├── services/
    │   │   ├── authService.ts      # PBKDF2 与 JWT 安全服务
    │   │   ├── subscription.ts     # 多客户端订阅自适应转换引擎
    │   │   ├── wsHub.ts            # WebSocket 遥测中心与心跳保活
    │   │   └── xrayConfig.ts       # Reality / Dokodemo 密钥与配置装配
    │   └── index.ts          # 入口服务与静态资源托管
    └── data/                 # 节点数据、初始凭据、安装与探针脚本
```

---

## 📄 开源许可证

本项目基于 [MIT License](LICENSE) 协议开源。
