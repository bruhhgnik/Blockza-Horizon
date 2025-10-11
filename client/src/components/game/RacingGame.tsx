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
  const collisionRaycaster = useRef(new THREE.Raycaster());
  const angularVelocityRef = useRef(0); // Rotational momentum

  const maxSpeed = 1.2; // Maximum speed
  const acceleration = 0.07; // Gradual acceleration
  const maxRotationSpeed = 0.04; // Maximum turn rate
  const rotationAcceleration = 0.002; // How fast turning builds up
  const rotationFriction = 0.85; // Rotational drag
  const friction = 0.94; // Slightly higher friction
  const lateralFriction = 0.92; // Sideways grip (prevents sliding)
  const carHeightOffset = 3; // Height above ground
  const collisionDistance = 5; // Distance to check for collisions ahead

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
    let currentRotation = carRef.current.rotation.y;

    // Calculate current speed
    const currentSpeed = Math.sqrt(
      velocityRef.current.x * velocityRef.current.x +
      velocityRef.current.z * velocityRef.current.z
    );

    // Speed-dependent turn rate (turn slower at high speeds, faster at low speeds)
    const speedFactor = Math.max(0.3, 1 - currentSpeed / maxSpeed);
    const effectiveMaxRotation = maxRotationSpeed * speedFactor;

    // Rotation controls with angular velocity (torque-based)
    if (keys['a'] || keys['arrowleft']) {
      angularVelocityRef.current += rotationAcceleration;
      if (angularVelocityRef.current > effectiveMaxRotation) {
        angularVelocityRef.current = effectiveMaxRotation;
      }
    } else if (keys['d'] || keys['arrowright']) {
      angularVelocityRef.current -= rotationAcceleration;
      if (angularVelocityRef.current < -effectiveMaxRotation) {
        angularVelocityRef.current = -effectiveMaxRotation;
      }
    } else {
      // No input - apply rotational friction
      angularVelocityRef.current *= rotationFriction;
    }

    // Apply angular velocity to rotation
    currentRotation += angularVelocityRef.current;

    // Forward/Backward controls (W/S or Up/Down arrows) - gradual acceleration
    if (keys['w'] || keys['arrowup']) {
      velocityRef.current.x -= Math.sin(currentRotation) * acceleration;
      velocityRef.current.z -= Math.cos(currentRotation) * acceleration;
    }
    if (keys['s'] || keys['arrowdown']) {
      velocityRef.current.x += Math.sin(currentRotation) * acceleration;
      velocityRef.current.z += Math.cos(currentRotation) * acceleration;
    }

    // Calculate forward and lateral vectors relative to car orientation
    const forwardDir = new Vector3(-Math.sin(currentRotation), 0, -Math.cos(currentRotation));
    const rightDir = new Vector3(Math.cos(currentRotation), 0, -Math.sin(currentRotation));

    // Project velocity onto forward and lateral directions
    const forwardVelocity = velocityRef.current.dot(forwardDir);
    const lateralVelocity = velocityRef.current.dot(rightDir);

    // Apply lateral friction (tire grip) - resist sideways motion
    const adjustedLateralVelocity = lateralVelocity * lateralFriction;

    // Reconstruct velocity with reduced lateral component (simulates tire grip)
    velocityRef.current.copy(
      forwardDir.multiplyScalar(forwardVelocity).add(
        rightDir.multiplyScalar(adjustedLateralVelocity)
      )
    );

    // Recalculate speed after lateral friction
    const adjustedSpeed = Math.sqrt(
      velocityRef.current.x * velocityRef.current.x +
      velocityRef.current.z * velocityRef.current.z
    );

    // Cap speed at maximum
    if (adjustedSpeed > maxSpeed) {
      velocityRef.current.multiplyScalar(maxSpeed / adjustedSpeed);
    }

    // Apply forward friction
    velocityRef.current.multiplyScalar(friction);

    // Check for collisions in multiple directions around the car
    const carPosition = new Vector3(position.x, position.y, position.z);
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

    // If collision detected, stop the car and reverse velocity slightly
    if (hasCollision) {
      velocityRef.current.multiplyScalar(-0.3); // Bounce back slightly
    }

    // Recalculate position after potential collision adjustment
    const finalX = position.x + velocityRef.current.x;
    const finalZ = position.z + velocityRef.current.z;

    // Raycast downward to detect terrain height
    raycaster.current.set(
      new Vector3(finalX, 100, finalZ), // Start from high above
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
      x: finalX,
      y: terrainHeight + carHeightOffset,
      z: finalZ,
    };

    // Update car rotation
    carRef.current.rotation.y = currentRotation;

    // Update car position
    carRef.current.position.set(newPosition.x, newPosition.y, newPosition.z);

    // Update store
    updatePosition(newPosition);
    updateRotation(currentRotation);

    // Camera follows car (lower angle view)
    const cameraOffset = new Vector3(0, 15, 20);
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
      <CarModel scale={0.17} />
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
