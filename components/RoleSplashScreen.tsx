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
      {/* Ambient role glow */}
      <div className={`pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-3xl animate-glowPulse ${isImposter ? 'bg-red-600/20' : 'bg-indigo-500/20'}`} />
      <div className="w-full max-w-md px-4 flex flex-col items-center gap-5 text-center relative mx-auto">
        <div
          className={`w-full rounded-3xl p-6 sm:p-8 border flex flex-col items-center gap-3 animate-popIn relative ${
            isImposter
              ? 'bg-gradient-to-b from-red-950/90 to-red-950/60 border-red-500/40'
              : 'bg-gradient-to-b from-indigo-950/90 to-indigo-950/60 border-indigo-500/40'
          }`}
          style={{
            boxShadow: isImposter
              ? '0 25px 60px -15px rgba(220,38,38,0.4), inset 0 1px 0 rgba(255,255,255,0.08)'
              : '0 25px 60px -15px rgba(99,102,241,0.4), inset 0 1px 0 rgba(255,255,255,0.08)',
          }}
        >
          <div className="text-6xl animate-bounceIn">{isImposter ? '🎭' : '🕵️'}</div>

          <div className="space-y-0.5">
            <p className={`text-[10px] uppercase tracking-[0.2em] font-bold ${isImposter ? 'text-red-400' : 'text-indigo-400'}`}>
              You are
            </p>
            <h2 className={`text-3xl sm:text-4xl font-black ${isImposter ? 'text-red-200' : 'text-white'}`}>
              {isImposter ? 'Sinungaling' : 'Normal na Tao'}
            </h2>
          </div>

          <div className={`w-full rounded-xl p-3 ${isImposter ? 'bg-red-900/50 border border-red-700/50' : 'bg-indigo-900/50 border border-indigo-700/50'}`}>
            <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-0.5">Your word</p>
            <p className={`text-xl sm:text-2xl font-black ${isImposter ? 'text-red-100' : 'text-white'}`}>{word}</p>
          </div>

          {isImposter ? (
            <p className="text-red-300/90 text-xs text-center leading-relaxed max-w-[260px]">
              Blend in! Describe your word as if you know what the others are talking about.
            </p>
          ) : (
            <p className="text-indigo-300/90 text-xs text-center leading-relaxed max-w-[260px]">
              Give clues without being too obvious. Find the Sinungaling!
            </p>
          )}
        </div>

        {/* Progress bar showing time until game starts */}
        <div className="w-full max-w-xs mx-auto animate-slideUp" style={{ animationDelay: '0.3s' }}>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-gray-500 text-[10px] uppercase tracking-wider">Entering game...</span>
            <span className="text-white text-[10px] font-bold">{Math.round(progress)}%</span>
          </div>
          <div className="h-1.5 bg-gray-800/80 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-75 ease-linear ${
                isImposter ? 'bg-red-500' : 'bg-indigo-500'
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
