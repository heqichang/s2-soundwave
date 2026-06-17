import { useCallback, useRef, useState } from "react";
import { Upload, FileAudio, X } from "lucide-react";
import { AUDIO_EXTENSIONS, AUDIO_MIME_TYPES } from "@/types/audio";
import { getFileExtension } from "@/utils/format";
import clsx from "clsx";

interface FileUploaderProps {
  onFilesSelected: (files: FileList | File[]) => Promise<void> | void;
}

export default function FileUploader({ onFilesSelected }: FileUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragCount, setDragCount] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateAudioFile = useCallback((file: File): boolean => {
    const ext = getFileExtension(file.name);
    if (AUDIO_EXTENSIONS.includes(ext)) return true;
    if (AUDIO_MIME_TYPES.includes(file.type.toLowerCase())) return true;
    if (file.type.startsWith("audio/")) return true;
    return false;
  }, []);

  const handleClick = () => {
    inputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const validFiles: File[] = [];
    for (let i = 0; i < files.length; i++) {
      if (validateAudioFile(files[i])) {
        validFiles.push(files[i]);
      }
    }

    if (validFiles.length > 0) {
      await onFilesSelected(validFiles);
    }

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCount((c) => c + 1);
    setIsDragging(true);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCount((c) => {
      const newCount = Math.max(0, c - 1);
      if (newCount === 0) {
        setIsDragging(false);
      }
      return newCount;
    });
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    setDragCount(0);

    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    const validFiles: File[] = [];
    for (let i = 0; i < files.length; i++) {
      if (validateAudioFile(files[i])) {
        validFiles.push(files[i]);
      }
    }

    if (validFiles.length > 0) {
      await onFilesSelected(validFiles);
    }
  };

  return (
    <div
      onClick={handleClick}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={clsx(
        "relative group cursor-pointer rounded-2xl border-2 border-dashed p-10 transition-all duration-300",
        "flex flex-col items-center justify-center gap-4 min-h-[200px]",
        isDragging
          ? "border-brand-400 bg-brand-400/10 shadow-lg shadow-brand-400/20 scale-[1.01]"
          : "border-surface-700/60 bg-surface-800/40 hover:border-brand-400/60 hover:bg-surface-800/60",
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept="audio/*,.mp3,.wav,.flac,.aac,.ogg,.m4a"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />

      <div
        className={clsx(
          "w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300",
          isDragging
            ? "bg-brand-400/20 text-brand-300 scale-110"
            : "bg-surface-700/60 text-surface-200 group-hover:bg-brand-400/10 group-hover:text-brand-300",
        )}
      >
        {isDragging ? (
          <FileAudio size={32} className="animate-pulse" />
        ) : (
          <Upload size={32} />
        )}
      </div>

      <div className="text-center">
        <p className="font-display font-semibold text-lg text-surface-100 mb-1">
          {isDragging ? "松开以上传文件" : "点击或拖拽音频文件到此处"}
        </p>
        <p className="text-sm text-surface-400">
          支持 MP3、WAV、FLAC、AAC、OGG 格式
        </p>
      </div>

      {isDragging && (
        <div className="absolute inset-0 rounded-2xl border-2 border-brand-400 animate-pulse pointer-events-none" />
      )}
    </div>
  );
}
