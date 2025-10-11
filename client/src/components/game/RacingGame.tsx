import { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3 } from 'three';
import * as THREE from 'three';
import { Model as CarModel } from '../../models/Car2';
import { Model as MapModel } from '../../models/Map';
import FloorGrid from './FloorGrid';
import useAppStore from '../../zustand/store';

// Car controls component
export const CarController = () => {
  const { camera, scene } = useThree();
  const { position, updatePosition, updateRotation } = useAppStore();

  const carRef = useRef<THREE.Group>(null);
  const velocityRef = useRef(new Vector3(0, 0, 0));
  const keysPressed = useRef<{ [key: string]: boolean }>({});
  const raycaster = useRef(new THREE.Raycaster());

  const speed = 0.5;
  const rotationSpeed = 0.03;
  const friction = 0.92;
  const carHeightOffset = 3; // Height above ground

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

  useFrame(() => {
    if (!carRef.current) return;

    const keys = keysPressed.current;
    let currentRotation = carRef.current.rotation.y;

    // Rotation controls (A/D or Left/Right arrows)
    if (keys['a'] || keys['arrowleft']) {
      currentRotation += rotationSpeed;
    }
    if (keys['d'] || keys['arrowright']) {
      currentRotation -= rotationSpeed;
    }

    // Forward/Backward controls (W/S or Up/Down arrows)
    if (keys['w'] || keys['arrowup']) {
      velocityRef.current.x -= Math.sin(currentRotation) * speed;
      velocityRef.current.z -= Math.cos(currentRotation) * speed;
    }
    if (keys['s'] || keys['arrowdown']) {
      velocityRef.current.x += Math.sin(currentRotation) * speed;
      velocityRef.current.z += Math.cos(currentRotation) * speed;
    }

    // Apply friction
    velocityRef.current.multiplyScalar(friction);

    // Calculate new X and Z position
    const newX = position.x + velocityRef.current.x;
    const newZ = position.z + velocityRef.current.z;

    // Raycast downward to detect terrain height
    raycaster.current.set(
      new Vector3(newX, 100, newZ), // Start from high above
      new Vector3(0, -1, 0) // Cast downward
    );

    // Get all intersections with the scene
    const intersects = raycaster.current.intersectObjects(scene.children, true);

    // Find terrain height (first hit that's not the car itself)
    let terrainHeight = 0;
    for (const intersect of intersects) {
      // Skip the car and its children
      if (carRef.current && !carRef.current.getObjectById(intersect.object.id)) {
        terrainHeight = intersect.point.y;
        break;
      }
    }

    // Update position with terrain following
    const newPosition = {
      x: newX,
      y: terrainHeight + carHeightOffset,
      z: newZ,
    };

    // Update car rotation
    carRef.current.rotation.y = currentRotation;

    // Update car position
    carRef.current.position.set(newPosition.x, newPosition.y, newPosition.z);

    // Update store
    updatePosition(newPosition);
    updateRotation(currentRotation);

    // Camera follows car (top-down view with slight angle)
    const cameraOffset = new Vector3(0, 30, 20);
    const rotatedOffset = cameraOffset.applyAxisAngle(new Vector3(0, 1, 0), currentRotation);
    camera.position.set(
      newPosition.x + rotatedOffset.x,
      newPosition.y + rotatedOffset.y,
      newPosition.z + rotatedOffset.z
    );
    camera.lookAt(newPosition.x, newPosition.y, newPosition.z);
  });

  return (
    <group ref={carRef} position={[position.x, position.y, position.z]}>
      <CarModel scale={1.2} />
      {/* Add a simple light to the car */}
      <pointLight position={[0, 5, 0]} intensity={1} distance={50} />
    </group>
  );
};

// Main racing game scene
export const RacingGame = () => {
  return (
    <>
      {/* Enhanced lighting to show car colors */}
      <ambientLight intensity={1.2} />
      <directionalLight position={[100, 100, 50]} intensity={1.5} castShadow />
      <directionalLight position={[-100, 100, -50]} intensity={0.8} />
      <hemisphereLight args={['#ffffff', '#666666', 0.8]} />

      {/* Floor grid */}
      <FloorGrid />

      {/* Racing map - positioned and scaled to match car starting position */}
      <MapModel position={[400, 0, 400]} scale={100} />

      {/* Car with controls */}
      <CarController />
    </>
  );
};
