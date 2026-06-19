import { useCallback, useEffect, useRef } from "react";
import { Waves, Sparkles } from "lucide-react";
import FileUploader from "@/components/FileUploader";
import Waveform from "@/components/Waveform";
import PlayerControls from "@/components/PlayerControls";
import ProgressBar from "@/components/ProgressBar";
import VolumeControl from "@/components/VolumeControl";
import AudioInfo from "@/components/AudioInfo";
import RecentFiles from "@/components/RecentFiles";
import Playlist from "@/components/Playlist";
import EditToolbar from "@/components/EditToolbar";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import { useAudioEditor } from "@/hooks/useAudioEditor";
import { usePlayerStore } from "@/store/playerStore";
import { useEditorStore } from "@/store/editorStore";
import type { AudioFile } from "@/types/audio";
import { getFileNameWithoutExtension } from "@/utils/format";
import clsx from "clsx";

export default function Home() {
  const {
    loadFiles,
    play,
    pause,
    stopPlayback,
    seek,
    seekByPercent,
    changeVolume,
    toggleMute,
    playNext,
    playPrev,
    playSelection,
    playFromSelection,
    updateAudioSrcFromBuffer,
    currentFile,
  } = useAudioPlayer();

  const {
    handleCopy,
    handleCut,
    handlePaste,
    handleDelete,
    handleTrim,
    handleFadeIn,
    handleFadeOut,
    handleUndo,
    handleRedo,
    handleSelectAll,
    clearSelection,
    resetEditor,
    audioBuffer,
  } = useAudioEditor();

  const {
    playlist,
    setPlaylist,
    setCurrentIndex,
    currentTime,
    duration,
    isPlaying,
  } = usePlayerStore();

  const handleFilesSelected = useCallback(
    async (files: FileList | File[]) => {
      const loaded = await loadFiles(files);
      if (loaded.length > 0) {
        setPlaylist(loaded);
        setCurrentIndex(0);
        setTimeout(() => {
          play();
        }, 100);
      }
    },
    [loadFiles, setPlaylist, setCurrentIndex, play],
  );

  const handleRecentFileSelect = useCallback(
    async (file: AudioFile) => {
      console.log("Selected recent file:", file.name);
    },
    [],
  );

  const handleTrackSelect = useCallback(
    (index: number) => {
      const file = playlist[index];
      if (file && file.url) {
        setTimeout(() => play(), 100);
      }
    },
    [playlist, play],
  );

  useEffect(() => {
    document.title = currentFile
      ? `${getFileNameWithoutExtension(currentFile.name)} - SoundWave`
      : "SoundWave - 音频播放器";
  }, [currentFile]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case "a":
            e.preventDefault();
            handleSelectAll();
            break;
          case "c":
            e.preventDefault();
            handleCopy();
            break;
          case "x":
            e.preventDefault();
            handleCut();
            break;
          case "v":
            e.preventDefault();
            handlePaste();
            break;
          case "z":
            e.preventDefault();
            if (e.shiftKey) {
              handleRedo();
            } else {
              handleUndo();
            }
            break;
          case "y":
            e.preventDefault();
            handleRedo();
            break;
        }
        return;
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        const { selection } = useEditorStore.getState();
        if (selection) {
          e.preventDefault();
          handleDelete();
        }
      }

      if (e.key === "Escape") {
        clearSelection();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleCopy, handleCut, handlePaste, handleDelete, handleUndo, handleRedo, handleSelectAll, clearSelection]);

  const isInitialLoad = useRef(true);

  useEffect(() => {
    if (!currentFile) {
      isInitialLoad.current = true;
    }
  }, [currentFile]);

  useEffect(() => {
    if (!audioBuffer) return;
    if (isInitialLoad.current) {
      isInitialLoad.current = false;
      return;
    }
    updateAudioSrcFromBuffer(audioBuffer).catch(console.error);
  }, [audioBuffer, updateAudioSrcFromBuffer]);

  return (
    <div className="min-h-screen w-full bg-noise relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-[500px] h-[500px] bg-accent-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-brand-400/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 container max-w-6xl mx-auto px-4 py-8 sm:py-10">
        <header className="flex items-center justify-between mb-8 sm:mb-10 animate-slide-up">
          <div className="flex items-center gap-3">
            <div className="relative w-11 h-11 rounded-xl bg-gradient-to-br from-brand-400 to-accent-500 flex items-center justify-center shadow-lg shadow-brand-500/20">
              <Waves size={22} className="text-surface-900" />
              <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-brand-400 to-accent-500 animate-ping opacity-20" />
            </div>
            <div>
              <h1 className="font-display font-bold text-2xl text-gradient tracking-tight">
                SoundWave
              </h1>
              <p className="text-xs text-surface-400 -mt-0.5">音频播放器</p>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-800/60 border border-surface-700/40">
            <Sparkles size={14} className="text-brand-400" />
            <span className="text-xs text-surface-400">空格键播放 / 暂停 · Ctrl+A 全选</span>
          </div>
        </header>

        {!currentFile && playlist.length === 0 ? (
          <div className="max-w-2xl mx-auto animate-slide-up" style={{ animationDelay: "100ms" }}>
            <FileUploader onFilesSelected={handleFilesSelected} />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div
                className={clsx(
                  "glass-card glow-border rounded-2xl p-6 sm:p-8",
                  "animate-slide-up",
                )}
                style={{ animationDelay: "100ms" }}
              >
                {currentFile && (
                  <div className="mb-6 animate-fade-in">
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div className="min-w-0 flex-1">
                        <h2
                          className={clsx(
                            "font-display font-bold text-xl sm:text-2xl truncate transition-all duration-500",
                            isPlaying && "text-gradient",
                          )}
                          title={getFileNameWithoutExtension(currentFile.name)}
                        >
                          {getFileNameWithoutExtension(currentFile.name)}
                        </h2>
                        <p className="text-sm text-surface-400 mt-1">
                          正在播放 {currentFile.name}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {Array.from({ length: 4 }).map((_, i) => (
                          <span
                            key={i}
                            className={clsx(
                              "w-1 rounded-full bg-brand-400 transition-all duration-300",
                              isPlaying ? "animate-breathe" : "opacity-40",
                            )}
                            style={{
                              height: isPlaying ? `${12 + (i % 3) * 6}px` : "8px",
                              animationDelay: `${i * 120}ms`,
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                <div className="mb-4">
                  <Waveform onSeek={seekByPercent} />
                </div>

                <div className="mb-4">
                  <ProgressBar onSeek={seek} />
                </div>

                <EditToolbar
                  onCopy={handleCopy}
                  onCut={handleCut}
                  onPaste={handlePaste}
                  onDelete={handleDelete}
                  onTrim={handleTrim}
                  onUndo={handleUndo}
                  onRedo={handleRedo}
                  onFadeIn={handleFadeIn}
                  onFadeOut={handleFadeOut}
                />

                <div className="mt-4">
                  <PlayerControls
                    onPlay={play}
                    onPause={pause}
                    onStop={stopPlayback}
                    onPrev={playPrev}
                    onNext={playNext}
                    onPlaySelection={playSelection}
                    onPlayFromSelection={playFromSelection}
                  />
                </div>

                <div className="mt-4 flex items-center justify-center">
                  <VolumeControl
                    onVolumeChange={changeVolume}
                    onToggleMute={toggleMute}
                  />
                </div>
              </div>

              <Playlist onSelectTrack={handleTrackSelect} />

              <div
                className="max-w-2xl mx-auto lg:max-w-none animate-slide-up"
                style={{ animationDelay: "200ms" }}
              >
                <FileUploader onFilesSelected={handleFilesSelected} />
              </div>
            </div>

            <div className="space-y-6">
              <div
                className="animate-slide-up"
                style={{ animationDelay: "150ms" }}
              >
                <AudioInfo />
              </div>

              <div
                className="animate-slide-up"
                style={{ animationDelay: "250ms" }}
              >
                <RecentFiles onSelectFile={handleRecentFileSelect} />
              </div>
            </div>
          </div>
        )}

        <footer className="mt-12 text-center text-xs text-surface-600 animate-fade-in" style={{ animationDelay: "500ms" }}>
          <p>© SoundWave 音频播放器 · 支持 MP3 · WAV · FLAC · AAC · OGG</p>
        </footer>
      </div>
    </div>
  );
}
