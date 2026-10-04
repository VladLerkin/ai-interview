import * as THREE from 'three';
const q = new THREE.Quaternion(0.05204965174198151, 1.395004147752843e-7, -0.1045278757810593, 0.9931589961051941);
const e = new THREE.Euler().setFromQuaternion(q);
console.log('Rest pose Euler:', e.x, e.y, e.z);
