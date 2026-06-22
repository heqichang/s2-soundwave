import {
  Scissors,
  Copy,
  ClipboardPaste,
  Trash2,
  Crop,
  Undo2,
  Redo2,
  TrendingUp,
  TrendingDown,
  VolumeX,
  Repeat,
  FlipVertical,
  Gauge,
  Volume2,
  AudioWaveform,
  Waves,
} from "lucide-react";
import { useEditorStore } from "@/store/editorStore";
import { usePlayerStore } from "@/store/playerStore";
import clsx from "clsx";
import type { FadeConfig } from "@/types/editor";

interface EditToolbarProps {
  onCopy: () => void;
  onCut: () => void;
  onPaste: () => void;
  onDelete: () => void;
  onTrim: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onFadeIn: () => void;
  onFadeOut: () => void;
  onSilence: () => void;
  onReverse: () => void;
  onInvertPhase: () => void;
  onNormalize: () => void;
  onAmplify: () => void;
}

const FADE_CURVES: { value: FadeConfig["fadeInCurve"]; label: string }[] = [
  { value: "linear", label: "线性" },
  { value: "logarithmic", label: "对数" },
  { value: "exponential", label: "指数" },
  { value: "sine", label: "正弦" },
];

export default function EditToolbar({
  onCopy,
  onCut,
  onPaste,
  onDelete,
  onTrim,
  onUndo,
  onRedo,
  onFadeIn,
  onFadeOut,
  onSilence,
  onReverse,
  onInvertPhase,
  onNormalize,
  onAmplify,
}: EditToolbarProps) {
  const {
    selection,
    clipboard,
    fadeConfig,
    setFadeConfig,
    amplifyConfig,
    setAmplifyConfig,
  } = useEditorStore();
  const { currentFile, waveformData } = usePlayerStore();
  const { canUndo, canRedo } = useEditorStore();

  const hasFile = !!currentFile && waveformData.length > 0;
  const hasSelection = selection !== null;
  const hasClipboard = clipboard !== null;

  const ToolButton = ({
    children,
    onClick,
    disabled,
    label,
    shortcut,
    className = "",
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    label: string;
    shortcut?: string;
    className?: string;
  }) => (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200",
        disabled
          ? "opacity-30 cursor-not-allowed text-surface-500"
          : "text-surface-200 hover:bg-surface-700/60 hover:text-white active:scale-95",
        className,
      )}
    >
      {children}
      <span className="hidden sm:inline">{label}</span>
      {shortcut && (
        <span className="hidden md:inline text-[10px] text-surface-500 ml-1 font-mono">
          {shortcut}
        </span>
      )}
    </button>
  );

  if (!hasFile) return null;

  return (
    <div className="glass-card rounded-xl p-3 animate-fade-in">
      <div className="flex flex-wrap items-center gap-1">
        <div className="flex items-center gap-0.5 pr-2 border-r border-surface-700/60">
          <ToolButton
            label="撤销"
            shortcut="Ctrl+Z"
            onClick={onUndo}
            disabled={!canUndo()}
          >
            <Undo2 size={14} />
          </ToolButton>
          <ToolButton
            label="重做"
            shortcut="Ctrl+Y"
            onClick={onRedo}
            disabled={!canRedo()}
          >
            <Redo2 size={14} />
          </ToolButton>
        </div>

        <div className="flex items-center gap-0.5 px-2 border-r border-surface-700/60">
          <ToolButton
            label="裁剪"
            onClick={onTrim}
            disabled={!hasSelection}
            className={
              !hasSelection
                ? ""
                : "hover:!bg-brand-400/10 hover:!text-brand-400"
            }
          >
            <Crop size={14} />
          </ToolButton>
          <ToolButton
            label="复制"
            shortcut="Ctrl+C"
            onClick={onCopy}
            disabled={!hasSelection}
          >
            <Copy size={14} />
          </ToolButton>
          <ToolButton
            label="剪切"
            shortcut="Ctrl+X"
            onClick={onCut}
            disabled={!hasSelection}
          >
            <Scissors size={14} />
          </ToolButton>
          <ToolButton
            label="粘贴"
            shortcut="Ctrl+V"
            onClick={onPaste}
            disabled={!hasClipboard}
          >
            <ClipboardPaste size={14} />
          </ToolButton>
          <ToolButton
            label="删除"
            shortcut="Del"
            onClick={onDelete}
            disabled={!hasSelection}
            className={
              !hasSelection ? "" : "hover:!bg-red-500/10 hover:!text-red-400"
            }
          >
            <Trash2 size={14} />
          </ToolButton>
        </div>

        <div className="flex items-center gap-0.5 px-2 border-r border-surface-700/60">
          <ToolButton
            label="静音"
            shortcut="S"
            onClick={onSilence}
            disabled={!hasSelection}
            className={
              !hasSelection ? "" : "hover:!bg-slate-500/10 hover:!text-slate-300"
            }
          >
            <VolumeX size={14} />
          </ToolButton>
          <ToolButton
            label="反转"
            shortcut="Shift+R"
            onClick={onReverse}
            disabled={!hasSelection}
            className={
              !hasSelection ? "" : "hover:!bg-cyan-500/10 hover:!text-cyan-400"
            }
          >
            <Repeat size={14} />
          </ToolButton>
          <ToolButton
            label="反转相位"
            onClick={onInvertPhase}
            disabled={!hasSelection}
            className={
              !hasSelection ? "" : "hover:!bg-indigo-500/10 hover:!text-indigo-400"
            }
          >
            <FlipVertical size={14} />
          </ToolButton>
        </div>

        <div className="flex items-center gap-0.5 px-2 border-r border-surface-700/60">
          <ToolButton
            label="标准化"
            shortcut="N"
            onClick={onNormalize}
            disabled={!hasSelection}
            className={
              !hasSelection ? "" : "hover:!bg-emerald-500/10 hover:!text-emerald-400"
            }
          >
            <Gauge size={14} />
          </ToolButton>
          <ToolButton
            label="增益"
            shortcut="G"
            onClick={onAmplify}
            disabled={!hasSelection}
            className={
              !hasSelection ? "" : "hover:!bg-amber-500/10 hover:!text-amber-400"
            }
          >
            <Volume2 size={14} />
          </ToolButton>
        </div>

        <div className="flex items-center gap-0.5 px-2 border-r border-surface-700/60">
          <ToolButton
            label="淡入"
            onClick={onFadeIn}
            disabled={!hasSelection}
            className={
              !hasSelection ? "" : "hover:!bg-green-500/10 hover:!text-green-400"
            }
          >
            <TrendingUp size={14} />
          </ToolButton>
          <ToolButton
            label="淡出"
            onClick={onFadeOut}
            disabled={!hasSelection}
            className={
              !hasSelection ? "" : "hover:!bg-green-500/10 hover:!text-green-400"
            }
          >
            <TrendingDown size={14} />
          </ToolButton>
        </div>

        <div className="flex items-center gap-2 pl-1 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <label className="text-[10px] text-surface-500 whitespace-nowrap">淡入</label>
              <input
                type="number"
                min={0.01}
                max={30}
                step={0.05}
                value={fadeConfig.fadeInDuration}
                onChange={(e) =>
                  setFadeConfig({ fadeInDuration: Math.max(0.01, parseFloat(e.target.value) || 0.5) })
                }
                className="w-14 px-1.5 py-0.5 rounded bg-surface-800/60 border border-surface-700/40 text-xs text-surface-200 font-mono text-center focus:outline-none focus:border-brand-400/60"
              />
              <select
                value={fadeConfig.fadeInCurve}
                onChange={(e) =>
                  setFadeConfig({
                    fadeInCurve: e.target.value as FadeConfig["fadeInCurve"]
                  })
                }
                className="px-1.5 py-0.5 rounded bg-surface-800/60 border border-surface-700/40 text-[10px] text-surface-200 font-mono focus:outline-none focus:border-brand-400/60"
                title="淡入曲线类型"
              >
                {FADE_CURVES.map((c) => (
                  <option key={c.value}>{c.label}</option>
                ))}
              </select>
              <span className="text-[10px] text-surface-500">s</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <label className="text-[10px] text-surface-500 whitespace-nowrap">淡出</label>
            <input
              type="number"
              min={0.01}
              max={30}
              step={0.05}
              value={fadeConfig.fadeOutDuration}
              onChange={(e) =>
                setFadeConfig({ fadeOutDuration: Math.max(0.01, parseFloat(e.target.value) || 0.5) })
              }
              className="w-14 px-1.5 py-0.5 rounded bg-surface-800/60 border border-surface-700/40 text-xs text-surface-200 font-mono text-center focus:outline-none focus:border-brand-400/60"
            />
            <select
              value={fadeConfig.fadeOutCurve}
              onChange={(e) =>
                setFadeConfig({
                  fadeOutCurve: e.target.value as FadeConfig["fadeOutCurve"]
                })
              }
              className="px-1.5 py-0.5 rounded bg-surface-800/60 border border-surface-700/40 text-[10px] text-surface-200 font-mono focus:outline-none focus:border-brand-400/60"
              title="淡出曲线类型"
            >
              {FADE_CURVES.map((c) => (
                <option key={c.value}>{c.label}</option>
              ))}
            </select>
            <span className="text-[10px] text-surface-500">s</span>
          </div>

          <div className="flex items-center gap-1.5">
            <Volume2 size={12} className="text-surface-500" />
            <label className="text-[10px] text-surface-500 whitespace-nowrap">增益</label>
            <input
              type="number"
              min={-60}
              max={60}
              step={0.5}
              value={amplifyConfig.gainDb}
              onChange={(e) =>
                setAmplifyConfig({
                  gainDb: clampF(parseFloat(e.target.value) || 0, -60, 60),
                })
              }
              className="w-14 px-1.5 py-0.5 rounded bg-surface-800/60 border border-surface-700/40 text-xs text-surface-200 font-mono text-center focus:outline-none focus:border-brand-400/60"
            />
            <span className="text-[10px] text-surface-500">dB</span>
            <label className="flex items-center gap-1 text-[10px] text-surface-500">
              <input
                type="checkbox"
                checked={amplifyConfig.allowClipping}
                onChange={(e) =>
                  setAmplifyConfig({ allowClipping: e.target.checked })
                }
                className="w-3 h-3 rounded text-brand-500 focus:ring-brand-400"
                title="允许削波"
              />
              削波
            </label>
          </div>
        </div>
      </div>

      {hasSelection && (
        <div className="mt-2 pt-2 border-t border-surface-700/40 flex items-center gap-3 text-xs text-surface-400">
          <span>
            选中:{" "}
            <span className="text-accent-400 font-mono">
              {formatSelectionTime(selection.start)}
            </span>
            {" → "}
            <span className="text-accent-400 font-mono">
              {formatSelectionTime(selection.end)}
            </span>
          </span>
          <span className="text-surface-600">|</span>
          <span>
            时长:{" "}
            <span className="text-brand-400 font-mono">
              {formatSelectionTime(selection.end - selection.start)}
            </span>
          </span>
        </div>
      )}
    </div>
  );
}

function clampF(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max);
}

function formatSelectionTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "0:00.000";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const wholeSecs = Math.floor(secs);
  const ms = Math.floor((secs - wholeSecs) * 1000);
  return `${mins}:${wholeSecs.toString().padStart(2, "0")}.${ms.toString().padStart(3, "0")}`;
}
