import React, { useState } from "react";
import {
  Plus,
  Trash,
  PencilSimple,
  ArrowsClockwise,
  DotsSixVertical,
  HardDrives,
  Info,
  Target,
  ArrowSquareOut,
} from "@phosphor-icons/react";
import { LatencyTask, NodeItem } from "../../types";
import { Badge } from "../common/Badge";
import { Input } from "../common/Input";
import { Modal } from "../common/Modal";
import { Tooltip } from "../common/Tooltip";

interface LatencyMonitorViewProps {
  tasks: LatencyTask[];
  nodes: NodeItem[];
  onAddTask: (task: Partial<LatencyTask>) => Promise<any>;
  onUpdateTask: (id: string, updates: Partial<LatencyTask>) => Promise<any>;
  onDeleteTask: (id: string) => Promise<any>;
  onResetTasks: () => Promise<any>;
  onReorderTasks?: (orderedIds: string[]) => Promise<any>;
  onOpenNodeDetail: (node: NodeItem) => void;
}

export const LatencyMonitorView: React.FC<LatencyMonitorViewProps> = ({
  tasks,
  nodes,
  onAddTask,
  onUpdateTask,
  onDeleteTask,
  onResetTasks,
  onReorderTasks,
  onOpenNodeDetail,
}) => {
  const [activeTab, setActiveTab] = useState<"tasks" | "servers">("tasks");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<LatencyTask | null>(null);

  // Drag-and-Drop Reordering State
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [dropPosition, setDropPosition] = useState<"top" | "bottom" | null>(null);

  const handleDragStart = (e: React.DragEvent, idx: number, taskId: string) => {
    setDraggedIdx(idx);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", taskId);
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (draggedIdx === null || draggedIdx === idx) {
      setDragOverIdx(null);
      setDropPosition(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    const isTop = offsetY < rect.height / 2;
    setDragOverIdx(idx);
    setDropPosition(isTop ? "top" : "bottom");
  };

  const handleDragLeave = (e: React.DragEvent) => {
    const related = e.relatedTarget as Node | null;
    if (!e.currentTarget.contains(related)) {
      setDragOverIdx(null);
      setDropPosition(null);
    }
  };

  const handleDrop = async (e: React.DragEvent, targetIdx: number) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === targetIdx || !dropPosition) {
      setDraggedIdx(null);
      setDragOverIdx(null);
      setDropPosition(null);
      return;
    }

    const reordered = [...tasks];
    const [removed] = reordered.splice(draggedIdx, 1);
    let insertAt = targetIdx;
    if (draggedIdx < targetIdx) {
      insertAt = dropPosition === "top" ? targetIdx - 1 : targetIdx;
    } else {
      insertAt = dropPosition === "top" ? targetIdx : targetIdx + 1;
    }
    insertAt = Math.max(0, Math.min(reordered.length, insertAt));
    reordered.splice(insertAt, 0, removed);

    setDraggedIdx(null);
    setDragOverIdx(null);
    setDropPosition(null);

    if (onReorderTasks) {
      await onReorderTasks(reordered.map((t) => t.id));
    }
  };

  const handleDragEnd = () => {
    setDraggedIdx(null);
    setDragOverIdx(null);
    setDropPosition(null);
  };

  // Form State
  const [formName, setFormName] = useState("");
  const [formTarget, setFormTarget] = useState("");
  const [formType, setFormType] = useState<"tcp" | "icmp">("tcp");
  const [formInterval, setFormInterval] = useState(60);
  const [formNodeIds, setFormNodeIds] = useState<string[]>([]);
  const [formEnabled, setFormEnabled] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const openCreateModal = () => {
    setEditingTask(null);
    setFormName("");
    setFormTarget("");
    setFormType("tcp");
    setFormInterval(60);
    setFormNodeIds([]);
    setFormEnabled(true);
    setIsModalOpen(true);
  };

  const openEditModal = (task: LatencyTask) => {
    setEditingTask(task);
    setFormName(task.name);
    setFormTarget(task.target);
    setFormType(task.type);
    setFormInterval(task.intervalSec || 60);
    setFormNodeIds(task.nodeIds || []);
    setFormEnabled(task.enabled !== false);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formTarget.trim()) return;

    setIsSubmitting(true);
    try {
      if (editingTask) {
        await onUpdateTask(editingTask.id, {
          name: formName.trim(),
          target: formTarget.trim(),
          type: formType,
          intervalSec: Number(formInterval) || 60,
          nodeIds: formNodeIds,
          enabled: formEnabled,
        });
      } else {
        await onAddTask({
          name: formName.trim(),
          target: formTarget.trim(),
          type: formType,
          intervalSec: Number(formInterval) || 60,
          nodeIds: formNodeIds,
          enabled: formEnabled,
        });
      }
      setIsModalOpen(false);
    } catch (err) {
      console.error("Task save failed:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPresets = async () => {
    if (window.confirm("确定要将测速任务重置为默认的三网优化测速点吗？这不会影响服务器。")) {
      await onResetTasks();
    }
  };

  const toggleNodeSelection = (nodeId: string) => {
    setFormNodeIds((prev) =>
      prev.includes(nodeId) ? prev.filter((id) => id !== nodeId) : [...prev, nodeId]
    );
  };

  const toggleSelectAllNodes = () => {
    if (formNodeIds.length === nodes.length) {
      setFormNodeIds([]);
    } else {
      setFormNodeIds(nodes.map((n) => n.id));
    }
  };

  // Helper to format servers summary
  const renderServersSummary = (taskNodeIds: string[]) => {
    if (!taskNodeIds || taskNodeIds.length === 0) {
      return (
        <span className="text-ink-muted text-xs">
          全部服务器 ({nodes.length}台)
        </span>
      );
    }
    const assigned = nodes.filter((n) => taskNodeIds.includes(n.id));
    if (assigned.length === 0) return <span className="text-ink-muted text-xs">未指派</span>;
    const names = assigned.map((n) => n.name);
    if (names.length <= 3) {
      return <span className="text-ink-secondary text-xs">{names.join(", ")}</span>;
    }
    return (
      <span className="text-ink-secondary text-xs" title={names.join(", ")}>
        {names.slice(0, 3).join(", ")}, +{names.length - 3} ···
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
        <div>
          <h2 className="text-xl font-bold text-ink tracking-tight">延迟监测</h2>
          <p className="text-xs text-ink-muted mt-1">
            基于 TCP / ICMP 协议的多测速目标时序质量监控，毫秒级网络丢包与抖动分析
          </p>
        </div>

        <div className="flex items-center gap-2 sm:gap-2.5 w-full sm:w-auto">
          <Tooltip content="一键恢复默认三网测速目标预设">
            <button
              onClick={handleResetPresets}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-md bg-paper-2 hover:bg-paper-hover text-ink-secondary hover:text-ink text-xs font-medium border border-rule transition-colors cursor-pointer touch-manipulation min-h-[38px] sm:min-h-0"
            >
              <ArrowsClockwise className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">重置三网测试点</span>
            </button>
          </Tooltip>
          <button
            onClick={openCreateModal}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 sm:py-1.5 rounded-md bg-accent hover:bg-accent-hover text-paper text-xs font-semibold shadow transition-colors cursor-pointer touch-manipulation min-h-[38px] sm:min-h-0"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span className="truncate">新建监控任务</span>
          </button>
        </div>
      </div>

      {/* View Mode Tabs */}
      <div className="border-b border-rule flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="flex items-center gap-6">
          <button
            onClick={() => setActiveTab("tasks")}
            className={`pb-2.5 text-sm font-medium transition-colors cursor-pointer relative whitespace-nowrap touch-manipulation ${
              activeTab === "tasks"
                ? "text-accent font-semibold"
                : "text-ink-muted hover:text-ink"
            }`}
          >
            任务视图
            {activeTab === "tasks" && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent rounded-full" />
            )}
          </button>
          <button
            onClick={() => setActiveTab("servers")}
            className={`pb-2.5 text-sm font-medium transition-colors cursor-pointer relative whitespace-nowrap touch-manipulation ${
              activeTab === "servers"
                ? "text-accent font-semibold"
                : "text-ink-muted hover:text-ink"
            }`}
          >
            服务器视图
            {activeTab === "servers" && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent rounded-full" />
            )}
          </button>
        </div>

        {/* Desktop Meta Info */}
        <div className="hidden sm:flex items-center gap-2 text-xs text-ink-muted font-mono pb-2.5">
          <span>共 {tasks.length} 个监测任务</span>
          <span>·</span>
          <span>采样周期 60s</span>
          <span>·</span>
          <span className="text-accent/90 font-sans flex items-center gap-0.5">
            <DotsSixVertical className="w-3.5 h-3.5 inline" />
            支持拖拽排序
          </span>
        </div>
      </div>

      {/* Mobile Sub Meta (Shown only on small screens) */}
      <div className="sm:hidden -mt-3 flex items-center justify-between text-[11px] text-ink-muted font-mono px-0.5">
        <span>共 {tasks.length} 个任务 · 采样周期 60s</span>
        <span className="text-ink-secondary">点击卡片快捷操作</span>
      </div>

      {/* Tab 1: Task View */}
      {activeTab === "tasks" && (
        <div className="space-y-4">
          {/* Desktop Table View (>= md) */}
          <div className="hidden md:block rounded-lg bg-paper-2 border border-rule overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-rule bg-paper/60 text-[11px] font-mono text-ink-muted uppercase select-none">
                    <th className="py-3 px-3 w-10 text-center" title="拖拽排序">#</th>
                    <th className="py-3 px-4 font-medium min-w-[130px]">名称</th>
                    <th className="py-3 px-4 font-medium min-w-[200px]">服务器</th>
                    <th className="py-3 px-4 font-medium min-w-[240px]">目标</th>
                    <th className="py-3 px-3 font-medium min-w-[80px]">类型</th>
                    <th className="py-3 px-3 font-medium min-w-[80px]">间隔</th>
                    <th className="py-3 px-4 font-medium text-right min-w-[100px]">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rule font-mono">
                  {tasks.map((task, idx) => {
                    const isDragging = draggedIdx === idx;
                    const isDragOver = dragOverIdx === idx;
                    return (
                      <tr
                        key={task.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, idx, task.id)}
                        onDragOver={(e) => handleDragOver(e, idx)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, idx)}
                        onDragEnd={handleDragEnd}
                        className={`hover:bg-paper-hover transition-colors group relative ${
                          isDragging ? "opacity-30 bg-accent/10 cursor-grabbing" : ""
                        } ${
                          isDragOver && dropPosition === "top"
                            ? "border-t-2 !border-t-accent bg-accent/5 shadow-[0_-2px_6px_rgba(56,189,248,0.25)]"
                            : ""
                        } ${
                          isDragOver && dropPosition === "bottom"
                            ? "border-b-2 !border-b-accent bg-accent/5 shadow-[0_2px_6px_rgba(56,189,248,0.25)]"
                            : ""
                        }`}
                      >
                        {/* Drag / Index */}
                        <td className="py-3 px-3 text-center text-ink-muted">
                          <Tooltip content="按住上下拖拽调整排序">
                            <div className="flex items-center justify-center p-1 rounded hover:bg-paper-3 text-ink-muted group-hover:text-ink hover:!text-accent cursor-grab active:cursor-grabbing transition-colors">
                              <DotsSixVertical className="w-4 h-4" />
                            </div>
                          </Tooltip>
                        </td>

                        {/* Name */}
                        <td className="py-3 px-4 font-sans whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-ink text-xs">
                              {task.name}
                            </span>
                            {!task.enabled && (
                              <span className="text-[10px] px-1 py-0.2 rounded bg-paper-3 text-ink-muted border border-rule">
                                已暂停
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Assigned Servers */}
                        <td className="py-3 px-4 font-sans whitespace-nowrap">
                          {renderServersSummary(task.nodeIds)}
                        </td>

                        {/* Target Address */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="text-ink font-mono text-xs select-all">
                            {task.target}
                          </span>
                        </td>

                        {/* Protocol Type */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">
                            {task.type}
                          </span>
                        </td>

                        {/* Interval */}
                        <td className="py-3 px-3 whitespace-nowrap text-ink-secondary">
                          {task.intervalSec || 60}
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <Tooltip content="编辑任务">
                              <button
                                onClick={() => openEditModal(task)}
                                className="p-1.5 rounded-md hover:bg-paper-3 text-ink-muted hover:text-ink transition-colors cursor-pointer"
                              >
                                <PencilSimple className="w-4 h-4" />
                              </button>
                            </Tooltip>
                            <Tooltip content="删除任务">
                              <button
                                onClick={() => {
                                 if (window.confirm(`确定删除任务「${task.name}」吗？`)) {
                                    onDeleteTask(task.id);
                                  }
                                }}
                                className="p-1.5 rounded-md hover:bg-rose-500/10 text-ink-muted hover:text-rose-400 transition-colors cursor-pointer"
                              >
                                <Trash className="w-4 h-4" />
                              </button>
                            </Tooltip>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {tasks.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-ink-muted">
                        暂无监测任务，点击右上角「新建监控任务」或「重置三网测试点」快速开始。
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Card Stream (< md) */}
          <div className="md:hidden space-y-3">
            {tasks.map((task) => (
              <div
                key={task.id}
                className="p-3.5 rounded-xl bg-paper-2 border border-rule hover:border-rule-active transition-all space-y-2.5 shadow-xs"
              >
                {/* Top row: Name + Badges + Actions */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-ink text-sm leading-tight break-words">
                        {task.name}
                      </span>
                      <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20 font-semibold shrink-0">
                        {task.type}
                      </span>
                      {!task.enabled && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-paper-3 text-ink-muted border border-rule shrink-0">
                          已暂停
                        </span>
                      )}
                    </div>

                    {/* Target Address */}
                    <div className="text-xs font-mono text-ink-secondary mt-1.5 break-all select-all flex items-center gap-1.5">
                      <Target className="w-3.5 h-3.5 shrink-0 text-ink-muted" />
                      <span>{task.target}</span>
                    </div>
                  </div>

                  {/* Mobile Action Buttons (34x34 touch-friendly targets) */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => openEditModal(task)}
                      className="w-8 h-8 rounded-lg bg-paper-3 hover:bg-paper-hover active:scale-95 text-ink-secondary hover:text-ink flex items-center justify-center border border-rule transition-all cursor-pointer touch-manipulation"
                      title="编辑任务"
                      aria-label="编辑任务"
                    >
                      <PencilSimple className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm(`确定删除任务「${task.name}」吗？`)) {
                          onDeleteTask(task.id);
                        }
                      }}
                      className="w-8 h-8 rounded-lg bg-paper-3 hover:bg-rose-500/10 active:scale-95 text-ink-secondary hover:text-rose-400 flex items-center justify-center border border-rule transition-all cursor-pointer touch-manipulation"
                      title="删除任务"
                      aria-label="删除任务"
                    >
                      <Trash className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Bottom row: Assigned Servers + Interval */}
                <div className="pt-2 border-t border-rule/60 flex items-center justify-between text-xs text-ink-muted">
                  <div className="flex items-center gap-1.5 min-w-0 pr-2">
                    <HardDrives className="w-3.5 h-3.5 shrink-0 text-ink-muted" />
                    <div className="truncate">
                      {renderServersSummary(task.nodeIds)}
                    </div>
                  </div>
                  <div className="shrink-0 font-mono text-[11px] text-ink-secondary">
                    周期: {task.intervalSec || 60}s
                  </div>
                </div>
              </div>
            ))}

            {tasks.length === 0 && (
              <div className="py-8 px-4 rounded-xl bg-paper-2 border border-rule text-center text-xs text-ink-muted">
                暂无监测任务，点击上方「新建监控任务」或「重置三网测试点」快速开始。
              </div>
            )}
          </div>

          {/* Bottom Storage Footprint Notice (7-day retention) */}
          <div className="flex items-start sm:items-center gap-2 text-xs text-ink-muted px-1 leading-relaxed">
            <Info className="w-3.5 h-3.5 shrink-0 text-accent mt-0.5 sm:mt-0" />
            <span>
              预计需要磁盘空间: {(tasks.length * 2.02).toFixed(2)} MB/天，根据设置的 7 天保存时间，需使用 {(tasks.length * 2.02 * 7).toFixed(2)} MB 磁盘空间。
            </span>
          </div>
        </div>
      )}

      {/* Tab 2: Server View */}
      {activeTab === "servers" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {nodes.map((node) => {
            const nodeTasks = tasks.filter(
              (t) => t.enabled && (t.nodeIds.length === 0 || t.nodeIds.includes(node.id))
            );

            return (
              <div
                key={node.id}
                className="p-4 rounded-lg bg-paper-2 border border-rule hover:border-rule-active transition-all space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-ink text-sm">
                        {node.name}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-paper-3 text-ink-muted border border-rule font-mono">
                        {node.countryName.split(" ")[0]}
                      </span>
                    </div>
                    <div className="text-xs font-mono text-ink-muted mt-0.5">
                      {node.ip}:{node.port}
                    </div>
                  </div>

                  <Badge
                    variant={node.status === "online" ? "online" : "danger"}
                    size="sm"
                    pulse={node.status === "online"}
                  >
                    {node.status === "online" ? "在线" : "离线"}
                  </Badge>
                </div>

                <div className="p-2.5 rounded bg-paper/60 border border-rule-subtle text-xs space-y-1.5 font-mono">
                  <div className="flex items-center justify-between text-ink-muted">
                    <span>监测目标任务</span>
                    <span className="font-semibold text-ink">{nodeTasks.length} 个目标</span>
                  </div>
                  <div className="flex items-center justify-between text-ink-muted">
                    <span>基准往返延迟</span>
                    <span className="font-semibold text-accent">{node.latencyMs} ms</span>
                  </div>
                </div>

                <button
                  onClick={() => onOpenNodeDetail(node)}
                  className="w-full py-2.5 px-3 rounded-lg bg-paper-3 hover:bg-paper-hover text-ink text-xs font-medium border border-rule flex items-center justify-center gap-1.5 transition-colors cursor-pointer touch-manipulation min-h-[38px]"
                >
                  <ArrowSquareOut className="w-3.5 h-3.5 text-accent" />
                  <span>查看详细延迟与时序图表</span>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Create or Edit Latency Task */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingTask ? "编辑监测任务" : "新建延迟监测任务"}
        subtitle="配置探测协议、测试目标与指派探针服务器"
        maxWidth="lg"
      >
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-4 sm:p-6 space-y-4 overflow-y-auto max-h-[calc(85vh-9rem)]">
            <div>
              <label className="block text-xs font-medium text-ink-secondary mb-1">
                任务名称 <span className="text-rose-400">*</span>
              </label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="例如: 广东移动 / 香港BGP优化测速点"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-ink-secondary mb-1">
                目标地址 (Host:Port 或 IP) <span className="text-rose-400">*</span>
              </label>
              <Input
                value={formTarget}
                onChange={(e) => setFormTarget(e.target.value)}
                placeholder="例如: gd-cm-v4.ip.zstaticcdn.com:80 或 1.1.1.1:53"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-ink-secondary mb-1">
                  协议类型
                </label>
                <div className="flex items-center gap-2 bg-paper p-1 rounded-md border border-rule">
                  {(["tcp", "icmp"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setFormType(t)}
                      className={`flex-1 py-1.5 text-xs font-mono uppercase rounded transition-colors cursor-pointer touch-manipulation ${
                        formType === t
                          ? "bg-paper-2 text-accent font-semibold shadow-xs"
                          : "text-ink-muted hover:text-ink"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-ink-secondary mb-1">
                  探测间隔 (秒)
                </label>
                <Input
                  type="number"
                  min={10}
                  max={3600}
                  value={formInterval}
                  onChange={(e) => setFormInterval(Number(e.target.value))}
                  required
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5 gap-2">
                <label className="block text-xs font-medium text-ink-secondary truncate">
                  指派探针服务器 <span className="text-ink-muted text-[11px] font-normal">(留空默认全部)</span>
                </label>
                <button
                  type="button"
                  onClick={toggleSelectAllNodes}
                  className="text-xs text-accent hover:text-accent-hover font-medium cursor-pointer transition-colors touch-manipulation whitespace-nowrap shrink-0"
                >
                  {nodes.length > 0 && formNodeIds.length === nodes.length
                    ? "取消全选"
                    : "选择所有节点"}
                </button>
              </div>

              <div className="max-h-48 overflow-y-auto p-2 bg-paper rounded-lg border border-rule space-y-1">
                {/* Master Select All Row */}
                <label className="flex items-center justify-between p-2 rounded hover:bg-paper-hover text-xs text-ink cursor-pointer transition-colors border-b border-rule/50 pb-2 mb-1 select-none touch-manipulation">
                  <div className="flex items-center gap-2.5">
                    <input
                      type="checkbox"
                      checked={nodes.length > 0 && formNodeIds.length === nodes.length}
                      ref={(el) => {
                        if (el) {
                          el.indeterminate =
                            formNodeIds.length > 0 && formNodeIds.length < nodes.length;
                        }
                      }}
                      onChange={toggleSelectAllNodes}
                      className="w-4 h-4 rounded border-rule text-accent focus:ring-accent"
                    />
                    <span className="font-semibold text-accent">选择所有节点</span>
                  </div>
                  <span className="text-ink-muted text-[11px] font-mono">
                    {formNodeIds.length === 0
                      ? "默认全部"
                      : `${formNodeIds.length}/${nodes.length} 已选`}
                  </span>
                </label>

                {nodes.map((node) => {
                  const isChecked = formNodeIds.includes(node.id);
                  return (
                    <label
                      key={node.id}
                      className="flex items-center gap-2.5 p-2 rounded hover:bg-paper-hover text-xs text-ink cursor-pointer transition-colors touch-manipulation select-none"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleNodeSelection(node.id)}
                        className="w-4 h-4 rounded border-rule text-accent focus:ring-accent"
                      />
                      <span className="font-semibold text-ink">{node.name}</span>
                      <span className="text-ink-muted text-[11px] font-mono">
                        ({node.ip})
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2.5 text-xs text-ink cursor-pointer touch-manipulation select-none">
                <input
                  type="checkbox"
                  checked={formEnabled}
                  onChange={(e) => setFormEnabled(e.target.checked)}
                  className="w-4 h-4 rounded border-rule text-accent focus:ring-accent"
                />
                <span>启用该监测任务</span>
              </label>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 px-4 py-3 sm:px-6 sm:py-4 border-t border-rule bg-paper-2/95">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 rounded-md bg-paper-3 hover:bg-paper-hover text-ink text-xs font-medium border border-rule transition-colors cursor-pointer touch-manipulation min-h-[38px]"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-md bg-accent hover:bg-accent-hover text-paper text-xs font-semibold shadow transition-colors cursor-pointer disabled:opacity-50 touch-manipulation min-h-[38px]"
            >
              {isSubmitting ? "保存中..." : editingTask ? "保存更改" : "创建任务"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
