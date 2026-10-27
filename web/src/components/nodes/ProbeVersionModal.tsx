import React, { useState, useEffect } from "react";
import { Modal } from "../common/Modal";
import { Button } from "../common/Button";
import { NodeItem, ProbeVersionInfo } from "../../types";
import { api } from "../../services/api";
import {
  ArrowClockwise,
  CheckCircle,
  Copy,
  Check,
  Terminal,
  WarningCircle,
  Cpu,
  ArrowsClockwise,
  HardDrives,
  Sparkle,
} from "@phosphor-icons/react";

interface ProbeVersionModalProps {
  isOpen: boolean;
  onClose: () => void;
  nodes: NodeItem[];
  onRefreshData?: () => void;
}

export const ProbeVersionModal: React.FC<ProbeVersionModalProps> = ({
  isOpen,
  onClose,
  nodes,
  onRefreshData,
}) => {
  const [loading, setLoading] = useState(false);
  const [versionInfo, setVersionInfo] = useState<ProbeVersionInfo | null>(null);
  const [upgradingNodeId, setUpgradingNodeId] = useState<string | null>(null);
  const [batchUpgrading, setBatchUpgrading] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchVersions = async () => {
    setLoading(true);
    setFeedbackMsg(null);
    try {
      const data = await api<ProbeVersionInfo>("GET", "/api/probe/version");
      setVersionInfo(data);
    } catch (err: any) {
      setVersionInfo(null);
      setFeedbackMsg({ type: "error", text: err.message || "无法连接版本服务" });
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
      const result = await api<{ message?: string }>("POST", `/api/nodes/${nodeId}/upgrade-probe`, {
        version: versionInfo.latestVersion,
      });
      await fetchVersions();
      setFeedbackMsg({ type: "success", text: result?.message || "升级任务已下发，等待探针自重启确认" });
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
      const result = await api<{ totalUpdated?: number }>("POST", "/api/nodes/batch-upgrade-probe", {
        version: versionInfo.latestVersion,
      });
      await fetchVersions();
      setFeedbackMsg({
        type: "success",
        text: `已为 ${result?.totalUpdated ?? 0} 个节点排队升级至 ${versionInfo.latestVersion}，将在 3 秒内自动拉取并重启生效`,
      });
      onRefreshData?.();
    } catch (err: any) {
      setFeedbackMsg({ type: "error", text: err.message || "批量升级请求异常" });
    } finally {
      setBatchUpgrading(false);
    }
  };

  const upgradeCmd = `curl -fsSL ${window.location.origin}/api/update-probe.sh | bash`;

  const handleCopyCmd = () => {
    navigator.clipboard.writeText(upgradeCmd);
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2000);
  };

  const upToDateCount = versionInfo
    ? versionInfo.nodes.filter((n) => n.status === "up_to_date").length
    : 0;
  const outdatedCount = versionInfo
    ? versionInfo.nodes.filter((n) => n.status === "outdated").length
    : 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="NodeMaster 系统探针在线升级管理"
      subtitle="无感热重载 · 4包高精测速 · 毫秒级自更新控制"
      maxWidth="3xl"
    >
      <div className="space-y-4">
        {/* Banner 头部卡片: 官方版本与统计 */}
        <div className="p-4 rounded-xl bg-paper-2 border border-rule relative overflow-hidden space-y-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center text-emerald-400 shrink-0 shadow-sm">
                <Cpu className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold uppercase text-ink tracking-wider font-mono">
                    System Telemetry Probe Agent
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-sm">
                    <Sparkle className="w-3 h-3" />
                    {versionInfo?.latestVersion || "检测中..."}
                  </span>
                  <span className="text-[10px] text-emerald-400/80 font-mono bg-emerald-500/10 px-1.5 py-0.5 rounded">
                    4 包高精度采样
                  </span>
                </div>
                <div className="text-[11px] text-ink-muted mt-0.5">
                  全自动下发更新脚本至各受控 VPS，毫秒级无缝重启拉取最新测速与指标内核。
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="secondary"
                size="sm"
                onClick={fetchVersions}
                disabled={loading || batchUpgrading}
                icon={
                  <ArrowClockwise
                    className={`w-3.5 h-3.5 ${loading ? "animate-spin text-emerald-400" : ""}`}
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
                className="bg-emerald-600 hover:bg-emerald-500 text-white border-transparent"
              >
                {batchUpgrading ? "批量更新中..." : `一键升级全部待更新探针 (${outdatedCount})`}
              </Button>
            </div>
          </div>

          {/* 3 项统计指标卡片 */}
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
                已是最新探针
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
                  outdatedCount > 0 ? "text-amber-400" : "text-ink-secondary"
                }`}
              >
                <WarningCircle className="w-3.5 h-3.5 shrink-0" />
                待升级旧探针
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

        {/* 提示消息 */}
        {feedbackMsg && (
          <div
            className={`p-3 rounded-lg text-xs flex items-center gap-2 animate-fade-in ${
              feedbackMsg.type === "success"
                ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                : "bg-rose-500/10 text-rose-300 border border-rose-500/20"
            }`}
          >
            {feedbackMsg.type === "success" ? (
              <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400" />
            ) : (
              <WarningCircle className="w-4 h-4 shrink-0 text-rose-400" />
            )}
            <span>{feedbackMsg.text}</span>
          </div>
        )}

        {/* 节点探针版本列表 */}
        <div className="border border-rule rounded-xl overflow-hidden bg-paper">
          <div className="px-4 py-3 bg-paper-2 border-b border-rule flex items-center justify-between text-xs font-medium text-ink-secondary">
            <span>受控节点列表与探针内核状态</span>
            <span className="text-[11px] font-mono text-ink-muted">
              心跳周期: 3 秒 · 自动轮询
            </span>
          </div>

          <div className="divide-y divide-rule max-h-[320px] overflow-y-auto">
            {loading && !versionInfo ? (
              <div className="p-8 text-center text-xs text-ink-muted flex flex-col items-center gap-2">
                <ArrowClockwise className="w-5 h-5 animate-spin text-emerald-400" />
                <span>正在获取各节点探针版本...</span>
              </div>
            ) : versionInfo?.nodes.length === 0 ? (
              <div className="p-8 text-center text-xs text-ink-muted">
                暂未纳管任何受控节点
              </div>
            ) : (
              versionInfo?.nodes.map((nodeStatus) => {
                const isSingleUpgrading = upgradingNodeId === nodeStatus.nodeId;
                const isPending = nodeStatus.upgradeStatus === "pending" || isSingleUpgrading;
                const isUpToDate = nodeStatus.status === "up_to_date";

                return (
                  <div
                    key={nodeStatus.nodeId}
                    className="p-3.5 sm:px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-paper-hover/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-paper-3 border border-rule flex items-center justify-center shrink-0">
                        <Cpu className="w-4 h-4 text-emerald-400" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-ink font-sans">
                            {nodeStatus.nodeName}
                          </span>
                          {nodeStatus.os && (
                            <span className="text-[10px] font-mono text-ink-muted bg-paper-3 px-1.5 py-0.2 rounded border border-rule">
                              {nodeStatus.os} · {nodeStatus.arch}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-[11px] font-mono text-ink-muted">
                          <span>探针当前版本:</span>
                          <span
                            className={`font-semibold ${
                              isUpToDate
                                ? "text-emerald-400"
                                : nodeStatus.currentVersion
                                ? "text-amber-400"
                                : "text-ink-muted"
                            }`}
                          >
                            {nodeStatus.currentVersion || "旧版本 (未标注)"}
                          </span>
                          {!isUpToDate && versionInfo && (
                            <span className="text-ink-muted text-[10px]">
                              → 目标 {versionInfo.latestVersion}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                      {isPending ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-medium text-sky-400 bg-sky-500/10 border border-sky-500/20">
                          <ArrowClockwise className="w-3.5 h-3.5 animate-spin" />
                          <span>升级排队中...</span>
                        </span>
                      ) : isUpToDate ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-mono font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20">
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>已是最新</span>
                        </span>
                      ) : (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleUpgradeSingle(nodeStatus.nodeId)}
                          disabled={batchUpgrading || isPending}
                          className="hover:border-emerald-500/40 hover:text-emerald-400 text-xs py-1"
                        >
                          升级探针
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* 首次升级/离线备用终端命令 */}
        <div className="p-3.5 rounded-xl bg-paper-2 border border-rule space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-ink flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-accent" />
              <span>旧节点首次激活在线升级 (备用命令)</span>
            </span>
            <button
              type="button"
              onClick={handleCopyCmd}
              className="text-[11px] text-accent hover:text-accent-hover flex items-center gap-1 cursor-pointer font-medium"
            >
              {copiedCmd ? (
                <Check className="w-3 h-3 text-emerald-400" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
              <span>{copiedCmd ? "已复制" : "复制命令"}</span>
            </button>
          </div>
          <p className="text-[11px] text-ink-muted leading-relaxed">
            若节点运行的是尚未包含自升级指令的旧探针，登录 VPS 执行一次此命令即可完成切换。之后探针有任何改动均可直接在面板上方一键升级。
          </p>
          <div className="p-2.5 rounded bg-paper border border-rule font-mono text-[11px] text-ink-secondary select-all break-all">
            {upgradeCmd}
          </div>
        </div>
      </div>
    </Modal>
  );
};
