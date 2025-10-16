import { Vector3 } from 'three';

/**
 * Unified car physics configuration
 * All cars (player and AI) use these same parameters
 */
export const CAR_PHYSICS = {
  // Movement
  maxSpeed: 1.2,
  acceleration: 0.05,
  deceleration: 0.96, // Applied when not accelerating
  brakeForce: 0.85,

  // Steering
  maxSteerAngle: 0.03,
  steerSpeed: 0.0015,
  steerFriction: 0.93,

  // Grip and friction
  lateralFriction: 0.85, // Tire grip - prevents sliding sideways
  forwardFriction: 0.97, // Rolling resistance

  // Physical properties
  carHeightOffset: 2.26, // Adjusted for car scale

  // Speed-dependent steering (less steering at high speeds)
  minSteerFactor: 0.6, // At max speed
  maxSteerFactor: 1.0, // At zero speed
};

export interface CarState {
  velocity: Vector3;
  angularVelocity: number;
  position: Vector3;
  rotation: number;
}

/**
 * Apply physics update to a car
 */
export function updateCarPhysics(
  state: CarState,
  controls: {
    forward: boolean;
    backward: boolean;
    left: boolean;
    right: boolean;
  },
  deltaMultiplier: number = 1
): CarState {
  const { velocity, angularVelocity, position, rotation } = state;
  const { forward, backward, left, right } = controls;

  let newVelocity = velocity.clone();
  let newAngularVelocity = angularVelocity;
  let newRotation = rotation;

  // Calculate current speed
  const currentSpeed = Math.sqrt(
    newVelocity.x * newVelocity.x + newVelocity.z * newVelocity.z
  );

  // Speed-dependent steering factor (less steering at high speeds)
  const speedFactor =
    CAR_PHYSICS.maxSteerFactor -
    ((currentSpeed / CAR_PHYSICS.maxSpeed) *
      (CAR_PHYSICS.maxSteerFactor - CAR_PHYSICS.minSteerFactor));
  const effectiveMaxSteer = CAR_PHYSICS.maxSteerAngle * speedFactor;

  // Steering (angular velocity)
  if (left) {
    newAngularVelocity += CAR_PHYSICS.steerSpeed * deltaMultiplier;
    if (newAngularVelocity > effectiveMaxSteer) {
      newAngularVelocity = effectiveMaxSteer;
    }
  } else if (right) {
    newAngularVelocity -= CAR_PHYSICS.steerSpeed * deltaMultiplier;
    if (newAngularVelocity < -effectiveMaxSteer) {
      newAngularVelocity = -effectiveMaxSteer;
    }
  } else {
    // Apply steering friction when not turning
    newAngularVelocity *= CAR_PHYSICS.steerFriction;
  }

  // Apply rotation
  newRotation += newAngularVelocity;

  // Forward/Backward acceleration
  if (forward) {
    newVelocity.x -= Math.sin(newRotation) * CAR_PHYSICS.acceleration * deltaMultiplier;
    newVelocity.z -= Math.cos(newRotation) * CAR_PHYSICS.acceleration * deltaMultiplier;
  }
  if (backward) {
    newVelocity.x += Math.sin(newRotation) * CAR_PHYSICS.acceleration * 0.5 * deltaMultiplier; // Reverse is slower
    newVelocity.z += Math.cos(newRotation) * CAR_PHYSICS.acceleration * 0.5 * deltaMultiplier;
  }

  // Calculate forward and lateral vectors
  const forwardDir = new Vector3(-Math.sin(newRotation), 0, -Math.cos(newRotation));
  const rightDir = new Vector3(Math.cos(newRotation), 0, -Math.sin(newRotation));

  // Project velocity onto forward and lateral directions
  const forwardVelocity = newVelocity.dot(forwardDir);
  const lateralVelocity = newVelocity.dot(rightDir);

  // Apply lateral friction (tire grip - resist sideways sliding)
  const adjustedLateralVelocity = lateralVelocity * CAR_PHYSICS.lateralFriction;

  // Reconstruct velocity with reduced lateral component
  newVelocity.copy(
    forwardDir
      .clone()
      .multiplyScalar(forwardVelocity)
      .add(rightDir.clone().multiplyScalar(adjustedLateralVelocity))
  );

  // Recalculate speed after lateral friction
  const adjustedSpeed = Math.sqrt(
    newVelocity.x * newVelocity.x + newVelocity.z * newVelocity.z
  );

  // Cap speed at maximum
  if (adjustedSpeed > CAR_PHYSICS.maxSpeed) {
    newVelocity.multiplyScalar(CAR_PHYSICS.maxSpeed / adjustedSpeed);
  }

  // Apply forward friction (rolling resistance)
  if (backward && currentSpeed > 0.01) {
    // Braking
    newVelocity.multiplyScalar(CAR_PHYSICS.brakeForce);
  } else if (!forward && !backward) {
    // Natural deceleration when not accelerating
    newVelocity.multiplyScalar(CAR_PHYSICS.deceleration);
  } else {
    // Normal rolling friction
    newVelocity.multiplyScalar(CAR_PHYSICS.forwardFriction);
  }

  // Update position
  const newPosition = position.clone();
  newPosition.x += newVelocity.x;
  newPosition.z += newVelocity.z;

  return {
    velocity: newVelocity,
    angularVelocity: newAngularVelocity,
    position: newPosition,
    rotation: newRotation,
  };
}
