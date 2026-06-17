import { useCallback, useEffect, useState } from "react";

export function useWaveform() {
  const [waveformData, setWaveformData] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const generateWaveform = useCallback(async (file: File): Promise<number[]> => {
    setIsLoading(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const audioContext = new AudioContextClass();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      const rawData = audioBuffer.getChannelData(0);
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

      audioContext.close();
      setWaveformData(normalizedData);
      setIsLoading(false);
      return normalizedData;
    } catch (error) {
      console.error("Error generating waveform:", error);
      setIsLoading(false);
      return [];
    }
  }, []);

  const clearWaveform = useCallback(() => {
    setWaveformData([]);
  }, []);

  useEffect(() => {
    return () => {
      clearWaveform();
    };
  }, [clearWaveform]);

  return { waveformData, isLoading, generateWaveform, clearWaveform };
}
