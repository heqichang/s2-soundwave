import type {
  AudioFormat,
  BitDepth,
  ChannelCount,
  ExportOptions,
  SampleRate,
} from "@/types/audio";
import type { PeakData, FadeConfig, AmplifyConfig, CrossfadeConfig } from "@/types/editor";

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

function dbToLinear(db: number): number {
  return Math.pow(10, db / 20);
}

function linearToDb(linear: number): number {
  if (linear <= 0) return -Infinity;
  return 20 * Math.log10(linear);
}

function getFadeMultiplier(
  progress: number,
  curve: FadeConfig["fadeInCurve"] | FadeConfig["fadeOutCurve"],
  isFadeIn: boolean,
): number {
  const p = Math.max(0, Math.min(1, progress));
  switch (curve) {
    case "linear":
      return isFadeIn ? p : 1 - p;
    case "logarithmic":
      return isFadeIn
        ? Math.pow(p, 0.5)
        : 1 - Math.pow(p, 0.5);
    case "exponential":
      return isFadeIn
        ? p * p
        : 1 - p * p;
    case "sine":
      return isFadeIn
        ? Math.sin(p * Math.PI / 2)
        : Math.cos(p * Math.PI / 2);
    default:
      return isFadeIn ? p : 1 - p;
  }
}

export function applySilence(
  audioBuffer: AudioBuffer,
  startSample: number,
  endSample: number,
): AudioBuffer {
  const result = cloneAudioBuffer(audioBuffer);
  const clippedEnd = Math.min(endSample, result.length);
  const clippedStart = Math.max(0, startSample);
  for (let ch = 0; ch < result.numberOfChannels; ch++) {
    const data = result.getChannelData(ch);
    data.fill(0, clippedStart, clippedEnd);
  }
  return result;
}

export function applyReverse(
  audioBuffer: AudioBuffer,
  startSample: number,
  endSample: number,
): AudioBuffer {
  const result = cloneAudioBuffer(audioBuffer);
  const clippedEnd = Math.min(endSample, result.length);
  const clippedStart = Math.max(0, startSample);
  const length = clippedEnd - clippedStart;
  for (let ch = 0; ch < result.numberOfChannels; ch++) {
    const data = result.getChannelData(ch);
    const segment = data.slice(clippedStart, clippedEnd);
    for (let i = 0; i < length; i++) {
      data[clippedStart + i] = segment[length - 1 - i];
    }
  }
  return result;
}

export function applyInvertPhase(
  audioBuffer: AudioBuffer,
  startSample: number,
  endSample: number,
): AudioBuffer {
  const result = cloneAudioBuffer(audioBuffer);
  const clippedEnd = Math.min(endSample, result.length);
  const clippedStart = Math.max(0, startSample);
  for (let ch = 0; ch < result.numberOfChannels; ch++) {
    const data = result.getChannelData(ch);
    for (let i = clippedStart; i < clippedEnd; i++) {
      data[i] = -data[i];
    }
  }
  return result;
}

export function applyNormalize(
  audioBuffer: AudioBuffer,
  targetDb: number = 0,
): AudioBuffer {
  const result = cloneAudioBuffer(audioBuffer);
  let maxSample = 0;

  for (let ch = 0; ch < result.numberOfChannels; ch++) {
    const data = result.getChannelData(ch);
    for (let i = 0; i < data.length; i++) {
      const abs = Math.abs(data[i]);
      if (abs > maxSample) maxSample = abs;
    }
  }

  if (maxSample <= 0) return result;

  const targetLinear = dbToLinear(targetDb);
  const gain = targetLinear / maxSample;

  for (let ch = 0; ch < result.numberOfChannels; ch++) {
    const data = result.getChannelData(ch);
    for (let i = 0; i < data.length; i++) {
      data[i] = Math.max(-1, Math.min(1, data[i] * gain));
    }
  }
  return result;
}

