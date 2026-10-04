import * as THREE from 'three';
import fs from 'fs';
import { NodeIO } from '@gltf-transform/core';

const io = new NodeIO();
async function run() {
  const doc = await io.read('/tmp/avatar.glb');
  const nodes = doc.getRoot().listNodes();
  
  for (const node of nodes) {
    if (node.getName() === 'LeftArm') {
      console.log('LeftArm translation:', node.getTranslation());
      console.log('LeftArm rotation (quat):', node.getRotation());
      
      // Let's check its child (LeftForeArm) to find bone direction
      const children = node.listChildren();
      for (const child of children) {
        console.log('Child:', child.getName());
        console.log('Child translation (bone vector):', child.getTranslation());
      }
    }
  }
}
run();
