import { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import useAppStore from '../../zustand/store';

// Finish line component
export const FinishLine = () => {
  const { carPositions, setCarFinished, raceStarted } = useAppStore();
  const crossedCarsRef = useRef<Set<string>>(new Set());
  const startTimeRef = useRef<number | null>(null);

  // Finish line position and dimensions
  const finishLineZ = 458; // Same as starting Z position
  const finishLineX = 283; // Center X
  const finishLineWidth = 30; // Width of finish line detection zone
  const finishLineThickness = 2; // Thickness in Z direction

  useEffect(() => {
    if (raceStarted && startTimeRef.current === null) {
      startTimeRef.current = Date.now();
    }
  }, [raceStarted]);

  useFrame(() => {
    if (!raceStarted || startTimeRef.current === null) return;

    // Check each car's position
    carPositions.forEach((car) => {
      // Skip if already finished
      if (car.finishTime !== null) return;

      const carZ = car.position.z;
      const carX = car.position.x;

      // Check if car crossed finish line
      const withinXBounds = Math.abs(carX - finishLineX) < finishLineWidth / 2;
      const crossedZLine =
        Math.abs(carZ - finishLineZ) < finishLineThickness &&
        !crossedCarsRef.current.has(car.id);

      // Car must have moved away from start first (to prevent immediate finish)
      const hasMovedAway = Math.abs(carZ - finishLineZ) > 10;

      if (hasMovedAway) {
        crossedCarsRef.current.add(car.id);
      }

      // Check if car returned to finish line after moving away
      if (
        withinXBounds &&
        crossedZLine &&
        crossedCarsRef.current.has(car.id) &&
        crossedCarsRef.current.size > 1
      ) {
        const finishTime = Date.now() - startTimeRef.current;
        setCarFinished(car.id, finishTime);
        console.log(`${car.name} finished in ${(finishTime / 1000).toFixed(2)}s`);
      }
    });
  });

  return (
    <group position={[finishLineX, 0.5, finishLineZ]}>
      {/* Visual finish line - checkered pattern */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[finishLineWidth, finishLineThickness]} />
        <meshStandardMaterial
          color="#ffffff"
          transparent
          opacity={0.8}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Checkered squares */}
      {Array.from({ length: 10 }).map((_, i) => (
        <mesh
          key={i}
          position={[
            (i - 4.5) * 3,
            0.01,
            ((i % 2) - 0.5) * finishLineThickness,
          ]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[3, finishLineThickness]} />
          <meshStandardMaterial
            color={i % 2 === 0 ? '#000000' : '#ffffff'}
            transparent
            opacity={0.9}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </group>
  );
};
