import { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3 } from 'three';
import * as THREE from 'three';
import { Text } from '@react-three/drei';
import useAppStore from '../../zustand/store';
import { updateCarPhysics, CAR_PHYSICS } from './carPhysics';

interface AICarProps {
  carId: string;
  startPosition: { x: number; y: number; z: number };
  color?: string;
  CarModel: React.ComponentType<any>;
  driverName: string; // Driver name to display
}

export const AICar = ({ carId, startPosition, color = '#ff0000', CarModel, driverName }: AICarProps) => {
  const { scene } = useThree();
  const { raceStarted, updateCarPosition } = useAppStore();

  const carRef = useRef<THREE.Group>(null);
  const velocityRef = useRef(new Vector3(0, 0, 0));
  const angularVelocityRef = useRef(0);
  const positionRef = useRef(new Vector3(startPosition.x, startPosition.y, startPosition.z));
  const rotationRef = useRef(0);
  const raycaster = useRef(new THREE.Raycaster());

  // AI-specific racing line - each car gets unique variation
  const racingLineOffset = useRef((Math.random() - 0.5) * 15); // Offset from center line (-7.5 to +7.5)
  const aggressiveness = useRef(0.92 + Math.random() * 0.08); // 0.92-1.0 acceleration probability (accelerate 92-100% of time)
  const steeringSmoothness = useRef(0.6 + Math.random() * 0.3); // 0.6-0.9 steering probability
  const hasStartedRef = useRef(false);

  useEffect(() => {
    console.log(`🏁 ${driverName} (${carId}) mounted at position:`, startPosition, 'racingLineOffset:', racingLineOffset.current);

    // Initialize position ONCE on mount
    positionRef.current.set(startPosition.x, startPosition.y, startPosition.z);
    velocityRef.current.set(0, 0, 0);
    angularVelocityRef.current = 0;
    rotationRef.current = 0;
    hasStartedRef.current = false;

    return () => {
      console.log(`🏁 ${driverName} unmounted`);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carId]); // Only reset on mount/unmount, NOT when startPosition object reference changes

  useFrame(() => {
    if (!carRef.current) return;

    // Mark race as started
    if (!hasStartedRef.current && raceStarted) {
      hasStartedRef.current = true;
      console.log(`✅ ${driverName} RACE STARTED!`);
    }

    // Only move if race has started
    if (raceStarted) {

      // Calculate desired racing line position
      // For simplicity, AI tries to maintain its racing line offset from center (283)
      const centerLineX = 283;
      const desiredX = centerLineX + racingLineOffset.current;

      // Calculate steering direction based on position relative to racing line
      const offsetFromLine = positionRef.current.x - desiredX;

      // Determine steering: positive offset means too far right, need to steer left
      let shouldSteerLeft = false;
      let shouldSteerRight = false;

      if (Math.abs(offsetFromLine) > 2) { // Only steer if significantly off line
        if (offsetFromLine > 0) {
          shouldSteerLeft = true; // Too far right, steer left
        } else {
          shouldSteerRight = true; // Too far left, steer right
        }
      }

      // Apply steering smoothness - don't steer every frame
      const shouldSteer = Math.random() < steeringSmoothness.current;

      // Apply unified physics with variable aggressiveness
      const shouldAccelerate = Math.random() < aggressiveness.current;

      const newState = updateCarPhysics(
        {
          velocity: velocityRef.current,
          angularVelocity: angularVelocityRef.current,
          position: positionRef.current,
          rotation: rotationRef.current,
        },
        {
          forward: shouldAccelerate, // AI accelerates based on aggressiveness
          backward: false,
          left: shouldSteer && shouldSteerLeft,
          right: shouldSteer && shouldSteerRight,
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

      // Update car visual position
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
      <CarModel scale={1.5} />
      {/* Driver name text above car - always faces camera */}
      <Text
        position={[0, 12, 0]}
        fontSize={0.6}
        color={color}
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.1}
        outlineColor="#000000"
        fillOpacity={1}
        outlineOpacity={1}
      >
        {driverName}
      </Text>
      <pointLight position={[0, 6, 0]} intensity={1.0} distance={50} color={color} />
    </group>
  );
};