export function applyAmplify(
  audioBuffer: AudioBuffer,
  startSample: number,
  endSample: number,
  config: AmplifyConfig,
): AudioBuffer {
  const result = cloneAudioBuffer(audioBuffer);
  const gain = dbToLinear(config.gainDb);
  const clippedEnd = Math.min(endSample, result.length);
  const clippedStart = Math.max(0, startSample);

  for (let ch = 0; ch < result.numberOfChannels; ch++) {
    const data = result.getChannelData(ch);
    for (let i = clippedStart; i < clippedEnd; i++) {
      const amplified = data[i] * gain;
      data[i] = config.allowClipping
        ? amplified
        : Math.max(-1, Math.min(1, amplified));
    }
  }
  return result;
}

export function applyFadeInAdvanced(
  audioBuffer: AudioBuffer,
  startSample: number,
  fadeSamples: number,
  curve: FadeConfig["fadeInCurve"] = "linear",
): AudioBuffer {
  const result = cloneAudioBuffer(audioBuffer);
  const actualFade = Math.max(1, Math.min(fadeSamples, result.length - startSample));
  for (let ch = 0; ch < result.numberOfChannels; ch++) {
    const data = result.getChannelData(ch);
    for (let i = 0; i < actualFade; i++) {
      const progress = i / actualFade;
      const multiplier = getFadeMultiplier(progress, curve, true);
      data[startSample + i] *= multiplier;
    }
  }
  return result;
}

export function applyFadeOutAdvanced(
  audioBuffer: AudioBuffer,
  endSample: number,
  fadeSamples: number,
  curve: FadeConfig["fadeOutCurve"] = "linear",
): AudioBuffer {
  const result = cloneAudioBuffer(audioBuffer);
  const startFade = Math.max(0, endSample - fadeSamples);
  const actualFade = Math.max(1, endSample - startFade);
  for (let ch = 0; ch < result.numberOfChannels; ch++) {
    const data = result.getChannelData(ch);
    for (let i = 0; i < actualFade; i++) {
      const progress = i / actualFade;
      const multiplier = getFadeMultiplier(progress, curve, false);
      data[startFade + i] *= multiplier;
    }
  }
  return result;
}

export function applyCrossfade(
  bufferA: AudioBuffer,
  bufferB: AudioBuffer,
  config: CrossfadeConfig,
): AudioBuffer {
  const ctx = getAudioContext();
  try {
    const sampleRate = bufferA.sampleRate;
    const crossfadeSamples = Math.floor(config.duration * sampleRate);
    const overlap = Math.min(crossfadeSamples, bufferA.length, bufferB.length);
    const newLength = bufferA.length + bufferB.length - overlap;
    const numChannels = Math.max(bufferA.numberOfChannels, bufferB.numberOfChannels);

    const newBuffer = ctx.createBuffer(numChannels, newLength, sampleRate);

    for (let ch = 0; ch < numChannels; ch++) {
      const dataA = bufferA.numberOfChannels > ch
        ? bufferA.getChannelData(ch)
        : bufferA.getChannelData(0);
      const dataB = bufferB.numberOfChannels > ch
        ? bufferB.getChannelData(ch)
        : bufferB.getChannelData(0);
      const newData = newBuffer.getChannelData(ch);

      const aEnd = bufferA.length - overlap;
      for (let i = 0; i < aEnd; i++) {
        newData[i] = dataA[i];
      }

      for (let i = 0; i < overlap; i++) {
        const progress = i / overlap;
        let fadeOutMult: number;
        let fadeInMult: number;

        switch (config.curve) {
          case "logarithmic":
            fadeOutMult = 1 - Math.pow(progress, 0.5);
            fadeInMult = Math.pow(progress, 0.5);
            break;
          case "exponential":
            fadeOutMult = 1 - progress * progress;
            fadeInMult = progress * progress;
            break;
          case "linear":
          default:
            fadeOutMult = 1 - progress;
            fadeInMult = progress;
        }

        newData[aEnd + i] =
          dataA[aEnd + i] * fadeOutMult + dataB[i] * fadeInMult;
      }

      const bStart = overlap;
      for (let i = bStart; i < bufferB.length; i++) {
        newData[aEnd + i] = dataB[i];
      }
    }

    return newBuffer;
  } finally {
    ctx.close().catch(() => {});
  }
}

