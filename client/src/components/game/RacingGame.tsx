import { useRef, useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3 } from 'three';
import * as THREE from 'three';
import { Model as Car2Model } from '../../models/Car2';
// @ts-ignore - JSX models without type definitions
import { Model as Car3Model } from '../../models/Car3';
// @ts-ignore - JSX models without type definitions
import { Model as Car4Model } from '../../models/Car4';
// @ts-ignore - JSX models without type definitions
import { Model as Car5Model } from '../../models/Car5';
// @ts-ignore - JSX models without type definitions
import { Model as Car6Model } from '../../models/Car6';
import { Model as MapModel } from '../../models/Map';
import FloorGrid from './FloorGrid';
import useAppStore from '../../zustand/store';
import { AICar } from './AICar';
import { FinishLine } from './FinishLine';
import { updateCarPhysics, CAR_PHYSICS } from './carPhysics';

// Car controls component
export const CarController = () => {
  const { camera, scene } = useThree();
  const {
    position,
    rotation,
    updatePosition,
    updateRotation,
    setVelocity,
    raceStarted,
    countdownValue,
    initializeRace,
    startRaceCountdown,
    updateCarPosition,
  } = useAppStore();

  const carRef = useRef<THREE.Group>(null);
  const velocityRef = useRef(new Vector3(0, 0, 0));
  const angularVelocityRef = useRef(0);
  const positionRef = useRef(new Vector3(position.x, position.y, position.z));
  const rotationRef = useRef(rotation);
  const keysPressed = useRef<{ [key: string]: boolean }>({});
  const raycaster = useRef(new THREE.Raycaster());
  const collisionRaycaster = useRef(new THREE.Raycaster());
  const cameraPosRef = useRef(new Vector3());
  const raceInitializedRef = useRef(false);
  const collisionDistance = 5;

  // Initialize race and start countdown
  useEffect(() => {
    if (!raceInitializedRef.current) {
      raceInitializedRef.current = true;
      initializeRace();
      // Start countdown after 3 seconds
      setTimeout(() => {
        startRaceCountdown();
      }, 3000);
    }
  }, [initializeRace, startRaceCountdown]);

  // Reset car physics when new race starts (countdownValue = 3)
  useEffect(() => {
    if (countdownValue === 3) {
      console.log('🔄 Resetting player car physics for new race');
      velocityRef.current.set(0, 0, 0);
      angularVelocityRef.current = 0;
      positionRef.current.set(position.x, position.y, position.z);
      rotationRef.current = rotation;
      cameraPosRef.current.set(0, 0, 0); // Reset camera

      // Reset car visual position
      if (carRef.current) {
        carRef.current.position.set(position.x, position.y, position.z);
        carRef.current.rotation.y = rotation;
      }
    }
  }, [countdownValue, position, rotation]);

  // Keyboard event handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysPressed.current[e.key.toLowerCase()] = true;
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current[e.key.toLowerCase()] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Check for collisions in a given direction
  const checkCollision = (fromPos: Vector3, direction: Vector3): boolean => {
    if (!carRef.current) return false;

    collisionRaycaster.current.set(fromPos, direction.normalize());
    collisionRaycaster.current.far = collisionDistance;

    const intersects = collisionRaycaster.current.intersectObjects(scene.children, true);

    // Check if any intersection is with track barriers (not the car or floor grid)
    for (const intersect of intersects) {
      // Skip the car itself and its children
      if (carRef.current.getObjectById(intersect.object.id)) continue;

      // Skip floor grid (check by name or type)
      if (intersect.object.name === 'floorGrid' || intersect.object.type === 'GridHelper') continue;

      // If we hit something close enough, it's a collision
      if (intersect.distance < collisionDistance) {
        return true;
      }
    }
    return false;
  };

  useFrame(() => {
    if (!carRef.current) return;

    const keys = keysPressed.current;

    // Apply unified physics (only if race started)
    const newState = updateCarPhysics(
      {
        velocity: velocityRef.current,
        angularVelocity: angularVelocityRef.current,
        position: positionRef.current,
        rotation: rotationRef.current,
      },
      {
        forward: raceStarted && (keys['w'] || keys['arrowup']),
        backward: raceStarted && (keys['s'] || keys['arrowdown']),
        left: keys['a'] || keys['arrowleft'],
        right: keys['d'] || keys['arrowright'],
      }
    );

    // Update refs
    velocityRef.current = newState.velocity;
    angularVelocityRef.current = newState.angularVelocity;
    positionRef.current = newState.position;
    rotationRef.current = newState.rotation;

    // Check for collisions in multiple directions around the car
    const carPosition = new Vector3(positionRef.current.x, positionRef.current.y, positionRef.current.z);
    const movementDirection = new Vector3(velocityRef.current.x, 0, velocityRef.current.z);

    // If we're moving, check for collisions
    let hasCollision = false;
    if (movementDirection.length() > 0.01) {
      // Check collision in movement direction and sides
      const forwardDir = movementDirection.clone().normalize();
      const leftDir = new Vector3(-forwardDir.z, 0, forwardDir.x);
      const rightDir = new Vector3(forwardDir.z, 0, -forwardDir.x);

      // Check multiple rays: forward, forward-left, forward-right
      hasCollision =
        checkCollision(carPosition, forwardDir) ||
        checkCollision(carPosition, forwardDir.clone().add(leftDir.multiplyScalar(0.3)).normalize()) ||
        checkCollision(carPosition, forwardDir.clone().add(rightDir.multiplyScalar(0.3)).normalize());
    }

    // If collision detected, smoothly slow down
    if (hasCollision) {
      velocityRef.current.multiplyScalar(0.5);
      angularVelocityRef.current *= 0.7;
      positionRef.current = new Vector3(position.x, position.y, position.z); // Reset to last good position
    }

    // Raycast downward to detect terrain height (road surface only, not barriers)
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

    const newPosition = {
      x: positionRef.current.x,
      y: positionRef.current.y,
      z: positionRef.current.z,
    };

    // Update car rotation and position
    carRef.current.rotation.y = rotationRef.current;
    carRef.current.position.set(newPosition.x, newPosition.y, newPosition.z);

    // Update store and car position in race state
    updatePosition(newPosition);
    updateRotation(rotationRef.current);
    setVelocity({ x: velocityRef.current.x, y: velocityRef.current.y, z: velocityRef.current.z });

    // Update car position in race leaderboard
    const lapProgress = 0; // Placeholder
    updateCarPosition('player', newPosition, rotationRef.current, lapProgress);

    // Camera follows car smoothly - third-person POV behind car (closer and lower)
    const cameraOffset = new Vector3(0, 5, 10);
    const rotatedOffset = cameraOffset.applyAxisAngle(new Vector3(0, 1, 0), rotationRef.current);

    // Target camera position
    const targetCameraPos = new Vector3(
      newPosition.x + rotatedOffset.x,
      newPosition.y + rotatedOffset.y,
      newPosition.z + rotatedOffset.z
    );

    // Initialize camera position if first frame
    if (cameraPosRef.current.length() === 0) {
      cameraPosRef.current.copy(targetCameraPos);
    }

    // Smooth camera interpolation (lerp)
    cameraPosRef.current.lerp(targetCameraPos, 0.08);
    camera.position.copy(cameraPosRef.current);

    // Smooth camera look-at
    const lookAtTarget = new Vector3(newPosition.x, newPosition.y, newPosition.z);
    camera.lookAt(lookAtTarget);
  });

  return (
    <group ref={carRef} position={[position.x, position.y, position.z]} rotation={[0, rotation, 0]}>
      <Car2Model scale={0.085} castShadow receiveShadow />

      {/* Front headlights - positioned at front of car */}
      <spotLight
        position={[0.5, 0.5, -1.5]}
        angle={0.6}
        penumbra={0.5}
        intensity={2}
        distance={30}
        color="#ffffff"
        castShadow
      />
      <spotLight
        position={[-0.5, 0.5, -1.5]}
        angle={0.6}
        penumbra={0.5}
        intensity={2}
        distance={30}
        color="#ffffff"
        castShadow
      />

      {/* Ambient light above car */}
      <pointLight position={[0, 4, 0]} intensity={0.5} distance={35} />
    </group>
  );
};

