import * as THREE from 'three';

const root = new THREE.Object3D();
const shoulder = new THREE.Object3D();
shoulder.position.set(0.061, 0.112, -0.087);
root.add(shoulder);

const leftArm = new THREE.Object3D();
leftArm.position.set(-0.003, 0.093, -0.036);
shoulder.add(leftArm);

const leftForeArm = new THREE.Object3D();
leftForeArm.position.set(-0.005, 0.271, 0.002);
leftArm.add(leftForeArm);

leftArm.rotation.set(0, 0, 2.8);
root.updateMatrixWorld(true);
let pos = new THREE.Vector3();
leftForeArm.getWorldPosition(pos);
console.log('Left Elbow at Z=2.8:', pos);

leftArm.rotation.set(0, 0, -2.8);
root.updateMatrixWorld(true);
leftForeArm.getWorldPosition(pos);
console.log('Left Elbow at Z=-2.8:', pos);

