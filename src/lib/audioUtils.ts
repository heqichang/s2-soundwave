import type {
  AudioFormat,
  BitDepth,
  ChannelCount,
  ExportOptions,
  SampleRate,
} from "@/types/audio";

export function getAudioContext(): AudioContext {
  const AudioContextClass =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext;
  return new AudioContextClass();
}

export function cloneAudioBuffer(audioBuffer: AudioBuffer): AudioBuffer {
  const ctx = getAudioContext();
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

export async function decodeAudioFile(file: File): Promise<AudioBuffer> {
  const arrayBuffer = await file.arrayBuffer();
  const ctx = getAudioContext();
  try {
    const decoded = await ctx.decodeAudioData(arrayBuffer.slice(0));
    return cloneAudioBuffer(decoded);
  } finally {
    ctx.close().catch(() => {});
  }
}

export async function resampleAudioBuffer(
  buffer: AudioBuffer,
  targetSampleRate: SampleRate,
): Promise<AudioBuffer> {
  if (buffer.sampleRate === targetSampleRate) {
    return cloneAudioBuffer(buffer);
  }

  const ctx = getAudioContext();
  try {
    const offlineCtx = new OfflineAudioContext(
      buffer.numberOfChannels,
      Math.ceil(buffer.length * (targetSampleRate / buffer.sampleRate)),
      targetSampleRate,
    );
    const source = offlineCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(offlineCtx.destination);
    source.start();
    const rendered = await offlineCtx.startRendering();
    return cloneAudioBuffer(rendered);
  } finally {
    ctx.close().catch(() => {});
  }
}

export function convertChannels(
  buffer: AudioBuffer,
  targetChannels: ChannelCount,
): AudioBuffer {
  if (buffer.numberOfChannels === targetChannels) {
    return cloneAudioBuffer(buffer);
  }

  const ctx = getAudioContext();
  try {
    const newBuffer = ctx.createBuffer(
      targetChannels,
      buffer.length,
      buffer.sampleRate,
    );

    if (targetChannels === 1 && buffer.numberOfChannels > 1) {
      const left = buffer.getChannelData(0);
      const right = buffer.getChannelData(1);
      const mono = newBuffer.getChannelData(0);
      for (let i = 0; i < buffer.length; i++) {
        mono[i] = (left[i] + right[i]) / 2;
      }
    } else if (targetChannels === 2 && buffer.numberOfChannels === 1) {
      const mono = buffer.getChannelData(0);
      const left = newBuffer.getChannelData(0);
      const right = newBuffer.getChannelData(1);
      left.set(mono);
      right.set(mono);
    }

    return newBuffer;
  } finally {
    ctx.close().catch(() => {});
  }
}

export function floatToInt16(sample: number): number {
  const clamped = Math.max(-1, Math.min(1, sample));
  return clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
}

export function floatToInt24(sample: number): number {
  const clamped = Math.max(-1, Math.min(1, sample));
  const maxVal = 0x7fffff;
  return clamped < 0 ? Math.round(clamped * (maxVal + 1)) : Math.round(clamped * maxVal);
}

export function floatToInt32(sample: number): number {
  const clamped = Math.max(-1, Math.min(1, sample));
  const maxVal = 0x7fffffff;
  return clamped < 0 ? Math.round(clamped * (maxVal + 1)) : Math.round(clamped * maxVal);
}

export function audioBufferToWav(
  buffer: AudioBuffer,
  options: { bitDepth?: BitDepth } = {},
): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1;
  const bitDepth: BitDepth = options.bitDepth || 16;
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
      const sample = channels[ch][i];
      if (bitDepth === 16) {
        view.setInt16(offset, floatToInt16(sample), true);
        offset += 2;
      } else if (bitDepth === 24) {
        const intSample = floatToInt24(sample);
        view.setUint8(offset, intSample & 0xff);
        view.setUint8(offset + 1, (intSample >> 8) & 0xff);
        view.setUint8(offset + 2, (intSample >> 16) & 0xff);
        offset += 3;
      } else if (bitDepth === 32) {
        view.setInt32(offset, floatToInt32(sample), true);
        offset += 4;
      }
    }
  }

  return new Blob([arrayBuffer], { type: "audio/wav" });
}

export async function exportAudioBuffer(
  buffer: AudioBuffer,
  options: ExportOptions,
): Promise<Blob> {
  let processedBuffer = buffer;

  if (options.channels) {
    processedBuffer = convertChannels(processedBuffer, options.channels);
  }

  if (options.sampleRate) {
    processedBuffer = await resampleAudioBuffer(processedBuffer, options.sampleRate);
  }

  switch (options.format) {
    case ".wav":
      return audioBufferToWav(processedBuffer, {
        bitDepth: options.bitDepth || 16,
      });
    case ".mp3":
    case ".flac":
    case ".aac":
    case ".ogg":
    default:
      return audioBufferToWav(processedBuffer, { bitDepth: 16 });
  }
}

export function getAudioFormatInfo(buffer: AudioBuffer): AudioFormat {
  return {
    sampleRate: buffer.sampleRate,
    channels: buffer.numberOfChannels,
  };
}

export function generateWaveformData(
  buffer: AudioBuffer,
  samples: number = 200,
): number[] {
  const rawData = buffer.getChannelData(0);
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
  return filteredData.map((n) => (maxVal > 0 ? n / maxVal : 0));
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
