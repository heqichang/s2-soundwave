import { Music, Disc3, Waves, Radio, FileAudio } from "lucide-react";
import { usePlayerStore } from "@/store/playerStore";
import {
  formatSampleRate,
  formatBitRate,
  formatChannels,
  formatFileSize,
  getFileNameWithoutExtension,
  getFileExtension,
} from "@/utils/format";

export default function AudioInfo() {
  const { currentFile, duration } = usePlayerStore();

  if (!currentFile) {
    return (
      <div className="glass-card rounded-2xl p-6 h-full flex flex-col items-center justify-center text-center gap-3 opacity-60">
        <Disc3 size={40} className="text-surface-500 animate-spin-slow" />
        <p className="text-surface-400 text-sm">加载音频文件后显示详细信息</p>
      </div>
    );
  }

  const format = currentFile.format;
  const ext = getFileExtension(currentFile.name).toUpperCase().slice(1) || "未知";

  const infoItems = [
    {
      icon: <Waves size={16} />,
      label: "采样率",
      value: formatSampleRate(format?.sampleRate),
      accent: "text-brand-400",
    },
    {
      icon: <Radio size={16} />,
      label: "比特率",
      value: formatBitRate(format?.bitRate),
      accent: "text-accent-400",
    },
    {
      icon: <Music size={16} />,
      label: "声道",
      value: formatChannels(format?.channels),
      accent: "text-brand-400",
    },
    {
      icon: <FileAudio size={16} />,
      label: "格式",
      value: ext,
      accent: "text-accent-400",
    },
  ];

  return (
    <div className="glass-card rounded-2xl p-6 h-full animate-fade-in">
      <div className="flex items-start gap-4 mb-6">
        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-brand-400/20 to-accent-500/20 flex items-center justify-center flex-shrink-0">
          <Music size={28} className="text-brand-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h3
            className="font-display font-semibold text-lg text-surface-50 truncate"
            title={getFileNameWithoutExtension(currentFile.name)}
          >
            {getFileNameWithoutExtension(currentFile.name)}
          </h3>
          <p className="text-sm text-surface-400 mt-1">
            {formatFileSize(currentFile.size)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {infoItems.map((item, index) => (
          <div
            key={item.label}
            className="bg-surface-800/40 rounded-xl p-3 border border-surface-700/40 animate-slide-up"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className={item.accent}>{item.icon}</span>
              <span className="text-xs text-surface-400 font-medium">
                {item.label}
              </span>
            </div>
            <p className="font-mono text-sm text-surface-100 truncate">
              {item.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
