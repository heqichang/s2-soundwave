export interface AudioFormat {
  sampleRate?: number;
  bitRate?: number;
  channels?: number;
  codec?: string;
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

export const AUDIO_EXTENSIONS = [".mp3", ".wav", ".flac", ".aac", ".ogg", ".m4a"];

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
];
