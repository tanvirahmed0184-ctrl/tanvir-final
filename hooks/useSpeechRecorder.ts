"use client";

import { useCallback, useRef, useState } from "react";

type SpeechRecognitionAlt = {
  transcript: string;
  confidence: number;
};

type SpeechRecognitionResultLike = {
  isFinal: boolean;
  0: SpeechRecognitionAlt;
};

type SpeechRecognitionEventLike = Event & {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
};

type SpeechRecognitionLike = EventTarget & {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: Event & { error?: string }) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

type BrowserWithSpeech = Window & {
  SpeechRecognition?: SpeechRecognitionCtor;
  webkitSpeechRecognition?: SpeechRecognitionCtor;
};

type UseSpeechRecorderResult = {
  isRecording: boolean;
  isTranscribing: boolean;
  transcript: string;
  micLevel: number;
  inputDeviceLabel: string | null;
  error: string | null;
  startRecording: () => Promise<void>;
  stopAndTranscribe: () => Promise<{
    transcript: string;
    audioBlob: Blob | null;
  }>;
  abortRecording: () => Promise<void>;
};

const FILLER_WORDS = new Set(["um", "uh", "ah"]);

export function useSpeechRecorder(): UseSpeechRecorderResult {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [micLevel, setMicLevel] = useState(0);
  const [inputDeviceLabel, setInputDeviceLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const wordsRef = useRef<Array<{ word: string; time: number }>>([]);
  const lastWordTimeRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const levelRafRef = useRef<number | null>(null);

  const stopMediaTracks = useCallback(() => {
    if (!mediaStreamRef.current) return;
    mediaStreamRef.current.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;
  }, []);

  const stopLevelMeter = useCallback(() => {
    if (levelRafRef.current) {
      cancelAnimationFrame(levelRafRef.current);
      levelRafRef.current = null;
    }
    try {
      sourceNodeRef.current?.disconnect();
    } catch {
      // Ignore.
    }
    sourceNodeRef.current = null;
    analyserRef.current = null;
    const ctx = audioContextRef.current;
    audioContextRef.current = null;
    if (ctx) {
      void ctx.close().catch(() => undefined);
    }
    setMicLevel(0);
  }, []);

  const startLevelMeter = useCallback((stream: MediaStream) => {
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;

      const audioCtx = new Ctx();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.85;
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      audioContextRef.current = audioCtx;
      analyserRef.current = analyser;
      sourceNodeRef.current = source;

      const samples = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        const node = analyserRef.current;
        if (!node) return;
        node.getByteTimeDomainData(samples);
        let sum = 0;
        for (let i = 0; i < samples.length; i += 1) {
          const centered = (samples[i] - 128) / 128;
          sum += centered * centered;
        }
        const rms = Math.sqrt(sum / samples.length);
        const nextLevel = Math.max(0, Math.min(1, rms * 6));
        setMicLevel(nextLevel);
        levelRafRef.current = requestAnimationFrame(tick);
      };

      const startTickLoop = () => {
        if (levelRafRef.current) cancelAnimationFrame(levelRafRef.current);
        levelRafRef.current = requestAnimationFrame(tick);
      };

      if (audioCtx.state === "suspended") {
        void audioCtx.resume().finally(startTickLoop);
      } else {
        startTickLoop();
      }
    } catch {
      // If meter setup fails, continue recording without level meter.
      setMicLevel(0);
    }
  }, []);

  const buildTranscript = useCallback(() => {
    const words = wordsRef.current;
    if (!words.length) return "";

    const out: string[] = [];
    let prevTime: number | null = null;

    for (const entry of words) {
      if (prevTime !== null) {
        const gap = entry.time - prevTime;
        if (gap > 2000) {
          out.push(`[pause: ${(gap / 1000).toFixed(1)}s]`);
        }
      }

      out.push(entry.word);
      prevTime = entry.time;
    }

    return out.join(" ").replace(/\s+/g, " ").trim();
  }, []);

  const resetState = useCallback(() => {
    audioChunksRef.current = [];
    wordsRef.current = [];
    lastWordTimeRef.current = null;
    setTranscript("");
    setError(null);
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const w = window as BrowserWithSpeech;
      const RecognitionCtor = w.SpeechRecognition || w.webkitSpeechRecognition;

      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("MediaRecorder is not supported in this browser.");
      }

      if (!RecognitionCtor) {
        throw new Error("SpeechRecognition is not supported in this browser.");
      }

      resetState();
      stopLevelMeter();
      setIsTranscribing(true);

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }
      mediaStreamRef.current = stream;
      startLevelMeter(stream);
      const inputTrack = stream.getAudioTracks()[0] || null;
      setInputDeviceLabel(inputTrack?.label || null);

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e: BlobEvent) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      // Emit periodic chunks so silent/broken captures are easier to detect by size.
      recorder.start(250);

      const recognition = new RecognitionCtor();
      recognition.lang = "en-US";
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onresult = (event) => {
        const now = performance.now();

        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const result = event.results[i];
          const raw = result?.[0]?.transcript || "";
          if (!raw.trim()) continue;

          const normalized = raw
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9\s']/gi, " ")
            .replace(/\s+/g, " ")
            .trim();

          if (!normalized) continue;

          const tokens = normalized.split(" ").filter(Boolean);
          for (const token of tokens) {
            // Keep filler words explicitly for speaking quality evaluation.
            if (!FILLER_WORDS.has(token) && token.length === 1) {
              continue;
            }

            const tokenTime =
              lastWordTimeRef.current === null
                ? now
                : Math.max(now, lastWordTimeRef.current + 1);

            wordsRef.current.push({ word: token, time: tokenTime });
            lastWordTimeRef.current = tokenTime;
          }
        }

        setTranscript(buildTranscript());
      };

      recognition.onerror = (e) => {
        const err = (e.error || "").toLowerCase();
        // Browser WebSpeech "no-speech" is noisy and often false-negative.
        // We rely on recorded audio + server STT as source of truth.
        if (err === "no-speech" || err === "aborted") {
          return;
        }
        const message = err
          ? `Speech recognition error: ${err}`
          : "Speech recognition error.";
        setError(message);
      };

      recognition.onend = () => {
        // Avoid restarting automatically; explicit controls are cleaner for test flow.
      };

      recognitionRef.current = recognition;
      recognition.start();

      setIsRecording(true);
    } catch (err) {
      stopMediaTracks();
      stopLevelMeter();
      setIsRecording(false);
      setIsTranscribing(false);
      setInputDeviceLabel(null);
      setError(
        err instanceof Error ? err.message : "Failed to start recording",
      );
      throw err;
    }
  }, [
    buildTranscript,
    resetState,
    startLevelMeter,
    stopLevelMeter,
    stopMediaTracks,
  ]);

  const stopAndTranscribe = useCallback(async () => {
    const recorder = mediaRecorderRef.current;
    const recognition = recognitionRef.current;

    if (!recorder) {
      return { transcript: buildTranscript(), audioBlob: null };
    }

    return await new Promise<{ transcript: string; audioBlob: Blob | null }>(
      (resolve) => {
        const finalize = () => {
          const audioBlob =
            audioChunksRef.current.length > 0
              ? new Blob(audioChunksRef.current, { type: "audio/webm" })
              : null;

          const finalTranscript = buildTranscript();
          setTranscript(finalTranscript);
          setIsRecording(false);
          setIsTranscribing(false);
          stopMediaTracks();
          stopLevelMeter();
          setInputDeviceLabel(null);

          mediaRecorderRef.current = null;
          recognitionRef.current = null;

          resolve({ transcript: finalTranscript, audioBlob });
        };

        try {
          if (recognition) {
            recognition.stop();
          }
        } catch {
          // Ignore speech recognition stop errors.
        }

        try {
          recorder.onstop = () => finalize();
          recorder.stop();
        } catch {
          finalize();
        }
      },
    );
  }, [buildTranscript, stopLevelMeter, stopMediaTracks]);

  const abortRecording = useCallback(async () => {
    const recorder = mediaRecorderRef.current;
    const recognition = recognitionRef.current;

    try {
      if (recognition) {
        recognition.abort();
      }
    } catch {
      // Ignore speech recognition abort errors.
    }

    if (!recorder) {
      setIsRecording(false);
      setIsTranscribing(false);
      stopMediaTracks();
      stopLevelMeter();
      setInputDeviceLabel(null);
      recognitionRef.current = null;
      setTranscript("");
      return;
    }

    await new Promise<void>((resolve) => {
      const finalize = () => {
        setIsRecording(false);
        setIsTranscribing(false);
        stopMediaTracks();
        stopLevelMeter();
        setInputDeviceLabel(null);
        mediaRecorderRef.current = null;
        recognitionRef.current = null;
        audioChunksRef.current = [];
        wordsRef.current = [];
        lastWordTimeRef.current = null;
        setTranscript("");
        resolve();
      };

      try {
        recorder.onstop = () => finalize();
        recorder.stop();
      } catch {
        finalize();
      }
    });
  }, [stopLevelMeter, stopMediaTracks]);

  return {
    isRecording,
    isTranscribing,
    transcript,
    micLevel,
    inputDeviceLabel,
    error,
    startRecording,
    stopAndTranscribe,
    abortRecording,
  };
}

export default useSpeechRecorder;
