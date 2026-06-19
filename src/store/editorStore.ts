import { create } from "zustand";
import type { EditorState, EditorActions } from "@/types/editor";

const MAX_HISTORY = 50;

export const useEditorStore = create<EditorState & EditorActions>(
  (set, get) => ({
    selection: null,
    clipboard: null,
    history: [],
    historyIndex: -1,
    fadeConfig: {
      fadeInDuration: 1.0,
      fadeOutDuration: 1.0,
    },
    playbackMode: "normal",
    audioBuffer: null,

    setSelection: (selection) => set({ selection }),
    clearSelection: () => set({ selection: null }),

    selectAll: (duration) =>
      set({ selection: { start: 0, end: duration } }),

    setClipboard: (clipboard) => set({ clipboard }),

    setAudioBuffer: (buffer) => set({ audioBuffer: buffer }),

    pushHistory: (entry) =>
      set((state) => {
        const newHistory = state.history.slice(0, state.historyIndex + 1);
        newHistory.push(entry);
        if (newHistory.length > MAX_HISTORY) {
          newHistory.shift();
        }
        return {
          history: newHistory,
          historyIndex: newHistory.length - 1,
        };
      }),

    undo: () => {
      const { history, historyIndex } = get();
      if (historyIndex <= 0) return null;
      const newIndex = historyIndex - 1;
      set({ historyIndex: newIndex });
      return history[newIndex].audioBuffer;
    },

    redo: () => {
      const { history, historyIndex } = get();
      if (historyIndex >= history.length - 1) return null;
      const newIndex = historyIndex + 1;
      set({ historyIndex: newIndex });
      return history[newIndex].audioBuffer;
    },

    setFadeConfig: (config) =>
      set((state) => ({
        fadeConfig: { ...state.fadeConfig, ...config },
      })),

    setPlaybackMode: (mode) => set({ playbackMode: mode }),

    canUndo: () => {
      const { historyIndex } = get();
      return historyIndex > 0;
    },

    canRedo: () => {
      const { history, historyIndex } = get();
      return historyIndex < history.length - 1;
    },

    resetEditor: () =>
      set({
        selection: null,
        clipboard: null,
        history: [],
        historyIndex: -1,
        playbackMode: "normal",
        audioBuffer: null,
      }),
  }),
);
