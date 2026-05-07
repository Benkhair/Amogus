'use client';

import { useEffect, useState } from 'react';
import { useGame } from '@/context/GameContext';
import { Skull, Ghost, ArrowRight, Sparkles, AlertTriangle } from 'lucide-react';

interface EliminationRevealScreenProps {
  eliminatedPlayer: {
    id: string;
    name: string;
    avatar_color: string;
    is_imposter: boolean;
  } | null;
  onContinue: () => void;
  isGameOver: boolean;
  imposterWins: boolean;
}

export default function EliminationRevealScreen({
  eliminatedPlayer,
  onContinue,
  isGameOver,
  imposterWins,
}: EliminationRevealScreenProps) {
  const [countdown, setCountdown] = useState(5);
  const [revealStage, setRevealStage] = useState(0); // 0: suspense, 1: show player, 2: show role
  const { myPlayer } = useGame();

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(timer);
          return 0;
        }
        return c - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Reveal stages animation
  useEffect(() => {
    const stages = [1000, 2500, 4000]; // timings for each stage
    stages.forEach((delay, index) => {
      setTimeout(() => setRevealStage(index + 1), delay);
    });
  }, []);

  const handleContinue = () => {
    onContinue();
  };

  const isEliminated = myPlayer?.id === eliminatedPlayer?.id;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0a0a14]">
      {/* Animated background */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-[#0a0a14] to-gray-900" />
      
      {/* Dramatic glow effects */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        {eliminatedPlayer?.is_imposter ? (
          // Red glow for imposter
          <div className="w-[700px] h-[700px] rounded-full bg-red-600/20 blur-3xl animate-glowPulse" />
        ) : (
          // Purple glow for normal
          <div className="w-[700px] h-[700px] rounded-full bg-purple-600/20 blur-3xl animate-glowPulse" />
        )}
      </div>

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center justify-center px-4 max-w-lg w-full">
        
        {/* Stage 0: Building suspense */}
        {revealStage === 0 && (
          <div className="text-center animate-pulse">
            <AlertTriangle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
            <p className="text-yellow-400 text-sm uppercase tracking-[0.3em] font-bold">
              The votes have been cast...
            </p>
          </div>
        )}

        {/* Stage 1: Reveal eliminated player */}
        {revealStage >= 1 && eliminatedPlayer && (
          <div className="text-center animate-bounceIn">
            <p className="text-gray-400 text-xs uppercase tracking-[0.3em] font-bold mb-6">
              Eliminated
            </p>
            
            {/* Player avatar with dramatic styling */}
            <div className="relative mb-6">
              <div className="absolute inset-0 rounded-full bg-red-600/30 blur-xl animate-glowPulse" />
              <div
                className="relative w-28 h-28 rounded-full flex items-center justify-center text-3xl font-black text-white border-4 border-white/20 shadow-2xl"
                style={{ 
                  backgroundColor: eliminatedPlayer.avatar_color || '#6366f1',
                  boxShadow: `0 0 60px -10px ${eliminatedPlayer.avatar_color || '#6366f1'}80`
                }}
              >
                {eliminatedPlayer.name[0].toUpperCase()}
                <div className="absolute -bottom-2 -right-2 w-10 h-10 rounded-full bg-red-600 flex items-center justify-center border-2 border-gray-900">
                  <Skull className="w-5 h-5 text-white" />
                </div>
              </div>
            </div>
            
            <h2 className="text-3xl font-black text-white mb-2">
              {eliminatedPlayer.name}
            </h2>
            
            {isEliminated && (
              <p className="text-red-400 text-sm font-semibold mb-4">
                👻 You have been eliminated!
              </p>
            )}
          </div>
        )}

        {/* Stage 2: Reveal role */}
        {revealStage >= 2 && eliminatedPlayer && (
          <div className="text-center mt-6 animate-slideUp">
            {eliminatedPlayer.is_imposter ? (
              // Imposter was eliminated
              <div className="bg-gradient-to-b from-red-900/40 to-red-950/40 border border-red-500/40 rounded-2xl p-6 animate-bounceIn">
                <div className="text-5xl mb-3">🎭</div>
                <p className="text-red-400 text-lg font-bold uppercase tracking-wider mb-1">
                  The Sinungaling!
                </p>
                <p className="text-gray-300 text-sm">
                  The Normal na Tao win!
                </p>
              </div>
            ) : (
              // Normal was eliminated
              <div className="bg-gradient-to-b from-purple-900/40 to-purple-950/40 border border-purple-500/40 rounded-2xl p-6 animate-bounceIn">
                <div className="text-5xl mb-3">🕵️</div>
                <p className="text-purple-400 text-lg font-bold uppercase tracking-wider mb-1">
                  Normal na Tao
                </p>
                <p className="text-gray-300 text-sm">
                  {isGameOver 
                    ? "The Sinungaling wins!"
                    : "The game continues..."
                  }
                </p>
              </div>
            )}
          </div>
        )}

        {/* Continue button */}
        {countdown <= 0 ? (
          <button
            onClick={handleContinue}
            className="mt-8 px-8 py-4 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold text-lg transition-all flex items-center gap-3 shadow-lg shadow-blue-900/30 animate-slideUp"
          >
            {isGameOver ? 'View Results' : 'Continue Game'}
            <ArrowRight className="w-5 h-5" />
          </button>
        ) : (
          <div className="mt-8 flex items-center gap-3 text-gray-500 animate-slideUp">
            <Sparkles className="w-4 h-4 animate-spin" />
            <span className="text-sm">Continuing in {countdown}...</span>
          </div>
        )}

        {/* Spectator notice for eliminated players */}
        {isEliminated && !isGameOver && revealStage >= 2 && (
          <div className="mt-6 px-4 py-3 rounded-xl bg-gray-800/50 border border-gray-700 text-center animate-slideUp">
            <Ghost className="w-5 h-5 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-400 text-xs">
              You are now a spectator. You can see all words and chat with other eliminated players.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
