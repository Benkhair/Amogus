'use client';

import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text, Billboard } from '@react-three/drei';
import * as THREE from 'three';
import { Player } from '@/lib/types';

interface PlayerAvatarProps {
  player: Player;
  isSpeaking: boolean;
  isMe: boolean;
  isEliminated: boolean;
}

export default function PlayerAvatar({ player, isSpeaking, isMe, isEliminated }: PlayerAvatarProps) {
  const groupRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  const color = player.avatar_color || '#6366f1';
  const eliminatedColor = '#374151';

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    // Hover bob animation
    if (isSpeaking) {
      groupRef.current.position.y = Math.sin(Date.now() * 0.004) * 0.08 + 0.08;
    } else {
      groupRef.current.position.y = THREE.MathUtils.lerp(groupRef.current.position.y, 0, delta * 3);
    }

    // Glow pulse when speaking
    if (glowRef.current) {
      const scale = isSpeaking ? 1 + Math.sin(Date.now() * 0.006) * 0.2 : 1;
      glowRef.current.scale.setScalar(scale);
      (glowRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity =
        isSpeaking ? 1 + Math.sin(Date.now() * 0.006) * 0.5 : 0.15;
    }
  });

  const bodyColor = isEliminated ? eliminatedColor : color;

  return (
    <group
      ref={groupRef}
      position={[player.pos_x || 0, 0, player.pos_z || 0]}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      {/* Glow ring on floor */}
      <mesh ref={glowRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[0.45, 0.6, 32]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.1}
          transparent
          opacity={isEliminated ? 0.2 : 0.7}
        />
      </mesh>

      {/* Body — capsule shape */}
      <mesh ref={bodyRef} position={[0, 0.7, 0]} castShadow>
        <capsuleGeometry args={[0.3, 0.6, 8, 16]} />
        <meshStandardMaterial
          color={bodyColor}
          roughness={0.4}
          metalness={0.2}
          emissive={color}
          emissiveIntensity={isSpeaking ? 0.5 : 0.1}
          transparent
          opacity={isEliminated ? 0.3 : 1}
        />
      </mesh>

      {/* Visor / face */}
      <mesh position={[0, 1.0, 0.28]} castShadow>
        <boxGeometry args={[0.32, 0.14, 0.05]} />
        <meshStandardMaterial
          color={isSpeaking ? '#86efac' : '#93c5fd'}
          emissive={isSpeaking ? '#86efac' : '#93c5fd'}
          emissiveIntensity={isSpeaking ? 0.8 : 0.3}
          transparent
          opacity={isEliminated ? 0.2 : 1}
        />
      </mesh>

      {/* Backpack */}
      <mesh position={[0, 0.75, -0.32]} castShadow>
        <boxGeometry args={[0.22, 0.35, 0.12]} />
        <meshStandardMaterial
          color={bodyColor}
          roughness={0.5}
          transparent
          opacity={isEliminated ? 0.2 : 1}
        />
      </mesh>

      {/* Name tag billboard (always faces camera) */}
      <Billboard follow={true} lockX={false} lockY={false} lockZ={false}>
        <Text
          position={[0, 1.65, 0]}
          fontSize={0.22}
          color={isEliminated ? '#6b7280' : isMe ? '#fbbf24' : '#f1f5f9'}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.03}
          outlineColor="#000000"
        >
          {player.name}{isMe ? ' (You)' : ''}
        </Text>

        {/* Speaking indicator */}
        {isSpeaking && (
          <Text
            position={[0, 1.95, 0]}
            fontSize={0.18}
            color="#22c55e"
            anchorX="center"
            anchorY="middle"
          >
            🎤 Speaking
          </Text>
        )}

        {/* Eliminated X */}
        {isEliminated && (
          <Text
            position={[0, 1.95, 0]}
            fontSize={0.22}
            color="#ef4444"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.03}
            outlineColor="#000000"
          >
            ✕ Eliminated
          </Text>
        )}
      </Billboard>

      {/* Point light when speaking */}
      {isSpeaking && (
        <pointLight color={color} intensity={1.5} distance={4} position={[0, 1.2, 0]} />
      )}
    </group>
  );
}
