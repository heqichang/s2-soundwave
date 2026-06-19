import { useEffect, useRef, useCallback } from "react";
import { usePlayerStore } from "@/store/playerStore";
import { useEditorStore } from "@/store/editorStore";
import clsx from "clsx";

interface WaveformProps {
  onSeek?: (percent: number) => void;
  onSelectionChange?: (start: number, end: number) => void;
}

export default function Waveform({ onSeek, onSelectionChange }: WaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { waveformData, currentTime, duration, isPlaying } = usePlayerStore();
  const { selection } = useEditorStore();

  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartTime = useRef(0);
  const isSelecting = useRef(false);

  const progressPercent = duration > 0 ? currentTime / duration : 0;

  const getTimeFromX = useCallback(
    (clientX: number): number => {
      if (!containerRef.current || duration <= 0) return 0;
      const rect = containerRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
      return (x / rect.width) * duration;
    },
    [duration],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resizeCanvas = () => {
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      ctx.scale(dpr, dpr);
    };

    resizeCanvas();

    const draw = () => {
      const width = canvas.width / (window.devicePixelRatio || 1);
      const height = canvas.height / (window.devicePixelRatio || 1);

      ctx.clearRect(0, 0, width, height);

      if (waveformData.length === 0) {
        const barCount = 60;
        const barWidth = width / barCount - 2;
        for (let i = 0; i < barCount; i++) {
          const barHeight = height * 0.15 + Math.sin(i * 0.3) * height * 0.1;
          const x = i * (barWidth + 2);
          const y = (height - barHeight) / 2;
          ctx.fillStyle = "rgba(51, 65, 85, 0.5)";
          ctx.beginPath();
          ctx.roundRect(x, y, barWidth, barHeight, 2);
          ctx.fill();
        }
        return;
      }

      const barCount = waveformData.length;
      const barWidth = width / barCount - 2;
      const progressIndex = Math.floor(barCount * progressPercent);

      const selectionStartPercent = selection
        ? selection.start / duration
        : -1;
      const selectionEndPercent = selection ? selection.end / duration : -1;

      for (let i = 0; i < barCount; i++) {
        const amplitude = waveformData[i];
        const barHeight = Math.max(4, amplitude * height * 0.85);
        const x = i * (barWidth + 2);
        const y = (height - barHeight) / 2;
        const isPast = i <= progressIndex;
        const barCenterPercent = (i + 0.5) / barCount;
        const isInSelection =
          selection &&
          barCenterPercent >= selectionStartPercent &&
          barCenterPercent <= selectionEndPercent;

        if (isInSelection) {
          const gradient = ctx.createLinearGradient(x, y, x, y + barHeight);
          gradient.addColorStop(0, "rgba(167, 139, 250, 0.9)");
          gradient.addColorStop(1, "rgba(139, 92, 246, 0.7)");
          ctx.fillStyle = gradient;
        } else if (isPast) {
          const gradient = ctx.createLinearGradient(x, y, x, y + barHeight);
          gradient.addColorStop(0, "#22d3ee");
          gradient.addColorStop(1, "#06b6d4");
          ctx.fillStyle = gradient;
        } else {
          const gradient = ctx.createLinearGradient(x, y, x, y + barHeight);
          gradient.addColorStop(0, "rgba(100, 116, 139, 0.6)");
          gradient.addColorStop(1, "rgba(71, 85, 105, 0.4)");
          ctx.fillStyle = gradient;
        }

        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, 2);
        ctx.fill();
      }

      if (selection && duration > 0) {
        const selStartX = (selection.start / duration) * width;
        const selEndX = (selection.end / duration) * width;

        ctx.fillStyle = "rgba(139, 92, 246, 0.1)";
        ctx.fillRect(selStartX, 0, selEndX - selStartX, height);

        ctx.strokeStyle = "rgba(167, 139, 250, 0.8)";
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(selStartX, 0);
        ctx.lineTo(selStartX, height);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(selEndX, 0);
        ctx.lineTo(selEndX, height);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = "rgba(167, 139, 250, 0.9)";
        ctx.font = "11px 'JetBrains Mono', monospace";
        const selDuration = selection.end - selection.start;
        const timeLabel = formatSelectionTime(selDuration);
        const labelX = (selStartX + selEndX) / 2;
        const labelY = 14;
        const textMetrics = ctx.measureText(timeLabel);
        const labelPad = 4;
        ctx.fillStyle = "rgba(30, 41, 59, 0.85)";
        ctx.beginPath();
        ctx.roundRect(
          labelX - textMetrics.width / 2 - labelPad,
          labelY - 10,
          textMetrics.width + labelPad * 2,
          16,
          4,
        );
        ctx.fill();
        ctx.fillStyle = "rgba(167, 139, 250, 1)";
        ctx.textAlign = "center";
        ctx.fillText(timeLabel, labelX, labelY);
        ctx.textAlign = "start";
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
  }, [waveformData, progressPercent, selection, duration]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (waveformData.length === 0) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;

      isDragging.current = true;
      dragStartX.current = x;
      dragStartTime.current = getTimeFromX(e.clientX);
      isSelecting.current = false;
    },
    [waveformData, getTimeFromX],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!isDragging.current || waveformData.length === 0) return;

      const dx = Math.abs(e.clientX - dragStartX.current - (containerRef.current?.getBoundingClientRect().left || 0) + (containerRef.current?.getBoundingClientRect().left || 0));
      const currentX = e.clientX - (containerRef.current?.getBoundingClientRect().left || 0);
      const distFromStart = Math.abs(currentX - dragStartX.current);

      if (distFromStart > 3) {
        isSelecting.current = true;
      }

      if (isSelecting.current) {
        const startTime = dragStartTime.current;
        const currentTimePos = getTimeFromX(e.clientX);
        const start = Math.min(startTime, currentTimePos);
        const end = Math.max(startTime, currentTimePos);
        useEditorStore.getState().setSelection({ start, end });
        onSelectionChange?.(start, end);
      }
    },
    [waveformData, getTimeFromX, onSelectionChange],
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!isDragging.current) return;

      if (!isSelecting.current) {
        if (onSeek && waveformData.length > 0) {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const percent = x / rect.width;
          onSeek(Math.max(0, Math.min(1, percent)));
        }
      }

      isDragging.current = false;
      isSelecting.current = false;
    },
    [onSeek, waveformData],
  );

  return (
    <div
      ref={containerRef}
      className={clsx(
        "relative w-full h-24 rounded-xl overflow-hidden select-none",
        waveformData.length > 0 && "cursor-crosshair",
        isPlaying && waveformData.length > 0 && "animate-breathe",
      )}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => {
        isDragging.current = false;
        isSelecting.current = false;
      }}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
      />
      {waveformData.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p className="text-sm text-surface-500">加载音频文件后显示波形预览</p>
        </div>
      )}
    </div>
  );
}

function formatSelectionTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "0:00.000";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const wholeSecs = Math.floor(secs);
  const ms = Math.floor((secs - wholeSecs) * 1000);
  return `${mins}:${wholeSecs.toString().padStart(2, "0")}.${ms.toString().padStart(3, "0")}`;
}
