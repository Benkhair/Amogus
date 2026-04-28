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
      <div className={`pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 w-[520px] h-[520px] rounded-full blur-3xl animate-glowPulse ${isImposter ? 'bg-red-600/25' : 'bg-indigo-500/25'}`} />
      <div className="w-full max-w-sm px-6 flex flex-col items-center gap-6 text-center relative">
        <div
          className={`w-full rounded-3xl p-8 border flex flex-col items-center gap-4 animate-popIn relative ${
            isImposter
              ? 'bg-gradient-to-b from-red-950/80 to-red-950/50 border-red-500/40'
              : 'bg-gradient-to-b from-indigo-950/80 to-indigo-950/50 border-indigo-500/40'
          }`}
          style={{
            boxShadow: isImposter
              ? '0 30px 70px -20px rgba(220,38,38,0.5), inset 0 1px 0 rgba(255,255,255,0.06)'
              : '0 30px 70px -20px rgba(99,102,241,0.5), inset 0 1px 0 rgba(255,255,255,0.06)',
          }}
        >
          <div className="text-7xl animate-bounceIn">{isImposter ? '🎭' : '🕵️'}</div>

          <div>
            <p className={`text-xs uppercase tracking-widest font-bold mb-1 ${isImposter ? 'text-red-400' : 'text-indigo-400'}`}>
              You are
            </p>
            <h2 className={`text-4xl font-black ${isImposter ? 'text-red-300' : 'text-white'}`}>
              {isImposter ? 'Sinungaling' : 'Normal na Tao'}
            </h2>
          </div>

          <div className={`w-full rounded-xl p-4 mt-1 ${isImposter ? 'bg-red-900/40 border border-red-700/50' : 'bg-indigo-900/40 border border-indigo-700/50'}`}>
            <p className="text-xs uppercase tracking-wider text-gray-400 mb-1">Your word</p>
            <p className={`text-2xl font-black ${isImposter ? 'text-red-200' : 'text-white'}`}>{word}</p>
          </div>

          {isImposter ? (
            <p className="text-red-300 text-xs text-center leading-relaxed">
              Blend in! Describe your word as if you know what the others are talking about.
            </p>
          ) : (
            <p className="text-indigo-300 text-xs text-center leading-relaxed">
              Give clues without being too obvious. Find the Sinungaling!
            </p>
          )}
        </div>

        {/* Progress bar showing time until game starts */}
        <div className="w-full max-w-xs animate-slideUp" style={{ animationDelay: '0.3s' }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-xs">Entering game...</span>
            <span className="text-white text-xs font-bold">{Math.round(progress)}%</span>
          </div>
          <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
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
