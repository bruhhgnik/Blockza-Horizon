import { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3 } from 'three';
import * as THREE from 'three';
import { Model as CarModel } from '../../models/Car2';
import useAppStore from '../../zustand/store';
import { updateCarPhysics, CAR_PHYSICS } from './carPhysics';

interface AICarProps {
  carId: string;
  startPosition: { x: number; y: number; z: number };
  color?: string;
}

export const AICar = ({ carId, startPosition, color = '#ff0000' }: AICarProps) => {
  const { scene } = useThree();
  const { raceStarted, updateCarPosition } = useAppStore();

  const carRef = useRef<THREE.Group>(null);
  const velocityRef = useRef(new Vector3(0, 0, 0));
  const angularVelocityRef = useRef(0);
  const positionRef = useRef(new Vector3(startPosition.x, startPosition.y, startPosition.z));
  const rotationRef = useRef(0);
  const raycaster = useRef(new THREE.Raycaster());

  // AI-specific behavior (slight variations per car)
  const aiSteerDirection = useRef(0); // -1 = left, 0 = straight, 1 = right
  const steerChangeInterval = useRef(0);
  const hasStartedRef = useRef(false);

  useEffect(() => {
    // Reset when race restarts
    positionRef.current.set(startPosition.x, startPosition.y, startPosition.z);
    velocityRef.current.set(0, 0, 0);
    angularVelocityRef.current = 0;
    rotationRef.current = 0;
    hasStartedRef.current = false;
    aiSteerDirection.current = 0;
    steerChangeInterval.current = 0;
  }, [startPosition]);

  useFrame(() => {
    if (!carRef.current) return;

    // Only move if race has started
    if (raceStarted) {
      if (!hasStartedRef.current) {
        hasStartedRef.current = true;
        console.log(`✅ AI Car ${carId} starting at`, positionRef.current);
      }

      // Simple AI steering logic - occasionally change direction
      steerChangeInterval.current++;
      if (steerChangeInterval.current > 60) { // Change direction every ~60 frames
        steerChangeInterval.current = 0;
        const rand = Math.random();
        if (rand < 0.3) {
          aiSteerDirection.current = -1; // Steer left
        } else if (rand < 0.6) {
          aiSteerDirection.current = 1; // Steer right
        } else {
          aiSteerDirection.current = 0; // Go straight
        }
      }

      // Apply unified physics - AI always accelerates forward
      const newState = updateCarPhysics(
        {
          velocity: velocityRef.current,
          angularVelocity: angularVelocityRef.current,
          position: positionRef.current,
          rotation: rotationRef.current,
        },
        {
          forward: true, // AI always accelerates
          backward: false,
          left: aiSteerDirection.current === -1,
          right: aiSteerDirection.current === 1,
        }
      );

      // Update refs
      velocityRef.current = newState.velocity;
      angularVelocityRef.current = newState.angularVelocity;
      positionRef.current = newState.position;
      rotationRef.current = newState.rotation;

      // Raycast downward for terrain height
      raycaster.current.set(
        new Vector3(positionRef.current.x, 100, positionRef.current.z),
        new Vector3(0, -1, 0)
      );

      const intersects = raycaster.current.intersectObjects(scene.children, true);
      let terrainHeight = 0;

      for (const intersect of intersects) {
        if (carRef.current && !carRef.current.getObjectById(intersect.object.id)) {
          terrainHeight = intersect.point.y;
          break;
        }
      }

      positionRef.current.y = terrainHeight + CAR_PHYSICS.carHeightOffset;

      // Update car
      carRef.current.position.copy(positionRef.current);
      carRef.current.rotation.y = rotationRef.current;

      // Update race state
      updateCarPosition(
        carId,
        { x: positionRef.current.x, y: positionRef.current.y, z: positionRef.current.z },
        rotationRef.current,
        0 // lapProgress
      );
    }
  });

  return (
    <group ref={carRef} position={[startPosition.x, startPosition.y, startPosition.z]}>
      <CarModel scale={0.17} />
      {/* Debug marker - visible colored sphere above car */}
      <mesh position={[0, 8, 0]}>
        <sphereGeometry args={[0.5, 16, 16]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} />
      </mesh>
      <pointLight position={[0, 5, 0]} intensity={0.5} distance={30} />
    </group>
  );
};
