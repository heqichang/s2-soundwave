import { useEffect, useRef } from "react";
import { Mic, MicOff, Pause, Play, Square, Plus, Settings, RefreshCw } from "lucide-react";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { useRecordingStore } from "@/store/recordingStore";
import {
  SAMPLE_RATE_OPTIONS,
  BIT_DEPTH_OPTIONS,
  CHANNEL_OPTIONS,
} from "@/types/audio";
import clsx from "clsx";
import { formatTime } from "@/utils/format";

interface RecorderPanelProps {
  onClose?: () => void;
}

function drawWaveform(canvas: HTMLCanvasElement, waveform: number[]) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  const width = canvas.width / dpr;
  const height = canvas.height / dpr;

  ctx.clearRect(0, 0, width, height);

  if (waveform.length === 0) {
    ctx.fillStyle = "rgba(51, 65, 85, 0.3)";
    for (let i = 0; i < 60; i++) {
      const barWidth = width / 60 - 1;
      const barHeight = height * 0.2;
      const x = i * (barWidth + 1);
      const y = (height - barHeight) / 2;
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barHeight, 1);
      ctx.fill();
    }
    return;
  }

  const barCount = Math.min(waveform.length, 100);
  const startIdx = Math.max(0, waveform.length - barCount);
  const visibleWaveform = waveform.slice(startIdx);
  const barWidth = width / barCount - 1;

  for (let i = 0; i < barCount; i++) {
    const amp = visibleWaveform[i] || 0;
    const barHeight = Math.max(2, amp * height * 0.9);
    const x = i * (barWidth + 1);
    const y = (height - barHeight) / 2;

    const gradient = ctx.createLinearGradient(x, y, x, y + barHeight);
    gradient.addColorStop(0, "rgba(34, 211, 238, 0.9)");
    gradient.addColorStop(1, "rgba(139, 92, 246, 0.9)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.roundRect(x, y, barWidth, barHeight, 1);
    ctx.fill();
  }
}

function drawLevel(canvas: HTMLCanvasElement, level: number) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  const width = canvas.width / dpr;
  const height = canvas.height / dpr;

  ctx.clearRect(0, 0, width, height);

  const segmentCount = 30;
  const segmentWidth = width / segmentCount - 2;
  const filledSegments = Math.floor(level * segmentCount);

  for (let i = 0; i < segmentCount; i++) {
    const x = i * (segmentWidth + 2);
    const isFilled = i < filledSegments;

    let color: string;
    if (i < segmentCount * 0.6) {
      color = isFilled ? "#22c55e" : "rgba(34, 197, 94, 0.2)";
    } else if (i < segmentCount * 0.85) {
      color = isFilled ? "#eab308" : "rgba(234, 179, 8, 0.2)";
    } else {
      color = isFilled ? "#ef4444" : "rgba(239, 68, 68, 0.2)";
    }

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x, 0, segmentWidth, height, 2);
    ctx.fill();
  }
}

