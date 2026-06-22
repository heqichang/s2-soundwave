import { useCallback } from "react";
import { useEditorStore } from "@/store/editorStore";
import { usePlayerStore } from "@/store/playerStore";
import type { ClipboardData } from "@/types/editor";
import {
  cloneAudioBuffer,
  generateWaveformData,
  audioBufferToWav,
  applySilence,
  applyReverse,
  applyInvertPhase,
  applyNormalize,
  applyAmplify,
  applyFadeInAdvanced,
  applyFadeOutAdvanced,
  applyCrossfade,
} from "@/lib/audioUtils";

function createBufferFromRange(
  audioBuffer: AudioBuffer,
  startSample: number,
  endSample: number,
): AudioBuffer {
  const AudioContextClass =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext;
  const ctx = new AudioContextClass();
  const length = Math.max(0, endSample - startSample);
  const newBuffer = ctx.createBuffer(
    audioBuffer.numberOfChannels,
    length,
    audioBuffer.sampleRate,
  );
  for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
    const sourceData = audioBuffer.getChannelData(ch);
    newBuffer.copyToChannel(
      new Float32Array(sourceData.slice(startSample, endSample)),
      ch,
    );
  }
  ctx.close().catch(() => {});
  return newBuffer;
}

function spliceAudioBuffer(
  audioBuffer: AudioBuffer,
  startSample: number,
  endSample: number,
  insertBuffer?: AudioBuffer | null,
): AudioBuffer {
  const AudioContextClass =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext;
  const ctx = new AudioContextClass();
  const insertLength = insertBuffer ? insertBuffer.length : 0;
  const newLength =
    Math.max(0, startSample) + insertLength + Math.max(0, audioBuffer.length - endSample);
  const newBuffer = ctx.createBuffer(
    audioBuffer.numberOfChannels,
    Math.max(0, newLength),
    audioBuffer.sampleRate,
  );
  for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
    const sourceData = audioBuffer.getChannelData(ch);
    const newData = newBuffer.getChannelData(ch);
    let offset = 0;
    const clampedStart = Math.max(0, Math.min(startSample, audioBuffer.length));
    const clampedEnd = Math.max(clampedStart, Math.min(endSample, audioBuffer.length));
    newData.set(sourceData.slice(0, clampedStart), offset);
    offset += clampedStart;
    if (insertBuffer) {
      newData.set(insertBuffer.getChannelData(ch), offset);
      offset += insertBuffer.length;
    }
    newData.set(sourceData.slice(clampedEnd), offset);
  }
  ctx.close().catch(() => {});
  return newBuffer;
}

