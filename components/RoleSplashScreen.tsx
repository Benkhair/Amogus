'use client';

import { useEffect, useState, useRef } from 'react';
import { useGame } from '@/context/GameContext';

const SPLASH_DURATION = 5000; // 5 seconds

interface RoleSplashScreenProps {
  onDone: () => void;
}

export default function RoleSplashScreen({ onDone }: RoleSplashScreenProps) {
  const { myPlayer } = useGame();
  const [progress, setProgress] = useState(0);
  const startTimeRef = useRef<number | null>(null);
  const hasCompletedRef = useRef(false);
  const onDoneRef = useRef(onDone);
  
  // Keep onDone reference current without triggering effect
  onDoneRef.current = onDone;

  const isImposter = myPlayer?.is_imposter ?? false;
  const word = myPlayer?.word ?? '???';
  const category = myPlayer?.category ?? 'Unknown';

  useEffect(() => {
    // Only set start time once on initial mount
    if (startTimeRef.current === null) {
      startTimeRef.current = Date.now();
    }
    
    const interval = setInterval(() => {
      const elapsed = Date.now() - (startTimeRef.current || Date.now());
      const pct = Math.min((elapsed / SPLASH_DURATION) * 100, 100);
      
      // Only update progress if it increased (never decrease)
      setProgress((prev) => Math.max(prev, pct));
      
      if (elapsed >= SPLASH_DURATION && !hasCompletedRef.current) {
        hasCompletedRef.current = true;
        clearInterval(interval);
        onDoneRef.current();
      }
    }, 50); // Update every 50ms for smooth animation
    
    return () => clearInterval(interval);
  }, []); // Empty deps - only run once on mount

  return (
    <div className="cinematic-bg fixed inset-0 z-50 flex items-center justify-center animate-fadeIn overflow-hidden">
      {/* Ambient role glow - centered and large */}
      <div className={`pointer-events-none absolute inset-0 flex items-center justify-center`}>
        <div className={`w-[700px] h-[700px] rounded-full blur-3xl animate-glowPulse ${isImposter ? 'bg-red-600/15' : 'bg-indigo-500/15'}`} />
      </div>

      {/* Main content container */}
      <div className="w-full h-full flex flex-col items-center justify-center px-4 relative">
        {/* Card */}
        <div
          className={`w-full max-w-md rounded-3xl p-8 border flex flex-col items-center gap-6 animate-popIn relative ${
            isImposter
              ? 'bg-gradient-to-b from-red-950/85 to-red-950/50 border-red-500/30'
              : 'bg-gradient-to-b from-indigo-950/85 to-indigo-950/50 border-indigo-500/30'
          }`}
          style={{
            boxShadow: isImposter
              ? '0 30px 80px -20px rgba(220,38,38,0.5), inset 0 1px 0 rgba(255,255,255,0.1)'
              : '0 30px 80px -20px rgba(99,102,241,0.5), inset 0 1px 0 rgba(255,255,255,0.1)',
          }}
        >
          {/* Role emoji */}
          <div className="text-7xl animate-bounceIn">{isImposter ? '🎭' : '🕵️'}</div>

          {/* Role title */}
          <div className="space-y-1.5 text-center">
            <p className={`text-[11px] uppercase tracking-[0.25em] font-bold ${isImposter ? 'text-red-400' : 'text-indigo-400'}`}>
              You are the
            </p>
            <h2 className={`text-4xl font-black tracking-tight ${isImposter ? 'text-red-100' : 'text-indigo-100'}`}>
              {isImposter ? 'Sinungaling' : 'Normal na Tao'}
            </h2>
          </div>

          {/* Word card */}
          <div className={`w-full rounded-2xl p-4 border-2 ${isImposter ? 'bg-red-900/40 border-red-600/40' : 'bg-indigo-900/40 border-indigo-600/40'}`}>
            <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-2 font-semibold">Category</p>
            <p className={`text-sm font-bold mb-3 ${isImposter ? 'text-red-300' : 'text-indigo-300'}`}>{category}</p>
            <div className="border-t border-gray-600/30 pt-3">
              <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-1.5 font-semibold">Your word</p>
              <p className={`text-3xl font-black tracking-tight ${isImposter ? 'text-red-100' : 'text-white'}`}>{word}</p>
            </div>
          </div>

          {/* Instructions */}
          <div className={`text-sm leading-relaxed ${isImposter ? 'text-red-300/80' : 'text-indigo-300/80'}`}>
            {isImposter ? (
              <p>Blend in! Describe your word as if you know what the others are talking about.</p>
            ) : (
              <p>Give clues without being too obvious. Find the Sinungaling!</p>
            )}
          </div>
        </div>

        {/* Progress bar - below card */}
        <div className="w-full max-w-md mt-8 animate-slideUp" style={{ animationDelay: '0.2s' }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-500 text-[10px] uppercase tracking-wider font-semibold">Entering game...</span>
            <span className="text-white text-[10px] font-bold tabular-nums">{Math.round(progress)}%</span>
          </div>
          <div className="h-2 bg-gray-800/60 rounded-full overflow-hidden border border-gray-700/40">
            <div
              className={`h-full rounded-full transition-all duration-75 ease-linear ${
                isImposter ? 'bg-gradient-to-r from-red-500 to-red-400' : 'bg-gradient-to-r from-indigo-500 to-indigo-400'
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
