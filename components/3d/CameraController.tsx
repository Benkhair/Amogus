'use client';

import { useRef, useEffect } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Player } from '@/lib/types';

interface CameraControllerProps {
  currentSpeaker: Player | null;
  phase: string;
}

export default function CameraController({ currentSpeaker, phase }: CameraControllerProps) {
  const { camera } = useThree();
  const targetPos = useRef(new THREE.Vector3(0, 10, 14));
  const targetLook = useRef(new THREE.Vector3(0, 0, 0));
  const currentLook = useRef(new THREE.Vector3(0, 0, 0));

  useEffect(() => {
    if (currentSpeaker && phase === 'speaking') {
      // Zoom toward the speaker
      const sx = currentSpeaker.pos_x || 0;
      const sz = currentSpeaker.pos_z || 0;
      const angle = Math.atan2(sz, sx);
      const dist = 5;
      targetPos.current.set(
        sx + Math.cos(angle) * dist,
        4.5,
        sz + Math.sin(angle) * dist
      );
      targetLook.current.set(sx, 1, sz);
    } else {
      // Default overview
      targetPos.current.set(0, 12, 16);
      targetLook.current.set(0, 0, 0);
    }
  }, [currentSpeaker?.id, phase]);

  useFrame((_, delta) => {
    camera.position.lerp(targetPos.current, delta * 1.5);
    currentLook.current.lerp(targetLook.current, delta * 1.5);
    camera.lookAt(currentLook.current);
  });

  return null;
}
