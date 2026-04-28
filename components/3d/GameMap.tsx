'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export default function GameMap() {
  const floorRef = useRef<THREE.Mesh>(null);

  return (
    <group>
      {/* Main floor */}
      <mesh ref={floorRef} rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, 0, 0]}>
        <planeGeometry args={[30, 30]} />
        <meshStandardMaterial color="#1a1a2e" roughness={0.8} metalness={0.1} />
      </mesh>

      {/* Floor grid lines */}
      <gridHelper args={[30, 30, '#2a2a4a', '#2a2a4a']} position={[0, 0.01, 0]} />

      {/* Center platform */}
      <mesh position={[0, 0.02, 0]} receiveShadow>
        <cylinderGeometry args={[2.5, 2.5, 0.05, 32]} />
        <meshStandardMaterial color="#16213e" roughness={0.6} />
      </mesh>

      {/* Center glowing ring */}
      <mesh position={[0, 0.05, 0]}>
        <torusGeometry args={[2.5, 0.05, 8, 64]} />
        <meshStandardMaterial color="#e11d48" emissive="#e11d48" emissiveIntensity={0.8} />
      </mesh>

      {/* Outer boundary walls */}
      {[0, 1, 2, 3].map((i) => {
        const angle = (i / 4) * Math.PI * 2;
        const x = Math.cos(angle) * 14;
        const z = Math.sin(angle) * 14;
        return (
          <mesh key={i} position={[x, 0.5, z]} castShadow receiveShadow>
            <boxGeometry args={[2, 1, 0.2]} />
            <meshStandardMaterial color="#0f172a" roughness={0.9} />
          </mesh>
        );
      })}

      {/* Ambient decorative pillars */}
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const angle = (i / 6) * Math.PI * 2;
        const r = 10;
        return (
          <mesh key={`pillar-${i}`} position={[Math.cos(angle) * r, 1, Math.sin(angle) * r]} castShadow>
            <cylinderGeometry args={[0.2, 0.2, 2, 8]} />
            <meshStandardMaterial color="#1e293b" roughness={0.7} />
          </mesh>
        );
      })}

      {/* Floating particle lights */}
      {[0, 1, 2].map((i) => (
        <pointLight
          key={`light-${i}`}
          position={[
            Math.cos((i / 3) * Math.PI * 2) * 6,
            2.5,
            Math.sin((i / 3) * Math.PI * 2) * 6,
          ]}
          color={i === 0 ? '#e11d48' : i === 1 ? '#6366f1' : '#0ea5e9'}
          intensity={0.6}
          distance={8}
        />
      ))}
    </group>
  );
}