function setupCanvas(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

export default function RecorderPanel({ onClose }: RecorderPanelProps) {
  const {
    isRecording,
    isPaused,
    isProcessing,
    duration,
    level,
    recordedBlob,
    audioBuffer,
    settings,
    devices,
    error,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    addRecordingToPlaylist,
    updateSettings,
    resetRecording,
    listDevices,
  } = useAudioRecorder();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const levelCanvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const waveCanvas = canvasRef.current;
    const levelCanvas = levelCanvasRef.current;
    if (!waveCanvas || !levelCanvas) return;

    setupCanvas(waveCanvas);
    setupCanvas(levelCanvas);

    const resizeObserver = new ResizeObserver(() => {
      setupCanvas(waveCanvas);
      setupCanvas(levelCanvas);
    });
    resizeObserver.observe(waveCanvas.parentElement!);

    const render = () => {
      const state = useRecordingStore.getState();
      drawWaveform(waveCanvas, state.waveform);
      drawLevel(levelCanvas, state.level);
      rafRef.current = requestAnimationFrame(render);
    };
    rafRef.current = requestAnimationFrame(render);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <div className="glass-card glow-border rounded-2xl p-5 space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className={clsx(
              "w-8 h-8 rounded-lg flex items-center justify-center",
              isRecording
                ? "bg-red-500/20 text-red-400 animate-pulse"
                : "bg-brand-400/20 text-brand-400",
            )}
          >
            <Mic size={16} />
          </div>
          <div>
            <h3 className="font-display font-semibold text-sm text-surface-100">
              录音
            </h3>
            <p className="text-xs text-surface-400">
              {isRecording
                ? isPaused
                  ? "已暂停"
                  : "正在录音..."
                : "准备就绪"}
            </p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-surface-400 hover:text-surface-100 transition-colors"
          >
            <MicOff size={16} />
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-surface-400 mb-1">
            <Settings size={10} className="inline mr-1" />
            输入设备
          </label>
          <select
            value={settings.deviceId}
            onChange={(e) => updateSettings({ deviceId: e.target.value })}
            disabled={isRecording}
            className="w-full text-xs bg-surface-700/60 border border-surface-600/50 rounded-lg px-2 py-1.5 text-surface-100 disabled:opacity-50 focus:outline-none focus:border-brand-400"
          >
            {devices.length === 0 ? (
              <option value="">默认麦克风</option>
            ) : (
              devices.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `麦克风 ${devices.indexOf(device) + 1}`}
                </option>
              ))
            )}
          </select>
        </div>

        <div>
          <label className="block text-xs text-surface-400 mb-1">
            <RefreshCw size={10} className="inline mr-1" />
            刷新设备
          </label>
          <button
            onClick={listDevices}
            disabled={isRecording}
            className="w-full text-xs bg-surface-700/60 border border-surface-600/50 rounded-lg px-2 py-1.5 text-surface-100 hover:bg-surface-700 disabled:opacity-50 transition-colors"
          >
            刷新设备列表
          </button>
        </div>

        <div>
          <label className="block text-xs text-surface-400 mb-1">采样率</label>
          <select
            value={settings.sampleRate}
            onChange={(e) =>
              updateSettings({
                sampleRate: Number(e.target.value) as typeof settings.sampleRate,
              })
            }
            disabled={isRecording}
            className="w-full text-xs bg-surface-700/60 border border-surface-600/50 rounded-lg px-2 py-1.5 text-surface-100 disabled:opacity-50 focus:outline-none focus:border-brand-400"
          >
            {SAMPLE_RATE_OPTIONS.map((rate) => (
              <option key={rate} value={rate}>
                {rate >= 1000 ? `${rate / 1000} kHz` : `${rate} Hz`}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-surface-400 mb-1">位深度</label>
          <select
            value={settings.bitDepth}
            onChange={(e) =>
              updateSettings({
                bitDepth: Number(e.target.value) as typeof settings.bitDepth,
              })
            }
            disabled={isRecording}
            className="w-full text-xs bg-surface-700/60 border border-surface-600/50 rounded-lg px-2 py-1.5 text-surface-100 disabled:opacity-50 focus:outline-none focus:border-brand-400"
          >
            {BIT_DEPTH_OPTIONS.map((depth) => (
              <option key={depth} value={depth}>
                {depth} bit
              </option>
            ))}
          </select>
        </div>

        <div className="col-span-2">
          <label className="block text-xs text-surface-400 mb-1">声道</label>
          <select
            value={settings.channels}
            onChange={(e) =>
              updateSettings({
                channels: Number(e.target.value) as typeof settings.channels,
              })
            }
            disabled={isRecording}
            className="w-full text-xs bg-surface-700/60 border border-surface-600/50 rounded-lg px-2 py-1.5 text-surface-100 disabled:opacity-50 focus:outline-none focus:border-brand-400"
          >
            {CHANNEL_OPTIONS.map((ch) => (
              <option key={ch} value={ch}>
                {ch === 1 ? "单声道 (Mono)" : "立体声 (Stereo)"}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-surface-400">电平</span>
          <span className="font-mono text-surface-300">
            {Math.round(level * 100)}%
          </span>
        </div>
        <canvas
          ref={levelCanvasRef}
          className="w-full h-3 rounded-md"
        />
      </div>

      <div>
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="text-surface-400">波形</span>
          <span className="font-mono text-surface-300">{formatTime(duration)}</span>
        </div>
        <div className="w-full h-16 bg-surface-900/50 rounded-lg overflow-hidden border border-surface-700/40">
          <canvas ref={canvasRef} className="w-full h-full" />
        </div>
      </div>

      {error && (
        <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <div className="flex items-center justify-center gap-2">
        {!isRecording ? (
          <button
            onClick={startRecording}
            disabled={isProcessing}
            className={clsx(
              "btn-icon w-14 h-14 text-lg",
              "bg-red-500 text-white hover:bg-red-400 shadow-lg shadow-red-500/30",
              isProcessing && "opacity-50 cursor-not-allowed",
            )}
          >
            <Mic size={24} />
          </button>
        ) : (
          <>
            <button
              onClick={isPaused ? resumeRecording : pauseRecording}
              className="btn-icon w-12 h-12 bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30"
            >
              {isPaused ? <Play size={20} /> : <Pause size={20} />}
            </button>
            <button
              onClick={stopRecording}
              disabled={isProcessing}
              className={clsx(
                "btn-icon w-14 h-14",
                "bg-red-500 text-white hover:bg-red-400 shadow-lg shadow-red-500/30",
                isProcessing && "opacity-50 cursor-not-allowed",
              )}
            >
              <Square size={24} />
            </button>
          </>
        )}
      </div>

      {(recordedBlob || audioBuffer) && !isRecording && (
        <div className="space-y-3 pt-3 border-t border-surface-700/40">
          <div className="text-xs text-surface-400">
            录音完成：
            <span className="text-surface-200 ml-1">
              {formatTime(duration)} · {recordedBlob ? `${(recordedBlob.size / 1024).toFixed(1)} KB` : ""}
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={addRecordingToPlaylist}
              disabled={isProcessing}
              className="flex-1 flex items-center justify-center gap-1.5 btn-primary text-xs py-2 rounded-lg disabled:opacity-50"
            >
              <Plus size={14} />
              添加到播放列表
            </button>
            <button
              onClick={resetRecording}
              className="flex-1 flex items-center justify-center gap-1.5 btn-secondary text-xs py-2 rounded-lg"
            >
              <RefreshCw size={14} />
              重新录音
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
