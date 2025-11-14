
import * as THREE from './three.module.js';
import { GLTFLoader } from './GLTFLoader.js';
import { OrbitControls } from './OrbitControls.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf7f3ff);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth/window.innerHeight, 0.1, 100);
camera.position.set(2, 2, 3);

const renderer = new THREE.WebGLRenderer({antialias:true});
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(5,5,5);
scene.add(light);

const amb = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(amb);

// LOAD MODEL
const loader = new GLTFLoader();
loader.load(
    './assets/models/room.glb',
    (gltf) => {
        const model = gltf.scene;
        model.position.set(0,0,0);
        scene.add(model);
    },
    undefined,
    (err) => console.error("Ошибка загрузки модели:", err)
);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

window.addEventListener('resize', ()=>{
    camera.aspect = window.innerWidth/window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}
animate();
