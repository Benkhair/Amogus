'use client';

import * as THREE from 'three';

export default function GameMap() {
  return (
    <group>
      {/* Floor - Dark metallic surface */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, 0, 0]}>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial 
          color="#0d1117" 
          roughness={0.6} 
          metalness={0.3}
        />
      </mesh>

      {/* Floor grid - subtle tech pattern */}
      <gridHelper args={[40, 40, '#1f2937', '#1f2937']} position={[0, 0.01, 0]} />

      {/* Central Meeting Table - Large oval table like Among Us */}
      <group position={[0, 0, 0]}>
        {/* Table top - Main surface */}
        <mesh position={[0, 0.8, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[4.5, 4.5, 0.15, 64]} />
          <meshStandardMaterial 
            color="#1e3a5f" 
            roughness={0.4} 
            metalness={0.5}
          />
        </mesh>

        {/* Table edge/rim */}
        <mesh position={[0, 0.75, 0]} castShadow>
          <torusGeometry args={[4.5, 0.08, 16, 64]} />
          <meshStandardMaterial 
            color="#2d4a6f" 
            roughness={0.3} 
            metalness={0.6}
          />
        </mesh>

        {/* Table center console - Emergency button area */}
        <mesh position={[0, 0.9, 0]} castShadow>
          <cylinderGeometry args={[1.2, 1.2, 0.1, 32]} />
          <meshStandardMaterial 
            color="#dc2626" 
            roughness={0.3} 
            metalness={0.4}
            emissive="#7f1d1d"
            emissiveIntensity={0.2}
          />
        </mesh>

        {/* Emergency button base */}
        <mesh position={[0, 1.0, 0]} castShadow>
          <cylinderGeometry args={[0.6, 0.6, 0.15, 32]} />
          <meshStandardMaterial 
            color="#991b1b" 
            roughness={0.4} 
            metalness={0.3}
          />
        </mesh>

        {/* Emergency button - Glowing top */}
        <mesh position={[0, 1.12, 0]} castShadow>
          <cylinderGeometry args={[0.4, 0.4, 0.1, 32]} />
          <meshStandardMaterial 
            color="#ef4444" 
            roughness={0.2} 
            metalness={0.3}
            emissive="#dc2626"
            emissiveIntensity={1.5}
          />
        </mesh>

        {/* Table legs/support */}
        {[0, 1, 2, 3].map((i) => {
          const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
          const x = Math.cos(angle) * 3;
          const z = Math.sin(angle) * 3;
          return (
            <mesh key={`table-leg-${i}`} position={[x, 0.4, z]} castShadow>
              <cylinderGeometry args={[0.25, 0.2, 0.8, 16]} />
              <meshStandardMaterial color="#1e293b" roughness={0.6} metalness={0.4} />
            </mesh>
          );
        })}

        {/* Table center support column */}
        <mesh position={[0, 0.4, 0]} castShadow>
          <cylinderGeometry args={[0.8, 0.8, 0.8, 32]} />
          <meshStandardMaterial color="#1e293b" roughness={0.6} metalness={0.4} />
        </mesh>
      </group>

      {/* Seating markers - subtle indicators around table */}
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
        const angle = (i / 8) * Math.PI * 2;
        const r = 5.8;
        const x = Math.cos(angle) * r;
        const z = Math.sin(angle) * r;
        return (
          <group key={`seat-${i}`}>
            {/* Floor marker for each seat */}
            <mesh position={[x, 0.02, z]} receiveShadow>
              <ringGeometry args={[0.35, 0.45, 32]} />
              <meshStandardMaterial 
                color="#374151" 
                transparent 
                opacity={0.5}
              />
            </mesh>
            {/* Small light above each seat position */}
            <pointLight
              position={[x, 3, z]}
              color="#6366f1"
              intensity={0.3}
              distance={4}
            />
          </group>
        );
      })}

      {/* Room walls - curved sections */}
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const angle = (i / 6) * Math.PI * 2;
        const r = 18;
        const x = Math.cos(angle) * r;
        const z = Math.sin(angle) * r;
        const rotY = -angle + Math.PI / 2;
        return (
          <mesh 
            key={`wall-${i}`} 
            position={[x, 2, z]} 
            rotation={[0, rotY, 0]}
            castShadow 
          >
            <boxGeometry args={[8, 4, 0.3]} />
            <meshStandardMaterial color="#111827" roughness={0.9} />
          </mesh>
        );
      })}

      {/* Wall corner pillars */}
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const angle = (i / 6) * Math.PI * 2 + Math.PI / 6;
        const r = 18;
        const x = Math.cos(angle) * r;
        const z = Math.sin(angle) * r;
        return (
          <mesh key={`pillar-${i}`} position={[x, 2, z]} castShadow>
            <cylinderGeometry args={[0.4, 0.4, 4, 16]} />
            <meshStandardMaterial color="#1f2937" roughness={0.7} metalness={0.2} />
          </mesh>
        );
      })}

      {/* Ambient ceiling lights */}
      {[0, 1, 2, 3].map((i) => {
        const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
        const r = 12;
        return (
          <group key={`ceiling-light-${i}`}>
            <mesh position={[Math.cos(angle) * r, 6, Math.sin(angle) * r]}>
              <boxGeometry args={[2, 0.1, 2]} />
              <meshStandardMaterial 
                color="#fef3c7" 
                emissive="#fbbf24"
                emissiveIntensity={0.8}
              />
            </mesh>
            <pointLight
              position={[Math.cos(angle) * r, 5, Math.sin(angle) * r]}
              color="#fbbf24"
              intensity={0.8}
              distance={15}
            />
          </group>
        );
      })}

      {/* Central overhead light */}
      <mesh position={[0, 7, 0]}>
        <cylinderGeometry args={[3, 3, 0.2, 32]} />
        <meshStandardMaterial 
          color="#e0e7ff" 
          emissive="#6366f1"
          emissiveIntensity={0.5}
        />
      </mesh>
      <pointLight
        position={[0, 6, 0]}
        color="#6366f1"
        intensity={1.2}
        distance={20}
      />

      {/* Floor accent lighting around table */}
      <mesh position={[0, 0.02, 0]} receiveShadow>
        <ringGeometry args={[5.5, 6.5, 64]} />
        <meshStandardMaterial 
          color="#1e3a5f" 
          emissive="#1e3a5f"
          emissiveIntensity={0.3}
          transparent
          opacity={0.6}
        />
      </mesh>
    </group>
  );
}
