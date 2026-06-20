import { useState, useCallback } from "react";
import { X, Download, Settings, FileAudio, Loader2 } from "lucide-react";
import { useEditorStore } from "@/store/editorStore";
import { usePlayerStore } from "@/store/playerStore";
import {
  SUPPORTED_EXPORT_FORMATS,
  SAMPLE_RATE_OPTIONS,
  BIT_DEPTH_OPTIONS,
  CHANNEL_OPTIONS,
  MP3_BIT_RATE_OPTIONS,
  type ExportOptions,
  type ExportFormat,
  type SampleRate,
  type BitDepth,
  type ChannelCount,
} from "@/types/audio";
import { exportAudioBuffer, downloadBlob, decodeAudioFile } from "@/lib/audioUtils";
import { getFileNameWithoutExtension, formatSampleRate } from "@/utils/format";
import clsx from "clsx";

interface ExportDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function ExportDialog({ open, onClose }: ExportDialogProps) {
  const { audioBuffer } = useEditorStore();
  const { currentFile } = usePlayerStore();

  const [format, setFormat] = useState<ExportFormat>(".wav");
  const [sampleRate, setSampleRate] = useState<SampleRate | undefined>();
  const [bitDepth, setBitDepth] = useState<BitDepth>(16);
  const [bitRate, setBitRate] = useState<number>(320);
  const [channels, setChannels] = useState<ChannelCount | undefined>();
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const showSampleRate = format === ".wav" || format === ".flac";
  const showBitDepth = format === ".wav";
  const showBitRate = format === ".mp3" || format === ".aac" || format === ".ogg";
  const showChannels = format === ".wav" || format === ".flac" || format === ".mp3";

