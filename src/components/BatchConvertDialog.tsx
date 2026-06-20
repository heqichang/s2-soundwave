import { useState, useCallback, useMemo } from "react";
import {
  X,
  RefreshCw,
  Download,
  Settings,
  FileAudio,
  Check,
  AlertCircle,
  Loader2,
  Trash2,
  ArrowRight,
} from "lucide-react";
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
  type ConversionJob,
  type AudioFile,
} from "@/types/audio";
import {
  exportAudioBuffer,
  downloadBlob,
  decodeAudioFile,
} from "@/lib/audioUtils";
import { generateId, getFileNameWithoutExtension, formatFileSize, formatSampleRate } from "@/utils/format";
import clsx from "clsx";

interface BatchConvertDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function BatchConvertDialog({
  open,
  onClose,
}: BatchConvertDialogProps) {
  const { playlist } = usePlayerStore();

  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [format, setFormat] = useState<ExportFormat>(".wav");
  const [sampleRate, setSampleRate] = useState<SampleRate | undefined>();
  const [bitDepth, setBitDepth] = useState<BitDepth>(16);
  const [bitRate, setBitRate] = useState<number>(320);
  const [channels, setChannels] = useState<ChannelCount | undefined>();
  const [jobs, setJobs] = useState<ConversionJob[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const showSampleRate = format === ".wav" || format === ".flac";
  const showBitDepth = format === ".wav";
  const showBitRate = format === ".mp3" || format === ".aac" || format === ".ogg";
  const showChannels = format === ".wav" || format === ".flac" || format === ".mp3";

  const allSelected = useMemo(() => {
    return playlist.length > 0 && selectedFiles.size === playlist.length;
  }, [playlist.length, selectedFiles.size]);

  const toggleFile = useCallback((id: string) => {
    setSelectedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    if (allSelected) {
      setSelectedFiles(new Set());
    } else {
      setSelectedFiles(new Set(playlist.map((f) => f.id)));
    }
  }, [allSelected, playlist]);

  const removeJob = useCallback((id: string) => {
    setJobs((prev) => prev.filter((j) => j.id !== id));
  }, []);

  const getExportOptions = useCallback((): ExportOptions => {
    const options: ExportOptions = { format };
    if (sampleRate) options.sampleRate = sampleRate;
    if (bitDepth && showBitDepth) options.bitDepth = bitDepth;
    if (bitRate && showBitRate) options.bitRate = bitRate;
    if (channels) options.channels = channels;
    return options;
  }, [format, sampleRate, bitDepth, bitRate, channels, showBitDepth, showBitRate]);

  const runConversion = useCallback(async () => {
    if (selectedFiles.size === 0) {
      setError("请至少选择一个文件");
      return;
    }

    setIsRunning(true);
    setError(null);

    const filesToConvert = playlist.filter((f) => selectedFiles.has(f.id));
    const options = getExportOptions();

    const initialJobs: ConversionJob[] = filesToConvert.map((file) => ({
      id: generateId(),
      source: file,
      options,
      status: "pending",
      progress: 0,
    }));

    setJobs(initialJobs);

    for (let i = 0; i < initialJobs.length; i++) {
      const job = initialJobs[i];
      setJobs((prev) =>
        prev.map((j) =>
          j.id === job.id ? { ...j, status: "processing", progress: 10 } : j,
        ),
      );

      try {
        const response = await fetch(job.source.url);
        const blob = await response.blob();
        const file = new File([blob], job.source.name, { type: blob.type });
        const buffer = await decodeAudioFile(file);

        setJobs((prev) =>
          prev.map((j) =>
            j.id === job.id ? { ...j, progress: 50 } : j,
          ),
        );

        const outputBlob = await exportAudioBuffer(buffer, job.options);
        const baseName = getFileNameWithoutExtension(job.source.name);
        const outputName = `${baseName}${job.options.format}`;

        setJobs((prev) =>
          prev.map((j) =>
            j.id === job.id
              ? {
                  ...j,
                  status: "completed",
                  progress: 100,
                  outputBlob,
                  outputName,
                }
              : j,
          ),
        );
      } catch (err) {
        setJobs((prev) =>
          prev.map((j) =>
            j.id === job.id
              ? {
                  ...j,
                  status: "error",
                  error: err instanceof Error ? err.message : "转换失败",
                }
              : j,
          ),
        );
      }
    }

    setIsRunning(false);
  }, [selectedFiles, playlist, getExportOptions]);

  const downloadCompleted = useCallback(() => {
    const completed = jobs.filter((j) => j.status === "completed" && j.outputBlob);
    completed.forEach((job) => {
      if (job.outputBlob && job.outputName) {
        downloadBlob(job.outputBlob, job.outputName);
      }
    });
  }, [jobs]);

  const clearJobs = useCallback(() => {
    setJobs([]);
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-950/80 backdrop-blur-sm animate-fade-in">
      <div className="glass-card glow-border rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col animate-slide-up">
        <div className="flex items-center justify-between p-5 border-b border-surface-700/40 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-accent-400/20 text-accent-400 flex items-center justify-center">
              <RefreshCw size={16} />
            </div>
            <div>
              <h2 className="font-display font-semibold text-surface-100">
                批量格式转换
              </h2>
              <p className="text-xs text-surface-400">
                选择文件并设置输出参数
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-surface-400 hover:text-surface-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-surface-400">
                选择文件 ({selectedFiles.size}/{playlist.length})
              </label>
              <button
                onClick={toggleAll}
                className="text-xs text-brand-400 hover:text-brand-300"
              >
                {allSelected ? "取消全选" : "全选"}
              </button>
            </div>
            <div className="space-y-1.5 max-h-48 overflow-y-auto rounded-xl border border-surface-700/40">
              {playlist.length === 0 ? (
                <div className="p-4 text-center text-xs text-surface-500">
                  播放列表为空，请先添加音频文件
                </div>
              ) : (
                playlist.map((file: AudioFile) => (
                  <button
                    key={file.id}
                    onClick={() => toggleFile(file.id)}
                    className={clsx(
                      "w-full flex items-center gap-3 p-2.5 text-left rounded-lg transition-all",
                      selectedFiles.has(file.id)
                        ? "bg-brand-400/10 border border-brand-400/30"
                        : "hover:bg-surface-700/40 border border-transparent",
                    )}
                  >
                    <div
                      className={clsx(
                        "w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border",
                        selectedFiles.has(file.id)
                          ? "bg-brand-400 border-brand-400"
                          : "border-surface-600",
                      )}
                    >
                      {selectedFiles.has(file.id) && (
                        <Check size={10} className="text-surface-900" />
                      )}
                    </div>
                    <FileAudio size={14} className="text-surface-400 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-surface-100 truncate">{file.name}</p>
                      <p className="text-xs text-surface-500">
                        {formatFileSize(file.size)}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs text-surface-400 mb-1.5">
              输出格式
            </label>
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
              <span className="text-xs text-surface-400">输出参数</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {showSampleRate && (
                <div>
                  <label className="block text-xs text-surface-300 mb-1">
                    采样率
                  </label>
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
                    <option value="">保持原始</option>
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
                  <label className="block text-xs text-surface-300 mb-1">
                    位深度
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {BIT_DEPTH_OPTIONS.map((depth) => (
                      <button
                        key={depth}
                        onClick={() => setBitDepth(depth)}
                        className={clsx(
                          "py-1.5 text-xs font-medium rounded-lg transition-all",
                          bitDepth === depth
                            ? "bg-brand-400 text-surface-900"
                            : "bg-surface-700/60 text-surface-200 hover:bg-surface-700",
                        )}
                      >
                        {depth}bit
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {showBitRate && (
                <div>
                  <label className="block text-xs text-surface-300 mb-1">
                    比特率 (kbps)
                  </label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {MP3_BIT_RATE_OPTIONS.map((rate) => (
                      <button
                        key={rate}
                        onClick={() => setBitRate(rate)}
                        className={clsx(
                          "py-1.5 text-xs font-medium rounded-lg transition-all",
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
                  <label className="block text-xs text-surface-300 mb-1">
                    声道
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => setChannels(undefined)}
                      className={clsx(
                        "py-1.5 text-xs font-medium rounded-lg transition-all",
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
                          "py-1.5 text-xs font-medium rounded-lg transition-all",
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

          {jobs.length > 0 && (
            <div className="pt-2 border-t border-surface-700/30">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs text-surface-400">
                  转换结果 ({jobs.filter((j) => j.status === "completed").length}/
                  {jobs.length})
                </label>
                <button
                  onClick={clearJobs}
                  className="text-xs text-surface-500 hover:text-surface-300"
                >
                  清空
                </button>
              </div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {jobs.map((job) => (
                  <div
                    key={job.id}
                    className="flex items-center gap-2 p-2 rounded-lg bg-surface-800/50 border border-surface-700/40"
                  >
                    {job.status === "pending" && (
                      <div className="w-4 h-4 rounded-full border-2 border-surface-600 border-t-surface-400 flex-shrink-0" />
                    )}
                    {job.status === "processing" && (
                      <Loader2 size={16} className="text-brand-400 animate-spin flex-shrink-0" />
                    )}
                    {job.status === "completed" && (
                      <div className="w-4 h-4 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                        <Check size={10} className="text-green-400" />
                      </div>
                    )}
                    {job.status === "error" && (
                      <div className="w-4 h-4 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                        <AlertCircle size={10} className="text-red-400" />
                      </div>
                    )}
                    <FileAudio size={12} className="text-surface-500 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-surface-100 truncate flex items-center gap-1">
                        {job.source.name}
                        <ArrowRight size={10} className="text-surface-500" />
                        <span className="text-brand-400">{job.options.format}</span>
                      </p>
                      {job.status === "processing" && (
                        <div className="mt-1 h-1 bg-surface-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-brand-400 transition-all"
                            style={{ width: `${job.progress}%` }}
                          />
                        </div>
                      )}
                      {job.status === "error" && job.error && (
                        <p className="text-xs text-red-400">{job.error}</p>
                      )}
                    </div>
                    {job.status === "completed" && job.outputBlob && job.outputName && (
                      <button
                        onClick={() => {
                          if (job.outputBlob && job.outputName) {
                            downloadBlob(job.outputBlob, job.outputName);
                          }
                        }}
                        className="text-brand-400 hover:text-brand-300 flex-shrink-0"
                      >
                        <Download size={14} />
                      </button>
                    )}
                    {job.status !== "processing" && (
                      <button
                        onClick={() => removeJob(job.id)}
                        className="text-surface-500 hover:text-red-400 flex-shrink-0"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
        </div>

        <div className="flex gap-3 p-5 border-t border-surface-700/40 flex-shrink-0">
          <button
            onClick={onClose}
            className="flex-1 btn-secondary py-2.5 text-sm rounded-xl font-medium"
          >
            关闭
          </button>
          {jobs.filter((j) => j.status === "completed").length > 0 && (
            <button
              onClick={downloadCompleted}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm rounded-xl font-medium bg-green-500/80 text-white hover:bg-green-500 shadow-lg shadow-green-500/20"
            >
              <Download size={16} />
              下载全部
            </button>
          )}
          <button
            onClick={runConversion}
            disabled={isRunning || selectedFiles.size === 0}
            className={clsx(
              "flex-1 flex items-center justify-center gap-2 py-2.5 text-sm rounded-xl font-medium",
              "bg-brand-400 text-surface-900 hover:bg-brand-300 shadow-lg shadow-brand-400/20",
              "disabled:opacity-50 disabled:cursor-not-allowed",
            )}
          >
            {isRunning ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                转换中...
              </>
            ) : (
              <>
                <RefreshCw size={16} />
                开始转换
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