// Main racing game scene
export const RacingGame = () => {
  // Stable AI car configurations (names don't change) - positioned at track location
  const aiCarPositions = useMemo(() => [
    { id: 'ai-1', x: 1188.6, y: 1.3, z: 1502.4, color: '#ff0000', model: Car3Model, name: 'Max Thunder' },
    { id: 'ai-2', x: 1178.9, y: 1.3, z: 1502.4, color: '#00ff00', model: Car4Model, name: 'Luna Speed' },
    { id: 'ai-3', x: 1168.7, y: 1.3, z: 1502.4, color: '#0000ff', model: Car5Model, name: 'Turbo Smith' },
    { id: 'ai-4', x: 1164.4, y: 1.3, z: 1495.3, color: '#ffff00', model: Car6Model, name: 'Blaze Cruz' },
    { id: 'ai-5', x: 1172.2, y: 1.3, z: 1495.3, color: '#ff00ff', model: Car3Model, name: 'Nitro Nova' },
    { id: 'ai-6', x: 1183.9, y: 1.3, z: 1495.3, color: '#00ffff', model: Car4Model, name: 'Storm Racer' },
  ], []); // Empty dependency array means this only runs once

  return (
    <>
      {/* Enhanced lighting to show car colors */}
      <ambientLight intensity={1.2} />
      <directionalLight
        position={[100, 100, 50]}
        intensity={1.5}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={500}
        shadow-camera-left={-100}
        shadow-camera-right={100}
        shadow-camera-top={100}
        shadow-camera-bottom={-100}
      />
      <directionalLight position={[-100, 100, -50]} intensity={0.8} />
      <hemisphereLight args={['#ffffff', '#666666', 0.8]} />

      {/* Floor grid */}
      <FloorGrid />

      {/* Racing map - positioned directly under the cars */}
      <MapModel position={[400, -2, 400]} scale={1} receiveShadow />

      {/* Player car with controls */}
      <CarController />

      {/* AI cars */}
      {aiCarPositions.map((pos) => (
        <AICar
          key={pos.id}
          carId={pos.id}
          startPosition={{ x: pos.x, y: pos.y, z: pos.z }}
          color={pos.color}
          CarModel={pos.model}
          driverName={pos.name}
        />
      ))}
    </>
  );
};
