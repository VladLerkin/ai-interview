import * as THREE from 'three';

const measure = (container: HTMLElement) => ({
  width: container.clientWidth || window.innerWidth / 2,
  height: container.clientHeight || window.innerHeight,
});

function addStudioLights(scene: THREE.Scene) {
  const keyLight = new THREE.DirectionalLight(0xfff5ee, 3.0);
  keyLight.position.set(1, 2, 3);
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0xb0c4de, 1.5);
  fillLight.position.set(-2, 1, 2);
  scene.add(fillLight);

  const rimLight = new THREE.DirectionalLight(0x6699ff, 1.0);
  rimLight.position.set(0, 2, -3);
  scene.add(rimLight);

  scene.add(new THREE.AmbientLight(0xffffff, 0.8));
}

export interface Stage {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  render: () => void;
  resize: () => void;
  dispose: () => void;
}

/** Creates the renderer, camera, studio lighting and floor grid, and mounts the canvas into `container`. */
export function createStage(container: HTMLDivElement): Stage {
  const scene = new THREE.Scene();

  const { width, height } = measure(container);
  const camera = new THREE.PerspectiveCamera(25, width / height, 0.1, 20);
  camera.position.set(0, 1.35, 1.6);
  camera.lookAt(0, 1.3, 0);

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  container.appendChild(renderer.domElement);

  addStudioLights(scene);
  // Subtle grid
  scene.add(new THREE.GridHelper(10, 20, 0x1a2a3a, 0x1a2a3a));

  return {
    scene,
    camera,
    renderer,
    render: () => renderer.render(scene, camera),
    resize: () => {
      const size = measure(container);
      camera.aspect = size.width / size.height;
      camera.updateProjectionMatrix();
      renderer.setSize(size.width, size.height);
    },
    dispose: () => {
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    },
  };
}
