import { useCallback } from "react";
import { useEditorStore } from "@/store/editorStore";
import { usePlayerStore } from "@/store/playerStore";
import type { ClipboardData } from "@/types/editor";

function cloneAudioBuffer(audioBuffer: AudioBuffer): AudioBuffer {
  const AudioContextClass =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext;
  const ctx = new AudioContextClass();
  const newBuffer = ctx.createBuffer(
    audioBuffer.numberOfChannels,
    audioBuffer.length,
    audioBuffer.sampleRate,
  );
  for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
    const sourceData = audioBuffer.getChannelData(ch);
    newBuffer.copyToChannel(new Float32Array(sourceData), ch);
  }
  ctx.close().catch(() => {});
  return newBuffer;
}

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
  const length = endSample - startSample;
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
    startSample + insertLength + (audioBuffer.length - endSample);
  const newBuffer = ctx.createBuffer(
    audioBuffer.numberOfChannels,
    newLength,
    audioBuffer.sampleRate,
  );
  for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
    const sourceData = audioBuffer.getChannelData(ch);
    const newData = newBuffer.getChannelData(ch);
    let offset = 0;
    newData.set(sourceData.slice(0, startSample), offset);
    offset += startSample;
    if (insertBuffer) {
      newData.set(insertBuffer.getChannelData(ch), offset);
      offset += insertBuffer.length;
    }
    newData.set(sourceData.slice(endSample), offset);
  }
  ctx.close().catch(() => {});
  return newBuffer;
}

function applyFadeIn(
  audioBuffer: AudioBuffer,
  startSample: number,
  fadeSamples: number,
): AudioBuffer {
  const result = cloneAudioBuffer(audioBuffer);
  const actualFade = Math.min(fadeSamples, result.length - startSample);
  for (let ch = 0; ch < result.numberOfChannels; ch++) {
    const data = result.getChannelData(ch);
    for (let i = 0; i < actualFade; i++) {
      data[startSample + i] *= i / actualFade;
    }
  }
  return result;
}

function applyFadeOut(
  audioBuffer: AudioBuffer,
  endSample: number,
  fadeSamples: number,
): AudioBuffer {
  const result = cloneAudioBuffer(audioBuffer);
  const startFade = Math.max(0, endSample - fadeSamples);
  const actualFade = endSample - startFade;
  for (let ch = 0; ch < result.numberOfChannels; ch++) {
    const data = result.getChannelData(ch);
    for (let i = 0; i < actualFade; i++) {
      data[startFade + i] *= 1 - i / actualFade;
    }
  }
  return result;
}

