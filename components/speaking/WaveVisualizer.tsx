"use client";

import { useEffect, useRef } from "react";

type WaveVisualizerProps = {
  isRecording: boolean;
  level?: number;
  className?: string;
  width?: number;
  height?: number;
};

export default function WaveVisualizer({
  isRecording,
  level = 0,
  className,
  width = 640,
  height = 120,
}: WaveVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    const centerY = height / 2;
    const barCount = 60;
    const barGap = width / barCount;

    const draw = (t: number) => {
      ctx.clearRect(0, 0, width, height);

      ctx.fillStyle = "rgba(108, 63, 197, 0.08)";
      ctx.fillRect(0, 0, width, height);

      if (!isRecording) {
        ctx.strokeStyle = "rgba(14, 165, 160, 0.7)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, centerY);
        ctx.lineTo(width, centerY);
        ctx.stroke();

        rafRef.current = requestAnimationFrame(draw);
        return;
      }

      const levelBoost = 0.35 + Math.min(1, Math.max(0, level)) * 1.8;

      for (let i = 0; i < barCount; i += 1) {
        const x = i * barGap + barGap * 0.2;
        const phase = t * 0.006 + i * 0.45;
        const amp = Math.abs(
          Math.sin(phase) * 0.9 + Math.sin(phase * 0.35) * 0.4,
        );
        const barHeight = 6 + amp * (height * 0.26) + levelBoost * (height * 0.24);

        const gradient = ctx.createLinearGradient(
          0,
          centerY - barHeight / 2,
          0,
          centerY + barHeight / 2,
        );
        gradient.addColorStop(0, "#6C3FC5");
        gradient.addColorStop(1, "#0EA5A0");
        ctx.fillStyle = gradient;

        ctx.fillRect(x, centerY - barHeight / 2, barGap * 0.6, barHeight);
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [height, isRecording, level, width]);

  return (
    <canvas
      ref={canvasRef}
      className={[
        "w-full rounded-2xl border border-brand-purple/20 bg-white shadow-sm",
        className || "",
      ].join(" ")}
      aria-label="Audio wave visualizer"
    />
  );
}
