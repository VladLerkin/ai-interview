import { NodeIO } from '@gltf-transform/core';
const io = new NodeIO();
async function run() {
  const doc = await io.read('/tmp/avatar.glb');
  const anims = doc.getRoot().listAnimations();
  if (anims.length > 0) {
    const anim = anims[0];
    const channels = anim.listChannels();
    console.log('Channels count:', channels.length);
    channels.slice(0, 10).forEach(c => console.log(c.getTargetNode().getName()));
  } else {
    console.log('No animations!');
  }
}
run();
