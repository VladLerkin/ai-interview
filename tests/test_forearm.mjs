import { NodeIO } from '@gltf-transform/core';

const io = new NodeIO();
async function run() {
  const doc = await io.read('/tmp/avatar.glb');
  const nodes = doc.getRoot().listNodes();
  for (const node of nodes) {
    if (node.getName() === 'LeftForeArm') {
      console.log('LeftForeArm rotation:', node.getRotation());
    }
  }
}
run();
