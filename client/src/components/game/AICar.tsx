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
  const { raceStarted, countdownValue, updateCarPosition, carPositions } = useAppStore();

  // Get initial rotation from store
  const initialRotation = carPositions.find(car => car.id === carId)?.rotation ?? Math.PI / 2;

  const carRef = useRef<THREE.Group>(null);
  const velocityRef = useRef(new Vector3(0, 0, 0));
  const angularVelocityRef = useRef(0);
  const positionRef = useRef(new Vector3(startPosition.x, startPosition.y, startPosition.z));
  const rotationRef = useRef(initialRotation);
  const raycaster = useRef(new THREE.Raycaster());

  // AI parameters for variation
  const targetLateralOffset = useRef((Math.random() - 0.5) * 12); // Desired offset from center (-6 to +6)
  const aggressiveness = useRef(0.93 + Math.random() * 0.07); // How often to accelerate (93-100%)
  const hasStartedRef = useRef(false);

  useEffect(() => {
    console.log(`🏁 ${driverName} (${carId}) mounted - target lateral offset:`, targetLateralOffset.current);

    // Initialize position ONCE on mount
    positionRef.current.set(startPosition.x, startPosition.y, startPosition.z);
    velocityRef.current.set(0, 0, 0);
    angularVelocityRef.current = 0;
    rotationRef.current = initialRotation;
    hasStartedRef.current = false;

    // Set initial car rotation
    if (carRef.current) {
      carRef.current.rotation.y = initialRotation;
    }

    return () => {
      console.log(`🏁 ${driverName} unmounted`);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carId]);

  // Reset AI car when new race starts (countdownValue = 3)
  useEffect(() => {
    if (countdownValue === 3) {
      console.log(`🔄 Resetting ${driverName} for new race`);
      velocityRef.current.set(0, 0, 0);
      angularVelocityRef.current = 0;
      positionRef.current.set(startPosition.x, startPosition.y, startPosition.z);
      rotationRef.current = initialRotation;
      hasStartedRef.current = false;

      // Reset car visual position
      if (carRef.current) {
        carRef.current.position.set(startPosition.x, startPosition.y, startPosition.z);
        carRef.current.rotation.y = initialRotation;
      }

      // Randomize AI parameters for variety in each race
      targetLateralOffset.current = (Math.random() - 0.5) * 12;
      aggressiveness.current = 0.93 + Math.random() * 0.07;
    }
  }, [countdownValue, startPosition, driverName, initialRotation]);

  useFrame(() => {
    if (!carRef.current) return;

    // Mark race as started
    if (!hasStartedRef.current && raceStarted) {
      hasStartedRef.current = true;
      console.log(`✅ ${driverName} RACE STARTED!`);
    }

    // Only move if race has started
    if (raceStarted) {
      // AI Logic: Simple strategy - always accelerate, steer to maintain racing line
      const centerLineX = 1194.1; // Track center X position - aligned with actual track
      const desiredX = centerLineX + targetLateralOffset.current;
      const currentOffsetFromDesired = positionRef.current.x - desiredX;

      // Determine steering based on position relative to desired racing line
      let shouldSteerLeft = false;
      let shouldSteerRight = false;

      // Steer to get back to racing line
      if (Math.abs(currentOffsetFromDesired) > 1) {
        if (currentOffsetFromDesired > 0) {
          shouldSteerLeft = true; // Too far right, steer left
        } else {
          shouldSteerRight = true; // Too far left, steer right
        }
      }

      // Apply physics with AI controls
      const shouldAccelerate = Math.random() < aggressiveness.current;

      const newState = updateCarPhysics(
        {
          velocity: velocityRef.current,
          angularVelocity: angularVelocityRef.current,
          position: positionRef.current,
          rotation: rotationRef.current,
        },
        {
          forward: shouldAccelerate,
          backward: false,
          left: shouldSteerLeft,
          right: shouldSteerRight,
        }
      );

      // Update refs
      velocityRef.current = newState.velocity;
      angularVelocityRef.current = newState.angularVelocity;
      positionRef.current = newState.position;
      rotationRef.current = newState.rotation;

      // Raycast downward for terrain height (road surface only, not barriers)
      raycaster.current.set(
        new Vector3(positionRef.current.x, 100, positionRef.current.z),
        new Vector3(0, -1, 0)
      );

      const intersects = raycaster.current.intersectObjects(scene.children, true);

      // Find the lowest intersection point below the car (the actual road surface)
      // This prevents cars from riding on top of barriers/obstacles
      let terrainHeight = 0;
      let foundRoad = false;

      for (const intersect of intersects) {
        // Skip the car itself
        if (carRef.current && carRef.current.getObjectById(intersect.object.id)) continue;

        // Skip floor grid
        if (intersect.object.name === 'floorGrid' || intersect.object.type === 'GridHelper') continue;

        // Take the lowest Y position (road surface, not barriers above)
        if (!foundRoad || intersect.point.y < terrainHeight) {
          terrainHeight = intersect.point.y;
          foundRoad = true;
        }
      }

      // Update position with terrain following
      const calculatedY = terrainHeight + CAR_PHYSICS.carHeightOffset;
      positionRef.current.y = calculatedY;

      // Update car visual position and rotation
      carRef.current.position.copy(positionRef.current);
      carRef.current.rotation.y = rotationRef.current;

      // Calculate lap progress (simple Z-based progress for now)
      const startZ = 1495.0;
      const lapProgress = Math.max(0, (startZ - positionRef.current.z) / 1000); // Rough estimate

      // Update race state
      updateCarPosition(
        carId,
        { x: positionRef.current.x, y: positionRef.current.y, z: positionRef.current.z },
        rotationRef.current,
        lapProgress
      );
    }
  });

  return (
    <group ref={carRef} position={[startPosition.x, startPosition.y, startPosition.z]} rotation={[0, initialRotation, 0]}>
      <CarModel scale={0.8} />
      {/* Driver name text above car - always faces camera */}
      <Text
        position={[0, 2.22, 0]}
        fontSize={0.35}
        color={color}
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.022}
        outlineColor="#000000"
        fillOpacity={1}
        outlineOpacity={1}
      >
        {driverName}
      </Text>
      <pointLight position={[0, 1.1, 0]} intensity={1.0} distance={35} color={color} />
    </group>
  );
};