export function useAudioEditor() {
  const {
    selection,
    clipboard,
    audioBuffer,
    fadeConfig,
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
      const rawData = buffer.getChannelData(0);
      const samples = 120;
      const blockSize = Math.floor(rawData.length / samples);
      const filteredData: number[] = [];
      for (let i = 0; i < samples; i++) {
        const blockStart = blockSize * i;
        let sum = 0;
        for (let j = 0; j < blockSize; j++) {
          sum += Math.abs(rawData[blockStart + j]);
        }
        filteredData.push(sum / blockSize);
      }
      const maxVal = Math.max(...filteredData);
      const normalizedData = filteredData.map((n) =>
        maxVal > 0 ? n / maxVal : 0,
      );
      setWaveformData(normalizedData);
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
    },
    [setAudioBuffer, pushHistory, setDuration, regenerateWaveform, clearSelection],
  );

  const handleCopy = useCallback(() => {
    if (!selection || !audioBuffer) return;
    const sampleRate = audioBuffer.sampleRate;
    const startSample = Math.floor(selection.start * sampleRate);
    const endSample = Math.floor(selection.end * sampleRate);
    const clippedEnd = Math.min(endSample, audioBuffer.length);
    const copiedBuffer = createBufferFromRange(audioBuffer, startSample, clippedEnd);
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
    const clippedEnd = Math.min(endSample, audioBuffer.length);
    const newBuffer = spliceAudioBuffer(audioBuffer, startSample, clippedEnd);
    commitEdit(newBuffer, "剪切");
  }, [selection, audioBuffer, handleCopy, commitEdit]);

  const handlePaste = useCallback(() => {
    if (!clipboard || !audioBuffer) return;
    const pasteTarget = selection
      ? Math.floor(selection.start * audioBuffer.sampleRate)
      : Math.floor(duration * audioBuffer.sampleRate);
    const newBuffer = spliceAudioBuffer(
      audioBuffer,
      pasteTarget,
      pasteTarget,
      clipboard.audioBuffer,
    );
    commitEdit(newBuffer, "粘贴");
  }, [clipboard, audioBuffer, selection, duration, commitEdit]);

  const handleDelete = useCallback(() => {
    if (!selection || !audioBuffer) return;
    const sampleRate = audioBuffer.sampleRate;
    const startSample = Math.floor(selection.start * sampleRate);
    const endSample = Math.floor(selection.end * sampleRate);
    const clippedEnd = Math.min(endSample, audioBuffer.length);
    const newBuffer = spliceAudioBuffer(audioBuffer, startSample, clippedEnd);
    commitEdit(newBuffer, "删除");
  }, [selection, audioBuffer, commitEdit]);

  const handleTrim = useCallback(() => {
    if (!selection || !audioBuffer) return;
    const sampleRate = audioBuffer.sampleRate;
    const startSample = Math.floor(selection.start * sampleRate);
    const endSample = Math.floor(selection.end * sampleRate);
    const clippedEnd = Math.min(endSample, audioBuffer.length);
    const newBuffer = createBufferFromRange(audioBuffer, startSample, clippedEnd);
    commitEdit(newBuffer, "裁剪");
  }, [selection, audioBuffer, commitEdit]);

  const handleFadeIn = useCallback(() => {
    if (!selection || !audioBuffer) return;
    const sampleRate = audioBuffer.sampleRate;
    const startSample = Math.floor(selection.start * sampleRate);
    const fadeSamples = Math.floor(fadeConfig.fadeInDuration * sampleRate);
    const newBuffer = applyFadeIn(audioBuffer, startSample, fadeSamples);
    commitEdit(newBuffer, "淡入");
  }, [selection, audioBuffer, fadeConfig.fadeInDuration, commitEdit]);

  const handleFadeOut = useCallback(() => {
    if (!selection || !audioBuffer) return;
    const sampleRate = audioBuffer.sampleRate;
    const endSample = Math.floor(selection.end * sampleRate);
    const fadeSamples = Math.floor(fadeConfig.fadeOutDuration * sampleRate);
    const newBuffer = applyFadeOut(audioBuffer, endSample, fadeSamples);
    commitEdit(newBuffer, "淡出");
  }, [selection, audioBuffer, fadeConfig.fadeOutDuration, commitEdit]);

  const handleUndo = useCallback(() => {
    const prevBuffer = undo();
    if (prevBuffer) {
      setAudioBuffer(prevBuffer);
      setDuration(prevBuffer.duration);
      regenerateWaveform(prevBuffer);
      clearSelection();
    }
  }, [undo, setAudioBuffer, setDuration, regenerateWaveform, clearSelection]);

  const handleRedo = useCallback(() => {
    const nextBuffer = redo();
    if (nextBuffer) {
      setAudioBuffer(nextBuffer);
      setDuration(nextBuffer.duration);
      regenerateWaveform(nextBuffer);
      clearSelection();
    }
  }, [redo, setAudioBuffer, setDuration, regenerateWaveform, clearSelection]);

  const handleSelectAll = useCallback(() => {
    if (audioBuffer) {
      selectAll(audioBuffer.duration);
    }
  }, [audioBuffer, selectAll]);

  const exportAudioBuffer = useCallback(async (): Promise<Blob | null> => {
    if (!audioBuffer) return null;
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
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
    loadAudioBuffer,
    handleCopy,
    handleCut,
    handlePaste,
    handleDelete,
    handleTrim,
    handleFadeIn,
    handleFadeOut,
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

function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1;
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const dataLength = buffer.length * blockAlign;
  const headerLength = 44;
  const totalLength = headerLength + dataLength;
  const arrayBuffer = new ArrayBuffer(totalLength);
  const view = new DataView(arrayBuffer);

  function writeString(offset: number, str: string) {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }

  writeString(0, "RIFF");
  view.setUint32(4, totalLength - 8, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(36, "data");
  view.setUint32(40, dataLength, true);

  const channels: Float32Array[] = [];
  for (let ch = 0; ch < numChannels; ch++) {
    channels.push(buffer.getChannelData(ch));
  }

  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channels[ch][i]));
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, intSample, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: "audio/wav" });
}
