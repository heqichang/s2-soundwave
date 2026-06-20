export interface AudioFormat {
  sampleRate?: number;
  bitRate?: number;
  channels?: number;
  codec?: string;
  bitDepth?: number;
}

export interface AudioFile {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
  duration?: number;
  format?: AudioFormat;
  openedAt: number;
}

export interface PlayerState {
  playlist: AudioFile[];
  currentIndex: number;
  currentFile: AudioFile | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  recentFiles: AudioFile[];
  waveformData: number[];
}

export interface PlayerActions {
  setPlaylist: (files: AudioFile[]) => void;
  addToPlaylist: (file: AudioFile) => void;
  removeFromPlaylist: (id: string) => void;
  setCurrentIndex: (index: number) => void;
  setCurrentFile: (file: AudioFile | null) => void;
  setPlaying: (playing: boolean) => void;
  togglePlay: () => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  setMuted: (muted: boolean) => void;
  addRecentFile: (file: AudioFile) => void;
  removeRecentFile: (id: string) => void;
  clearRecentFiles: () => void;
  setWaveformData: (data: number[]) => void;
  next: () => void;
  prev: () => void;
  stop: () => void;
  reset: () => void;
}

export type SampleRate = 44100 | 48000 | 96000 | 192000;
export type BitDepth = 16 | 24 | 32;
export type ChannelCount = 1 | 2;

export interface RecordingSettings {
  deviceId: string;
  sampleRate: SampleRate;
  bitDepth: BitDepth;
  channels: ChannelCount;
}

export interface RecordingState {
  isRecording: boolean;
  isPaused: boolean;
  isProcessing: boolean;
  duration: number;
  level: number;
  waveform: number[];
  recordedBlob: Blob | null;
  audioBuffer: AudioBuffer | null;
  settings: RecordingSettings;
  devices: MediaDeviceInfo[];
  error: string | null;
}

export interface RecordingActions {
  setRecording: (recording: boolean) => void;
  setPaused: (paused: boolean) => void;
  setProcessing: (processing: boolean) => void;
  setDuration: (duration: number) => void;
  setLevel: (level: number) => void;
  setWaveform: (waveform: number[]) => void;
  appendWaveform: (value: number) => void;
  setRecordedBlob: (blob: Blob | null) => void;
  setAudioBuffer: (buffer: AudioBuffer | null) => void;
  setSettings: (settings: Partial<RecordingSettings>) => void;
  setDevices: (devices: MediaDeviceInfo[]) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

export const SUPPORTED_IMPORT_FORMATS = [
  { ext: ".mp3", name: "MP3", mime: "audio/mpeg" },
  { ext: ".wav", name: "WAV", mime: "audio/wav" },
  { ext: ".flac", name: "FLAC", mime: "audio/flac" },
  { ext: ".aac", name: "AAC", mime: "audio/aac" },
  { ext: ".ogg", name: "OGG", mime: "audio/ogg" },
  { ext: ".aiff", name: "AIFF", mime: "audio/aiff" },
  { ext: ".wma", name: "WMA", mime: "audio/x-ms-wma" },
  { ext: ".m4a", name: "M4A", mime: "audio/mp4" },
] as const;

export const SUPPORTED_EXPORT_FORMATS = [
  { ext: ".mp3", name: "MP3", mime: "audio/mpeg" },
  { ext: ".wav", name: "WAV", mime: "audio/wav" },
  { ext: ".flac", name: "FLAC", mime: "audio/flac" },
  { ext: ".aac", name: "AAC", mime: "audio/aac" },
  { ext: ".ogg", name: "OGG", mime: "audio/ogg" },
] as const;

export type ExportFormat = (typeof SUPPORTED_EXPORT_FORMATS)[number]["ext"];
export type ImportFormat = (typeof SUPPORTED_IMPORT_FORMATS)[number]["ext"];

export interface ExportOptions {
  format: ExportFormat;
  sampleRate?: SampleRate;
  bitDepth?: BitDepth;
  bitRate?: number;
  channels?: ChannelCount;
}

export interface ConversionJob {
  id: string;
  source: AudioFile;
  options: ExportOptions;
  status: "pending" | "processing" | "completed" | "error";
  progress: number;
  error?: string;
  outputBlob?: Blob;
  outputName?: string;
}

export interface BatchConversionState {
  jobs: ConversionJob[];
  isRunning: boolean;
}

export const SAMPLE_RATE_OPTIONS: SampleRate[] = [44100, 48000, 96000, 192000];
export const BIT_DEPTH_OPTIONS: BitDepth[] = [16, 24, 32];
export const CHANNEL_OPTIONS: ChannelCount[] = [1, 2];
export const MP3_BIT_RATE_OPTIONS = [128, 192, 256, 320];

export const AUDIO_EXTENSIONS = [
  ".mp3",
  ".wav",
  ".flac",
  ".aac",
  ".ogg",
  ".m4a",
  ".aiff",
  ".aif",
  ".wma",
];

export const AUDIO_MIME_TYPES = [
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/wave",
  "audio/x-wav",
  "audio/flac",
  "audio/x-flac",
  "audio/aac",
  "audio/x-aac",
  "audio/ogg",
  "audio/vorbis",
  "audio/mp4",
  "audio/x-m4a",
  "audio/aiff",
  "audio/x-aiff",
  "audio/x-ms-wma",
];
