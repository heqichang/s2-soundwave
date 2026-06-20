import { useCallback, useEffect, useRef } from "react";
import { useRecordingStore } from "@/store/recordingStore";
import { usePlayerStore } from "@/store/playerStore";
import { useEditorStore } from "@/store/editorStore";
import type { AudioFile, RecordingSettings } from "@/types/audio";
import { decodeAudioFile, generateWaveformData, getAudioContext } from "@/lib/audioUtils";
import { generateId } from "@/utils/format";

export function useAudioRecorder() {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const pausedDurationRef = useRef<number>(0);
  const pauseStartRef = useRef<number>(0);
  const recordedChunksRef = useRef<Blob[]>([]);

  const {
    isRecording,
    isPaused,
    isProcessing,
    duration,
    level,
    waveform,
    recordedBlob,
    audioBuffer,
    settings,
    devices,
    error,
    setRecording,
    setPaused,
    setProcessing,
    setDuration,
    setLevel,
    setWaveform,
    appendWaveform,
    setRecordedBlob,
    setAudioBuffer,
    setSettings,
    setDevices,
    setError,
    reset,
  } = useRecordingStore();

  const { setPlaylist, setCurrentIndex, addRecentFile, setWaveformData, setDuration: setPlayerDuration } =
    usePlayerStore();

  const listDevices = useCallback(async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      const deviceList = await navigator.mediaDevices.enumerateDevices();
      const audioDevices = deviceList.filter((d) => d.kind === "audioinput");
      setDevices(audioDevices);
      if (audioDevices.length > 0 && !settings.deviceId) {
        setSettings({ deviceId: audioDevices[0].deviceId });
      }
    } catch (err) {
      setError("无法访问麦克风设备");
      console.error(err);
    }
  }, [setDevices, setSettings, setError, settings.deviceId]);

  const startAnalyser = useCallback((stream: MediaStream) => {
    const ctx = getAudioContext();
    audioContextRef.current = ctx;

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    analyserRef.current = analyser;

    const source = ctx.createMediaStreamSource(stream);
    sourceRef.current = source;
    source.connect(analyser);

    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const updateLevel = () => {
      if (!analyserRef.current || !isRecording) return;

      analyserRef.current.getByteTimeDomainData(dataArray);

      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        const v = (dataArray[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / dataArray.length);
      const db = rms > 0 ? 20 * Math.log10(rms) : -100;
      const normalizedLevel = Math.max(0, Math.min(1, (db + 60) / 60));

      setLevel(normalizedLevel);
      appendWaveform(normalizedLevel);

      if (!isPaused) {
        const elapsed =
          (performance.now() - startTimeRef.current - pausedDurationRef.current) / 1000;
        setDuration(elapsed);
      }

      animationFrameRef.current = requestAnimationFrame(updateLevel);
    };

    updateLevel();
  }, [setLevel, appendWaveform, setDuration, isRecording, isPaused]);

  const stopAnalyser = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (analyserRef.current) {
      analyserRef.current.disconnect();
      analyserRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
  }, []);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      setProcessing(true);

      const constraints: MediaStreamConstraints = {
        audio: {
          deviceId: settings.deviceId ? { exact: settings.deviceId } : undefined,
          sampleRate: settings.sampleRate,
          channelCount: settings.channels,
        },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      const mimeTypes = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/ogg;codecs=opus",
        "audio/ogg",
      ];
      let selectedMimeType = "";
      for (const type of mimeTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
          selectedMimeType = type;
          break;
        }
      }

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: selectedMimeType || undefined,
      });
      mediaRecorderRef.current = mediaRecorder;
      recordedChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const mimeType = mediaRecorder.mimeType || "audio/webm";
        const blob = new Blob(recordedChunksRef.current, { type: mimeType });
        setRecordedBlob(blob);

        try {
          setProcessing(true);
          const file = new File([blob], `recording-${Date.now()}.webm`, {
            type: mimeType,
          });
          const decodedBuffer = await decodeAudioFile(file);
          setAudioBuffer(decodedBuffer);
        } catch (err) {
          console.error("Failed to decode recording:", err);
        } finally {
          setProcessing(false);
        }

        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
        }
        stopAnalyser();
      };

      startTimeRef.current = performance.now();
      pausedDurationRef.current = 0;
      setWaveform([]);
      setDuration(0);
      setLevel(0);

      startAnalyser(stream);
      mediaRecorder.start(100);
      setRecording(true);
      setPaused(false);
      setProcessing(false);
    } catch (err) {
      setProcessing(false);
      setError("开始录音失败：" + (err instanceof Error ? err.message : "未知错误"));
      console.error(err);
    }
  }, [
    settings,
    setRecording,
    setPaused,
    setProcessing,
    setError,
    setWaveform,
    setDuration,
    setLevel,
    setRecordedBlob,
    setAudioBuffer,
    startAnalyser,
    stopAnalyser,
  ]);

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.pause();
      pauseStartRef.current = performance.now();
      setPaused(true);
    }
  }, [setPaused]);

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "paused") {
      pausedDurationRef.current += performance.now() - pauseStartRef.current;
      mediaRecorderRef.current.resume();
      setPaused(false);
    }
  }, [setPaused]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
      setRecording(false);
      setPaused(false);
    }
  }, [setRecording, setPaused]);

  const addRecordingToPlaylist = useCallback(async () => {
    if (!audioBuffer && !recordedBlob) return;

    try {
      setProcessing(true);

      let finalBuffer = audioBuffer;
      const blob = recordedBlob;

      if (!finalBuffer && blob) {
        const file = new File([blob], `recording-${Date.now()}.webm`, {
          type: blob.type,
        });
        finalBuffer = await decodeAudioFile(file);
        setAudioBuffer(finalBuffer);
      }

      if (!finalBuffer || !blob) {
        setProcessing(false);
        return;
      }

      const url = URL.createObjectURL(blob);
      const waveformData = generateWaveformData(finalBuffer, 120);

      const audioFile: AudioFile = {
        id: generateId(),
        name: `录音-${new Date().toLocaleString("zh-CN").replace(/[/:]/g, "-")}.webm`,
        size: blob.size,
        type: blob.type,
        url,
        duration: finalBuffer.duration,
        format: {
          sampleRate: finalBuffer.sampleRate,
          channels: finalBuffer.numberOfChannels,
        },
        openedAt: Date.now(),
      };

      const { playlist } = usePlayerStore.getState();
      const newPlaylist = [...playlist, audioFile];
      setPlaylist(newPlaylist);
      setCurrentIndex(newPlaylist.length - 1);
      addRecentFile(audioFile);
      setWaveformData(waveformData);
      setPlayerDuration(finalBuffer.duration);
      useEditorStore.getState().setAudioBuffer(finalBuffer);
      useEditorStore.getState().pushHistory({ audioBuffer: finalBuffer, label: "录音" });

      reset();
    } catch (err) {
      setError("添加录音到播放列表失败：" + (err instanceof Error ? err.message : "未知错误"));
      console.error(err);
    } finally {
      setProcessing(false);
    }
  }, [
    audioBuffer,
    recordedBlob,
    setProcessing,
    setPlaylist,
    setCurrentIndex,
    addRecentFile,
    setWaveformData,
    setPlayerDuration,
    reset,
    setError,
    setAudioBuffer,
  ]);

  const updateSettings = useCallback(
    (newSettings: Partial<RecordingSettings>) => {
      if (!isRecording) {
        setSettings(newSettings);
      }
    },
    [isRecording, setSettings],
  );

  useEffect(() => {
    listDevices();
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      stopAnalyser();
    };
  }, [listDevices, stopAnalyser]);

  return {
    isRecording,
    isPaused,
    isProcessing,
    duration,
    level,
    waveform,
    recordedBlob,
    audioBuffer,
    settings,
    devices,
    error,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    addRecordingToPlaylist,
    updateSettings,
    resetRecording: reset,
    listDevices,
  };
}
