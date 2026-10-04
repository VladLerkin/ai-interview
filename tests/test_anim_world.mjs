import * as THREE from 'three';

const root = new THREE.Object3D();
const shoulder = new THREE.Object3D();
shoulder.position.set(0.061, 0.112, -0.087);
root.add(shoulder);

const leftArm = new THREE.Object3D();
leftArm.position.set(-0.003, 0.093, -0.036);
// Suppose the animation puts it in T-pose.
// T-pose means the arm points along world X.
// Local Y points along world X.
// We can construct a quaternion that points local Y to world X, and local Z to world Z.
const m = new THREE.Matrix4().lookAt(new THREE.Vector3(0,0,0), new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0, 1));
leftArm.quaternion.setFromRotationMatrix(m);
shoulder.add(leftArm);

// Now apply local rotateZ
leftArm.rotateZ(1.2);

const leftForeArm = new THREE.Object3D();
leftForeArm.position.set(0, 0.271, 0); // Y is length
leftArm.add(leftForeArm);

root.updateMatrixWorld(true);
let pos = new THREE.Vector3();
leftForeArm.getWorldPosition(pos);
console.log('After rotateZ:', pos);

// Let's reset and try rotateX
leftArm.quaternion.setFromRotationMatrix(m);
leftArm.rotateX(1.2);
root.updateMatrixWorld(true);
leftForeArm.getWorldPosition(pos);
console.log('After rotateX:', pos);
