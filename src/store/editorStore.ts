import { create } from "zustand";
import type { EditorState, EditorActions, Marker } from "@/types/editor";
import { generateId } from "@/utils/format";

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
      fadeInCurve: "linear",
      fadeOutCurve: "linear",
    },
    playbackMode: "normal",
    audioBuffer: null,
    markers: [],
    zoomConfig: {
      horizontal: 1,
      vertical: 1,
      viewStart: 0,
      viewEnd: 1,
    },
    showDbScale: false,
    amplifyConfig: {
      gainDb: 0,
      allowClipping: false,
    },
    crossfadeConfig: {
      duration: 0.5,
      curve: "linear",
    },
    peakData: null,

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
        markers: [],
        zoomConfig: {
          horizontal: 1,
          vertical: 1,
          viewStart: 0,
          viewEnd: 1,
        },
        peakData: null,
      }),

    addMarker: (marker) =>
      set((state) => {
        const newMarker: Marker = {
          ...marker,
          id: generateId(),
          createdAt: Date.now(),
        };
        const newMarkers = [...state.markers, newMarker].sort(
          (a, b) => a.time - b.time,
        );
        return { markers: newMarkers };
      }),

    updateMarker: (id, updates) =>
      set((state) => ({
        markers: state.markers.map((m) =>
          m.id === id ? { ...m, ...updates } : m,
        ),
      })),

    removeMarker: (id) =>
      set((state) => ({
        markers: state.markers.filter((m) => m.id !== id),
      })),

    clearMarkers: () => set({ markers: [] }),

    setZoomConfig: (config) =>
      set((state) => ({
        zoomConfig: { ...state.zoomConfig, ...config },
      })),

    resetZoom: (duration) =>
      set({
        zoomConfig: {
          horizontal: 1,
          vertical: 1,
          viewStart: 0,
          viewEnd: duration > 0 ? duration : 1,
        },
      }),

    toggleDbScale: () =>
      set((state) => ({ showDbScale: !state.showDbScale })),

    setAmplifyConfig: (config) =>
      set((state) => ({
        amplifyConfig: { ...state.amplifyConfig, ...config },
      })),

    setCrossfadeConfig: (config) =>
      set((state) => ({
        crossfadeConfig: { ...state.crossfadeConfig, ...config },
      })),

    setPeakData: (data) => set({ peakData: data }),
  }),
);
