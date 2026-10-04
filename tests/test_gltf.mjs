import { NodeIO } from '@gltf-transform/core';
import fs from 'fs';

const io = new NodeIO();
async function run() {
  const doc = await io.read('/tmp/avatar.glb');
  const nodes = doc.getRoot().listNodes();
  for (const node of nodes) {
    const name = node.getName();
    if (name.includes('Arm')) {
      console.log(name, node.getRotation());
    }
  }
}
run();
