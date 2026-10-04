import * as THREE from 'three';

const q = new THREE.Quaternion(0.05204965174198151, 1.395004147752843e-7, -0.1045278757810593, 0.9931589961051941);
const dir = new THREE.Vector3(0, 1, 0);
dir.applyQuaternion(q);
console.log('Rest pose arm direction (local to shoulder):', dir);

const shoulderQ = new THREE.Quaternion(); // Assuming identity for shoulder
console.log('World direction:', dir);
