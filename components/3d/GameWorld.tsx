'use client';

import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { Stars, Preload } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import GameMap from './GameMap';
import PlayerAvatar from './PlayerAvatar';
import CameraController from './CameraController';
import { Player } from '@/lib/types';

interface GameWorldProps {
  players: Player[];
  currentSpeaker: Player | null;
  myPlayerId: string;
  phase: string;
}

export default function GameWorld({ players, currentSpeaker, myPlayerId, phase }: GameWorldProps) {
  return (
    <Canvas
      shadows
      camera={{ position: [0, 12, 16], fov: 50 }}
      style={{ width: '100%', height: '100%' }}
      gl={{ antialias: true, alpha: false }}
    >
      {/* Lighting */}
      <color attach="background" args={['#030712']} />
      <ambientLight intensity={0.3} />
      <directionalLight
        position={[5, 10, 5]}
        intensity={0.8}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-far={50}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
      />
      <pointLight position={[0, 8, 0]} intensity={0.5} color="#e11d48" />

      {/* Stars background */}
      <Stars radius={80} depth={50} count={3000} factor={4} saturation={0} fade speed={0.5} />

      {/* Camera controller */}
      <CameraController currentSpeaker={currentSpeaker} phase={phase} />

      {/* Game map */}
      <Suspense fallback={null}>
        <GameMap />

        {/* Player avatars */}
        {players.map((p) => (
          <PlayerAvatar
            key={p.id}
            player={p}
            isSpeaking={currentSpeaker?.id === p.id}
            isMe={p.id === myPlayerId}
            isEliminated={p.is_eliminated}
          />
        ))}
      </Suspense>

      {/* Post-processing bloom */}
      <EffectComposer>
        <Bloom
          luminanceThreshold={0.6}
          luminanceSmoothing={0.9}
          intensity={0.4}
          mipmapBlur
        />
      </EffectComposer>

      <Preload all />
    </Canvas>
  );
}
