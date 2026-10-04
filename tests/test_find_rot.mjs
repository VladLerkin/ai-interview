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

let bestDist = Infinity;
let bestEuler = null;

const targetY = -0.066;

for (let x = -Math.PI; x <= Math.PI; x += 0.2) {
  for (let z = -Math.PI; z <= Math.PI; z += 0.2) {
    leftArm.rotation.set(x, 0, z);
    root.updateMatrixWorld(true);
    let pos = new THREE.Vector3();
    leftForeArm.getWorldPosition(pos);
    
    // We want arm pointing down (y ~ -0.066) and slightly outwards (x ~ 0.1)
    const dist = Math.pow(pos.y - targetY, 2) + Math.pow(pos.x - 0.1, 2) + Math.pow(pos.z + 0.08, 2);
    if (dist < bestDist) {
      bestDist = dist;
      bestEuler = { x, y: 0, z };
    }
  }
}
console.log('Best Euler for left arm:', bestEuler);
leftArm.rotation.set(bestEuler.x, bestEuler.y, bestEuler.z);
root.updateMatrixWorld(true);
let pos = new THREE.Vector3();
leftForeArm.getWorldPosition(pos);
console.log('Elbow pos:', pos);

// Same for right arm
const rightShoulder = new THREE.Object3D();
rightShoulder.position.set(-0.061, 0.112, -0.087);
root.add(rightShoulder);
const rightArm = new THREE.Object3D();
rightArm.position.set(0.003, 0.093, -0.036);
rightShoulder.add(rightArm);
const rightForeArm = new THREE.Object3D();
rightForeArm.position.set(0.005, 0.271, 0.002); // x offset flipped
rightArm.add(rightForeArm);

bestDist = Infinity;
bestEuler = null;
for (let x = -Math.PI; x <= Math.PI; x += 0.2) {
  for (let z = -Math.PI; z <= Math.PI; z += 0.2) {
    rightArm.rotation.set(x, 0, z);
    root.updateMatrixWorld(true);
    let p = new THREE.Vector3();
    rightForeArm.getWorldPosition(p);
    
    // We want arm pointing down and slightly outwards (x ~ -0.1)
    const dist = Math.pow(p.y - targetY, 2) + Math.pow(p.x + 0.1, 2) + Math.pow(p.z + 0.08, 2);
    if (dist < bestDist) {
      bestDist = dist;
      bestEuler = { x, y: 0, z };
    }
  }
}
console.log('Best Euler for right arm:', bestEuler);

