"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type SpeakOptions = {
  onEnd?: () => void;
  rate?: number;
};

type UseSpeechSynthesisResult = {
  isSpeaking: boolean;
  speakText: (text: string, options?: SpeakOptions) => void;
  stopSpeaking: () => void;
};

export function useSpeechSynthesis(): UseSpeechSynthesisResult {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const stopSpeaking = useCallback(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    utteranceRef.current = null;
    setIsSpeaking(false);
  }, []);

  const speakText = useCallback(
    (text: string, options?: SpeakOptions) => {
      if (typeof window === "undefined" || !window.speechSynthesis) return;
      if (!text.trim()) return;

      stopSpeaking();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = options?.rate ?? 1;
      utterance.pitch = 1;
      utterance.volume = 1;

      utterance.onstart = () => {
        setIsSpeaking(true);
      };

      utterance.onend = () => {
        setIsSpeaking(false);
        options?.onEnd?.();
      };

      utterance.onerror = () => {
        setIsSpeaking(false);
        options?.onEnd?.();
      };

      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    },
    [stopSpeaking],
  );

  useEffect(() => {
    return () => {
      stopSpeaking();
    };
  }, [stopSpeaking]);

  return {
    isSpeaking,
    speakText,
    stopSpeaking,
  };
}

export default useSpeechSynthesis;
