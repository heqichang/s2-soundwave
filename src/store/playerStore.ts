import { create } from "zustand";
import type { AudioFile, PlayerState, PlayerActions } from "@/types/audio";

const STORAGE_KEYS = {
  VOLUME: "soundwave_volume",
  MUTED: "soundwave_muted",
  RECENT: "soundwave_recent",
};

const MAX_RECENT_FILES = 20;

const getInitialVolume = (): number => {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.VOLUME);
    return saved !== null ? parseFloat(saved) : 0.8;
  } catch {
    return 0.8;
  }
};

const getInitialMuted = (): boolean => {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.MUTED);
    return saved === "true";
  } catch {
    return false;
  }
};

const getInitialRecentFiles = (): AudioFile[] => {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.RECENT);
    if (saved) {
      const parsed = JSON.parse(saved) as AudioFile[];
      return parsed.map((f) => ({ ...f, url: "" }));
    }
  } catch {
    // ignore
  }
  return [];
};

export const usePlayerStore = create<PlayerState & PlayerActions>(
  (set, get) => ({
    playlist: [],
    currentIndex: -1,
    currentFile: null,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: getInitialVolume(),
    isMuted: getInitialMuted(),
    recentFiles: getInitialRecentFiles(),
    waveformData: [],

    setPlaylist: (files) => set({ playlist: files, currentIndex: files.length > 0 ? 0 : -1 }),

    addToPlaylist: (file) =>
      set((state) => ({
        playlist: [...state.playlist, file],
      })),

    removeFromPlaylist: (id) =>
      set((state) => {
        const index = state.playlist.findIndex((f) => f.id === id);
        if (index === -1) return {};
        const newPlaylist = state.playlist.filter((f) => f.id !== id);
        let newIndex = state.currentIndex;
        if (index < state.currentIndex) {
          newIndex = state.currentIndex - 1;
        } else if (index === state.currentIndex) {
          newIndex = newPlaylist.length > 0 ? Math.min(index, newPlaylist.length - 1) : -1;
        }
        return {
          playlist: newPlaylist,
          currentIndex: newIndex,
          currentFile: newIndex >= 0 ? newPlaylist[newIndex] : null,
        };
      }),

    setCurrentIndex: (index) =>
      set((state) => ({
        currentIndex: index,
        currentFile: state.playlist[index] || null,
        currentTime: 0,
      })),

    setCurrentFile: (file) =>
      set({
        currentFile: file,
        currentTime: 0,
        duration: 0,
      }),

    setPlaying: (playing) => set({ isPlaying: playing }),

    togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),

    setCurrentTime: (time) => set({ currentTime: time }),

    setDuration: (duration) => set({ duration }),

    setVolume: (volume) => {
      const clampedVolume = Math.min(Math.max(volume, 0), 1);
      localStorage.setItem(STORAGE_KEYS.VOLUME, clampedVolume.toString());
      set({ volume: clampedVolume });
    },

    toggleMute: () => {
      const { isMuted } = get();
      const newMuted = !isMuted;
      localStorage.setItem(STORAGE_KEYS.MUTED, newMuted.toString());
      set({ isMuted: newMuted });
    },

    setMuted: (muted) => {
      localStorage.setItem(STORAGE_KEYS.MUTED, muted.toString());
      set({ isMuted: muted });
    },

    addRecentFile: (file) => {
      const { recentFiles } = get();
      const filtered = recentFiles.filter((f) => f.name !== file.name);
      const fileToSave: AudioFile = { ...file, url: "" };
      const updated = [fileToSave, ...filtered].slice(0, MAX_RECENT_FILES);
      localStorage.setItem(STORAGE_KEYS.RECENT, JSON.stringify(updated));
      set({ recentFiles: updated });
    },

    removeRecentFile: (id) => {
      const { recentFiles } = get();
      const updated = recentFiles.filter((f) => f.id !== id);
      localStorage.setItem(STORAGE_KEYS.RECENT, JSON.stringify(updated));
      set({ recentFiles: updated });
    },

    clearRecentFiles: () => {
      localStorage.removeItem(STORAGE_KEYS.RECENT);
      set({ recentFiles: [] });
    },

    setWaveformData: (data) => set({ waveformData: data }),

    next: () =>
      set((state) => {
        if (state.playlist.length === 0) return {};
        const nextIndex = (state.currentIndex + 1) % state.playlist.length;
        return {
          currentIndex: nextIndex,
          currentFile: state.playlist[nextIndex],
          currentTime: 0,
        };
      }),

    prev: () =>
      set((state) => {
        if (state.playlist.length === 0) return {};
        const prevIndex =
          state.currentIndex <= 0
            ? state.playlist.length - 1
            : state.currentIndex - 1;
        return {
          currentIndex: prevIndex,
          currentFile: state.playlist[prevIndex],
          currentTime: 0,
        };
      }),

    stop: () => set({ isPlaying: false, currentTime: 0 }),

    reset: () =>
      set({
        currentFile: null,
        isPlaying: false,
        currentTime: 0,
        duration: 0,
        waveformData: [],
      }),
  }),
);
