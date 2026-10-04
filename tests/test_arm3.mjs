import * as THREE from 'three';
import { NodeIO } from '@gltf-transform/core';

const io = new NodeIO();
async function run() {
  const doc = await io.read('/tmp/avatar.glb');
  for (const node of doc.getRoot().listNodes()) {
    if (node.getName() === 'LeftShoulder' || node.getName() === 'RightShoulder') {
      console.log(node.getName(), node.getTranslation());
      for (const child of node.listChildren()) {
        console.log('  Child:', child.getName(), 'trans:', child.getTranslation());
      }
    }
  }
}
run();
