import * as THREE from 'three';
import { NodeIO } from '@gltf-transform/core';

const io = new NodeIO();
async function run() {
  const doc = await io.read('/tmp/avatar.glb');
  
  const root = new THREE.Object3D();
  const shoulder = new THREE.Object3D();
  shoulder.position.set(0.061, 0.112, -0.087);
  root.add(shoulder);

  const leftArm = new THREE.Object3D();
  leftArm.position.set(-0.003, 0.093, -0.036);
  // Set rest pose quaternion
  leftArm.quaternion.set(0.052, 0, -0.104, 0.993);
  shoulder.add(leftArm);

  const leftForeArm = new THREE.Object3D();
  leftForeArm.position.set(-0.005, 0.271, 0.002);
  leftArm.add(leftForeArm);

  // Suppose the animation puts it in T-pose (set(0, 0, 1.2))
  leftArm.rotation.set(0, 0, 1.2);
  
  // Now apply local rotation to drop it!
  leftArm.rotateZ(1.57); // 90 degrees
  
  root.updateMatrixWorld(true);
  let pos = new THREE.Vector3();
  leftForeArm.getWorldPosition(pos);
  console.log('After set(0,0,1.2) + rotateZ(1.57):', pos);
  
  leftArm.rotation.set(0, 0, 1.2);
  leftArm.rotateZ(-1.57);
  leftForeArm.getWorldPosition(pos);
  console.log('After set(0,0,1.2) + rotateZ(-1.57):', pos);
  
  leftArm.rotation.set(0, 0, 1.2);
  leftArm.rotateX(1.57);
  leftForeArm.getWorldPosition(pos);
  console.log('After set(0,0,1.2) + rotateX(1.57):', pos);
  
  leftArm.rotation.set(0, 0, 1.2);
  leftArm.rotateX(-1.57);
  leftForeArm.getWorldPosition(pos);
  console.log('After set(0,0,1.2) + rotateX(-1.57):', pos);
}
run();
