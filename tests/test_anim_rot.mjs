import * as THREE from 'three';
import { NodeIO } from '@gltf-transform/core';

const io = new NodeIO();
async function run() {
  const doc = await io.read('/tmp/avatar.glb');
  const anims = doc.getRoot().listAnimations();
  const leftArmNode = doc.getRoot().listNodes().find(n => n.getName() === 'LeftArm');
  
  if (anims.length > 0 && leftArmNode) {
    const anim = anims[0];
    const channels = anim.listChannels();
    const track = channels.find(c => c.getTargetNode() === leftArmNode && c.getTargetPath() === 'rotation');
    
    if (track) {
      const sampler = track.getSampler();
      // Get the first keyframe quaternion
      const qArray = sampler.getOutput().getArray();
      const q = new THREE.Quaternion(qArray[0], qArray[1], qArray[2], qArray[3]);
      
      const dir = new THREE.Vector3(0, 1, 0);
      dir.applyQuaternion(q);
      console.log('Anim pose arm direction (local to shoulder):', dir);
      
      // Let's see what happens if we rotateZ by 1.2
      const leftArm = new THREE.Object3D();
      leftArm.quaternion.copy(q);
      
      leftArm.rotateZ(1.2);
      const dir2 = new THREE.Vector3(0, 1, 0);
      dir2.applyQuaternion(leftArm.quaternion);
      console.log('After rotateZ(1.2) direction:', dir2);
      
      // Let's see what happens if we rotateZ by -1.2
      leftArm.quaternion.copy(q);
      leftArm.rotateZ(-1.2);
      const dir3 = new THREE.Vector3(0, 1, 0);
      dir3.applyQuaternion(leftArm.quaternion);
      console.log('After rotateZ(-1.2) direction:', dir3);
      
      // Let's see rotateX(1.2)
      leftArm.quaternion.copy(q);
      leftArm.rotateX(1.2);
      const dir4 = new THREE.Vector3(0, 1, 0);
      dir4.applyQuaternion(leftArm.quaternion);
      console.log('After rotateX(1.2) direction:', dir4);
    }
  }
}
run();
