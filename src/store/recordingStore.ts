import { create } from "zustand";
import type {
  RecordingState,
  RecordingActions,
  RecordingSettings,
} from "@/types/audio";

const DEFAULT_SETTINGS: RecordingSettings = {
  deviceId: "",
  sampleRate: 44100,
  bitDepth: 16,
  channels: 2,
};

export const useRecordingStore = create<RecordingState & RecordingActions>(
  (set) => ({
    isRecording: false,
    isPaused: false,
    isProcessing: false,
    duration: 0,
    level: 0,
    waveform: [],
    recordedBlob: null,
    audioBuffer: null,
    settings: DEFAULT_SETTINGS,
    devices: [],
    error: null,

    setRecording: (recording) => set({ isRecording: recording }),
    setPaused: (paused) => set({ isPaused: paused }),
    setProcessing: (processing) => set({ isProcessing: processing }),
    setDuration: (duration) => set({ duration }),
    setLevel: (level) => set({ level }),
    setWaveform: (waveform) => set({ waveform }),
    appendWaveform: (value) =>
      set((state) => {
        const newWaveform = [...state.waveform, value].slice(-500);
        return { waveform: newWaveform };
      }),
    setRecordedBlob: (blob) => set({ recordedBlob: blob }),
    setAudioBuffer: (buffer) => set({ audioBuffer: buffer }),
    setSettings: (settings) =>
      set((state) => ({
        settings: { ...state.settings, ...settings },
      })),
    setDevices: (devices) => set({ devices }),
    setError: (error) => set({ error }),

    reset: () =>
      set({
        isRecording: false,
        isPaused: false,
        isProcessing: false,
        duration: 0,
        level: 0,
        waveform: [],
        recordedBlob: null,
        audioBuffer: null,
        error: null,
      }),
  }),
);
