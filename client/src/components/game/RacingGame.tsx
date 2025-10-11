import { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3 } from 'three';
import * as THREE from 'three';
import { Model as Car } from '../../models/Car';
import { Model as Map } from '../../models/Map';
import FloorGrid from './FloorGrid';
import useAppStore from '../../zustand/store';

// Car controls component
export const CarController = () => {
  const { camera } = useThree();
  const { position, updatePosition, updateRotation } = useAppStore();

  const carRef = useRef<THREE.Group>(null);
  const velocityRef = useRef(new Vector3(0, 0, 0));
  const keysPressed = useRef<{ [key: string]: boolean }>({});

  const speed = 0.5;
  const rotationSpeed = 0.03;
  const friction = 0.92;

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

    // Update position
    const newPosition = {
      x: position.x + velocityRef.current.x,
      y: position.y,
      z: position.z + velocityRef.current.z,
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
      <Car scale={0.5} />
      {/* Add a simple light to the car */}
      <pointLight position={[0, 5, 0]} intensity={1} distance={50} />
    </group>
  );
};

// Main racing game scene
export const RacingGame = () => {
  return (
    <>
      {/* Ambient lighting */}
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 10, 5]} intensity={0.8} />

      {/* Floor grid */}
      <FloorGrid />

      {/* Racing map */}
      <Map position={[0, 0, 0]} />

      {/* Car with controls */}
      <CarController />
    </>
  );
};
