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
}

export type PlaybackMode = "normal" | "loop-selection" | "play-selection" | "play-from-selection";

export interface EditorState {
  selection: Selection | null;
  clipboard: ClipboardData | null;
  history: HistoryEntry[];
  historyIndex: number;
  fadeConfig: FadeConfig;
  playbackMode: PlaybackMode;
  audioBuffer: AudioBuffer | null;
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
}
