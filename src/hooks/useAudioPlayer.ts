import { useCallback, useEffect, useRef } from "react";
import { usePlayerStore } from "@/store/playerStore";
import type { AudioFile, AudioFormat } from "@/types/audio";
import { generateId } from "@/utils/format";
import { useWaveform } from "./useWaveform";

export function useAudioPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { generateWaveform, clearWaveform } = useWaveform();

  const {
    currentFile,
    isPlaying,
    volume,
    isMuted,
    setPlaying,
    setCurrentTime,
    setDuration,
    setWaveformData,
    setVolume,
    setMuted,
    addRecentFile,
    next,
    prev,
    stop,
  } = usePlayerStore();

  const ensureAudioElement = useCallback(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
    }
    return audioRef.current;
  }, []);

  const applyVolume = useCallback(() => {
    const audio = ensureAudioElement();
    audio.volume = isMuted ? 0 : volume;
    audio.muted = isMuted;
  }, [ensureAudioElement, isMuted, volume]);

  const loadFile = useCallback(
    async (file: File): Promise<AudioFile | null> => {
      try {
        const audio = ensureAudioElement();
        const url = URL.createObjectURL(file);

        const waveformPromise = generateWaveform(file).then((data) => {
          setWaveformData(data);
        });

        const formatPromise = new Promise<AudioFormat>((resolve) => {
          file
            .arrayBuffer()
            .then(async (buffer) => {
              try {
                const AudioContextClass =
                  window.AudioContext ||
                  (window as unknown as { webkitAudioContext: typeof AudioContext })
                    .webkitAudioContext;
                const ctx = new AudioContextClass();
                const decoded = await ctx.decodeAudioData(buffer.slice(0));
                const bitRate = file.size && decoded.duration
                  ? (file.size * 8) / decoded.duration / 1000
                  : undefined;

                ctx.close().catch(() => {});

                resolve({
                  sampleRate: decoded.sampleRate,
                  channels: decoded.numberOfChannels,
                  bitRate,
                });
              } catch {
                resolve({});
              }
            })
            .catch(() => resolve({}));
        });

        audio.src = url;

        const loadPromise = new Promise<void>((resolve, reject) => {
          const cleanup = () => {
            audio.removeEventListener("loadedmetadata", onLoaded);
            audio.removeEventListener("error", onError);
          };
          const onLoaded = () => {
            cleanup();
            resolve();
          };
          const onError = () => {
            cleanup();
            reject(new Error("Failed to load audio"));
          };
          audio.addEventListener("loadedmetadata", onLoaded);
          audio.addEventListener("error", onError);
        });

        await Promise.all([loadPromise, waveformPromise, formatPromise]);

        const format = await formatPromise;

        const audioFile: AudioFile = {
          id: generateId(),
          name: file.name,
          size: file.size,
          type: file.type,
          url,
          duration: audio.duration,
          format,
          openedAt: Date.now(),
        };

        setDuration(audio.duration);
        addRecentFile(audioFile);

        return audioFile;
      } catch (error) {
        console.error("Error loading audio file:", error);
        return null;
      }
    },
    [
      ensureAudioElement,
      generateWaveform,
      setWaveformData,
      setDuration,
      addRecentFile,
    ],
  );

  const loadFiles = useCallback(
    async (files: FileList | File[]): Promise<AudioFile[]> => {
      const fileArray = Array.from(files);
      const loadedFiles: AudioFile[] = [];

      if (fileArray.length === 0) return loadedFiles;

      const firstFile = await loadFile(fileArray[0]);
      if (firstFile) {
        loadedFiles.push(firstFile);
      }

      for (let i = 1; i < fileArray.length; i++) {
        const file = fileArray[i];
        try {
          const url = URL.createObjectURL(file);
          const loaded: AudioFile = {
            id: generateId(),
            name: file.name,
            size: file.size,
            type: file.type,
            url,
            openedAt: Date.now(),
          };
          loadedFiles.push(loaded);
        } catch (error) {
          console.error(`Error loading file ${file.name}:`, error);
        }
      }

      return loadedFiles;
    },
    [loadFile],
  );

  const play = useCallback(() => {
    const audio = ensureAudioElement();
    if (!audio.src) return;
    applyVolume();
    audio.play().catch((err) => {
      console.error("Play error:", err);
      setPlaying(false);
    });
    setPlaying(true);
  }, [ensureAudioElement, applyVolume, setPlaying]);

  const pause = useCallback(() => {
    const audio = ensureAudioElement();
    audio.pause();
    setPlaying(false);
  }, [ensureAudioElement, setPlaying]);

  const togglePlayback = useCallback(() => {
    const audio = ensureAudioElement();
    if (!audio.src) return;
    if (audio.paused) {
      play();
    } else {
      pause();
    }
  }, [ensureAudioElement, play, pause]);

  const stopPlayback = useCallback(() => {
    const audio = ensureAudioElement();
    audio.pause();
    audio.currentTime = 0;
    setCurrentTime(0);
    stop();
  }, [ensureAudioElement, setCurrentTime, stop]);

  const seek = useCallback(
    (time: number) => {
      const audio = ensureAudioElement();
      const clampedTime = Math.min(Math.max(time, 0), audio.duration || 0);
      audio.currentTime = clampedTime;
      setCurrentTime(clampedTime);
    },
    [ensureAudioElement, setCurrentTime],
  );

  const seekByPercent = useCallback(
    (percent: number) => {
      const { duration } = usePlayerStore.getState();
      if (duration <= 0) return;
      seek(percent * duration);
    },
    [seek],
  );

  const changeVolume = useCallback(
    (newVolume: number) => {
      setVolume(newVolume);
      setMuted(newVolume === 0);
    },
    [setVolume, setMuted],
  );

  const toggleMute = useCallback(() => {
    const { isMuted: currentMuted } = usePlayerStore.getState();
    setMuted(!currentMuted);
  }, [setMuted]);

  const playNext = useCallback(() => {
    next();
    const state = usePlayerStore.getState();
    const nextFile = state.playlist[state.currentIndex];
    if (nextFile && nextFile.url) {
      const audio = ensureAudioElement();
      audio.src = nextFile.url;
      audio.load();
      applyVolume();
      audio.play().catch(console.error);
      setPlaying(true);
    }
  }, [next, ensureAudioElement, applyVolume, setPlaying]);

  const playPrev = useCallback(() => {
    prev();
    const state = usePlayerStore.getState();
    const prevFile = state.playlist[state.currentIndex];
    if (prevFile && prevFile.url) {
      const audio = ensureAudioElement();
      audio.src = prevFile.url;
      audio.load();
      applyVolume();
      audio.play().catch(console.error);
      setPlaying(true);
    }
  }, [prev, ensureAudioElement, applyVolume, setPlaying]);

  useEffect(() => {
    const audio = ensureAudioElement();

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const onDurationChange = () => {
      if (audio.duration && isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
    };

    const onEnded = () => {
      const state = usePlayerStore.getState();
      if (state.currentIndex < state.playlist.length - 1) {
        playNext();
      } else {
        stopPlayback();
      }
    };

    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("durationchange", onDurationChange);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("durationchange", onDurationChange);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
    };
  }, [
    ensureAudioElement,
    setCurrentTime,
    setDuration,
    setPlaying,
    playNext,
    stopPlayback,
  ]);

  useEffect(() => {
    applyVolume();
  }, [applyVolume]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.code === "Space") {
        e.preventDefault();
        togglePlayback();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [togglePlayback]);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        if (currentFile?.url) {
          URL.revokeObjectURL(currentFile.url);
        }
      }
      clearWaveform();
    };
  }, [currentFile, clearWaveform]);

  return {
    audioRef,
    loadFile,
    loadFiles,
    play,
    pause,
    togglePlayback,
    stopPlayback,
    seek,
    seekByPercent,
    changeVolume,
    toggleMute,
    playNext,
    playPrev,
    isPlaying,
    currentFile,
  };
}
