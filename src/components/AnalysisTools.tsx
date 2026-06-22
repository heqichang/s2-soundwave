import { useEffect, useRef, useState } from "react";
import { useEditorStore } from "@/store/editorStore";
import { usePlayerStore } from "@/store/playerStore";
import {
  analyzePeakData,
  generateSpectrumData,
  computeRmsLevels,
  linearToDbValue,
} from "@/lib/audioUtils";
import {
  BarChart3,
  Activity,
  TrendingUp,
  Waves,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import clsx from "clsx";
import type { PeakData } from "@/types/editor";

function formatDb(db: number): string {
  if (!isFinite(db)) return "-∞";
  return `${db.toFixed(1)} dB`;
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function formatMarkerTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "0:00.000";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const wholeSecs = Math.floor(secs);
  const ms = Math.floor((secs - wholeSecs) * 1000);
  return `${mins}:${wholeSecs.toString().padStart(2, "0")}.${ms.toString().padStart(3, "0")}`;
}

function dbToColor(db: number): string {
  if (db >= -3) return "#ef4444";
  if (db >= -12) return "#f59e0b";
  if (db >= -30) return "#22c55e";
  return "#3b82f6";
}

export default function AnalysisTools() {
  const { audioBuffer, peakData, setPeakData } = useEditorStore();
  const { waveformData, currentTime, isPlaying } = usePlayerStore();
  const spectrumCanvasRef = useRef<HTMLCanvasElement>(null);
  const meterCanvasRef = useRef<HTMLCanvasElement>(null);
  const [expanded, setExpanded] = useState(true);
  const [localPeakData, setLocalPeakData] = useState<PeakData | null>(peakData);
  const [rmsLevels, setRmsLevels] = useState<{ time: number; rmsDb: number; peakDb: number }[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const runFullAnalysis = async () => {
    if (!audioBuffer) return;
    setIsAnalyzing(true);
    try {
      await new Promise((r) => setTimeout(r, 20));
      const peak = analyzePeakData(audioBuffer);
      setPeakData(peak);
      setLocalPeakData(peak);
      const levels = computeRmsLevels(audioBuffer, 4096);
      setRmsLevels(levels);
      drawSpectrum();
    } finally {
      setIsAnalyzing(false);
    }
  };

  useEffect(() => {
    if (audioBuffer) {
      const peak = analyzePeakData(audioBuffer);
      setPeakData(peak);
      setLocalPeakData(peak);
      drawSpectrum();
    } else {
      setLocalPeakData(null);
      setRmsLevels([]);
      const sc = spectrumCanvasRef.current;
      if (sc) {
        const sctx = sc.getContext("2d");
        if (sctx) {
          const w = sc.clientWidth;
          const h = sc.clientHeight;
          sctx.clearRect(0, 0, w, h);
        }
      }
    }
  }, [audioBuffer, setPeakData]);

  const drawSpectrum = () => {
    const canvas = spectrumCanvasRef.current;
    if (!canvas || !audioBuffer) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const { frequencies, magnitudes, maxMagnitudeDb } = generateSpectrumData(audioBuffer, 1024);
    if (frequencies.length === 0) return;

    const minDb = -80;
    const maxDb = isFinite(maxMagnitudeDb) ? Math.max(maxMagnitudeDb, -20) : 0;
    const dbRange = maxDb - minDb;
    const numBars = Math.min(frequencies.length, Math.floor(w / 3));
    const barWidth = (w / numBars) * 0.75;

    for (let i = 0; i < numBars; i++) {
      const startIdx = Math.floor((i / numBars) * frequencies.length);
      const endIdx = Math.floor(((i + 1) / numBars) * frequencies.length);
      let maxMag = 0;
      for (let j = startIdx; j < endIdx && j < magnitudes.length; j++) {
        if (magnitudes[j] > maxMag) maxMag = magnitudes[j];
      }
      const magDb = linearToDbValue(maxMag);
      const normalized = Math.max(0, Math.min(1, (magDb - minDb) / dbRange));
      const barHeight = Math.max(1, normalized * (h - 20));
      const x = (i / numBars) * w;
      const y = h - barHeight - 14;

      const freq = frequencies[startIdx];
      const color =
        freq < 250
          ? "rgba(34,197,94,"
          : freq < 2000
          ? "rgba(59,130,246,"
          : freq < 8000
          ? "rgba(168,85,247,"
          : "rgba(244,63,94,";

      const grad = ctx.createLinearGradient(x, y, x, h - 14);
      grad.addColorStop(0, color + "0.95)");
      grad.addColorStop(1, color + "0.4)");
      ctx.fillStyle = grad;
      ctx.fillRect(x, y, Math.max(1, barWidth), barHeight);
    }

    ctx.fillStyle = "rgba(100,116,139,0.7)";
    ctx.font = "9px 'JetBrains Mono', monospace";
    ctx.textAlign = "center";
    const labels = [
      { freq: 50, label: "50" },
      { freq: 200, label: "200" },
      { freq: 1000, label: "1k" },
      { freq: 5000, label: "5k" },
      { freq: 20000, label: "20k" },
    ];
    const nyquist = audioBuffer.sampleRate / 2;
    labels.forEach((l) => {
      if (l.freq <= nyquist) {
        const pos = Math.log10(Math.max(20, l.freq) / 20) / Math.log10(nyquist / 20);
        const x = Math.max(0, Math.min(1, pos)) * w;
        ctx.fillText(l.label, x, h - 3);
      }
    });
    ctx.textAlign = "start";
    ctx.fillText("Hz", w - 14, h - 3);
  };

  useEffect(() => {
    const canvas = meterCanvasRef.current;
    if (!canvas || !audioBuffer) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    if (!localPeakData || rmsLevels.length === 0) {
      ctx.fillStyle = "rgba(100,116,139,0.3)";
      ctx.font = "10px sans-serif";
      ctx.fillText("等待分析...", 8, h / 2 + 4);
      return;
    }

    const barH = Math.max(4, (h - 24) / 2 - 4);
    const drawLevels = (data: typeof rmsLevels, yOffset: number, label: string) => {
      const minDb = -80;
      const maxDb = 0;
      ctx.fillStyle = "rgba(100,116,139,0.5)";
      ctx.font = "9px 'JetBrains Mono', monospace";
      ctx.fillText(label, 4, yOffset + 10);

      const graphX = 42;
      const graphW = w - graphX - 8;

      for (let i = 0; i < data.length; i++) {
        const x = graphX + (i / data.length) * graphW;
        const peakNorm = Math.max(0, Math.min(1, (data[i].peakDb - minDb) / (maxDb - minDb)));
        const peakH = peakNorm * barH;
        const rmsNorm = Math.max(0, Math.min(1, (data[i].rmsDb - minDb) / (maxDb - minDb)));
        const rmsH = rmsNorm * barH;

        const peakColor = data[i].peakDb >= -3
          ? "rgba(239,68,68,0.7)"
          : data[i].peakDb >= -12
          ? "rgba(245,158,11,0.7)"
          : "rgba(34,197,94,0.55)";
        ctx.fillStyle = peakColor;
        ctx.fillRect(x, yOffset + barH - peakH, Math.max(1, graphW / data.length * 0.8), peakH);

        ctx.fillStyle = "rgba(56,189,248,0.9)";
        const rmsY = yOffset + barH - rmsH;
        ctx.fillRect(x, rmsY, Math.max(1, graphW / data.length * 0.8), 1.5);
      }
    };

    drawLevels(rmsLevels, 4, "Peak");
    drawLevels(rmsLevels, barH + 16, "RMS");

    const playhead = currentTime / audioBuffer.duration;
    if (isFinite(playhead) && playhead >= 0 && playhead <= 1) {
      const ph = 42 + playhead * (w - 50);
      ctx.strokeStyle = "rgba(244,63,94,0.9)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(ph, 0);
      ctx.lineTo(ph, h);
      ctx.stroke();
    }
  }, [audioBuffer, localPeakData, rmsLevels, currentTime]);

  const hasData = waveformData.length > 0;

  return (
    <div className="glass-card rounded-xl overflow-hidden animate-fade-in">
      <div
        className={clsx(
          "flex items-center justify-between px-4 py-3 cursor-pointer",
          "border-b border-surface-700/40 hover:bg-surface-700/20 transition-colors",
        )}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <Activity size={14} className="text-accent-400" />
          <h3 className="text-sm font-semibold text-surface-100">分析工具</h3>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              runFullAnalysis();
            }}
            disabled={!audioBuffer || isAnalyzing}
            className={clsx(
              "px-2 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1",
              audioBuffer && !isAnalyzing
                ? "bg-accent-500/20 text-accent-400 hover:bg-accent-500/30 border border-accent-500/30"
                : "bg-surface-700/40 text-surface-500 cursor-not-allowed border border-surface-700/40",
            )}
            title="重新分析"
          >
            <RefreshCw size={12} className={clsx(isAnalyzing && "animate-spin")} />
            分析
          </button>
          {expanded ? (
            <ChevronUp size={14} className="text-surface-500" />
          ) : (
            <ChevronDown size={14} className="text-surface-500" />
          )}
        </div>
      </div>

      {expanded && (
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-surface-800/50 border border-surface-700/40 space-y-1.5">
              <div className="flex items-center gap-1.5">
                <TrendingUp size={12} className="text-red-400" />
                <span className="text-[10px] uppercase font-semibold text-surface-400 tracking-wider">
                  最大峰值
                </span>
              </div>
              {localPeakData ? (
                <>
                  <div
                    className="text-lg font-bold font-mono"
                    style={{ color: dbToColor(linearToDbValue(localPeakData.maxPeak)) }}
                  >
                    {formatDb(linearToDbValue(localPeakData.maxPeak))}
                  </div>
                  <div className="text-[10px] font-mono text-surface-500">
                    @ {formatMarkerTime(localPeakData.maxPeakTime)}
                  </div>
                  <div className="text-[10px] font-mono text-surface-500">
                    {formatPercent(localPeakData.maxPeak)}
                  </div>
                </>
              ) : (
                <div className="text-xs text-surface-600">--</div>
              )}
            </div>

            <div className="p-3 rounded-lg bg-surface-800/50 border border-surface-700/40 space-y-1.5">
              <div className="flex items-center gap-1.5">
                <BarChart3 size={12} className="text-sky-400" />
                <span className="text-[10px] uppercase font-semibold text-surface-400 tracking-wider">
                  RMS 电平
                </span>
              </div>
              {localPeakData ? (
                <>
                  <div
                    className="text-lg font-bold font-mono"
                    style={{ color: dbToColor(linearToDbValue(localPeakData.rmsLevel)) }}
                  >
                    {formatDb(linearToDbValue(localPeakData.rmsLevel))}
                  </div>
                  <div className="text-[10px] font-mono text-surface-500">
                    平均均方根
                  </div>
                  <div className="text-[10px] font-mono text-surface-500">
                    {formatPercent(localPeakData.rmsLevel)}
                  </div>
                </>
              ) : (
                <div className="text-xs text-surface-600">--</div>
              )}
            </div>

            <div className="p-3 rounded-lg bg-surface-800/50 border border-surface-700/40 space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Waves size={12} className="text-amber-400" />
                <span className="text-[10px] uppercase font-semibold text-surface-400 tracking-wider">
                  直流偏移
                </span>
              </div>
              {localPeakData ? (
                <>
                  <div
                    className={clsx(
                      "text-lg font-bold font-mono",
                      Math.abs(localPeakData.dcOffset) > 0.01 ? "text-red-400" : "text-emerald-400",
                    )}
                  >
                    {formatPercent(localPeakData.dcOffset)}
                  </div>
                  <div className="text-[10px] font-mono text-surface-500">
                    {Math.abs(localPeakData.dcOffset) > 0.01
                      ? "⚠️ 建议移除直流偏移"
                      : "✓ 正常范围"}
                  </div>
                  <div className="text-[10px] font-mono text-surface-500">
                    {localPeakData.dcOffset.toFixed(6)}
                  </div>
                </>
              ) : (
                <div className="text-xs text-surface-600">--</div>
              )}
            </div>

            <div className="p-3 rounded-lg bg-surface-800/50 border border-surface-700/40 space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Activity size={12} className="text-violet-400" />
                <span className="text-[10px] uppercase font-semibold text-surface-400 tracking-wider">
                  动态范围
                </span>
              </div>
              {localPeakData ? (
                <>
                  <div className="text-lg font-bold font-mono text-violet-400">
                    {formatDb(
                      linearToDbValue(localPeakData.maxPeak) -
                        linearToDbValue(localPeakData.rmsLevel),
                    )}
                  </div>
                  <div className="text-[10px] font-mono text-surface-500">
                    Peak / RMS 比
                  </div>
                  <div className="text-[10px] font-mono text-surface-500">
                    {(localPeakData.maxPeak / Math.max(localPeakData.rmsLevel, 1e-9)).toFixed(2)}x
                  </div>
                </>
              ) : (
                <div className="text-xs text-surface-600">--</div>
              )}
            </div>
          </div>

          {hasData && (
            <>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-1.5">
                    <BarChart3 size={12} className="text-emerald-400" />
                    <span className="text-[10px] uppercase font-semibold text-surface-400 tracking-wider">
                      频谱分析 (FFT)
                    </span>
                  </div>
                  <span className="text-[10px] text-surface-600">
                    {audioBuffer?.sampleRate
                      ? `采样率: ${(audioBuffer.sampleRate / 1000).toFixed(1)} kHz`
                      : ""}
                  </span>
                </div>
                <div className="rounded-lg bg-surface-800/60 border border-surface-700/40 p-2">
                  <canvas
                    ref={spectrumCanvasRef}
                    className="w-full h-24"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-1.5">
                    <Activity size={12} className="text-pink-400" />
                    <span className="text-[10px] uppercase font-semibold text-surface-400 tracking-wider">
                      电平表 (Peak / RMS)
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-mono">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded bg-emerald-500" /> Peak
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-0.5 bg-sky-400" /> RMS
                    </span>
                  </div>
                </div>
                <div className="rounded-lg bg-surface-800/60 border border-surface-700/40 p-2">
                  <canvas
                    ref={meterCanvasRef}
                    className="w-full h-20"
                  />
                </div>
              </div>
            </>
          )}

          {!hasData && (
            <div className="py-6 text-center">
              <Activity size={28} className="mx-auto text-surface-700 mb-2 opacity-50" />
              <p className="text-xs text-surface-500">加载音频文件后显示分析结果</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
