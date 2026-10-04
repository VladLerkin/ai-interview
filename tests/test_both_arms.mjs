import * as THREE from 'three';

function dropArm(armBone, forearm) {
  armBone.parent.updateMatrixWorld(true);
  const startPos = new THREE.Vector3();
  armBone.getWorldPosition(startPos);
  
  const endPos = new THREE.Vector3();
  forearm.getWorldPosition(endPos);

  const currentDir = new THREE.Vector3().subVectors(endPos, startPos).normalize();
  
  const isLeft = startPos.x > 0; 
  const targetDir = new THREE.Vector3(isLeft ? 0.25 : -0.25, -0.95, -0.1).normalize();
  
  if (currentDir.y > -0.5) {
    const axis = new THREE.Vector3().crossVectors(currentDir, targetDir).normalize();
    const angle = currentDir.angleTo(targetDir);
    
    const parentRotInv = armBone.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
    axis.applyQuaternion(parentRotInv);
    
    const localRot = new THREE.Quaternion().setFromAxisAngle(axis, angle);
    armBone.quaternion.premultiply(localRot);
  }
}

const root = new THREE.Object3D();
const lshoulder = new THREE.Object3D(); lshoulder.position.set(0.061, 0.112, -0.087); root.add(lshoulder);
const rshoulder = new THREE.Object3D(); rshoulder.position.set(-0.061, 0.112, -0.087); root.add(rshoulder);

const larm = new THREE.Object3D(); larm.position.set(-0.003, 0.093, -0.036); larm.quaternion.set(0.052, 0, -0.104, 0.993); lshoulder.add(larm);
const lfore = new THREE.Object3D(); lfore.position.set(-0.005, 0.271, 0.002); larm.add(lfore);

const rarm = new THREE.Object3D(); rarm.position.set(0.003, 0.093, -0.036); rarm.quaternion.set(0.052, 0, 0.104, 0.993); rshoulder.add(rarm);
const rfore = new THREE.Object3D(); rfore.position.set(0.005, 0.271, 0.002); rarm.add(rfore);

root.updateMatrixWorld(true);
dropArm(larm, lfore);
dropArm(rarm, rfore);
root.updateMatrixWorld(true);

const lp = new THREE.Vector3(); lfore.getWorldPosition(lp);
const rp = new THREE.Vector3(); rfore.getWorldPosition(rp);
console.log('Left elbow:', lp);
console.log('Right elbow:', rp);

const el = new THREE.Euler().setFromQuaternion(larm.quaternion);
const er = new THREE.Euler().setFromQuaternion(rarm.quaternion);
console.log('Left Euler:', el.x.toFixed(3), el.y.toFixed(3), el.z.toFixed(3));
console.log('Right Euler:', er.x.toFixed(3), er.y.toFixed(3), er.z.toFixed(3));
