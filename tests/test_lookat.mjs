import * as THREE from 'three';

const root = new THREE.Object3D();
const shoulder = new THREE.Object3D();
// Left shoulder
shoulder.position.set(0.061, 0.112, -0.087);
root.add(shoulder);

const leftArm = new THREE.Object3D();
leftArm.position.set(-0.003, 0.093, -0.036);
// Rest pose quaternion
leftArm.quaternion.set(0.052, 0, -0.104, 0.993);
shoulder.add(leftArm);

const leftForeArm = new THREE.Object3D();
leftForeArm.position.set(-0.005, 0.271, 0.002);
leftArm.add(leftForeArm);

root.updateMatrixWorld(true);

// 1. Find the current arm vector in world space
const shoulderWorld = new THREE.Vector3();
leftArm.getWorldPosition(shoulderWorld);

const elbowWorld = new THREE.Vector3();
leftForeArm.getWorldPosition(elbowWorld);

const currentArmDir = new THREE.Vector3().subVectors(elbowWorld, shoulderWorld).normalize();
console.log('Current world arm dir:', currentArmDir);

// 2. We want the arm to point down (Y = -0.9) and outwards (X = 0.3)
const targetArmDir = new THREE.Vector3(0.3, -0.9, 0).normalize();
console.log('Target world arm dir:', targetArmDir);

// 3. Find quaternion that rotates currentArmDir to targetArmDir
const rot = new THREE.Quaternion().setFromUnitVectors(currentArmDir, targetArmDir);

// 4. Apply this rotation to the leftArm in WORLD space.
// Since we want to rotate the bone such that its world direction changes by `rot`:
// leftArm.quaternion = leftArm.parent.quaternion^-1 * rot * leftArm.parent.quaternion * originalLocalQuat
// Wait, an easier way is to just rotate the bone in world space, but Three.js bones have world/local.
// Or just apply the rotation to the local quaternion by converting the axis!
const localAxis = new THREE.Vector3();
localAxis.crossVectors(currentArmDir, targetArmDir).normalize();
const angle = currentArmDir.angleTo(targetArmDir);

// Convert world axis to local axis
leftArm.parent.worldToLocal(localAxis.clone().add(leftArm.parent.getWorldPosition(new THREE.Vector3()))).normalize();
// wait, direction vectors can be converted using inverse rotation matrix
const parentRotInv = shoulder.getWorldQuaternion(new THREE.Quaternion()).invert();
localAxis.applyQuaternion(parentRotInv);

const localRot = new THREE.Quaternion().setFromAxisAngle(localAxis, angle);
leftArm.quaternion.premultiply(localRot);

root.updateMatrixWorld(true);
leftForeArm.getWorldPosition(elbowWorld);
const newDir = new THREE.Vector3().subVectors(elbowWorld, shoulderWorld).normalize();
console.log('New world arm dir:', newDir);

// Let's get the resulting Euler angles so we can just hardcode them!
const e = new THREE.Euler().setFromQuaternion(leftArm.quaternion);
console.log('Best LeftArm Euler:', e);
