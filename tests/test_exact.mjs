import * as THREE from 'three';

const root = new THREE.Object3D();
const lshoulder = new THREE.Object3D(); lshoulder.position.set(0.061, 0.112, -0.087); root.add(lshoulder);
const rshoulder = new THREE.Object3D(); rshoulder.position.set(-0.061, 0.112, -0.087); root.add(rshoulder);

const larm = new THREE.Object3D(); larm.position.set(-0.003, 0.093, -0.036); lshoulder.add(larm);
const lfore = new THREE.Object3D(); lfore.position.set(-0.005, 0.271, 0.002); larm.add(lfore);

const rarm = new THREE.Object3D(); rarm.position.set(0.003, 0.093, -0.036); rshoulder.add(rarm);
const rfore = new THREE.Object3D(); rfore.position.set(0.005, 0.271, 0.002); rarm.add(rfore);

// Apply hardcoded Euler angles (stripped animation tracks)
larm.rotation.set(0.118, -0.022, -2.904);
rarm.rotation.set(0.118, 0.022, 2.904);

root.updateMatrixWorld(true);

const lp = new THREE.Vector3(); lfore.getWorldPosition(lp);
const rp = new THREE.Vector3(); rfore.getWorldPosition(rp);
console.log('Left elbow:', lp);
console.log('Right elbow:', rp);

