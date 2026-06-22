import { useEffect, useRef, useCallback, useState } from "react";
import { usePlayerStore } from "@/store/playerStore";
import { useEditorStore } from "@/store/editorStore";
import clsx from "clsx";
import { ZoomIn, ZoomOut, Maximize2, Ruler } from "lucide-react";

interface WaveformProps {
  onSeek?: (percent: number) => void;
  onSelectionChange?: (start: number, end: number) => void;
}

const DB_TICKS = [-60, -48, -36, -24, -12, -6, 0];

function linearToDb(linear: number): number {
  if (linear <= 0) return -Infinity;
  return 20 * Math.log10(linear);
}

function dbToLinear(db: number): number {
  return Math.pow(10, db / 20);
}

function formatTimeMs(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "0:00.000";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const wholeSecs = Math.floor(secs);
  const ms = Math.floor((secs - wholeSecs) * 1000);
  return `${mins}:${wholeSecs.toString().padStart(2, "0")}.${ms.toString().padStart(3, "0")}`;
}

export default function Waveform({ onSeek, onSelectionChange }: WaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { waveformData, currentTime, duration, isPlaying } = usePlayerStore();
  const {
    selection,
    markers,
    zoomConfig,
    showDbScale,
    setZoomConfig,
    resetZoom,
    toggleDbScale,
  } = useEditorStore();

  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartTime = useRef(0);
  const isSelecting = useRef(false);
  const isPanning = useRef(false);
  const panStartX = useRef(0);
  const panStartView = useRef<{ start: number; end: number }>({ start: 0, end: 1 });
  const [hoverTime, setHoverTime] = useState<number | null>(null);

  const viewDuration = zoomConfig.viewEnd - zoomConfig.viewStart;

  const timeToX = useCallback(
    (time: number, width: number): number => {
      if (viewDuration <= 0) return 0;
      return ((time - zoomConfig.viewStart) / viewDuration) * width;
    },
    [viewDuration, zoomConfig.viewStart],
  );

  const xToTime = useCallback(
    (x: number, width: number): number => {
      if (viewDuration <= 0) return 0;
      return zoomConfig.viewStart + (x / width) * viewDuration;
    },
    [viewDuration, zoomConfig.viewStart],
  );

  const getTimeFromClientX = useCallback(
    (clientX: number): number => {
      if (!containerRef.current || viewDuration <= 0) return 0;
      const rect = containerRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
      return xToTime(x, rect.width);
    },
    [viewDuration, xToTime],
  );

  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      if (!containerRef.current || duration <= 0 || waveformData.length === 0) return;
      e.preventDefault();

      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseTime = xToTime(mouseX, rect.width);

      if (e.ctrlKey || e.metaKey) {
        const delta = -e.deltaY * 0.001;
        const currentRange = zoomConfig.viewEnd - zoomConfig.viewStart;
        const factor = Math.exp(-delta);
        const newRange = Math.max(0.001, Math.min(duration, currentRange * factor));

        const ratio = (mouseTime - zoomConfig.viewStart) / currentRange;
        let newStart = mouseTime - ratio * newRange;
        let newEnd = newStart + newRange;

        if (newStart < 0) {
          newStart = 0;
          newEnd = newRange;
        }
        if (newEnd > duration) {
          newEnd = duration;
          newStart = duration - newRange;
        }

        const newHorizontal = duration / newRange;
        setZoomConfig({
          viewStart: newStart,
          viewEnd: newEnd,
          horizontal: newHorizontal,
        });
      } else if (e.altKey) {
        const delta = -e.deltaY * 0.002;
        const newVertical = Math.max(0.25, Math.min(8, zoomConfig.vertical * (1 + delta)));
        setZoomConfig({ vertical: newVertical });
      } else {
        const scrollDelta = (e.deltaY / rect.height) * viewDuration * 0.5;
        let newStart = zoomConfig.viewStart + scrollDelta;
        let newEnd = zoomConfig.viewEnd + scrollDelta;

        if (newStart < 0) {
          newEnd = zoomConfig.viewEnd - zoomConfig.viewStart;
          newStart = 0;
        }
        if (newEnd > duration) {
          newEnd = duration;
          newStart = duration - (zoomConfig.viewEnd - zoomConfig.viewStart);
        }

        setZoomConfig({
          viewStart: newStart,
          viewEnd: newEnd,
        });
      }
    },
    [duration, waveformData.length, zoomConfig, setZoomConfig, viewDuration, xToTime],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const overlay = overlayCanvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || !overlay) return;

    const ctx = canvas.getContext("2d");
    const octx = overlay.getContext("2d");
    if (!ctx || !octx) return;

    const resizeCanvas = () => {
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const w = rect.width;
      const h = rect.height;

      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      overlay.width = w * dpr;
      overlay.height = h * dpr;
      overlay.style.width = `${w}px`;
      overlay.style.height = `${h}px`;
      octx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resizeCanvas();

    const draw = () => {
      const rect = container.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;

      const dbScaleWidth = showDbScale ? 48 : 0;
      const contentWidth = width - dbScaleWidth;

      ctx.clearRect(0, 0, width, height);
      octx.clearRect(0, 0, width, height);

      if (showDbScale) {
        ctx.fillStyle = "rgba(15, 23, 42, 0.6)";
        ctx.fillRect(0, 0, dbScaleWidth, height);

        ctx.strokeStyle = "rgba(100, 116, 139, 0.3)";
        ctx.lineWidth = 1;
        ctx.font = "10px 'JetBrains Mono', monospace";
        ctx.fillStyle = "rgba(148, 163, 184, 0.9)";
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";

        DB_TICKS.forEach((db) => {
          const normalized = (db + 60) / 60;
          const y = height - normalized * height;
          ctx.beginPath();
          ctx.moveTo(dbScaleWidth - 4, y);
          ctx.lineTo(dbScaleWidth, y);
          ctx.stroke();
          ctx.fillText(`${db}`, dbScaleWidth - 6, y);
        });
        ctx.textAlign = "start";
      }

      const cx = dbScaleWidth;

      if (waveformData.length === 0) {
        const barCount = 60;
        const barWidth = contentWidth / barCount - 2;
        for (let i = 0; i < barCount; i++) {
          const barHeight = height * 0.15 + Math.sin(i * 0.3) * height * 0.1;
          const x = cx + i * (barWidth + 2);
          const y = (height - barHeight) / 2;
          ctx.fillStyle = "rgba(51, 65, 85, 0.5)";
          ctx.beginPath();
          ctx.roundRect(x, y, barWidth, barHeight, 2);
          ctx.fill();
        }
        return;
      }

      const totalSamples = waveformData.length;
      const startSampleRatio = duration > 0 ? zoomConfig.viewStart / duration : 0;
      const endSampleRatio = duration > 0 ? zoomConfig.viewEnd / duration : 1;
      const startIdx = Math.max(0, Math.floor(startSampleRatio * totalSamples));
      const endIdx = Math.min(totalSamples, Math.ceil(endSampleRatio * totalSamples));
      const visibleSamples = Math.max(1, endIdx - startIdx);
      const barCount = Math.min(visibleSamples, Math.floor(contentWidth / 3));
      const barWidth = contentWidth / barCount - 1;
      const verticalScale = zoomConfig.vertical;

      const progressPercent = duration > 0 ? (currentTime - zoomConfig.viewStart) / viewDuration : -1;

      const selectionStartX =
        selection && duration > 0
          ? cx + timeToX(selection.start, contentWidth)
          : -1;
      const selectionEndX =
        selection && duration > 0
          ? cx + timeToX(selection.end, contentWidth)
          : -1;

      if (selection && selectionStartX >= 0 && selectionEndX >= 0) {
        const sx = Math.max(cx, Math.min(selectionStartX, selectionEndX));
        const ex = Math.min(width, Math.max(selectionStartX, selectionEndX));
        ctx.fillStyle = "rgba(139, 92, 246, 0.1)";
        ctx.fillRect(sx, 0, ex - sx, height);
      }

      for (let i = 0; i < barCount; i++) {
        const segStart = startIdx + Math.floor((i / barCount) * visibleSamples);
        const segEnd = startIdx + Math.floor(((i + 1) / barCount) * visibleSamples);
        let sum = 0;
        let peak = 0;
        for (let j = segStart; j < segEnd && j < totalSamples; j++) {
          const v = waveformData[j];
          sum += v;
          if (v > peak) peak = v;
        }
        const avg = segEnd > segStart ? sum / (segEnd - segStart) : 0;
        const amplitude = Math.max(avg * 0.7 + peak * 0.3, 0.02);

        const barCenterRatio = (segStart + (segEnd - segStart) / 2) / totalSamples;
        const isPast = progressPercent >= 0 && barCenterRatio <= startSampleRatio + progressPercent * (endSampleRatio - startSampleRatio);
        const barX = cx + i * (barWidth + 1);
        let barHeight = Math.max(3, amplitude * height * 0.9 * verticalScale);
        barHeight = Math.min(barHeight, height * 0.98);

        const absoluteBarCenterX = cx + barWidth / 2 + i * (barWidth + 1);
        const isInSelection =
          selection &&
          absoluteBarCenterX >= Math.max(cx, selectionStartX) &&
          absoluteBarCenterX <= Math.min(width, selectionEndX);

        let y = (height - barHeight) / 2;

        if (showDbScale) {
          const db = linearToDb(amplitude);
          const normalizedDb = Math.max(0, Math.min(1, (db + 60) / 60));
          barHeight = Math.max(3, normalizedDb * height * 0.95);
          barHeight = Math.min(barHeight * verticalScale, height * 0.98);
          y = height - barHeight;
        }

        let gradient: CanvasGradient;
        if (isInSelection) {
          gradient = ctx.createLinearGradient(barX, y, barX, y + barHeight);
          gradient.addColorStop(0, "rgba(167, 139, 250, 0.95)");
          gradient.addColorStop(1, "rgba(139, 92, 246, 0.75)");
        } else if (isPast) {
          gradient = ctx.createLinearGradient(barX, y, barX, y + barHeight);
          gradient.addColorStop(0, "#22d3ee");
          gradient.addColorStop(1, "#06b6d4");
        } else {
          gradient = ctx.createLinearGradient(barX, y, barX, y + barHeight);
          gradient.addColorStop(0, "rgba(100, 116, 139, 0.65)");
          gradient.addColorStop(1, "rgba(71, 85, 105, 0.45)");
        }
        ctx.fillStyle = gradient;

        ctx.beginPath();
        ctx.roundRect(barX, y, Math.max(1, barWidth), barHeight, 1);
        ctx.fill();
      }

      if (progressPercent >= 0) {
        const px = cx + progressPercent * contentWidth;
        if (px >= cx && px <= width) {
          const grad = octx.createLinearGradient(px - 1, 0, px + 1, 0);
          grad.addColorStop(0, "rgba(244, 63, 94, 0)");
          grad.addColorStop(0.5, "rgba(244, 63, 94, 0.95)");
          grad.addColorStop(1, "rgba(244, 63, 94, 0)");
          octx.fillStyle = grad;
          octx.fillRect(px - 1.5, 0, 3, height);
        }
      }

      if (selection && selectionStartX >= 0 && selectionEndX >= 0) {
        const sx = Math.max(cx, Math.min(selectionStartX, selectionEndX));
        const ex = Math.min(width, Math.max(selectionStartX, selectionEndX));

        octx.strokeStyle = "rgba(167, 139, 250, 0.9)";
        octx.lineWidth = 2;
        octx.setLineDash([5, 4]);
        octx.beginPath();
        octx.moveTo(sx, 0);
        octx.lineTo(sx, height);
        octx.stroke();
        octx.beginPath();
        octx.moveTo(ex, 0);
        octx.lineTo(ex, height);
        octx.stroke();
        octx.setLineDash([]);

        const selDuration = selection.end - selection.start;
        const timeLabel = formatTimeMs(selDuration);
        const labelX = (sx + ex) / 2;
        const labelY = 14;
        octx.font = "11px 'JetBrains Mono', monospace";
        const textMetrics = octx.measureText(timeLabel);
        const labelPad = 6;
        octx.fillStyle = "rgba(30, 41, 59, 0.9)";
        octx.beginPath();
        octx.roundRect(
          labelX - textMetrics.width / 2 - labelPad,
          labelY - 10,
          textMetrics.width + labelPad * 2,
          18,
          4,
        );
        octx.fill();
        octx.fillStyle = "rgba(167, 139, 250, 1)";
        octx.textAlign = "center";
        octx.fillText(timeLabel, labelX, labelY + 3);
        octx.textAlign = "start";
      }

      markers.forEach((marker) => {
        const mx = cx + timeToX(marker.time, contentWidth);
        if (mx < cx - 10 || mx > width + 10) return;

        octx.fillStyle = marker.color;
        octx.beginPath();
        octx.moveTo(mx - 7, 0);
        octx.lineTo(mx + 7, 0);
        octx.lineTo(mx, 10);
        octx.closePath();
        octx.fill();

        octx.strokeStyle = marker.color;
        octx.lineWidth = 1.5;
        octx.beginPath();
        octx.moveTo(mx, 10);
        octx.lineTo(mx, height);
        octx.stroke();

        octx.fillStyle = marker.color;
        octx.font = "bold 9px 'JetBrains Mono', monospace";
        octx.fillText(marker.name.substring(0, 8), mx + 3, 22);
      });

      if (hoverTime !== null && duration > 0) {
        const hx = cx + timeToX(hoverTime, contentWidth);
        if (hx >= cx && hx <= width) {
          octx.strokeStyle = "rgba(148, 163, 184, 0.6)";
          octx.lineWidth = 1;
          octx.setLineDash([3, 3]);
          octx.beginPath();
          octx.moveTo(hx, 0);
          octx.lineTo(hx, height);
          octx.stroke();
          octx.setLineDash([]);

          const timeLabel = formatTimeMs(hoverTime);
          octx.font = "10px 'JetBrains Mono', monospace";
          const textMetrics = octx.measureText(timeLabel);
          const labelPad = 4;
          const ly = height - 18;
          let lx = hx - textMetrics.width / 2 - labelPad;
          lx = Math.max(cx + 2, Math.min(lx, width - textMetrics.width - labelPad - 2));
          octx.fillStyle = "rgba(15, 23, 42, 0.9)";
          octx.beginPath();
          octx.roundRect(lx, ly, textMetrics.width + labelPad * 2, 16, 3);
          octx.fill();
          octx.fillStyle = "rgba(226, 232, 240, 1)";
          octx.textAlign = "center";
          octx.fillText(timeLabel, lx + textMetrics.width / 2 + labelPad, ly + 11);
          octx.textAlign = "start";
        }
      }

      const totalDur = duration > 0 ? duration : 1;
      const tickInterval = Math.max(
        0.001,
        Math.pow(10, Math.floor(Math.log10(Math.max(0.001, viewDuration / 4)))),
      );
      const firstTick = Math.ceil(zoomConfig.viewStart / tickInterval) * tickInterval;
      octx.strokeStyle = "rgba(100, 116, 139, 0.2)";
      octx.lineWidth = 1;
      octx.fillStyle = "rgba(100, 116, 139, 0.8)";
      octx.font = "9px 'JetBrains Mono', monospace";

      for (let t = firstTick; t <= zoomConfig.viewEnd; t += tickInterval) {
        const tx = cx + timeToX(t, contentWidth);
        if (tx < cx || tx > width) continue;
        octx.beginPath();
        octx.moveTo(tx, height - 10);
        octx.lineTo(tx, height - 4);
        octx.stroke();
        const tl = formatTimeMs(t);
        octx.fillText(tl, tx + 2, height - 12);
      }
    };

    draw();

    const resizeObserver = new ResizeObserver(() => {
      resizeCanvas();
      draw();
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, [
    waveformData,
    currentTime,
    selection,
    markers,
    zoomConfig,
    duration,
    showDbScale,
    hoverTime,
    timeToX,
    viewDuration,
  ]);

  useEffect(() => {
    if (duration > 0 && zoomConfig.viewEnd <= zoomConfig.viewStart) {
      setZoomConfig({ viewStart: 0, viewEnd: duration });
    }
  }, [duration, zoomConfig.viewEnd, zoomConfig.viewStart, setZoomConfig]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (waveformData.length === 0) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;

      if (e.altKey || e.button === 1 || e.shiftKey) {
        isPanning.current = true;
        panStartX.current = x;
        panStartView.current = {
          start: zoomConfig.viewStart,
          end: zoomConfig.viewEnd,
        };
        return;
      }

      isDragging.current = true;
      dragStartX.current = x;
      dragStartTime.current = getTimeFromClientX(e.clientX);
      isSelecting.current = false;
    },
    [waveformData, getTimeFromClientX, zoomConfig.viewStart, zoomConfig.viewEnd],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const currentX = e.clientX - rect.left;
      const currentTimeVal = getTimeFromClientX(e.clientX);
      setHoverTime(currentTimeVal);

      if (isPanning.current && duration > 0) {
        const dx = (currentX - panStartX.current) / rect.width;
        const viewRange = panStartView.current.end - panStartView.current.start;
        const timeDelta = -dx * viewRange;

        let newStart = panStartView.current.start + timeDelta;
        let newEnd = panStartView.current.end + timeDelta;

        if (newStart < 0) {
          newStart = 0;
          newEnd = viewRange;
        }
        if (newEnd > duration) {
          newEnd = duration;
          newStart = duration - viewRange;
        }

        setZoomConfig({ viewStart: newStart, viewEnd: newEnd });
        return;
      }

      if (!isDragging.current || waveformData.length === 0) return;

      const distFromStart = Math.abs(currentX - dragStartX.current);

      if (distFromStart > 3) {
        isSelecting.current = true;
      }

      if (isSelecting.current) {
        const startTime = dragStartTime.current;
        const start = Math.min(startTime, currentTimeVal);
        const end = Math.max(startTime, currentTimeVal);
        useEditorStore.getState().setSelection({
          start: Math.max(zoomConfig.viewStart, start),
          end: Math.min(zoomConfig.viewEnd, end),
        });
        onSelectionChange?.(start, end);
      }
    },
    [
      waveformData,
      getTimeFromClientX,
      onSelectionChange,
      duration,
      setZoomConfig,
      zoomConfig.viewStart,
      zoomConfig.viewEnd,
    ],
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (isPanning.current) {
        isPanning.current = false;
        return;
      }

      if (!isDragging.current) return;

      if (!isSelecting.current) {
        if (onSeek && waveformData.length > 0 && duration > 0) {
          const time = getTimeFromClientX(e.clientX);
          const percent = Math.max(0, Math.min(1, time / duration));
          onSeek(percent);
        }
      }

      isDragging.current = false;
      isSelecting.current = false;
    },
    [onSeek, waveformData, duration, getTimeFromClientX],
  );

  const handleZoomIn = useCallback(() => {
    if (duration <= 0) return;
    const range = zoomConfig.viewEnd - zoomConfig.viewStart;
    const center = (zoomConfig.viewStart + zoomConfig.viewEnd) / 2;
    const newRange = Math.max(0.001, range * 0.6);
    let newStart = center - newRange / 2;
    let newEnd = center + newRange / 2;
    if (newStart < 0) {
      newStart = 0;
      newEnd = newRange;
    }
    if (newEnd > duration) {
      newEnd = duration;
      newStart = duration - newRange;
    }
    setZoomConfig({
      viewStart: newStart,
      viewEnd: newEnd,
      horizontal: duration / newRange,
    });
  }, [duration, zoomConfig, setZoomConfig]);

  const handleZoomOut = useCallback(() => {
    if (duration <= 0) return;
    const range = zoomConfig.viewEnd - zoomConfig.viewStart;
    const center = (zoomConfig.viewStart + zoomConfig.viewEnd) / 2;
    const newRange = Math.min(duration, range * 1.6);
    let newStart = center - newRange / 2;
    let newEnd = center + newRange / 2;
    if (newStart < 0) {
      newStart = 0;
      newEnd = newRange;
    }
    if (newEnd > duration) {
      newEnd = duration;
      newStart = duration - newRange;
    }
    setZoomConfig({
      viewStart: newStart,
      viewEnd: newEnd,
      horizontal: duration / newRange,
    });
  }, [duration, zoomConfig, setZoomConfig]);

  const handleFit = useCallback(() => {
    if (duration > 0) resetZoom(duration);
  }, [duration, resetZoom]);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleZoomOut}
            disabled={waveformData.length === 0}
            className="p-1 rounded hover:bg-surface-700/50 text-surface-400 hover:text-surface-100 disabled:opacity-30 transition-colors"
            title="缩小"
          >
            <ZoomOut size={14} />
          </button>
          <span className="text-[10px] font-mono text-surface-500 px-1 min-w-[60px] text-center">
            {zoomConfig.horizontal.toFixed(1)}x
          </span>
          <button
            type="button"
            onClick={handleZoomIn}
            disabled={waveformData.length === 0}
            className="p-1 rounded hover:bg-surface-700/50 text-surface-400 hover:text-surface-100 disabled:opacity-30 transition-colors"
            title="放大"
          >
            <ZoomIn size={14} />
          </button>
          <button
            type="button"
            onClick={handleFit}
            disabled={waveformData.length === 0}
            className="p-1 rounded hover:bg-surface-700/50 text-surface-400 hover:text-surface-100 disabled:opacity-30 transition-colors"
            title="自适应"
          >
            <Maximize2 size={14} />
          </button>
          <div className="w-px h-4 bg-surface-700 mx-1" />
          <button
            type="button"
            onClick={toggleDbScale}
            className={clsx(
              "p-1 rounded transition-colors",
              showDbScale
                ? "bg-brand-500/20 text-brand-400"
                : "text-surface-400 hover:text-surface-100 hover:bg-surface-700/50",
            )}
            disabled={waveformData.length === 0}
            title="分贝刻度"
          >
            <Ruler size={14} />
          </button>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-mono text-surface-500">
          <span>{formatTimeMs(zoomConfig.viewStart)}</span>
          <span>/</span>
          <span>{formatTimeMs(zoomConfig.viewEnd)}</span>
        </div>
      </div>
      <div
        ref={containerRef}
        className={clsx(
          "relative w-full h-28 rounded-xl overflow-hidden select-none",
          waveformData.length > 0 && "cursor-crosshair",
          isPlaying && waveformData.length > 0 && "animate-breathe",
        )}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          isDragging.current = false;
          isSelecting.current = false;
          isPanning.current = false;
          setHoverTime(null);
        }}
        onWheel={handleWheel}
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
        />
        <canvas
          ref={overlayCanvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
        />
        {waveformData.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-sm text-surface-500">加载音频文件后显示波形预览</p>
          </div>
        )}
      </div>
    </div>
  );
}
