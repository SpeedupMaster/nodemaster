import React, { useState, useEffect } from "react";
import { Modal } from "../common/Modal";
import { Button } from "../common/Button";
import { NodeItem, XrayVersionInfo } from "../../types";
import { api } from "../../services/api";
import {
  ArrowClockwise,
  ArrowSquareOut,
  CheckCircle,
  Copy,
  Check,
  ShieldCheck,
  Terminal,
  WarningCircle,
  Cpu,
  ArrowsClockwise,
  ArrowRight,
  HardDrives,
  Sparkle,
} from "@phosphor-icons/react";

interface XrayVersionModalProps {
  isOpen: boolean;
  onClose: () => void;
  nodes: NodeItem[];
  onRefreshData?: () => void;
}

export const XrayVersionModal: React.FC<XrayVersionModalProps> = ({
  isOpen,
  onClose,
  nodes,
  onRefreshData,
}) => {
  const [loading, setLoading] = useState(false);
  const [versionInfo, setVersionInfo] = useState<XrayVersionInfo | null>(null);
  const [upgradingNodeId, setUpgradingNodeId] = useState<string | null>(null);
  const [batchUpgrading, setBatchUpgrading] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchVersions = async (forceRefresh = false) => {
    setLoading(true);
    setFeedbackMsg(null);
    try {
      setVersionInfo(await api<XrayVersionInfo>("GET", `/api/xray/version${forceRefresh ? "?refresh=true" : ""}`));
    } catch (err: any) {
      setVersionInfo(null);
      setFeedbackMsg({ type: "error", text: err.message || "网络请求异常，无法连接版本服务" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchVersions();
    }
  }, [isOpen]);

  const handleUpgradeSingle = async (nodeId: string) => {
    if (!versionInfo) return;
    setUpgradingNodeId(nodeId);
    setFeedbackMsg(null);
    try {
      const result = await api<{ message?: string }>("POST", `/api/nodes/${nodeId}/upgrade-xray`, {
        version: versionInfo.latestVersion,
      });
      await fetchVersions(false);
      setFeedbackMsg({ type: "success", text: result?.message || "升级任务已排队，等待探针确认" });
      onRefreshData?.();
    } catch (err: any) {
      setFeedbackMsg({ type: "error", text: err.message || "请求异常" });
    } finally {
      setUpgradingNodeId(null);
    }
  };

  const handleBatchUpgrade = async () => {
    if (!versionInfo) return;
    setBatchUpgrading(true);
    setFeedbackMsg(null);
    try {
      const result = await api<{ totalUpdated?: number }>("POST", "/api/nodes/batch-upgrade-xray", {
        version: versionInfo.latestVersion,
      });
      await fetchVersions(false);
      setFeedbackMsg({
        type: "success",
        text: `已为 ${result?.totalUpdated ?? 0} 个节点排队升级至 ${versionInfo.latestVersion}，等待探针确认`,
      });
      onRefreshData?.();
    } catch (err: any) {
      setFeedbackMsg({ type: "error", text: err.message || "批量请求异常" });
    } finally {
      setBatchUpgrading(false);
    }
  };

  const upgradeCmd = `${window.location.origin}/api/xray/upgrade.sh | bash`;
  const fullUpgradeCmd = `curl -fsSL ${upgradeCmd}`;

  const handleCopyCmd = () => {
    navigator.clipboard.writeText(fullUpgradeCmd);
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2000);
  };

  if (!isOpen) return null;

  const outdatedCount = versionInfo?.nodes.filter((n) => n.status === "outdated").length || 0;
  const upToDateCount = versionInfo?.nodes.filter((n) => n.status === "up_to_date").length || 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Xray-core 内核版本检测与维护"
      subtitle="自动跟踪 XTLS 官方发布版本，比对全网节点内核状态，支持在线一键推送升级"
      maxWidth="3xl"
    >
      <div className="space-y-4">
        {/* Banner 头部卡片: 官方版本与统计 */}
        <div className="p-4 rounded-xl bg-paper-2 border border-rule relative overflow-hidden space-y-3.5">
          {/* 上半部：官方版本与操作按钮 */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-accent/15 border border-accent/25 flex items-center justify-center text-accent shrink-0 shadow-sm">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold uppercase text-ink tracking-wider font-mono">
                    XTLS / Xray-core
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-accent/15 text-accent border border-accent/30 shadow-sm">
                    <Sparkle className="w-3 h-3" />
                    {versionInfo?.latestVersion || "检测中..."}
                  </span>
                  {versionInfo?.releaseUrl && (
                    <a
                      href={versionInfo.releaseUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-ink-muted hover:text-accent transition-colors underline-offset-2 hover:underline"
                      title="在 GitHub 查看官方发行日志"
                    >
                      <span>发行日志</span>
                      <ArrowSquareOut className="w-3 h-3" />
                    </a>
                  )}
                </div>
                <div className="text-[11px] text-ink-muted mt-0.5">
                  官方发布日期：{versionInfo?.publishedAt ? new Date(versionInfo.publishedAt).toLocaleDateString() : "--"}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => fetchVersions(true)}
                disabled={loading || batchUpgrading}
                icon={
                  <ArrowClockwise
                    className={`w-3.5 h-3.5 ${loading ? "animate-spin text-accent" : ""}`}
                  />
                }
              >
                刷新检测
              </Button>

              <Button
                variant="primary"
                size="sm"
                onClick={handleBatchUpgrade}
                disabled={loading || batchUpgrading || outdatedCount === 0}
                icon={
                  <ArrowsClockwise
                    className={`w-3.5 h-3.5 ${batchUpgrading ? "animate-spin" : ""}`}
                  />
                }
              >
                {batchUpgrading ? "批量更新中..." : `一键升级全部待更新 (${outdatedCount})`}
              </Button>
            </div>
          </div>

          {/* 下半部：3 项统计指标卡片 */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-rule-subtle">
            <div className="px-3 py-2 rounded-lg bg-paper-3/60 border border-rule-subtle flex items-center justify-between">
              <span className="text-xs text-ink-secondary flex items-center gap-1.5 whitespace-nowrap">
                <HardDrives className="w-3.5 h-3.5 text-ink-muted shrink-0" />
                全网纳管节点
              </span>
              <span className="text-xs font-mono font-bold text-ink whitespace-nowrap">
                {nodes.length} 个
              </span>
            </div>

            <div className="px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between">
              <span className="text-xs text-emerald-400 flex items-center gap-1.5 whitespace-nowrap">
                <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                已是最新内核
              </span>
              <span className="text-xs font-mono font-bold text-emerald-400 whitespace-nowrap">
                {upToDateCount} 个
              </span>
            </div>

            <div
              className={`px-3 py-2 rounded-lg border flex items-center justify-between ${
                outdatedCount > 0
                  ? "bg-amber-500/10 border-amber-500/25"
                  : "bg-paper-3/60 border-rule-subtle"
              }`}
            >
              <span
                className={`text-xs flex items-center gap-1.5 whitespace-nowrap ${
                  outdatedCount > 0 ? "text-amber-400" : "text-ink-muted"
                }`}
              >
                <WarningCircle className="w-3.5 h-3.5 shrink-0" />
                待升级落后节点
              </span>
              <span
                className={`text-xs font-mono font-bold whitespace-nowrap ${
                  outdatedCount > 0 ? "text-amber-400" : "text-ink-muted"
                }`}
              >
                {outdatedCount} 个
              </span>
            </div>
          </div>
        </div>

        {/* 操作反馈提示 */}
        {feedbackMsg && (
          <div
            className={`p-3 rounded-lg text-xs flex items-center gap-2 border font-medium ${
              feedbackMsg.type === "success"
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/25"
                : "bg-status-danger-bg text-status-danger border-status-danger/30"
            }`}
          >
            {feedbackMsg.type === "success" ? (
              <CheckCircle className="w-4 h-4 shrink-0" />
            ) : (
              <WarningCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{feedbackMsg.text}</span>
          </div>
        )}

        {/* 节点列表与内核比对 */}
        <div className="border border-rule rounded-xl overflow-hidden bg-paper">
          <div className="px-4 py-2.5 bg-paper-2/80 border-b border-rule flex items-center justify-between text-xs font-medium text-ink-secondary">
            <span className="flex items-center gap-1.5 font-medium">
              <Cpu className="w-3.5 h-3.5 text-accent" />
              纳管节点内核矩阵
            </span>
            <div className="flex items-center gap-2 text-[11px] font-mono text-ink-muted">
              <span>目标内核版本:</span>
              <span className="font-semibold text-accent">
                {versionInfo?.latestVersion || "--"}
              </span>
            </div>
          </div>

          <div className="divide-y divide-rule max-h-[360px] overflow-y-auto">
            {nodes.length === 0 ? (
              <div className="py-10 text-center text-xs text-ink-muted">暂未添加任何节点</div>
            ) : (
              nodes.map((node) => {
                const nodeStatus = versionInfo?.nodes.find((n) => n.nodeId === node.id);
                const currentVer = nodeStatus?.currentVersion || node.xrayVersion || "尚未上报";
                const isLatest = nodeStatus?.status === "up_to_date";
                const isUpgrading = upgradingNodeId === node.id || batchUpgrading;

                return (
                  <div
                    key={node.id}
                    className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-paper-hover transition-colors"
                  >
                    {/* 左侧：节点标识与基础规格 */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-ink font-mono tracking-tight">
                          {node.name}
                        </span>
                        <span className="text-[11px] px-1.5 py-0.5 rounded bg-paper-3 text-ink-secondary border border-rule font-medium shrink-0">
                          {node.countryName}
                        </span>
                        <span className="text-xs text-ink-muted font-mono shrink-0">
                          {node.ip}:{node.port}
                        </span>
                      </div>

                      {/* 节点运行环境 */}
                      {node.upgradeStatus === "pending" && <p className="text-xs text-amber-400 mt-1">等待探针执行并确认 {node.desiredXrayVersion}</p>}
                      {node.upgradeStatus === "failed" && <p role="alert" className="text-xs text-red-400 mt-1">升级失败：{node.upgradeError || "请重试"}</p>}
                      <div className="text-xs text-ink-muted mt-1.5 flex items-center gap-2 font-mono flex-wrap">
                        <span>系统: {node.os || "Linux"}</span>
                        <span>•</span>
                        <span>架构: {node.arch || "x86_64"}</span>
                      </div>
                    </div>

                    {/* 右侧：内核版本状态与操作按钮 */}
                    <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                      {/* 版本指示器 */}
                      <div className="text-right flex items-center gap-1.5 font-mono">
                        {isLatest ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
                            <CheckCircle className="w-3.5 h-3.5" />
                            {currentVer}
                          </span>
                        ) : (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs bg-paper-2 border border-rule">
                            <span className="font-semibold text-amber-400">{currentVer}</span>
                            <ArrowRight className="w-3 h-3 text-ink-muted" />
                            <span className="font-semibold text-accent">
                              {versionInfo?.latestVersion}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* 操作按钮 */}
                      <div className="shrink-0">
                        {isLatest ? (
                          <span className="inline-flex items-center gap-1 text-xs font-mono font-medium text-emerald-400 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 whitespace-nowrap">
                            <Check className="w-3.5 h-3.5" />
                            已是最新
                          </span>
                        ) : (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleUpgradeSingle(node.id)}
                            disabled={isUpgrading || loading || !versionInfo}
                            icon={
                              <ArrowsClockwise
                                className={`w-3.5 h-3.5 ${
                                  isUpgrading ? "animate-spin" : ""
                                }`}
                              />
                            }
                          >
                            {isUpgrading ? "升级中..." : "立即升级"}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* 现代 macOS 终端风格升级命令卡片 */}
        <div className="rounded-xl border border-rule bg-paper-2 overflow-hidden shadow-sm">
          {/* 终端顶栏 */}
          <div className="px-4 py-2 bg-paper-3/80 border-b border-rule flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80 inline-block" />
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block" />
              </div>
              <span className="text-xs font-mono text-ink-secondary ml-1.5 flex items-center gap-1.5 font-medium">
                <Terminal className="w-3.5 h-3.5 text-accent" />
                VPS 终端独立一键升级命令 (支持直接在服务器 SSH 执行)
              </span>
            </div>

            <button
              onClick={handleCopyCmd}
              className="text-xs text-accent hover:text-accent-hover flex items-center gap-1.5 font-mono cursor-pointer transition-colors px-2 py-0.5 rounded hover:bg-accent/10"
            >
              {copiedCmd ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400 font-semibold">已复制命令</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>复制命令</span>
                </>
              )}
            </button>
          </div>

          {/* 终端代码体 */}
          <div className="p-3.5 bg-paper font-mono text-xs flex items-center gap-2 select-all overflow-x-auto">
            <span className="text-accent font-bold select-none">$</span>
            <span className="text-ink select-all break-all">{fullUpgradeCmd}</span>
          </div>

          {/* 终端底部功能提示 */}
          <div className="px-4 py-2.5 bg-paper-2 border-t border-rule-subtle text-[11px] text-ink-muted flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 font-mono">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-emerald-400">✓ 架构自适应 (x86_64 / arm64)</span>
              <span>•</span>
              <span className="text-emerald-400">✓ 配置预检与失败回滚</span>
              <span>•</span>
              <span>重启 nodemaster-proxy，连接会短暂中断</span>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};