  const handleExport = useCallback(async () => {
    if (!audioBuffer && !currentFile) {
      setError("没有可导出的音频");
      return;
    }

    try {
      setIsExporting(true);
      setError(null);

      let buffer = audioBuffer;
      if (!buffer && currentFile?.url) {
        const response = await fetch(currentFile.url);
        const blob = await response.blob();
        const file = new File([blob], currentFile.name, { type: blob.type });
        buffer = await decodeAudioFile(file);
      }

      if (!buffer) {
        setError("无法加载音频数据");
        return;
      }

      const options: ExportOptions = { format };
      if (sampleRate) options.sampleRate = sampleRate;
      if (bitDepth && showBitDepth) options.bitDepth = bitDepth;
      if (bitRate && showBitRate) options.bitRate = bitRate;
      if (channels) options.channels = channels;

      const blob = await exportAudioBuffer(buffer, options);

      const baseName = currentFile
        ? getFileNameWithoutExtension(currentFile.name)
        : "audio";
      const filename = `${baseName}${format}`;

      downloadBlob(blob, filename);
      onClose();
    } catch (err) {
      setError("导出失败：" + (err instanceof Error ? err.message : "未知错误"));
      console.error(err);
    } finally {
      setIsExporting(false);
    }
  }, [
    audioBuffer,
    currentFile,
    format,
    sampleRate,
    bitDepth,
    bitRate,
    channels,
    showBitDepth,
    showBitRate,
    onClose,
  ]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-950/80 backdrop-blur-sm animate-fade-in">
      <div className="glass-card glow-border rounded-2xl w-full max-w-md animate-slide-up">
        <div className="flex items-center justify-between p-5 border-b border-surface-700/40">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand-400/20 text-brand-400 flex items-center justify-center">
              <Download size={16} />
            </div>
            <div>
              <h2 className="font-display font-semibold text-surface-100">导出音频</h2>
              <p className="text-xs text-surface-400">选择导出格式和参数</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-surface-400 hover:text-surface-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {currentFile && (
            <div className="flex items-center gap-3 p-3 bg-surface-800/50 rounded-xl">
              <FileAudio size={20} className="text-brand-400 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-surface-100 truncate">{currentFile.name}</p>
                <p className="text-xs text-surface-400">
                  {formatSampleRate(audioBuffer?.sampleRate)} ·
                  {audioBuffer?.numberOfChannels === 1 ? " 单声道" : " 立体声"}
                </p>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs text-surface-400 mb-1.5">导出格式</label>
            <div className="grid grid-cols-5 gap-2">
              {SUPPORTED_EXPORT_FORMATS.map((f) => (
                <button
                  key={f.ext}
                  onClick={() => setFormat(f.ext)}
                  className={clsx(
                    "py-2 text-xs font-medium rounded-lg transition-all",
                    format === f.ext
                      ? "bg-brand-400 text-surface-900"
                      : "bg-surface-700/60 text-surface-200 hover:bg-surface-700",
                  )}
                >
                  {f.name}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2 border-t border-surface-700/30">
            <div className="flex items-center gap-1 mb-3">
              <Settings size={12} className="text-surface-400" />
              <span className="text-xs text-surface-400">高级选项</span>
            </div>

            <div className="space-y-3">
              {showSampleRate && (
                <div>
                  <label className="block text-xs text-surface-300 mb-1">采样率</label>
                  <select
                    value={sampleRate || ""}
                    onChange={(e) =>
                      setSampleRate(
                        e.target.value
                          ? (Number(e.target.value) as SampleRate)
                          : undefined,
                      )
                    }
                    className="w-full text-sm bg-surface-700/60 border border-surface-600/50 rounded-lg px-3 py-2 text-surface-100 focus:outline-none focus:border-brand-400"
                  >
                    <option value="">
                      原始采样率 {audioBuffer?.sampleRate ? `(${formatSampleRate(audioBuffer.sampleRate)})` : ""}
                    </option>
                    {SAMPLE_RATE_OPTIONS.map((rate) => (
                      <option key={rate} value={rate}>
                        {formatSampleRate(rate)}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {showBitDepth && (
                <div>
                  <label className="block text-xs text-surface-300 mb-1">位深度</label>
                  <div className="grid grid-cols-3 gap-2">
                    {BIT_DEPTH_OPTIONS.map((depth) => (
                      <button
                        key={depth}
                        onClick={() => setBitDepth(depth)}
                        className={clsx(
                          "py-2 text-xs font-medium rounded-lg transition-all",
                          bitDepth === depth
                            ? "bg-brand-400 text-surface-900"
                            : "bg-surface-700/60 text-surface-200 hover:bg-surface-700",
                        )}
                      >
                        {depth} bit
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {showBitRate && (
                <div>
                  <label className="block text-xs text-surface-300 mb-1">比特率 (kbps)</label>
                  <div className="grid grid-cols-4 gap-2">
                    {MP3_BIT_RATE_OPTIONS.map((rate) => (
                      <button
                        key={rate}
                        onClick={() => setBitRate(rate)}
                        className={clsx(
                          "py-2 text-xs font-medium rounded-lg transition-all",
                          bitRate === rate
                            ? "bg-brand-400 text-surface-900"
                            : "bg-surface-700/60 text-surface-200 hover:bg-surface-700",
                        )}
                      >
                        {rate}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {showChannels && (
                <div>
                  <label className="block text-xs text-surface-300 mb-1">声道</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setChannels(undefined)}
                      className={clsx(
                        "py-2 text-xs font-medium rounded-lg transition-all",
                        channels === undefined
                          ? "bg-brand-400 text-surface-900"
                          : "bg-surface-700/60 text-surface-200 hover:bg-surface-700",
                      )}
                    >
                      原始
                    </button>
                    {CHANNEL_OPTIONS.map((ch) => (
                      <button
                        key={ch}
                        onClick={() => setChannels(ch)}
                        className={clsx(
                          "py-2 text-xs font-medium rounded-lg transition-all",
                          channels === ch
                            ? "bg-brand-400 text-surface-900"
                            : "bg-surface-700/60 text-surface-200 hover:bg-surface-700",
                        )}
                      >
                        {ch === 1 ? "单声道" : "立体声"}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {error && (
            <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
        </div>

        <div className="flex gap-3 p-5 border-t border-surface-700/40">
          <button
            onClick={onClose}
            className="flex-1 btn-secondary py-2.5 text-sm rounded-xl font-medium"
          >
            取消
          </button>
          <button
            onClick={handleExport}
            disabled={isExporting || (!audioBuffer && !currentFile)}
            className={clsx(
              "flex-1 flex items-center justify-center gap-2 py-2.5 text-sm rounded-xl font-medium",
              "bg-brand-400 text-surface-900 hover:bg-brand-300 shadow-lg shadow-brand-400/20",
              "disabled:opacity-50 disabled:cursor-not-allowed",
            )}
          >
            {isExporting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                导出中...
              </>
            ) : (
              <>
                <Download size={16} />
                导出
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
