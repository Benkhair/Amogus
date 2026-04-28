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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0a0a14]">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-[#0a0a14] to-gray-900" />
      
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="w-[600px] h-[600px] rounded-full bg-purple-600/20 blur-3xl animate-glowPulse" />
      </div>

      {/* Main content - perfectly centered */}
      <div className="relative z-10 flex flex-col items-center justify-center px-4">
        {/* Icon */}
        <div className="text-7xl mb-6 animate-bounceIn drop-shadow-[0_0_40px_rgba(168,85,247,0.6)]">
          🗳️
        </div>

        {/* Title */}
        <div className="text-center mb-6 animate-slideUp">
          <p className="text-purple-400 text-xs uppercase tracking-[0.2em] font-bold mb-2">
            Round Over
          </p>
          <h1 className="text-4xl sm:text-5xl font-black text-white leading-tight tracking-tight mb-1">
            It&apos;s Voting
          </h1>
          <h2 className="text-4xl sm:text-5xl font-black bg-gradient-to-b from-purple-300 to-fuchsia-400 bg-clip-text text-transparent">
            Time!
          </h2>
        </div>

        {/* Description */}
        <p className="text-gray-400 text-sm mb-8 animate-slideUp max-w-xs text-center" style={{ animationDelay: '0.1s' }}>
          Discuss and decide — who is the Sinungaling?
        </p>

        {/* Countdown */}
        <div className="relative mb-6 animate-slideUp" style={{ animationDelay: '0.2s' }}>
          <div className="absolute inset-0 rounded-full bg-purple-500/30 blur-xl animate-glowPulse" />
          <div className="relative w-20 h-20 rounded-full border-2 border-purple-500/50 flex items-center justify-center bg-purple-950/60 backdrop-blur-sm">
            <span className="text-4xl font-black text-purple-200 tabular-nums">{countdown}</span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-48 animate-slideUp" style={{ animationDelay: '0.3s' }}>
          <div className="h-1.5 bg-gray-800/80 rounded-full overflow-hidden border border-gray-700/50">
            <div
              className="h-full rounded-full transition-all duration-1000 ease-linear"
              style={{
                width: `${((5 - countdown) / 5) * 100}%`,
                background: 'linear-gradient(90deg, #a855f7, #d946ef)',
                boxShadow: '0 0 15px rgba(168,85,247,0.6)',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