export function useAudioEditor() {
  const {
    selection,
    clipboard,
    audioBuffer,
    fadeConfig,
    amplifyConfig,
    crossfadeConfig,
    setSelection,
    clearSelection,
    selectAll,
    setClipboard,
    setAudioBuffer,
    pushHistory,
    undo,
    redo,
    canUndo,
    canRedo,
    resetEditor,
    setPeakData,
  } = useEditorStore();

  const { duration, setDuration, setWaveformData } = usePlayerStore();

  const loadAudioBuffer = useCallback(
    async (file: File) => {
      const arrayBuffer = await file.arrayBuffer();
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const ctx = new AudioContextClass();
      const decoded = await ctx.decodeAudioData(arrayBuffer);
      const cloned = cloneAudioBuffer(decoded);
      setAudioBuffer(cloned);
      pushHistory({ audioBuffer: cloned, label: "加载" });
      ctx.close().catch(() => {});
    },
    [setAudioBuffer, pushHistory],
  );

  const regenerateWaveform = useCallback(
    (buffer: AudioBuffer) => {
      const data = generateWaveformData(buffer, 240);
      setWaveformData(data);
    },
    [setWaveformData],
  );

  const commitEdit = useCallback(
    (newBuffer: AudioBuffer, label: string) => {
      const cloned = cloneAudioBuffer(newBuffer);
      setAudioBuffer(cloned);
      pushHistory({ audioBuffer: cloned, label });
      setDuration(cloned.duration);
      regenerateWaveform(cloned);
      clearSelection();
      setPeakData(null);
    },
    [setAudioBuffer, pushHistory, setDuration, regenerateWaveform, clearSelection, setPeakData],
  );

  const handleCopy = useCallback(() => {
    if (!selection || !audioBuffer) return;
    const sampleRate = audioBuffer.sampleRate;
    const startSample = Math.floor(selection.start * sampleRate);
    const endSample = Math.floor(selection.end * sampleRate);
    const clippedStart = Math.max(0, Math.min(startSample, audioBuffer.length));
    const clippedEnd = Math.max(clippedStart, Math.min(endSample, audioBuffer.length));
    if (clippedEnd <= clippedStart) return;
    const copiedBuffer = createBufferFromRange(audioBuffer, clippedStart, clippedEnd);
    const clipboardData: ClipboardData = {
      audioBuffer: copiedBuffer,
      start: selection.start,
      end: selection.end,
    };
    setClipboard(clipboardData);
  }, [selection, audioBuffer, setClipboard]);

  const handleCut = useCallback(() => {
    if (!selection || !audioBuffer) return;
    handleCopy();
    const sampleRate = audioBuffer.sampleRate;
    const startSample = Math.floor(selection.start * sampleRate);
    const endSample = Math.floor(selection.end * sampleRate);
    const clippedStart = Math.max(0, Math.min(startSample, audioBuffer.length));
    const clippedEnd = Math.max(clippedStart, Math.min(endSample, audioBuffer.length));
    if (clippedEnd <= clippedStart) return;
    const newBuffer = spliceAudioBuffer(audioBuffer, clippedStart, clippedEnd);
    commitEdit(newBuffer, "剪切");
  }, [selection, audioBuffer, handleCopy, commitEdit]);

  const handlePaste = useCallback(() => {
    if (!clipboard || !audioBuffer) return;
    const pasteTarget = selection
      ? Math.floor(selection.start * audioBuffer.sampleRate)
      : Math.floor(duration * audioBuffer.sampleRate);
    const clampedTarget = Math.max(0, Math.min(pasteTarget, audioBuffer.length));
    const newBuffer = spliceAudioBuffer(
      audioBuffer,
      clampedTarget,
      clampedTarget,
      clipboard.audioBuffer,
    );
    commitEdit(newBuffer, "粘贴");
  }, [clipboard, audioBuffer, selection, duration, commitEdit]);

  const handleDelete = useCallback(() => {
    if (!selection || !audioBuffer) return;
    const sampleRate = audioBuffer.sampleRate;
    const startSample = Math.floor(selection.start * sampleRate);
    const endSample = Math.floor(selection.end * sampleRate);
    const clippedStart = Math.max(0, Math.min(startSample, audioBuffer.length));
    const clippedEnd = Math.max(clippedStart, Math.min(endSample, audioBuffer.length));
    if (clippedEnd <= clippedStart) return;
    const newBuffer = spliceAudioBuffer(audioBuffer, clippedStart, clippedEnd);
    commitEdit(newBuffer, "删除");
  }, [selection, audioBuffer, commitEdit]);

  const handleTrim = useCallback(() => {
    if (!selection || !audioBuffer) return;
    const sampleRate = audioBuffer.sampleRate;
    const startSample = Math.floor(selection.start * sampleRate);
    const endSample = Math.floor(selection.end * sampleRate);
    const clippedStart = Math.max(0, Math.min(startSample, audioBuffer.length));
    const clippedEnd = Math.max(clippedStart, Math.min(endSample, audioBuffer.length));
    if (clippedEnd <= clippedStart) return;
    const newBuffer = createBufferFromRange(audioBuffer, clippedStart, clippedEnd);
    commitEdit(newBuffer, "裁剪");
  }, [selection, audioBuffer, commitEdit]);

  const handleSilence = useCallback(() => {
    if (!selection || !audioBuffer) return;
    const sampleRate = audioBuffer.sampleRate;
    const startSample = Math.floor(selection.start * sampleRate);
    const endSample = Math.floor(selection.end * sampleRate);
    const newBuffer = applySilence(audioBuffer, startSample, endSample);
    commitEdit(newBuffer, "静音");
  }, [selection, audioBuffer, commitEdit]);

  const handleReverse = useCallback(() => {
    if (!selection || !audioBuffer) return;
    const sampleRate = audioBuffer.sampleRate;
    const startSample = Math.floor(selection.start * sampleRate);
    const endSample = Math.floor(selection.end * sampleRate);
    const newBuffer = applyReverse(audioBuffer, startSample, endSample);
    commitEdit(newBuffer, "反转");
  }, [selection, audioBuffer, commitEdit]);

  const handleInvertPhase = useCallback(() => {
    if (!selection || !audioBuffer) return;
    const sampleRate = audioBuffer.sampleRate;
    const startSample = Math.floor(selection.start * sampleRate);
    const endSample = Math.floor(selection.end * sampleRate);
    const newBuffer = applyInvertPhase(audioBuffer, startSample, endSample);
    commitEdit(newBuffer, "反转相位");
  }, [selection, audioBuffer, commitEdit]);

  const handleNormalize = useCallback(() => {
    if (!selection || !audioBuffer) return;
    const sampleRate = audioBuffer.sampleRate;
    const startSample = Math.floor(selection.start * sampleRate);
    const endSample = Math.floor(selection.end * sampleRate);
    const clippedStart = Math.max(0, Math.min(startSample, audioBuffer.length));
    const clippedEnd = Math.max(clippedStart, Math.min(endSample, audioBuffer.length));
    const selectedBuffer = createBufferFromRange(audioBuffer, clippedStart, clippedEnd);
    const normalizedSelected = applyNormalize(selectedBuffer, 0);
    const newBuffer = spliceAudioBuffer(
      audioBuffer,
      clippedStart,
      clippedEnd,
      normalizedSelected,
    );
    commitEdit(newBuffer, "标准化");
  }, [selection, audioBuffer, commitEdit]);

  const handleAmplify = useCallback(() => {
    if (!selection || !audioBuffer) return;
    const sampleRate = audioBuffer.sampleRate;
    const startSample = Math.floor(selection.start * sampleRate);
    const endSample = Math.floor(selection.end * sampleRate);
    const newBuffer = applyAmplify(audioBuffer, startSample, endSample, amplifyConfig);
    commitEdit(newBuffer, `增益 ${amplifyConfig.gainDb > 0 ? "+" : ""}${amplifyConfig.gainDb.toFixed(1)}dB`);
  }, [selection, audioBuffer, amplifyConfig, commitEdit]);

  const handleFadeIn = useCallback(() => {
    if (!selection || !audioBuffer) return;
    const sampleRate = audioBuffer.sampleRate;
    const startSample = Math.floor(selection.start * sampleRate);
    const fadeSamples = Math.floor(fadeConfig.fadeInDuration * sampleRate);
    const newBuffer = applyFadeInAdvanced(
      audioBuffer,
      startSample,
      fadeSamples,
      fadeConfig.fadeInCurve,
    );
    commitEdit(newBuffer, `淡入 (${fadeConfig.fadeInCurve})`);
  }, [selection, audioBuffer, fadeConfig, commitEdit]);

  const handleFadeOut = useCallback(() => {
    if (!selection || !audioBuffer) return;
    const sampleRate = audioBuffer.sampleRate;
    const endSample = Math.floor(selection.end * sampleRate);
    const fadeSamples = Math.floor(fadeConfig.fadeOutDuration * sampleRate);
    const newBuffer = applyFadeOutAdvanced(
      audioBuffer,
      endSample,
      fadeSamples,
      fadeConfig.fadeOutCurve,
    );
    commitEdit(newBuffer, `淡出 (${fadeConfig.fadeOutCurve})`);
  }, [selection, audioBuffer, fadeConfig, commitEdit]);

  const handleCrossfade = useCallback(() => {
    if (!clipboard || !audioBuffer || !selection) return;
    const sampleRate = audioBuffer.sampleRate;
    const startSample = Math.floor(selection.start * sampleRate);
    const endSample = Math.floor(selection.end * sampleRate);
    const selectedBuffer = createBufferFromRange(audioBuffer, startSample, endSample);
    const xFadedBuffer = applyCrossfade(selectedBuffer, clipboard.audioBuffer, crossfadeConfig);
    const newBuffer = spliceAudioBuffer(audioBuffer, startSample, endSample, xFadedBuffer);
    commitEdit(newBuffer, "交叉淡化");
  }, [clipboard, audioBuffer, selection, crossfadeConfig, commitEdit]);

  const handleUndo = useCallback(() => {
    const prevBuffer = undo();
    if (prevBuffer) {
      setAudioBuffer(prevBuffer);
      setDuration(prevBuffer.duration);
      regenerateWaveform(prevBuffer);
      clearSelection();
      setPeakData(null);
    }
  }, [undo, setAudioBuffer, setDuration, regenerateWaveform, clearSelection, setPeakData]);

  const handleRedo = useCallback(() => {
    const nextBuffer = redo();
    if (nextBuffer) {
      setAudioBuffer(nextBuffer);
      setDuration(nextBuffer.duration);
      regenerateWaveform(nextBuffer);
      clearSelection();
      setPeakData(null);
    }
  }, [redo, setAudioBuffer, setDuration, regenerateWaveform, clearSelection, setPeakData]);

  const handleSelectAll = useCallback(() => {
    if (audioBuffer) {
      selectAll(audioBuffer.duration);
    }
  }, [audioBuffer, selectAll]);

  const exportAudioBuffer = useCallback(async (): Promise<Blob | null> => {
    if (!audioBuffer) return null;
    const offlineCtx = new OfflineAudioContext(
      audioBuffer.numberOfChannels,
      audioBuffer.length,
      audioBuffer.sampleRate,
    );
    const source = offlineCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(offlineCtx.destination);
    source.start();
    const rendered = await offlineCtx.startRendering();
    const wavBlob = audioBufferToWav(rendered);
    return wavBlob;
  }, [audioBuffer]);

  return {
    selection,
    clipboard,
    audioBuffer,
    fadeConfig,
    amplifyConfig,
    crossfadeConfig,
    loadAudioBuffer,
    handleCopy,
    handleCut,
    handlePaste,
    handleDelete,
    handleTrim,
    handleSilence,
    handleReverse,
    handleInvertPhase,
    handleNormalize,
    handleAmplify,
    handleFadeIn,
    handleFadeOut,
    handleCrossfade,
    handleUndo,
    handleRedo,
    handleSelectAll,
    clearSelection,
    setSelection,
    canUndo,
    canRedo,
    resetEditor,
    exportAudioBuffer,
  };
}
