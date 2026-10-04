import * as THREE from 'three';
import fs from 'fs';

// Read the /tmp/avatar.glb bone names again to be absolutely sure.
const data = fs.readFileSync('/tmp/avatar.glb');
// we just print the exact names.
const names = data.toString('utf8').match(/"name":"([^"]+)"/g);
const unique = [...new Set(names)].map(n => n.split('":"')[1].slice(0, -1));
console.log(unique.filter(n => n.toLowerCase().includes('arm')));
