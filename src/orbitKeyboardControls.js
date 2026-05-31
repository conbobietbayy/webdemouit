import * as THREE from "three";

const ORBIT_MOVE_SPEED = 28; // meters per second

/**
 * Updates the Orbit camera and controls target positions based on keyboard input.
 * @param {THREE.Camera} camera The active PerspectiveCamera
 * @param {OrbitControls} controls The active OrbitControls instance
 * @param {Set<string>} keys The Set containing currently pressed event.code keys
 * @param {number} delta The frame delta time in seconds
 */
export function updateOrbitKeyboard(camera, controls, keys, delta) {
  if (!camera || !controls || !keys || delta <= 0) return;

  // 1. Identify movement directions
  const forwardKey = keys.has("KeyW") || keys.has("ArrowUp");
  const backwardKey = keys.has("KeyS") || keys.has("ArrowDown");
  const leftKey = keys.has("KeyA") || keys.has("ArrowLeft");
  const rightKey = keys.has("KeyD") || keys.has("ArrowRight");

  const isMoving = forwardKey || backwardKey || leftKey || rightKey;
  if (!isMoving) return;

  // 2. Determine horizontal forward vector (camera facing direction projected to ground plane Y=0)
  const forward = new THREE.Vector3();
  camera.getWorldDirection(forward);
  forward.y = 0;
  forward.normalize();

  // 3. Determine horizontal right vector
  const right = new THREE.Vector3();
  right.crossVectors(forward, camera.up);
  right.y = 0;
  right.normalize();

  // 4. Compute composite movement vector
  const moveVector = new THREE.Vector3();
  if (forwardKey) moveVector.add(forward);
  if (backwardKey) moveVector.addScaledVector(forward, -1);
  if (rightKey) moveVector.add(right);
  if (leftKey) moveVector.addScaledVector(right, -1);

  if (moveVector.lengthSq() > 0.0001) {
    moveVector.normalize();

    // 5. Apply speed modifiers (Shift to boost speed)
    const runMultiplier = (keys.has("ShiftLeft") || keys.has("ShiftRight")) ? 2.5 : 1.0;
    const speed = ORBIT_MOVE_SPEED * runMultiplier;

    moveVector.multiplyScalar(speed * delta);

    // 6. Translate both camera and controls target by the same offset
    camera.position.add(moveVector);
    controls.target.add(moveVector);
  }
}
