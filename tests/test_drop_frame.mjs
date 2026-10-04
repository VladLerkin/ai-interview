import * as THREE from 'three';

const root = new THREE.Object3D();
const lshoulder = new THREE.Object3D(); lshoulder.position.set(0.061, 0.112, -0.087); root.add(lshoulder);
const larm = new THREE.Object3D(); larm.position.set(-0.003, 0.093, -0.036); lshoulder.add(larm);
const lfore = new THREE.Object3D(); lfore.position.set(-0.005, 0.271, 0.002); larm.add(lfore);

// Assume animation puts it in T-pose (pointing sideways). Let's construct a T-pose quaternion.
// Left arm points to X > 0.
const m = new THREE.Matrix4().lookAt(new THREE.Vector3(0,0,0), new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 1, 0));
larm.quaternion.setFromRotationMatrix(m);

root.updateMatrixWorld(true);
let lp = new THREE.Vector3(); lfore.getWorldPosition(lp);
let sp = new THREE.Vector3(); larm.getWorldPosition(sp);
console.log('Before drop, elbow pos:', lp);
console.log('Before drop, arm dir:', new THREE.Vector3().subVectors(lp, sp).normalize());

// The drop function (runs every frame)
function dropArmFrame(armBone, forearm) {
  armBone.parent.updateMatrixWorld(true);
  const startPos = new THREE.Vector3();
  armBone.getWorldPosition(startPos);
  
  const endPos = new THREE.Vector3();
  forearm.getWorldPosition(endPos);

  const currentDir = new THREE.Vector3().subVectors(endPos, startPos).normalize();
  
  // Only drop if it's pointing sideways or up (y > -0.5)
  if (currentDir.y > -0.5) {
    const isLeft = startPos.x > 0; 
    // Target direction: down and slightly outwards/forward
    const targetDir = new THREE.Vector3(isLeft ? 0.15 : -0.15, -0.9, 0.1).normalize();
    
    const axis = new THREE.Vector3().crossVectors(currentDir, targetDir).normalize();
    const angle = currentDir.angleTo(targetDir);
    
    // Apply world rotation to bone
    const parentRotInv = armBone.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
    axis.applyQuaternion(parentRotInv);
    
    const localRot = new THREE.Quaternion().setFromAxisAngle(axis, angle);
    armBone.quaternion.premultiply(localRot);
  }
}

dropArmFrame(larm, lfore);
root.updateMatrixWorld(true);
lfore.getWorldPosition(lp);
larm.getWorldPosition(sp);
console.log('After drop, elbow pos:', lp);
console.log('After drop, arm dir:', new THREE.Vector3().subVectors(lp, sp).normalize());

