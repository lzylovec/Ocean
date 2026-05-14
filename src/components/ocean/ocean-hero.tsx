"use client";

import type { CSSProperties } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

type Bubble = {
  id: number;
  x: number;
  size: number;
  duration: number;
  delay: number;
  moveX: number;
};

type BubbleStyle = CSSProperties & {
  "--move-x": string;
};

function seededBetween(seed: number, min: number, max: number) {
  const value = Math.sin(seed) * 10000;
  return min + (value - Math.floor(value)) * (max - min);
}

function round(value: number, digits = 4) {
  return Number(value.toFixed(digits));
}

const bubbles: Bubble[] = Array.from({ length: 20 }, (_, index) => ({
  id: index,
  x: round(seededBetween(index + 1, 5, 95)),
  size: round(seededBetween(index + 21, 10, 30)),
  duration: round(seededBetween(index + 41, 8, 15)),
  delay: round(seededBetween(index + 61, 0, 5)),
  moveX: round(seededBetween(index + 81, -30, 30)),
}));

function getBubbleStyle(bubble: Bubble): BubbleStyle {
  return {
    left: `${bubble.x}%`,
    width: `${bubble.size}px`,
    height: `${bubble.size}px`,
    animationName: "ocean-float-bubble",
    animationDuration: `${bubble.duration}s`,
    animationTimingFunction: "linear",
    animationDelay: `${bubble.delay}s`,
    animationIterationCount: "infinite",
    "--move-x": `${bubble.moveX}px`,
  };
}

