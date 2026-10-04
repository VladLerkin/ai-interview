import * as THREE from 'three';

const root = new THREE.Object3D();
const shoulder = new THREE.Object3D();
shoulder.position.set(0.061, 0.112, -0.087);
root.add(shoulder);

const leftArm = new THREE.Object3D();
leftArm.position.set(-0.003, 0.093, -0.036);
// Animation puts it in T-pose
leftArm.rotation.set(0, 0, 1.2);
shoulder.add(leftArm);

const leftForeArm = new THREE.Object3D();
leftForeArm.position.set(-0.005, 0.271, 0.002);
leftArm.add(leftForeArm);

// Now apply local rotation!
leftArm.rotateZ(1.2);

root.updateMatrixWorld(true);
let pos = new THREE.Vector3();
leftForeArm.getWorldPosition(pos);
console.log('Left elbow after animation + rotateZ(1.2):', pos);

// Right arm
const rshoulder = new THREE.Object3D();
rshoulder.position.set(-0.061, 0.112, -0.087);
root.add(rshoulder);

const rightArm = new THREE.Object3D();
rightArm.position.set(0.003, 0.093, -0.036);
rightArm.rotation.set(0, 0, -1.2);
rshoulder.add(rightArm);

const rightForeArm = new THREE.Object3D();
rightForeArm.position.set(0.005, 0.271, 0.002);
rightArm.add(rightForeArm);

rightArm.rotateZ(-1.2);
root.updateMatrixWorld(true);
rightForeArm.getWorldPosition(pos);
console.log('Right elbow after animation + rotateZ(-1.2):', pos);
