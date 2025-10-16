import { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import useAppStore from '../../zustand/store';

// Finish line component
export const FinishLine = () => {
  const { carPositions, setCarFinished, setRaceFinished, raceStarted, countdownValue } = useAppStore();
  const movedAwayCarsRef = useRef<Set<string>>(new Set()); // Cars that have moved away from start
  const startTimeRef = useRef<number | null>(null);

  // Finish line position and dimensions - aligned with actual track
  const finishLineZ = 1493.0; // Finish line Z position - just ahead of starting line
  const finishLineMinX = 1179.1; // Left edge of finish line
  const finishLineMaxX = 1209.1; // Right edge of finish line
  const finishLineWidth = finishLineMaxX - finishLineMinX; // 30 units wide
  const finishLineCenterX = (finishLineMinX + finishLineMaxX) / 2; // Center at 1194.1
  const finishLineThickness = 3; // Thickness in Z direction

  useEffect(() => {
    if (raceStarted && startTimeRef.current === null) {
      startTimeRef.current = Date.now();
    }
  }, [raceStarted]);

  // Reset tracking when new race starts
  useEffect(() => {
    if (countdownValue === 3) {
      console.log('🔄 Resetting finish line tracking for new race');
      movedAwayCarsRef.current.clear();
      startTimeRef.current = null;
    }
  }, [countdownValue]);

  useFrame(() => {
    if (!raceStarted || startTimeRef.current === null) return;

    // Check each car's position
    carPositions.forEach((car) => {
      // Skip if already finished
      if (car.finishTime !== null) return;

      const carZ = car.position.z;
      const carX = car.position.x;

      // Mark car as moved away if it's far enough from start
      const hasMovedAway = Math.abs(carZ - finishLineZ) > 50; // Moved at least 50 units from start
      if (hasMovedAway && !movedAwayCarsRef.current.has(car.id)) {
        movedAwayCarsRef.current.add(car.id);
        console.log(`${car.name} has moved away from start`);
      }

      // Check if car is crossing the finish line
      const withinXBounds = carX >= finishLineMinX && carX <= finishLineMaxX;
      const atFinishLine = Math.abs(carZ - finishLineZ) < finishLineThickness;

      // Car finishes if: within bounds, at finish line, and has moved away before
      if (
        withinXBounds &&
        atFinishLine &&
        movedAwayCarsRef.current.has(car.id) &&
        startTimeRef.current !== null
      ) {
        const finishTime = Date.now() - startTimeRef.current;
        setCarFinished(car.id, finishTime);
        console.log(`🏁 ${car.name} finished in ${(finishTime / 1000).toFixed(2)}s`);

        // If player finished, end the race
        if (car.id === 'player') {
          console.log('🎉 Player finished the race!');
          setRaceFinished(true);
        }
      }
    });
  });

  return (
    <group position={[finishLineCenterX, 0.5, finishLineZ]}>
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

      {/* Checkered squares - 6 squares across the finish line */}
      {Array.from({ length: 6 }).map((_, i) => (
        <mesh
          key={i}
          position={[
            (i - 2.5) * 3,
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
