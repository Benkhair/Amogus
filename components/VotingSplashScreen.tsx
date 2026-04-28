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
      {/* Ambient glow - centered */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="w-[700px] h-[700px] rounded-full bg-purple-600/15 blur-3xl animate-glowPulse" />
      </div>

      {/* Main content */}
      <div className="w-full h-full flex flex-col items-center justify-center px-4 relative">
        {/* Voting icon */}
        <div className="text-8xl animate-bounceIn mb-6 drop-shadow-[0_0_40px_rgba(168,85,247,0.6)]">🗳️</div>

        {/* Title section */}
        <div className="text-center mb-8 animate-slideUp">
          <p className="text-purple-400 text-[11px] uppercase tracking-[0.3em] font-bold mb-3">Round Over</p>
          <h1 className="text-5xl sm:text-6xl font-black text-white leading-tight tracking-tight mb-2">
            It&apos;s Voting
          </h1>
          <h2 className="text-5xl sm:text-6xl font-black bg-gradient-to-b from-purple-300 to-fuchsia-400 bg-clip-text text-transparent">
            Time!
          </h2>
        </div>

        {/* Description */}
        <p className="text-gray-300 text-sm mb-10 animate-slideUp max-w-sm" style={{ animationDelay: '0.1s' }}>
          Discuss and decide — who is the Sinungaling?
        </p>

        {/* Countdown circle */}
        <div className="relative mb-8 animate-slideUp" style={{ animationDelay: '0.2s' }}>
          <div className="absolute inset-0 rounded-full bg-purple-500/20 blur-2xl animate-glowPulse" />
          <div className="relative w-24 h-24 rounded-full border-3 border-purple-500/40 flex items-center justify-center bg-purple-950/50 backdrop-blur-sm">
            <span className="text-5xl font-black text-purple-200 tabular-nums">{countdown}</span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full max-w-xs animate-slideUp" style={{ animationDelay: '0.3s' }}>
          <div className="h-2 bg-gray-800/60 rounded-full overflow-hidden border border-gray-700/40">
            <div
              className="h-full rounded-full transition-all duration-1000 ease-linear"
              style={{
                width: `${((5 - countdown) / 5) * 100}%`,
                background: 'linear-gradient(90deg, #a855f7, #d946ef)',
                boxShadow: '0 0 20px rgba(168,85,247,0.8)',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