export function analyzePeakData(
  audioBuffer: AudioBuffer,
  startSample: number = 0,
  endSample?: number,
): PeakData {
  const clippedEnd = endSample !== undefined
    ? Math.min(endSample, audioBuffer.length)
    : audioBuffer.length;
  const clippedStart = Math.max(0, startSample);

  let maxPeak = 0;
  let maxPeakIndex = clippedStart;
  let sumSquares = 0;
  let sum = 0;
  let sampleCount = 0;

  for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
    const data = audioBuffer.getChannelData(ch);
    for (let i = clippedStart; i < clippedEnd; i++) {
      const sample = data[i];
      const absSample = Math.abs(sample);
      if (absSample > maxPeak) {
        maxPeak = absSample;
        maxPeakIndex = i;
      }
      sumSquares += sample * sample;
      sum += sample;
      sampleCount++;
    }
  }

  const rmsLevel = sampleCount > 0
    ? Math.sqrt(sumSquares / sampleCount)
    : 0;
  const dcOffset = sampleCount > 0
    ? sum / sampleCount
    : 0;
  const maxPeakTime = maxPeakIndex / audioBuffer.sampleRate;

  return {
    maxPeak,
    maxPeakTime,
    rmsLevel,
    dcOffset,
  };
}

export function generateSpectrumData(
  audioBuffer: AudioBuffer,
  fftSize: number = 2048,
): { frequencies: number[]; magnitudes: number[]; maxMagnitudeDb: number } {
  const rawData = audioBuffer.getChannelData(0);
  const sampleRate = audioBuffer.sampleRate;

  const startIdx = 0;
  const segmentLength = Math.min(fftSize, rawData.length - startIdx);
  if (segmentLength < 2) {
    return { frequencies: [], magnitudes: [], maxMagnitudeDb: -Infinity };
  }

  const segment = new Float32Array(fftSize);
  for (let i = 0; i < segmentLength; i++) {
    const window = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (segmentLength - 1)));
    segment[i] = rawData[startIdx + i] * window;
  }

  const frequencies: number[] = [];
  const magnitudes: number[] = [];
  let maxMag = 0;

  const numBins = Math.floor(fftSize / 2);
  for (let k = 0; k < numBins; k++) {
    let re = 0;
    let im = 0;
    for (let n = 0; n < fftSize; n++) {
      const angle = (-2 * Math.PI * k * n) / fftSize;
      re += segment[n] * Math.cos(angle);
      im += segment[n] * Math.sin(angle);
    }
    const magnitude = Math.sqrt(re * re + im * im);
    magnitudes.push(magnitude);
    frequencies.push((k * sampleRate) / fftSize);
    if (magnitude > maxMag) maxMag = magnitude;
  }

  const maxMagnitudeDb = linearToDb(maxMag);
  return { frequencies, magnitudes, maxMagnitudeDb };
}

export function computeRmsLevels(
  audioBuffer: AudioBuffer,
  windowSize: number = 1024,
): { time: number; rmsDb: number; peakDb: number }[] {
  const data = audioBuffer.getChannelData(0);
  const sampleRate = audioBuffer.sampleRate;
  const results: { time: number; rmsDb: number; peakDb: number }[] = [];

  for (let i = 0; i < data.length; i += windowSize) {
    const end = Math.min(i + windowSize, data.length);
    let sumSq = 0;
    let peak = 0;
    for (let j = i; j < end; j++) {
      const s = data[j];
      sumSq += s * s;
      const abs = Math.abs(s);
      if (abs > peak) peak = abs;
    }
    const count = end - i;
    const rms = Math.sqrt(sumSq / count);
    results.push({
      time: i / sampleRate,
      rmsDb: linearToDb(rms),
      peakDb: linearToDb(peak),
    });
  }

  return results;
}

export function linearToDbValue(linear: number): number {
  return linearToDb(linear);
}

export function dbToLinearValue(db: number): number {
  return dbToLinear(db);
}
