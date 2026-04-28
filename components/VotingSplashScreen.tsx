'use client';

import { useEffect, useState } from 'react';

interface VotingSplashScreenProps {
  onDone: () => void;
}

export default function VotingSplashScreen({ onDone }: VotingSplashScreenProps) {
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    if (countdown <= 0) {
      onDone();
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown, onDone]);

  return (
    <div className="cinematic-bg fixed inset-0 z-50 flex items-center justify-center animate-fadeIn overflow-hidden">
      <div className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 w-[520px] h-[520px] rounded-full bg-purple-600/25 blur-3xl animate-glowPulse" />

      <div className="flex flex-col items-center gap-6 text-center px-6 relative">
        <div className="text-8xl animate-bounceIn drop-shadow-[0_0_30px_rgba(168,85,247,0.55)]">🗳️</div>

        <div className="animate-slideUp">
          <p className="text-purple-300 text-xs uppercase tracking-[0.4em] font-bold mb-2">Round Over</p>
          <h1 className="text-5xl font-black text-white leading-tight tracking-tight">
            It&apos;s Voting<br />
            <span className="bg-gradient-to-b from-purple-300 to-fuchsia-400 bg-clip-text text-transparent">Time!</span>
          </h1>
        </div>

        <p className="text-gray-400 text-sm animate-slideUp" style={{ animationDelay: '0.1s' }}>
          Discuss and decide — who is the Sinungaling?
        </p>

        <div className="mt-2 relative">
          <div className="absolute inset-0 rounded-full bg-purple-500/30 blur-xl animate-glowPulse" />
          <div className="relative w-20 h-20 rounded-full border-2 border-purple-400/40 flex items-center justify-center bg-purple-950/40 backdrop-blur-md">
            <span className="text-4xl font-black text-purple-200 tabular-nums">{countdown}</span>
          </div>
        </div>

        <div className="w-48 h-1 bg-white/5 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-1000 ease-linear"
            style={{
              width: `${((5 - countdown) / 5) * 100}%`,
              background: 'linear-gradient(90deg, #a855f7, #d946ef)',
              boxShadow: '0 0 16px rgba(168,85,247,0.7)',
            }}
          />
        </div>
      </div>
    </div>
  );
}
