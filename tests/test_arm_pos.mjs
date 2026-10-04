import * as THREE from 'three';
import fs from 'fs';

// Mock simple hierarchy
const root = new THREE.Object3D();
const shoulder = new THREE.Object3D();
shoulder.position.set(0.061, 0.112, -0.087);
root.add(shoulder);

const leftArm = new THREE.Object3D();
leftArm.position.set(-0.003, 0.093, -0.036);
leftArm.quaternion.set(0.052, 0, -0.104, 0.993);
shoulder.add(leftArm);

const leftForeArm = new THREE.Object3D();
leftForeArm.position.set(-0.005, 0.271, 0.002);
leftArm.add(leftForeArm);

root.updateMatrixWorld(true);
let pos = new THREE.Vector3();
leftForeArm.getWorldPosition(pos);
console.log('Original elbow world pos:', pos);

// Try set(0, 0, 1.2)
leftArm.rotation.set(0, 0, 1.2);
root.updateMatrixWorld(true);
leftForeArm.getWorldPosition(pos);
console.log('After set(0,0,1.2) elbow world pos:', pos);

// Try set(1.2, 0, 0)
leftArm.quaternion.set(0.052, 0, -0.104, 0.993); // reset
leftArm.rotation.set(1.2, 0, 0);
root.updateMatrixWorld(true);
leftForeArm.getWorldPosition(pos);
console.log('After set(1.2,0,0) elbow world pos:', pos);

// Try rotateZ(1.2)
leftArm.quaternion.set(0.052, 0, -0.104, 0.993); // reset
leftArm.rotateZ(1.2);
root.updateMatrixWorld(true);
leftForeArm.getWorldPosition(pos);
console.log('After rotateZ(1.2) elbow world pos:', pos);

// Try rotateX(1.2)
leftArm.quaternion.set(0.052, 0, -0.104, 0.993); // reset
leftArm.rotateX(1.2);
root.updateMatrixWorld(true);
leftForeArm.getWorldPosition(pos);
console.log('After rotateX(1.2) elbow world pos:', pos);