export function OceanHero({ className }: { className?: string }) {
  return (
    <div className={cn("relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#e0f2fe] to-[#bae6fd] h-[60vh] min-h-[500px] border border-blue-100/50 shadow-[0_8px_32px_rgb(0,100,255,0.08)]", className)}>
      <style dangerouslySetInnerHTML={{
        __html: `
        @keyframes ocean-bg-pan {
          0% { background-position: 0px 0px; }
          100% { background-position: 100px 100px; }
        }
        @keyframes ocean-aurora-1 {
          0% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(100px, -50px) scale(1.2); }
          66% { transform: translate(-50px, 50px) scale(0.8); }
          100% { transform: translate(0, 0) scale(1); }
        }
        @keyframes ocean-aurora-2 {
          0% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(-100px, 50px) scale(1.5); }
          66% { transform: translate(50px, -50px) scale(0.9); }
          100% { transform: translate(0, 0) scale(1); }
        }
        @keyframes ocean-wave-back {
          0% { transform: translateX(0%); }
          100% { transform: translateX(-50%); }
        }
        @keyframes ocean-wave-front {
          0% { transform: translateX(-50%); }
          100% { transform: translateX(0%); }
        }
        @keyframes ocean-float-bubble {
          0% { transform: translateY(0vh) translateX(0px) scale(0.8); opacity: 0; }
          20% { opacity: 0.6; }
          80% { opacity: 0.6; }
          100% { transform: translateY(-80vh) translateX(var(--move-x)) scale(1.2); opacity: 0; }
        }
        @keyframes ocean-bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(6px); }
        }
        @keyframes ocean-text-shimmer {
          0% { background-position: 0px 0px, 0% 0%; }
          50% { background-position: 0px 0px, 100% 100%; }
          100% { background-position: 0px 0px, 0% 0%; }
        }
      `}} />

      {/* Animated Background Grid Pattern */}
      <div
        className="absolute inset-0 opacity-20 pointer-events-none z-0"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)`,
          backgroundSize: '100px 100px',
          animation: 'ocean-bg-pan 20s linear infinite'
        }}
      />

      {/* Subtle Fluid/Aurora effect behind text for "Liquid Glass" refraction */}
      <div className="absolute inset-0 z-0 opacity-40 pointer-events-none overflow-hidden mix-blend-overlay">
        <div
          className="absolute top-1/2 left-1/4 w-[500px] h-[500px] bg-blue-400/50 rounded-full blur-[100px]"
          style={{ animation: 'ocean-aurora-1 15s ease-in-out infinite' }}
        />
        <div
          className="absolute top-1/2 right-1/4 w-[400px] h-[400px] bg-cyan-300/40 rounded-full blur-[100px]"
          style={{ animation: 'ocean-aurora-2 18s ease-in-out infinite' }}
        />
      </div>

      {/* Floating Bubbles */}
      <div className="absolute inset-0 pointer-events-none z-[5] overflow-hidden">
        {bubbles.map((bubble) => (
          <div
            key={bubble.id}
            className="absolute bottom-[-10%] rounded-full border border-white/40 bg-white/10 backdrop-blur-[2px]"
            style={getBubbleStyle(bubble)}
          />
        ))}
      </div>

      {/* Dynamic Wave (SVG Based - Matching screenshot but animated) */}
      <div className="absolute inset-x-0 bottom-0 pointer-events-none z-0 h-[200px] overflow-hidden">
        {/* Back wave */}
        <div
          className="absolute bottom-0 w-[200%] h-full flex"
          style={{ animation: 'ocean-wave-back 25s linear infinite' }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 320" className="w-1/2 h-full object-cover relative -bottom-1 drop-shadow-md" preserveAspectRatio="none">
            <path fill="#7dd3fc" fillOpacity="0.4" d="M 0 160 C 240 220, 480 220, 720 160 C 960 100, 1200 100, 1440 160 L 1440 320 L 0 320 Z" />
          </svg>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 320" className="w-1/2 h-full object-cover relative -bottom-1 drop-shadow-md" preserveAspectRatio="none">
            <path fill="#7dd3fc" fillOpacity="0.4" d="M 0 160 C 240 220, 480 220, 720 160 C 960 100, 1200 100, 1440 160 L 1440 320 L 0 320 Z" />
          </svg>
        </div>

        {/* Front wave */}
        <div
          className="absolute bottom-0 w-[200%] h-full flex"
          style={{ animation: 'ocean-wave-front 20s linear infinite' }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 320" className="w-1/2 h-full object-cover relative -bottom-1 drop-shadow-md" preserveAspectRatio="none">
            <path fill="#38bdf8" fillOpacity="0.5" d="M 0 192 C 240 132, 480 132, 720 192 C 960 252, 1200 252, 1440 192 L 1440 320 L 0 320 Z" />
          </svg>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 320" className="w-1/2 h-full object-cover relative -bottom-1 drop-shadow-md" preserveAspectRatio="none">
            <path fill="#38bdf8" fillOpacity="0.5" d="M 0 192 C 240 132, 480 132, 720 192 C 960 252, 1200 252, 1440 192 L 1440 320 L 0 320 Z" />
          </svg>
        </div>
      </div>

      {/* Thematic Visual Element (Typography) */}
      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center pointer-events-none select-none pb-12">

        {/* Transparent text with white outline and inner grid (Matching screenshot) */}
        <div className="relative animate-in fade-in slide-in-from-bottom-8 duration-1000 fill-mode-both">
          <h2
            className="text-[14vw] md:text-[8rem] lg:text-[12rem] font-bold tracking-[0.05em] uppercase text-transparent bg-clip-text"
            style={{
              fontFamily: 'Arial, Helvetica, sans-serif',
              WebkitTextStroke: "2px rgba(255,255,255,0.9)",
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='20' height='20' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h20v20H0z' fill='none'/%3E%3Cpath d='M0 19h20M19 0v20' stroke='rgba(255,255,255,0.15)' stroke-width='1'/%3E%3C/svg%3E"), linear-gradient(135deg, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0.05) 20%, rgba(125,211,252,0.4) 40%, rgba(56,189,248,0.5) 50%, rgba(255,255,255,0.6) 70%, rgba(255,255,255,0.05) 100%)`,
              backgroundSize: '20px 20px, 200% 200%',
              animation: 'ocean-text-shimmer 8s ease-in-out infinite',
              filter: "drop-shadow(0 12px 24px rgba(2,132,199,0.2))"
            }}
          >
            Ocean
          </h2>
        </div>

        <div
          className="mt-4 md:mt-8 flex items-center gap-3 px-6 py-2.5 rounded-full bg-white/20 backdrop-blur-md border border-white/60 shadow-[0_4px_24px_rgba(0,100,255,0.1)] animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-300 fill-mode-both"
        >
          <div className="w-2 h-2 rounded-full bg-blue-500/80" />
          <span className="text-blue-900/80 font-medium tracking-[0.2em] text-sm pr-[0.2em]">
            水下垃圾识别系统
          </span>
        </div>
      </div>

      {/* Scroll Down Indicator */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2 text-blue-500/60">
        <span className="text-[10px] font-mono uppercase tracking-widest font-semibold">Scroll to explore</span>
        <div
          style={{ animation: 'ocean-bounce 2s ease-in-out infinite' }}
        >
          <ChevronDown className="w-4 h-4 opacity-70" />
        </div>
      </div >
    </div >
  );
}
