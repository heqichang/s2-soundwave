export interface Selection {
  start: number;
  end: number;
}

export interface ClipboardData {
  audioBuffer: AudioBuffer;
  start: number;
  end: number;
}

export interface HistoryEntry {
  audioBuffer: AudioBuffer;
  label: string;
}

export interface FadeConfig {
  fadeInDuration: number;
  fadeOutDuration: number;
  fadeInCurve: "linear" | "logarithmic" | "exponential" | "sine";
  fadeOutCurve: "linear" | "logarithmic" | "exponential" | "sine";
}

export type PlaybackMode = "normal" | "loop-selection" | "play-selection" | "play-from-selection";

export interface Marker {
  id: string;
  time: number;
  name: string;
  color: string;
  createdAt: number;
}

export interface ZoomConfig {
  horizontal: number;
  vertical: number;
  viewStart: number;
  viewEnd: number;
}

export interface PeakData {
  maxPeak: number;
  maxPeakTime: number;
  rmsLevel: number;
  dcOffset: number;
}

export interface AmplifyConfig {
  gainDb: number;
  allowClipping: boolean;
}

export interface CrossfadeConfig {
  duration: number;
  curve: "linear" | "logarithmic" | "exponential";
}

export interface EditorState {
  selection: Selection | null;
  clipboard: ClipboardData | null;
  history: HistoryEntry[];
  historyIndex: number;
  fadeConfig: FadeConfig;
  playbackMode: PlaybackMode;
  audioBuffer: AudioBuffer | null;
  markers: Marker[];
  zoomConfig: ZoomConfig;
  showDbScale: boolean;
  amplifyConfig: AmplifyConfig;
  crossfadeConfig: CrossfadeConfig;
  peakData: PeakData | null;
}

export interface EditorActions {
  setSelection: (selection: Selection | null) => void;
  clearSelection: () => void;
  selectAll: (duration: number) => void;
  setClipboard: (clipboard: ClipboardData | null) => void;
  setAudioBuffer: (buffer: AudioBuffer | null) => void;
  pushHistory: (entry: HistoryEntry) => void;
  undo: () => AudioBuffer | null;
  redo: () => AudioBuffer | null;
  setFadeConfig: (config: Partial<FadeConfig>) => void;
  setPlaybackMode: (mode: PlaybackMode) => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  resetEditor: () => void;
  addMarker: (marker: Omit<Marker, "id" | "createdAt">) => void;
  updateMarker: (id: string, updates: Partial<Marker>) => void;
  removeMarker: (id: string) => void;
  clearMarkers: () => void;
  setZoomConfig: (config: Partial<ZoomConfig>) => void;
  resetZoom: (duration: number) => void;
  toggleDbScale: () => void;
  setAmplifyConfig: (config: Partial<AmplifyConfig>) => void;
  setCrossfadeConfig: (config: Partial<CrossfadeConfig>) => void;
  setPeakData: (data: PeakData | null) => void;
}

export const MARKER_COLORS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#f43f5e",
  "#14b8a6",
];
