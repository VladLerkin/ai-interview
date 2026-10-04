import * as THREE from 'three';

const root = new THREE.Object3D();
const lshoulder = new THREE.Object3D(); lshoulder.position.set(0.061, 0.112, -0.087); root.add(lshoulder);
const larm = new THREE.Object3D(); larm.position.set(-0.003, 0.093, -0.036); lshoulder.add(larm);
const lfore = new THREE.Object3D(); lfore.position.set(-0.005, 0.271, 0.002); larm.add(lfore);

const rshoulder = new THREE.Object3D(); rshoulder.position.set(-0.061, 0.112, -0.087); root.add(rshoulder);
const rarm = new THREE.Object3D(); rarm.position.set(0.003, 0.093, -0.036); rshoulder.add(rarm);
const rfore = new THREE.Object3D(); rfore.position.set(0.005, 0.271, 0.002); rarm.add(rfore);

// Assume animation sets T-pose (using original GLB_ARM_POSE which user saw as T-pose)
larm.rotation.set(0, 0, 1.2);
rarm.rotation.set(0, 0, -1.2);

// Now test different rotateZ values!
for (let angle of [0, 0.4, 0.6, 0.8, 1.0]) {
  // reset to T-pose
  larm.rotation.set(0, 0, 1.2);
  rarm.rotation.set(0, 0, -1.2);
  
  larm.rotateZ(angle);
  rarm.rotateZ(-angle);
  
  root.updateMatrixWorld(true);
  
  const lp = new THREE.Vector3(); lfore.getWorldPosition(lp);
  console.log(`Angle ${angle}: Left Elbow world pos: x=${lp.x.toFixed(3)}, y=${lp.y.toFixed(3)}, z=${lp.z.toFixed(3)}`);
}
