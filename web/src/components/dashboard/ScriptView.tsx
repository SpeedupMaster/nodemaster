import React, { useState, useEffect, useMemo, useRef } from "react";
import { apiFetch } from "../../services/api";
import { Copy, Check, Plus, Warning, CheckCircle, CircleNotch, Circle, ArrowSquareOut } from "@phosphor-icons/react";
import type { NodeItem } from "../../types";

interface ScriptViewProps {
  nodes: NodeItem[];
  onAddNode: () => void;
}

const useCopy = () => {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied((k) => (k === key ? null : k)), 2000);
  };
  return { copied, copy };
};

const btn =
  "h-9 px-3.5 inline-flex items-center gap-2 rounded-lg border border-rule bg-paper-3 text-[13px] font-medium text-ink hover:border-rule-active cursor-pointer transition-colors";
const btnPrimary =
  "h-9 px-3.5 inline-flex items-center gap-2 rounded-lg bg-accent-fill text-white text-[13px] font-semibold hover:brightness-110 cursor-pointer transition";

const StepCard: React.FC<{ n: number; done?: boolean; title: string; children: React.ReactNode; action?: React.ReactNode }> = ({
  n,
  done,
  title,
  children,
  action,
}) => (
  <section className="p-4 sm:p-5 rounded-xl bg-paper-2 border border-rule flex gap-4">
    <span
      className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center font-mono text-[13px] font-semibold ${
        done ? "bg-status-online-bg text-status-online" : "bg-paper-3 text-ink-secondary"
      }`}
      aria-hidden="true"
    >
      {done ? <Check weight="bold" className="w-3.5 h-3.5" /> : n}
    </span>
    <div className="flex-1 min-w-0 flex flex-col gap-3.5">
      <div className="flex items-center gap-3 min-h-7">
        <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
        {action && <div className="ml-auto">{action}</div>}
      </div>
      {children}
    </div>
  </section>
);

const CopyLine: React.FC<{ cmd: string; copied: boolean; onCopy: () => void }> = ({ cmd, copied, onCopy }) => (
  <div className="flex items-start gap-2 p-2.5 rounded-lg bg-paper border border-rule">
    <code className="flex-1 min-w-0 font-mono text-xs text-ink-secondary break-all leading-relaxed select-all">{cmd}</code>
    <button
      type="button"
      onClick={onCopy}
      aria-label="复制命令"
      className="shrink-0 w-7 h-7 rounded-md flex items-center justify-center text-ink-muted hover:text-ink hover:bg-paper-3 cursor-pointer"
    >
      {copied ? <Check weight="bold" className="w-3.5 h-3.5 text-status-online" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  </div>
);

export const ScriptView: React.FC<ScriptViewProps> = ({ nodes, onAddNode }) => {
  const [scriptContent, setScriptContent] = useState("");
  const [tcpTuneContent, setTcpTuneContent] = useState("");
  const [activePreview, setActivePreview] = useState<"install" | "tcp_tune">("install");
  const [deployMode, setDeployMode] = useState<"all" | "probe_only">("all");
  const [enableBbr, setEnableBbr] = useState(true);
  const [enableIpv4First, setEnableIpv4First] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const { copied, copy } = useCopy();

  // Default to the first node that has never reported in, else the first node
  const [nodeId, setNodeId] = useState<string>(() => (nodes.find((n) => !n.lastSeen) ?? nodes[0])?.id ?? "");
  const knownIds = useRef(new Set(nodes.map((n) => n.id)));
  useEffect(() => {
    // Jump to a node created from the "添加节点" dialog while on this page
    const fresh = nodes.find((n) => !knownIds.current.has(n.id));
    nodes.forEach((n) => knownIds.current.add(n.id));
    if (fresh) setNodeId(fresh.id);
    else if (!nodes.some((n) => n.id === nodeId) && nodes[0]) setNodeId(nodes[0].id);
  }, [nodes, nodeId]);

  const node = nodes.find((n) => n.id === nodeId) ?? null;
  const isProbeNode = node?.type === "probe" || node?.protocol === "probe";
  const effectiveMode = isProbeNode ? "probe_only" : deployMode;

  const panelHost = window.location.origin;
  const insecurePanel = panelHost.startsWith("http://") && !/^http:\/\/(localhost|127\.0\.0\.1|\[::1\])/.test(panelHost);

  const buildCmd = (token: string) => {
    const args = [`--panel ${panelHost}`, `--token ${token}`];
    if (effectiveMode === "probe_only") args.push("--probe-only");
    if (enableBbr) args.push("--bbr");
    if (enableIpv4First) args.push("--ipv4-first");
    if (panelHost.startsWith("http://")) args.push("--allow-http");
    return `curl -fsSL ${panelHost}/api/install.sh | bash -s -- ${args.join(" ")}`;
  };
  const token = node?.token ?? "<NODE_TOKEN>";
  const maskedToken = token.length > 10 ? `${token.slice(0, 6)}…${token.slice(-4)}` : token;
  const installCmd = buildCmd(token);
  const displayCmd = showToken ? installCmd : buildCmd(maskedToken);

  const tuneOfficialCmd = `bash <(curl -fsSL https://tcp.vpsing.de)`;
  const tunePanelCmd = `curl -fsSL ${panelHost}/api/tcp-tune.sh | bash`;

  useEffect(() => {
    const load = (path: string, set: (text: string) => void) =>
      apiFetch(path)
        .then((r) => (r.ok ? r.text() : Promise.reject(new Error(`HTTP ${r.status}`))))
        .then(set)
        .catch((e) => console.error(`[ScriptView] ${path}:`, e));
    load("/api/install.sh", setScriptContent);
    load("/api/tcp-tune.sh", setTcpTuneContent);
  }, []);

  const checks = useMemo(() => {
    if (!node) return [];
    const heartbeat = node.status === "online" || !!node.lastSeen;
    const list = [{ label: "探针首次心跳", done: heartbeat, hint: node.lastSeen ? `最后心跳 ${new Date(node.lastSeen).toLocaleString()}` : "运行命令后通常 30 秒内出现" }];
    if (effectiveMode === "all") {
      list.push({
        label: "Xray 内核安装与配置下发",
        done: !!node.xrayVersion && node.configSyncStatus !== "failed" && node.configSyncStatus !== "pending",
        hint: node.configSyncStatus === "failed" ? node.configSyncError || "配置校验失败" : node.xrayVersion ? `Xray ${node.xrayVersion}` : "等待探针上报内核版本",
      });
    }
    list.push({ label: "首次延迟采样", done: node.latencyMs > 0, hint: node.latencyMs > 0 ? `${node.latencyMs} ms` : "上线后约 1 分钟内完成" });
    return list;
  }, [node, effectiveMode]);
  const allDone = checks.length > 0 && checks.every((c) => c.done);

  const modes = [
    { id: "all" as const, title: "节点 + 探针", desc: "安装 Xray 内核与监控探针，面板统一下发配置" },
    { id: "probe_only" as const, title: "仅探针", desc: "只采集负载与流量，不安装代理内核" },
  ];

  return (
    <div className="space-y-5">
      <p className="text-sm text-ink-secondary">
        四步把一台 Linux VPS 接入面板：选择节点 → 选择部署项 → 在 VPS 上运行命令 → 等待心跳。
      </p>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-4 items-start">
        <div className="flex flex-col gap-3 min-w-0">
          <StepCard
            n={1}
            done={!!node}
            title="选择要接入的节点"
            action={
              <button type="button" onClick={onAddNode} className={btn}>
                <Plus className="w-4 h-4" />
                添加新节点
              </button>
            }
          >
            {nodes.length === 0 ? (
              <p className="text-[13px] text-ink-muted">还没有节点。先在面板中添加一台 VPS，系统会为它生成专属令牌。</p>
            ) : (
              <label className="flex flex-col gap-1.5 text-[13px] text-ink-secondary max-w-md">
                节点
                <select
                  value={nodeId}
                  onChange={(e) => setNodeId(e.target.value)}
                  className="h-10 px-3 rounded-lg bg-paper border border-rule-active text-sm text-ink focus:outline-none focus:border-accent cursor-pointer"
                >
                  {nodes.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.name} · {n.ip}
                      {n.lastSeen ? "" : "（未接入）"}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </StepCard>

          <StepCard n={2} done={!!node} title="部署项">
            <div role="radiogroup" aria-label="部署模式" className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {modes.map((m) => {
                const sel = effectiveMode === m.id;
                const disabled = isProbeNode && m.id === "all";
                return (
                  <button
                    key={m.id}
                    type="button"
                    role="radio"
                    aria-checked={sel}
                    disabled={disabled}
                    onClick={() => setDeployMode(m.id)}
                    className={`p-3.5 rounded-lg border text-left flex flex-col gap-1 transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${
                      sel ? "border-accent bg-accent-subtle" : "border-rule bg-paper hover:border-rule-active"
                    }`}
                  >
                    <span className="text-sm font-semibold text-ink">{m.title}</span>
                    <span className="text-xs text-ink-secondary">{disabled ? "该节点为仅探针类型" : m.desc}</span>
                  </button>
                );
              })}
            </div>
            <fieldset className="flex flex-col gap-2.5">
              <legend className="text-[13px] text-ink-secondary mb-2">网络调优</legend>
              <label className="flex items-start gap-2.5 text-[13px] text-ink cursor-pointer">
                <input type="checkbox" checked={enableBbr} onChange={(e) => setEnableBbr(e.target.checked)} className="mt-0.5 w-4 h-4 accent-[var(--color-accent-fill)]" />
                <span>
                  <span className="font-mono">--bbr</span> 开启 BBR + FQ 拥塞控制
                  <span className="block text-xs text-ink-muted">推荐。显著改善高丢包跨境链路的单线程速度</span>
                </span>
              </label>
              <label className="flex items-start gap-2.5 text-[13px] text-ink cursor-pointer">
                <input
                  type="checkbox"
                  checked={enableIpv4First}
                  onChange={(e) => setEnableIpv4First(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-[var(--color-accent-fill)]"
                />
                <span>
                  <span className="font-mono">--ipv4-first</span> IPv4 优先解析
                  <span className="block text-xs text-ink-muted">仅当 VPS 的 IPv6 出口质量差时开启</span>
                </span>
              </label>
            </fieldset>
          </StepCard>

          <StepCard n={3} title="以 root 身份在 VPS 上运行">
            <pre className="p-3.5 rounded-lg bg-paper border border-rule font-mono text-xs text-ink-secondary whitespace-pre-wrap break-all leading-relaxed">
              <span className="text-ink-muted select-none">$ </span>
              {displayCmd}
            </pre>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => copy("install", installCmd)} disabled={!node} className={`${btnPrimary} disabled:opacity-50`}>
                {copied === "install" ? <Check weight="bold" className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied === "install" ? "已复制" : "复制命令"}
              </button>
              {node && (
                <button type="button" onClick={() => setShowToken((v) => !v)} className={btn}>
                  {showToken ? "隐藏令牌" : "显示完整令牌"}
                </button>
              )}
              <span className="text-xs text-ink-muted">命令包含该节点的专属令牌，请勿公开分享</span>
            </div>
            {insecurePanel && (
              <div className="flex items-start gap-2.5 p-3 rounded-lg bg-status-warning-bg text-[13px] text-ink-secondary leading-relaxed">
                <Warning weight="fill" className="w-4 h-4 text-status-warning shrink-0 mt-0.5" aria-hidden="true" />
                <span>
                  面板当前通过明文 HTTP 访问，令牌、代理配置与脚本可能被中间人篡改后以 root 执行。建议先为面板配置 HTTPS 反向代理。
                </span>
              </div>
            )}
          </StepCard>

          <StepCard n={4} done={allDone} title={allDone ? "节点已上线" : "等待节点上线"}>
            {!node ? (
              <p className="text-[13px] text-ink-muted">选择节点后在这里实时查看接入进度。</p>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {checks.map((c, i) => {
                  const firstPending = checks.findIndex((x) => !x.done) === i;
                  return (
                    <li key={c.label} className="flex items-center gap-2.5 text-[13px]">
                      {c.done ? (
                        <CheckCircle weight="fill" className="w-4 h-4 text-status-online shrink-0" />
                      ) : firstPending ? (
                        <CircleNotch className="w-4 h-4 text-accent animate-spin shrink-0" />
                      ) : (
                        <Circle className="w-4 h-4 text-ink-muted shrink-0" />
                      )}
                      <span className={c.done ? "text-ink" : "text-ink-secondary"}>{c.label}</span>
                      <span className="ml-auto text-xs text-ink-muted truncate">{c.hint}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </StepCard>
        </div>

        <aside className="flex flex-col gap-3 min-w-0">
          <section className="p-4 sm:p-5 rounded-xl bg-paper-2 border border-rule flex flex-col gap-3">
            <h2 className="text-[15px] font-semibold text-ink">已有节点只想调优？</h2>
            <p className="text-xs text-ink-muted leading-relaxed">
              TCP-Dashboard 调优：BBR + FQ、按内存 5% 动态缓冲（16–128 MB）、somaxconn 65535 与百万文件句柄、Reality / HY2 专项补丁、网卡多队列均衡，并安装终端快捷命令{" "}
              <code className="font-mono text-ink-secondary">t</code>。
            </p>
            <span className="text-xs text-ink-secondary">官方源（推荐）</span>
            <CopyLine cmd={tuneOfficialCmd} copied={copied === "tune-official"} onCopy={() => copy("tune-official", tuneOfficialCmd)} />
            <span className="text-xs text-ink-secondary">面板镜像源</span>
            <CopyLine cmd={tunePanelCmd} copied={copied === "tune-panel"} onCopy={() => copy("tune-panel", tunePanelCmd)} />
            <a
              href="https://github.com/666shen/tcp-dashboard"
              target="_blank"
              rel="noreferrer"
              className="text-[13px] text-accent hover:underline inline-flex items-center gap-1"
            >
              开源项目
              <ArrowSquareOut className="w-3.5 h-3.5" />
            </a>
          </section>

          <section className="p-4 sm:p-5 rounded-xl bg-paper-2 border border-rule flex flex-col gap-2">
            <h2 className="text-[15px] font-semibold text-ink">支持的系统</h2>
            <p className="text-xs text-ink-muted leading-relaxed">Debian 11/12 · Ubuntu 20/22/24 · CentOS 7/8/9 · Rocky Linux；x86_64 与 arm64。</p>
          </section>
        </aside>
      </div>

      <details className="group rounded-xl bg-paper-2 border border-rule">
        <summary className="list-none cursor-pointer select-none px-4 sm:px-5 h-12 flex items-center gap-2 text-[13px] text-ink-secondary hover:text-ink">
          <span className="transition-transform group-open:rotate-90" aria-hidden="true">›</span>
          查看下发脚本源码
        </summary>
        <div className="px-4 sm:px-5 pb-5 flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div role="group" aria-label="脚本" className="flex p-[3px] gap-0.5 rounded-[9px] border border-rule bg-paper">
              {([
                { id: "install", label: "install.sh" },
                { id: "tcp_tune", label: "tcp-tune.sh" },
              ] as const).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={activePreview === t.id}
                  onClick={() => setActivePreview(t.id)}
                  className={`h-7 px-3 rounded-md font-mono text-xs cursor-pointer ${
                    activePreview === t.id ? "bg-paper-3 text-ink" : "text-ink-secondary hover:text-ink"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => copy("script", activePreview === "install" ? scriptContent : tcpTuneContent)}
              className={`${btn} ml-auto h-8`}
            >
              {copied === "script" ? <Check weight="bold" className="w-3.5 h-3.5 text-status-online" /> : <Copy className="w-3.5 h-3.5" />}
              {copied === "script" ? "已复制" : "复制脚本"}
            </button>
          </div>
          <pre className="p-4 rounded-lg bg-paper border border-rule font-mono text-xs text-ink-secondary overflow-x-auto max-h-[460px] leading-relaxed">
            {activePreview === "install"
              ? scriptContent || "正在获取 install.sh…"
              : tcpTuneContent || "正在获取 tcp-tune.sh…"}
          </pre>
        </div>
      </details>
    </div>
  );
};
