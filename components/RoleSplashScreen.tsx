'use client';

import { useEffect, useState } from 'react';
import { useGame } from '@/context/GameContext';
import { Eye, EyeOff } from 'lucide-react';

interface RoleSplashScreenProps {
  onDone: () => void;
}

export default function RoleSplashScreen({ onDone }: RoleSplashScreenProps) {
  const { myPlayer } = useGame();
  const [progress, setProgress] = useState(0);
  const [blurred, setBlurred] = useState(true);

  const isImposter = myPlayer?.is_imposter ?? false;
  const roleText = isImposter ? 'Sinungaling' : 'Normal na Tao';
  const roleEmoji = isImposter ? '🎭' : '🕵️';
  const word = myPlayer?.word ?? '???';
  const category = myPlayer?.category ?? '';

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          clearInterval(interval);
          setTimeout(onDone, 300);
          return 100;
        }
        return p + 2;
      });
    }, 120);
    return () => clearInterval(interval);
  }, [onDone]);

  useEffect(() => {
    const t = setTimeout(() => setBlurred(false), 800);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0a0a14]">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-[#0a0a14] to-gray-900" />
      
      {/* Ambient glow */}
      <div className={`pointer-events-none absolute inset-0 flex items-center justify-center`}>
        <div className={`w-[600px] h-[600px] rounded-full blur-3xl animate-glowPulse ${isImposter ? 'bg-red-600/20' : 'bg-indigo-500/20'}`} />
      </div>

      {/* Main content - perfectly centered */}
      <div className="relative z-10 flex flex-col items-center justify-center px-4 w-full max-w-md">
        {/* Card */}
        <div
          className={`w-full rounded-3xl p-8 border flex flex-col items-center gap-5 animate-popIn ${
            isImposter
              ? 'bg-gradient-to-b from-red-950/90 to-red-950/60 border-red-500/40'
              : 'bg-gradient-to-b from-indigo-950/90 to-indigo-950/60 border-indigo-500/40'
          }`}
          style={{ boxShadow: isImposter ? '0 25px 50px -12px rgba(220,38,38,0.4)' : '0 25px 50px -12px rgba(99,102,241,0.4)' }}
        >
          {/* Role icon */}
          <div className={`w-20 h-20 rounded-2xl flex items-center justify-center text-4xl mb-2 ${isImposter ? 'bg-red-500/20' : 'bg-indigo-500/20'}`}>
            {roleEmoji}
          </div>

          {/* Role title */}
          <div className="text-center">
            <p className={`text-sm uppercase tracking-wider font-bold mb-1 ${isImposter ? 'text-red-400' : 'text-indigo-400'}`}>
              You are
            </p>
            <h1 className={`text-3xl sm:text-4xl font-black ${isImposter ? 'text-red-300' : 'text-indigo-300'}`}>
              {roleText}
            </h1>
          </div>

          {/* Divider */}
          <div className={`w-16 h-1 rounded-full ${isImposter ? 'bg-red-500/50' : 'bg-indigo-500/50'}`} />

          {/* Word section */}
          <div className="w-full text-center">
            <p className="text-gray-400 text-xs uppercase tracking-wider mb-2">
              {isImposter ? 'Fake Word' : 'Your Word'}
            </p>
            {category && (
              <p className="text-gray-500 text-xs mb-2 uppercase tracking-wide">Category: {category}</p>
            )}
            <div
              className={`relative rounded-xl p-4 border cursor-pointer transition-all ${
                blurred ? 'blur-md' : 'blur-0'
              } ${isImposter ? 'bg-red-900/30 border-red-500/30' : 'bg-indigo-900/30 border-indigo-500/30'}`}
              onClick={() => setBlurred(!blurred)}
            >
              <p className={`text-2xl font-black text-center ${isImposter ? 'text-red-200' : 'text-indigo-200'}`}>
                {word}
              </p>
              <button
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-black/30 text-gray-400 hover:text-white transition-colors"
                aria-label={blurred ? 'Show word' : 'Hide word'}
              >
                {blurred ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-gray-500 text-xs mt-2">Tap to {blurred ? 'reveal' : 'hide'}</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full mt-6 animate-slideUp" style={{ animationDelay: '0.2s' }}>
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-gray-500 text-xs uppercase tracking-wider font-medium">Entering game...</span>
            <span className="text-white text-xs font-bold tabular-nums">{Math.round(progress)}%</span>
          </div>
          <div className="h-2 bg-gray-800/80 rounded-full overflow-hidden border border-gray-700/50">
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
