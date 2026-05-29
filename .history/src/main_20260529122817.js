import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import {
  EffectComposer,
  RenderPass,
  NormalPass,
  EffectPass,
  SSAOEffect,
  BloomEffect,
  GodRaysEffect,
  ToneMappingEffect,
  BlendFunction,
  KernelSize,
  ToneMappingMode
} from "postprocessing";
import * as CANNON from "cannon-es";

const MODEL_URLS = {
  day: "/model/Day.glb",
  night: "/model/Night.glb",
};
THREE.Cache.enabled = false;

const MODEL_VERTICAL_OFFSET = 0;
const EXPLORE_EYE_HEIGHT = 0.505;
const EXPLORE_WALK_SPEED = 2.15;
const EXPLORE_RUN_SPEED = 3.35;
const EXPLORE_ACCELERATION = 18;
const EXPLORE_FRICTION = 14;
const EXPLORE_GRAVITY = 11;
const EXPLORE_JUMP_SPEED = 3.35;
const EXPLORE_COLLISION_RADIUS = 0.42;

const shell = document.querySelector(".experience-shell");
const canvas = document.querySelector("#campus-canvas");
const loadingScreen = document.querySelector("#loading-screen");
const modelStatus = document.querySelector("#model-status");
const modeStatus = document.querySelector("#mode-status");
const lightingStatus = document.querySelector("#lighting-status");
const focusButton = document.querySelector("#focus-model");
const walkButton = document.querySelector("#toggle-walk");
const heroWalkButton = document.querySelector("#toggle-walk-hero");
const settingsToggle = document.querySelector("#toggle-controls");
const settingsToggleLabel = settingsToggle.querySelector(".sr-only");
const pickFocusButton = document.querySelector("#pick-focus");
const exposureSlider = document.querySelector("#exposure-slider");
const autoRotate = document.querySelector("#auto-rotate");
const presetButtons = [...document.querySelectorAll("[data-preset]")];
const cameraButtons = [...document.querySelectorAll("[data-camera]")];

let ssaoEffect, godRaysEffect, bloomEffect, toneMappingEffect;
let sunLightMesh;
let sunRaysSprite = null;

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: false,
  alpha: false,
  logarithmicDepthBuffer: true,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x86cfff);
scene.fog = null;

const focusMarker = createFocusMarker();
scene.add(focusMarker);

const camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.08, 2200);
camera.position.set(26, 18, 32);

// Sun Mesh for God Rays
const sunGeometry = new THREE.SphereGeometry(18, 32, 32);
const sunMaterial = new THREE.MeshBasicMaterial({
  color: 0xffc35f,
  transparent: true,
  opacity: 0.52,
  blending: THREE.AdditiveBlending,
  toneMapped: false,
  fog: false,
});
sunLightMesh = new THREE.Mesh(sunGeometry, sunMaterial);
sunLightMesh.visible = false;
scene.add(sunLightMesh);

const composer = new EffectComposer(renderer, {
  frameBufferType: THREE.HalfFloatType,
  multisampling: 4
});
const renderPass = new RenderPass(scene, camera);
const normalPass = new NormalPass(scene, camera);

composer.addPass(renderPass);
composer.addPass(normalPass);

// SSAO Effect
ssaoEffect = new SSAOEffect(camera, normalPass.texture, {
  blendFunction: BlendFunction.MULTIPLY,
  distanceScaling: true,
  depthAwareBias: true,
  samples: 16,
  rings: 4,
  distanceThreshold: 1.0,
  distanceFalloff: 0.0,
  rangeThreshold: 0.5,
  rangeFalloff: 0.1,
  luminanceInfluence: 0.48,
  radius: 0.22,
  scale: 1.0,
  bias: 0.025,
  intensity: 1.35
});

// God Rays (using sunLightMesh as the source)
godRaysEffect = new GodRaysEffect(camera, sunLightMesh, {
  height: 480,
  kernelSize: KernelSize.MEDIUM,
  density: 0.28,
  decay: 0.88,
  weight: 0.06,
  exposure: 0.09,
  clampMax: 0.18,
  color: new THREE.Color(0xffd08a),
  blur: true
});
godRaysEffect.blendMode.blendFunction = BlendFunction.ADD;

// Bloom Effect
bloomEffect = new BloomEffect({
  blendFunction: BlendFunction.ADD,
  mipmapBlur: true,
  luminanceThreshold: 0.72,
  luminanceSmoothing: 0.16,
  intensity: 0.16
});

// Tone Mapping Effect
toneMappingEffect = new ToneMappingEffect({
  mode: ToneMappingMode.ACES_FILMIC,
  exposure: Number(exposureSlider.value)
});

// Combine all effects into a single EffectPass (vignette-free)
const effectPass = new EffectPass(
  camera,
  ssaoEffect,
  godRaysEffect,
  bloomEffect,
  toneMappingEffect
);
composer.addPass(effectPass);

// Function to generate a highly reflective, beautiful sunny environment map
function createCustomDayEnvironment(renderer) {
  const envScene = new THREE.Scene();

  envScene.background = new THREE.Color(0x9fdbff);

  // Dark horizon ground plane to create high specular contrast and a beautiful horizon line in reflections
  const groundGeom = new THREE.PlaneGeometry(350, 350);
  const groundMat = new THREE.MeshBasicMaterial({
    color: 0x141f19, // Dark forest-green/grey ground
    toneMapped: false
  });
  const groundMesh = new THREE.Mesh(groundGeom, groundMat);
  groundMesh.rotation.x = -Math.PI / 2;
  groundMesh.position.y = -10;
  envScene.add(groundMesh);

  // Super-bright white-gold Sun sphere to cast beautiful specular reflections on glass and metal
  const sunGeom = new THREE.SphereGeometry(18, 16, 16);
  const sunMat = new THREE.MeshBasicMaterial({
    color: 0xffd276,
    toneMapped: false
  });
  const sunMesh = new THREE.Mesh(sunGeom, sunMat);
  sunMesh.position.set(-104, 124, -132);
  envScene.add(sunMesh);

  // Sky dome with a subtle vertical gradient (darker blue at the zenith) to look highly realistic
  const skyGeom = new THREE.SphereGeometry(140, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  const skyMat = new THREE.MeshBasicMaterial({
    color: 0x67bbff,
    side: THREE.BackSide,
    toneMapped: false
  });
  const skyMesh = new THREE.Mesh(skyGeom, skyMat);
  envScene.add(skyMesh);

  // A lower sky band to simulate the bright horizon haze
  const hazeGeom = new THREE.CylinderGeometry(138, 138, 30, 16, 1, true);
  const hazeMat = new THREE.MeshBasicMaterial({
    color: 0xdff4ff,
    side: THREE.BackSide,
    toneMapped: false
  });
  const hazeMesh = new THREE.Mesh(hazeGeom, hazeMat);
  hazeMesh.position.y = 10;
  envScene.add(hazeMesh);

  // High-intensity white reflective panels to act as architectural reflection boards
  const panelGeom = new THREE.BoxGeometry(45, 45, 2);

  // Bright white reflective panel
  const panel1Mat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  const panel1 = new THREE.Mesh(panelGeom, panel1Mat);
  panel1.position.set(100, 40, 100);
  panel1.lookAt(0, 0, 0);
  envScene.add(panel1);

  // Warm golden sun-bounce reflective panel
  const panel2Mat = new THREE.MeshBasicMaterial({ color: 0xffeab3, toneMapped: false });
  const panel2 = new THREE.Mesh(panelGeom, panel2Mat);
  panel2.position.set(-100, 70, 60);
  panel2.lookAt(0, 0, 0);
  envScene.add(panel2);

  // Cool skylight fill reflective panel
  const panel3Mat = new THREE.MeshBasicMaterial({ color: 0xa8d3ff, toneMapped: false });
  const panel3 = new THREE.Mesh(panelGeom, panel3Mat);
  panel3.position.set(20, 90, -100);
  panel3.lookAt(0, 0, 0);
  envScene.add(panel3);

  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  pmremGenerator.compileEquirectangularShader();

  const envRT = pmremGenerator.fromScene(envScene, 0.04);

  // Cleanup geometries/materials
  envScene.traverse((node) => {
    if (node.geometry) node.geometry.dispose();
    if (node.material) node.material.dispose();
  });
  pmremGenerator.dispose();

  return envRT.texture;
}

const dayEnvironment = createCustomDayEnvironment(renderer);
scene.environment = dayEnvironment;

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.085;
controls.screenSpacePanning = false;
controls.enablePan = true;
controls.panSpeed = 0.42;
controls.rotateSpeed = 0.58;
controls.zoomSpeed = 0.82;
controls.minPolarAngle = Math.PI * 0.12;
controls.maxPolarAngle = Math.PI * 0.54;
controls.minDistance = 7;
controls.maxDistance = 70;
controls.autoRotate = autoRotate.checked;
controls.autoRotateSpeed = 0.32;

const world = new CANNON.World({
  gravity: new CANNON.Vec3(0, -18, 0),
});
world.broadphase = new CANNON.SAPBroadphase(world);
world.allowSleep = true;

const groundMaterial = new CANNON.Material("ground");
const playerMaterial = new CANNON.Material("player");
world.addContactMaterial(
  new CANNON.ContactMaterial(groundMaterial, playerMaterial, {
    friction: 0.08,
    restitution: 0,
  }),
);

const groundBody = new CANNON.Body({
  mass: 0,
  material: groundMaterial,
  shape: new CANNON.Plane(),
});
groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
world.addBody(groundBody);

const playerBody = new CANNON.Body({
  mass: 2,
  linearDamping: 0.82,
  angularDamping: 1,
  fixedRotation: true,
  material: playerMaterial,
  shape: new CANNON.Sphere(0.8),
  position: new CANNON.Vec3(0, 3, 20),
});
world.addBody(playerBody);

const NIGHT_EMISSIVE_INTENSITY = 10.2;
const NIGHT_EMISSIVE_TEXTURE_INTENSITY = 9.5;
const NIGHT_AMBIENT_INTENSITY = 1;
const NIGHT_FLAT_AMBIENT_INTENSITY = 1;
const NIGHT_MODEL_LIGHT_LIMIT = 150;
const NIGHT_MODEL_LIGHT_INTENSITY_SCALE = 0.42;
const NIGHT_MODEL_LIGHT_MIN_INTENSITY = 1.2;
const NIGHT_MODEL_LIGHT_MAX_INTENSITY = 8.5;
const NIGHT_MODEL_LIGHT_DISTANCE_SCALE = 4.6;
const NIGHT_MODEL_LIGHT_MIN_DISTANCE = 16;
const NIGHT_MODEL_LIGHT_MAX_DISTANCE = 64;
const NIGHT_MODEL_LIGHT_SURFACE_OFFSET = 1.35;
const NIGHT_MODEL_LIGHT_DECAY = 1.05;
const NIGHT_EMISSIVE_FALLBACK_COLOR = 0xffd18a;
const NIGHT_FORCED_EMISSIVE_MATERIALS = new Set([
  "UIT_glasswindow_main_LIGHT_ON.002",
  "M06_Steel_Smoke_VERTICAL_WINDOW_LIGHTS_V3.002",
]);
const NIGHT_BLOOM_STRENGTH = 0.62;
const NIGHT_BLOOM_RADIUS = 0.5;
const NIGHT_BLOOM_THRESHOLD = 0.3;
const NIGHT_STAR_COUNT = 1400;
const NIGHT_PARTICLE_COUNT = 280;
const NIGHT_ATMOSPHERE_RADIUS = 120;
const DAY_PARTICLE_COUNT = 360;
const DAY_CLOUD_COUNT = 15;
const ORBIT_MAX_DISTANCE_SCALE = 1.2;
const ORBIT_MAX_DISTANCE_MIN = 1;
const DAY_ATMOSPHERE_RADIUS = 560;
const DAY_SUN_OCCLUSION_RADIUS = 0.18;
const DAY_SUN_OCCLUSION_SOFTNESS = 0.18;
const DAY_SUN_OCCLUSION_DAMPING = 10;
const DAY_SUN_VISUAL_SCALE = 2.35;
const DEBUG_NIGHT_LIGHTS = false;
const DAY_REFLECTIVE_MATERIAL_NAMES = ["M06_Steel_Smoke", "UIT_main_blue"];

const hemisphereLight = new THREE.HemisphereLight(0xffefcf, 0x2a342f, 1.5);
scene.add(hemisphereLight);

const ambientLight = new THREE.AmbientLight(0x6f7fa6, 0);
scene.add(ambientLight);

const DAY_SUN_DIRECTION = new THREE.Vector3(-0.52, 0.34, -0.78).normalize();
const DAY_SUN_LIGHT_POSITION = new THREE.Vector3(-42, 78, -86);
const DAY_SUN_LIGHT_CLEAR_INTENSITY = 5.15;
const DAY_SUN_LIGHT_OCCLUDED_INTENSITY = 3.65;
const DAY_FILL_CLEAR_INTENSITY = 0.36;
const DAY_FILL_OCCLUDED_INTENSITY = 0.48;

const sunLight = new THREE.DirectionalLight(0xffc46f, DAY_SUN_LIGHT_CLEAR_INTENSITY);
sunLight.position.copy(DAY_SUN_LIGHT_POSITION);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(4096, 4096);
sunLight.shadow.camera.near = 1;
sunLight.shadow.camera.far = 180;
sunLight.shadow.camera.left = -70;
sunLight.shadow.camera.right = 70;
sunLight.shadow.camera.top = 70;
sunLight.shadow.camera.bottom = -70;
sunLight.shadow.bias = -0.0004;
sunLight.shadow.normalBias = 0.018;
scene.add(sunLight);

const daySunSprite = new THREE.Sprite(
  new THREE.SpriteMaterial({
    map: createSunDiscTexture(),
    color: 0xfff2c9,
    transparent: true,
    opacity: 0.9,
    depthTest: false,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
    fog: false,
  }),
);
daySunSprite.visible = false;
scene.add(daySunSprite);

const daySunGlow = new THREE.Sprite(
  new THREE.SpriteMaterial({
    map: createRadialTexture("rgba(255,202,118,0.5)", "rgba(255,154,70,0)"),
    color: 0xffc070,
    transparent: true,
    opacity: 0.18,
    depthTest: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
    fog: false,
  }),
);
daySunGlow.visible = false;
daySunGlow.renderOrder = 19;
scene.add(daySunGlow);

const daySunOuterGlow = new THREE.Sprite(
  new THREE.SpriteMaterial({
    map: createRadialTexture("rgba(255,178,92,0.18)", "rgba(255,158,88,0)"),
    color: 0xffb16a,
    transparent: true,
    opacity: 0.08,
    depthTest: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
    fog: false,
  }),
);
daySunOuterGlow.visible = false;
daySunOuterGlow.renderOrder = 18;
scene.add(daySunOuterGlow);

const dayLightHaze = createDayLightHaze();
dayLightHaze.visible = false;
scene.add(dayLightHaze);

sunRaysSprite = new THREE.Mesh(
  new THREE.PlaneGeometry(1, 1),
  new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    depthWrite: false,
  }),
);
sunRaysSprite.visible = false;
sunRaysSprite.renderOrder = 17;
sunRaysSprite.frustumCulled = false;
scene.add(sunRaysSprite);

const fillLight = new THREE.DirectionalLight(0x86b7ff, 0.55);
fillLight.position.set(-28, 20, -24);
scene.add(fillLight);

const moonLight = new THREE.DirectionalLight(0x8fb8ff, 0);
moonLight.position.set(-42, 68, -58);
scene.add(moonLight);

const sunBeams = createSunBeams();
sunBeams.visible = false;

const campusRoot = new THREE.Group();
scene.add(campusRoot);

const ground = createGround();
ground.visible = false;
const helperGrid = createGrid();
helperGrid.visible = false;

const lampLights = createCampusLamps();
const trees = createTreeLine();

const modelBounds = {
  center: new THREE.Vector3(0, 3, 0),
  radius: 34,
  size: new THREE.Vector3(42, 18, 42),
  min: new THREE.Vector3(-21, 0, -21),
  max: new THREE.Vector3(21, 18, 21),
};

const modelLightGroup = new THREE.Group();
scene.add(modelLightGroup);

let activePreset = "day";
let daySunOcclusion = 0;

const dayAtmosphere = createDayAtmosphere();
scene.add(dayAtmosphere.group);
let cloudsEnabled = true;
setDayAtmosphereActive(true);

const nightAtmosphere = createNightAtmosphere();
scene.add(nightAtmosphere.group);
setNightAtmosphereActive(false);

const keys = new Set();
const clock = new THREE.Clock();
const modelColliders = [];

const cameraState = {
  preset: "overview",
};
const cameraTransition = {
  active: false,
  elapsed: 0,
  duration: 0.85,
  fromPosition: new THREE.Vector3(),
  toPosition: new THREE.Vector3(),
  fromTarget: new THREE.Vector3(),
  toTarget: new THREE.Vector3(),
};
const exploreIntro = {
  active: false,
  elapsed: 0,
  duration: 0.95,
  fromPosition: new THREE.Vector3(),
  toPosition: new THREE.Vector3(),
  fromLook: new THREE.Vector3(),
  toLook: new THREE.Vector3(),
};
const focusRaycaster = new THREE.Raycaster();
const focusPointer = new THREE.Vector2();
const focusGroundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -MODEL_VERTICAL_OFFSET);
const focusScratchPoint = new THREE.Vector3();
const focusPickState = {
  active: false,
  pointerDown: null,
};

let walkMode = false;
let pendingExploreMode = false;
let yaw = 0;
let pitch = -0.12;
let draggingLook = false;
let lastPointer = new THREE.Vector2();
const explorePosition = new THREE.Vector3(0, 1.05, 20);
const exploreVelocity = new THREE.Vector3();
let exploreVelocityY = 0;
let exploreGrounded = true;
let exploreWalkTime = 0;
let currentModel = null;
let loadToken = 0;
let physicsBoundsBuilt = false;
let hasFocusedInitialModel = false;
let hasLoggedNightMaterials = false;

applyLightingPreset("day");
animate();

controls.addEventListener("start", () => {
  cameraTransition.active = false;
  hideIntro();
});

focusButton.addEventListener("click", () => {
  hideIntro();
  setFocusPickMode(false);
  focusModel("overview");
});

walkButton.addEventListener("click", () => {
  hideIntro();
  setWalkMode(!walkMode);
});

heroWalkButton.addEventListener("click", () => {
  hideIntro();
  setFocusPickMode(false);
  setWalkMode(true);
});

settingsToggle.addEventListener("click", () => {
  const isHidden = shell.classList.toggle("controls-hidden");
  const label = isHidden ? "Show controls" : "Hide controls";
  settingsToggleLabel.textContent = label;
  settingsToggle.setAttribute("aria-label", label);
  settingsToggle.setAttribute("aria-expanded", String(!isHidden));
  settingsToggle.title = label;
});

pickFocusButton.addEventListener("click", () => {
  hideIntro();
  setFocusPickMode(!focusPickState.active);
});

autoRotate.addEventListener("change", () => {
  hideIntro();
  controls.autoRotate = autoRotate.checked && !walkMode;
});

exposureSlider.addEventListener("input", () => {
  hideIntro();
  const val = Number(exposureSlider.value);
  renderer.toneMappingExposure = val;
  if (toneMappingEffect) {
    toneMappingEffect.exposure = val;
  }
});

presetButtons.forEach((button) => {
  button.addEventListener("click", () => {
    hideIntro();
    applyLightingPreset(button.dataset.preset);
  });
});

cameraButtons.forEach((button) => {
  button.addEventListener("click", () => {
    hideIntro();
    setFocusPickMode(false);
    focusModel(button.dataset.camera);
  });
});

window.addEventListener("keydown", (event) => {
  hideIntro();
  keys.add(event.code);
  if (walkMode && ["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(event.code)) {
    event.preventDefault();
  }
  if (event.code === "Digit1") {
    focusModel("overview");
  }
  if (event.code === "Digit2") {
    focusModel("close");
  }
  if (event.code === "Digit3") {
    focusModel("top");
  }
  if (event.code === "Escape" && focusPickState.active) {
    event.preventDefault();
    setFocusPickMode(false);
    return;
  }
  if (event.code === "Escape" && walkMode) {
    setWalkMode(false);
  }
});

window.addEventListener("keyup", (event) => keys.delete(event.code));

document.addEventListener("pointerlockchange", () => {
  if (document.pointerLockElement !== renderer.domElement) {
    draggingLook = false;
    if (walkMode) {
      setWalkMode(false);
    }
  }
});

window.addEventListener("mousemove", (event) => {
  if (!walkMode || document.pointerLockElement !== renderer.domElement) {
    return;
  }

  yaw -= event.movementX * 0.0025;
  pitch = THREE.MathUtils.clamp(pitch - event.movementY * 0.0022, -Math.PI * 0.49, Math.PI * 0.49);
});

renderer.domElement.addEventListener("pointerdown", (event) => {
  hideIntro();
  if (focusPickState.active) {
    focusPickState.pointerDown = { x: event.clientX, y: event.clientY };
    event.preventDefault();
    renderer.domElement.setPointerCapture?.(event.pointerId);
    return;
  }

  if (!walkMode) {
    return;
  }

  renderer.domElement.requestPointerLock?.();
  draggingLook = true;
  lastPointer.set(event.clientX, event.clientY);
  renderer.domElement.setPointerCapture(event.pointerId);
});

renderer.domElement.addEventListener("pointermove", (event) => {
  if (focusPickState.active) {
    updateFocusPreview(event);
    return;
  }

  if (!walkMode || !draggingLook) {
    return;
  }
  if (document.pointerLockElement === renderer.domElement) {
    return;
  }

  const dx = event.clientX - lastPointer.x;
  const dy = event.clientY - lastPointer.y;
  lastPointer.set(event.clientX, event.clientY);
  yaw -= dx * 0.004;
  pitch = THREE.MathUtils.clamp(pitch - dy * 0.0032, -Math.PI * 0.49, Math.PI * 0.49);
});

renderer.domElement.addEventListener("pointerup", (event) => {
  if (focusPickState.active) {
    const pointerDown = focusPickState.pointerDown;
    focusPickState.pointerDown = null;
    if (renderer.domElement.hasPointerCapture(event.pointerId)) {
      renderer.domElement.releasePointerCapture(event.pointerId);
    }

    const moved = pointerDown
      ? Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y)
      : 0;
    if (moved < 10) {
      pickFocusFromPointer(event);
    }
    return;
  }

  draggingLook = false;
  if (renderer.domElement.hasPointerCapture(event.pointerId)) {
    renderer.domElement.releasePointerCapture(event.pointerId);
  }
});

renderer.domElement.addEventListener("dblclick", (event) => {
  if (walkMode || pendingExploreMode) {
    return;
  }

  hideIntro();
  setFocusPickMode(false);
  const hit = getFocusPick(event);
  if (hit) {
    focusOnPickedPoint(hit.point, hit.normal);
  }
});

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

function hideIntro() {
  shell.classList.add("is-exploring");
}

function loadModel(preset) {
  const loader = new GLTFLoader();
  const token = ++loadToken;
  modelStatus.textContent = `Loading ${preset}`;
  loadingScreen.classList.remove("is-hidden");

  loader.load(
    `${MODEL_URLS[preset]}?reload=${Date.now()}`,
    (gltf) => {
      if (token !== loadToken) {
        disposeModel(gltf.scene);
        return;
      }

      if (currentModel) {
        campusRoot.remove(currentModel);
        disposeModel(currentModel);
      }

      const model = gltf.scene;
      const rawBox = new THREE.Box3().setFromObject(model);
      const rawSize = rawBox.getSize(new THREE.Vector3());
      const maxDimension = Math.max(rawSize.x, rawSize.y, rawSize.z);
      const targetDimension = 42;
      const modelScale = maxDimension > 0 ? targetDimension / maxDimension : 1;
      model.scale.setScalar(modelScale);

      const scaledBox = new THREE.Box3().setFromObject(model);
      const scaledCenter = scaledBox.getCenter(new THREE.Vector3());
      model.position.sub(scaledCenter);

      const finalBox = new THREE.Box3().setFromObject(model);
      model.position.y -= finalBox.min.y;
      model.position.y += MODEL_VERTICAL_OFFSET;
      model.updateWorldMatrix(true, true);
      model.traverse((node) => {
        if (!node.isMesh) {
          return;
        }

        node.castShadow = true;
        node.receiveShadow = true;
        if (node.material) {
          prepareMaterial(node, preset);
        }
      });
      if (preset === "night") {
        hasLoggedNightMaterials = true;
      }
      campusRoot.add(model);
      currentModel = model;
      modelColliders.length = 0;
      rebuildModelLights(preset);
      rebuildExploreColliders();

      const bounds = new THREE.Box3().setFromObject(campusRoot);
      bounds.getCenter(modelBounds.center);
      const size = bounds.getSize(new THREE.Vector3());
      modelBounds.size.copy(size);
      modelBounds.min.copy(bounds.min);
      modelBounds.max.copy(bounds.max);
      modelBounds.radius = Math.max(size.x, size.y, size.z) * 0.72;
      configureOrbitCamera(size);
      refreshDayAtmosphere();
      refreshNightDust();

      if (!physicsBoundsBuilt) {
        buildPhysicsBounds(size);
        setWalkSpawn(size);
        physicsBoundsBuilt = true;
      }

      if (!hasFocusedInitialModel) {
        focusModel("overview");
        hasFocusedInitialModel = true;
      }

      modelStatus.textContent = preset === "day" ? "Day.glb" : "Night.glb";
      loadingScreen.classList.add("is-hidden");
    },
    undefined,
    (error) => {
      console.error(error);
      modelStatus.textContent = "Error";
      loadingScreen.querySelector("span").textContent = "Khong load duoc model GLB";
    },
  );
}

function convertToPhysical(mat) {
  if (!mat || mat.isMeshPhysicalMaterial) return mat;
  const newMat = new THREE.MeshPhysicalMaterial();

  newMat.name = mat.name || "";
  if (mat.color) newMat.color.copy(mat.color);
  newMat.roughness = mat.roughness !== undefined ? mat.roughness : 0.5;
  newMat.metalness = mat.metalness !== undefined ? mat.metalness : 0.0;

  if (mat.map) newMat.map = mat.map;
  if (mat.lightMap) newMat.lightMap = mat.lightMap;
  if (mat.lightMapIntensity !== undefined) newMat.lightMapIntensity = mat.lightMapIntensity;
  if (mat.aoMap) newMat.aoMap = mat.aoMap;
  if (mat.aoMapIntensity !== undefined) newMat.aoMapIntensity = mat.aoMapIntensity;
  if (mat.emissive) newMat.emissive.copy(mat.emissive);
  if (mat.emissiveIntensity !== undefined) newMat.emissiveIntensity = mat.emissiveIntensity;
  if (mat.emissiveMap) newMat.emissiveMap = mat.emissiveMap;
  if (mat.bumpMap) newMat.bumpMap = mat.bumpMap;
  if (mat.bumpScale !== undefined) newMat.bumpScale = mat.bumpScale;
  if (mat.normalMap) newMat.normalMap = mat.normalMap;
  if (mat.normalScale) newMat.normalScale.copy(mat.normalScale);
  if (mat.displacementMap) newMat.displacementMap = mat.displacementMap;
  if (mat.displacementScale !== undefined) newMat.displacementScale = mat.displacementScale;
  if (mat.displacementBias !== undefined) newMat.displacementBias = mat.displacementBias;
  if (mat.roughnessMap) newMat.roughnessMap = mat.roughnessMap;
  if (mat.metalnessMap) newMat.metalnessMap = mat.metalnessMap;
  if (mat.alphaMap) newMat.alphaMap = mat.alphaMap;
  if (mat.envMap) newMat.envMap = mat.envMap;
  if (mat.envMapIntensity !== undefined) newMat.envMapIntensity = mat.envMapIntensity;

  newMat.transparent = mat.transparent;
  newMat.opacity = mat.opacity;
  newMat.side = mat.side;
  newMat.depthWrite = mat.depthWrite;
  newMat.depthTest = mat.depthTest;
  newMat.blending = mat.blending;
  newMat.alphaTest = mat.alphaTest;
  newMat.visible = mat.visible;
  newMat.shadowSide = mat.shadowSide;

  return newMat;
}

function prepareMaterial(node, preset) {
  if (Array.isArray(node.material)) {
    node.material = node.material.map((material) => {
      const cloned = material.clone();
      return preset === "day" ? convertToPhysical(cloned) : cloned;
    });
  } else {
    const cloned = node.material.clone();
    node.material = preset === "day" ? convertToPhysical(cloned) : cloned;
  }

  const materials = Array.isArray(node.material) ? node.material : [node.material];
  const surfaceInfo = getSurfaceInfo(node);
  const materialSurfaceInfo = getMaterialSurfaceInfo(node);
  if (surfaceInfo.isFlatSurface && !surfaceInfo.isRoadLike) {
    node.position.y += 0.002 + (node.id % 5) * 0.0008;
    node.updateMatrixWorld(true);
  }

  materials.forEach((material, index) => {
    logNightMaterial(material, preset);
    const localSurfaceInfo = materialSurfaceInfo.get(index) || surfaceInfo;
    const authoredEmissiveIntensity = material.emissiveIntensity || 0;
    material.userData.authoredEmissiveIntensity = authoredEmissiveIntensity;
    material.envMapIntensity = preset === "night" ? 0.035 : 1.15;
    material.polygonOffset = localSurfaceInfo.isFlatSurface;
    material.polygonOffsetFactor = localSurfaceInfo.isFlatSurface ? 1.4 : 0;
    material.polygonOffsetUnits = localSurfaceInfo.isFlatSurface ? 1.4 : 0;

    if (preset === "night" && isForcedNightEmitter(material) && material.color) {
      material.color.set(NIGHT_EMISSIVE_FALLBACK_COLOR);
      material.toneMapped = false;
    }

    if (preset === "night" && "emissive" in material) {
      const hasAuthoredEmission = materialHasEmission(material);

      if (hasAuthoredEmission) {
        if (isForcedNightEmitter(material) || isBlackColor(material.emissive)) {
          material.emissive.copy(getNightEmitterColor(material));
        }
        material.emissiveIntensity = Math.max(
          authoredEmissiveIntensity,
          material.emissiveMap || isForcedNightEmitter(material)
            ? NIGHT_EMISSIVE_TEXTURE_INTENSITY
            : NIGHT_EMISSIVE_INTENSITY,
        );
        material.toneMapped = false;
      } else {
        material.emissive.set(0x000000);
        material.emissiveIntensity = 0;
        if (localSurfaceInfo.isRoadLike && material.color) {
          material.color.multiplyScalar(0.18);
        }
        material.toneMapped = true;
      }
    }

    if (preset === "day" && "emissive" in material) {
      material.emissive.set(0x000000);
      material.emissiveIntensity = 0;
      material.toneMapped = true;
    }

    if (preset === "day") {
      material.transparent = false;
      material.opacity = 1;
      material.depthWrite = true;
      if ("transmission" in material) {
        material.transmission = 0;
      }
      if ("thickness" in material) {
        material.thickness = 0;
      }

      try {
        const matName = (material.name || "").toLowerCase();

        if (matName.includes("glass") || matName.includes("window")) {
          if (material.color) {
            material.color.setHex(0xf7fcff);
          }
          material.roughness = 0.035;
          material.metalness = 0.05;
          material.envMapIntensity = 2.4;
          material.ior = 1.52;
          material.thickness = 0;
          material.clearcoat = 1.0;
          material.clearcoatRoughness = 0.035;
        } else if (
          matName.includes("metal") ||
          matName.includes("steel") ||
          matName.includes("iron") ||
          matName.includes("chrome") ||
          matName.includes("copper") ||
          matName.includes("aluminum") ||
          materialShouldReflectInDay(material)
        ) {
          material.roughness = 0.16;
          material.metalness = 0.82;
          material.envMapIntensity = 1.9;
          material.clearcoat = 0.75;
          material.clearcoatRoughness = 0.09;
        } else if (
          matName.includes("grass") ||
          matName.includes("ground") ||
          matName.includes("terrain") ||
          matName.includes("lawn") ||
          matName.includes("soil") ||
          matName.includes("earth")
        ) {
          material.roughness = 0.92;
          material.metalness = 0.0;
          material.envMapIntensity = 0.25;
          material.clearcoat = 0.0;
        } else if (
          matName.includes("concrete") ||
          matName.includes("wall") ||
          matName.includes("stone") ||
          matName.includes("brick") ||
          matName.includes("column") ||
          matName.includes("pillar") ||
          matName.includes("building_main") ||
          matName.includes("structure")
        ) {
          material.roughness = 0.75;
          material.metalness = 0.02;
          material.envMapIntensity = 0.65;
          material.clearcoat = 0.1;
          material.clearcoatRoughness = 0.36;
        } else {
          material.envMapIntensity = 1.05;
          material.roughness = Math.max(material.roughness ?? 0.5, 0.38);
          material.metalness = Math.min(Math.max(material.metalness ?? 0.0, 0.04), 0.18);
          material.clearcoat = 0.22;
          material.clearcoatRoughness = 0.22;
        }
      } catch (err) {
        console.warn("Could not enhance physical properties of material:", material.name, err);
      }
      forceOpaqueMaterial(material);
    }

    material.needsUpdate = true;
  });
}

function forceOpaqueMaterial(material) {
  material.transparent = false;
  material.opacity = 1;
  material.alphaMap = null;
  material.alphaTest = 0;
  material.blending = THREE.NormalBlending;
  material.depthTest = true;
  material.depthWrite = true;
  material.premultipliedAlpha = false;

  if ("transmission" in material) {
    material.transmission = 0;
  }
  if ("transmissionMap" in material) {
    material.transmissionMap = null;
  }
  if ("thickness" in material) {
    material.thickness = 0;
  }
  if ("thicknessMap" in material) {
    material.thicknessMap = null;
  }
  if ("attenuationDistance" in material) {
    material.attenuationDistance = Infinity;
  }
}

function materialShouldReflectInDay(material) {
  const name = material.name || "";
  return DAY_REFLECTIVE_MATERIAL_NAMES.some((targetName) => name.includes(targetName));
}

function logNightMaterial(material, preset) {
  if (preset !== "night" || hasLoggedNightMaterials) {
    return;
  }

  const name = material.name || "";
  if (name.toUpperCase().includes("WINDOW") || name.toUpperCase().includes("LIGHT") || name.toUpperCase().includes("GLASS")) {
    if (DEBUG_NIGHT_LIGHTS) {
      console.info("Night material candidate:", name);
    }
  }
}

function materialHasEmission(material) {
  if (!material) {
    return false;
  }

  if (isForcedNightEmitter(material) || materialNameLooksEmissive(material)) {
    return true;
  }

  if (!("emissive" in material)) {
    return false;
  }

  const emissivePower = material.emissive.r + material.emissive.g + material.emissive.b;
  return (
    Boolean(material.emissiveMap) ||
    emissivePower * Math.max(material.emissiveIntensity || 1, 1) > 0.02
  );
}

function materialNameLooksEmissive(material) {
  const name = material.name?.toUpperCase() || "";
  return name.includes("LIGHT_ON") || name.includes("WINDOW_LIGHT") || name.includes("EMISSIVE");
}

function isForcedNightEmitter(material) {
  return NIGHT_FORCED_EMISSIVE_MATERIALS.has(material.name) || material.name?.startsWith("UIT_glasswindow_main_LIGHT_ON");
}

function isBlackColor(color) {
  return !color || color.r + color.g + color.b <= 0.03;
}

function getMaterialSurfaceInfo(node) {
  const result = new Map();
  if (!Array.isArray(node.material) || !node.geometry?.attributes?.position || !node.geometry.groups?.length) {
    return result;
  }

  const position = node.geometry.attributes.position;
  const index = node.geometry.index;
  const matrix = node.matrixWorld;

  node.geometry.groups.forEach((group) => {
    if (group.materialIndex == null) {
      return;
    }

    const box = result.get(group.materialIndex)?.box || new THREE.Box3();
    const vertex = new THREE.Vector3();
    const end = group.start + group.count;

    for (let i = group.start; i < end; i += 1) {
      const vertexIndex = index ? index.getX(i) : i;
      vertex.fromBufferAttribute(position, vertexIndex).applyMatrix4(matrix);
      box.expandByPoint(vertex);
    }

    result.set(group.materialIndex, { box });
  });

  result.forEach((value, materialIndex) => {
    result.set(materialIndex, surfaceInfoFromBox(value.box));
  });

  return result;
}

function getSurfaceInfo(node) {
  const box = new THREE.Box3().setFromObject(node);
  return surfaceInfoFromBox(box);
}

function surfaceInfoFromBox(box) {
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const horizontalSpan = Math.max(size.x, size.z);
  const verticalSpan = Math.max(size.y, 0.0001);
  const isFlatSurface = verticalSpan < horizontalSpan * 0.075;
  const isLargeSurface = horizontalSpan > 2.2;
  const isLowSurface = center.y < 2.8;

  return {
    center,
    size,
    isFlatSurface,
    isLargeSurface,
    isRoadLike: isFlatSurface && isLargeSurface && isLowSurface,
  };
}

function rebuildModelLights(preset) {
  modelLightGroup.clear();
  if (preset !== "night" || !currentModel) {
    return;
  }

  const emitters = [];
  let forcedEmitterMeshes = 0;
  const rootBox = new THREE.Box3().setFromObject(currentModel);
  const rootCenter = rootBox.getCenter(new THREE.Vector3());
  currentModel.updateWorldMatrix(true, true);
  currentModel.traverse((node) => {
    if (!node.isMesh) {
      return;
    }

    const materials = Array.isArray(node.material) ? node.material : [node.material];
    if (materials.some(isForcedNightEmitter)) {
      forcedEmitterMeshes += 1;
    }
    const emissiveMaterials = materials.filter(materialHasEmission);
    if (!emissiveMaterials.length) {
      return;
    }

    const box = new THREE.Box3().setFromObject(node);
    const size = box.getSize(new THREE.Vector3());
    if (size.lengthSq() < 0.0001) {
      return;
    }

    const center = box.getCenter(new THREE.Vector3());
    const color = new THREE.Color(0x000000);
    let intensity = 0;
    emissiveMaterials.forEach((material) => {
      color.add(getNightEmitterColor(material));
      intensity = Math.max(intensity, material.emissiveIntensity || 0);
    });
    color.multiplyScalar(1 / emissiveMaterials.length);

    const offsetDirection = center.clone().sub(rootCenter);
    if (offsetDirection.lengthSq() < 0.0001) {
      offsetDirection.set(0, 1, 0);
    } else {
      offsetDirection.normalize();
    }
    const surfaceOffset = THREE.MathUtils.clamp(
      Math.max(size.x, size.y, size.z) * 0.22,
      NIGHT_MODEL_LIGHT_SURFACE_OFFSET,
      4.2,
    );

    emitters.push({
      center,
      lightPosition: center.clone().addScaledVector(offsetDirection, surfaceOffset),
      color,
      intensity,
      radius: Math.max(size.x, size.y, size.z),
      score: intensity * Math.max(size.x * size.y, size.x * size.z, size.y * size.z),
    });
  });

  emitters
    .sort((a, b) => b.score - a.score)
    .slice(0, NIGHT_MODEL_LIGHT_LIMIT)
    .forEach((emitter) => {
      const light = new THREE.PointLight(
        emitter.color,
        THREE.MathUtils.clamp(
          emitter.intensity * NIGHT_MODEL_LIGHT_INTENSITY_SCALE,
          NIGHT_MODEL_LIGHT_MIN_INTENSITY,
          NIGHT_MODEL_LIGHT_MAX_INTENSITY,
        ),
        THREE.MathUtils.clamp(
          emitter.radius * NIGHT_MODEL_LIGHT_DISTANCE_SCALE,
          NIGHT_MODEL_LIGHT_MIN_DISTANCE,
          NIGHT_MODEL_LIGHT_MAX_DISTANCE,
        ),
        NIGHT_MODEL_LIGHT_DECAY,
      );
      light.position.copy(emitter.lightPosition);
      light.castShadow = false;
      modelLightGroup.add(light);
    });

  if (DEBUG_NIGHT_LIGHTS) {
    console.info(
      `Created ${modelLightGroup.children.length} emissive model lights from ${emitters.length} night emitters. Forced UIT glass meshes: ${forcedEmitterMeshes}.`,
    );
  }
}

function rebuildExploreColliders() {
  modelColliders.length = 0;
  if (!currentModel) {
    return;
  }

  currentModel.updateWorldMatrix(true, true);
  currentModel.traverse((node) => {
    if (!node.isMesh) {
      return;
    }

    const box = new THREE.Box3().setFromObject(node);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    if (size.lengthSq() < 0.002) {
      return;
    }

    const horizontalSpan = Math.max(size.x, size.z);
    const verticalSpan = size.y;
    const isLowFlatSurface = verticalSpan < horizontalSpan * 0.08 && center.y < MODEL_VERTICAL_OFFSET + 0.65;
    const isTinyTrim = horizontalSpan < 0.32 || verticalSpan < 0.45;
    const isHighOverhead = box.min.y > MODEL_VERTICAL_OFFSET + EXPLORE_EYE_HEIGHT + 0.5;

    if (isLowFlatSurface || isTinyTrim || isHighOverhead) {
      return;
    }

    modelColliders.push(box.clone().expandByScalar(EXPLORE_COLLISION_RADIUS));
  });
}

function getNightEmitterColor(material) {
  if (material.emissive && material.emissive.r + material.emissive.g + material.emissive.b > 0.03) {
    return material.emissive.clone();
  }

  if (material.color && material.color.r + material.color.g + material.color.b > 0.03) {
    return material.color.clone().lerp(new THREE.Color(NIGHT_EMISSIVE_FALLBACK_COLOR), 0.45);
  }

  return new THREE.Color(NIGHT_EMISSIVE_FALLBACK_COLOR);
}

function disposeModel(model) {
  model.traverse((node) => {
    if (!node.isMesh) {
      return;
    }

    node.geometry?.dispose();
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    materials.forEach((material) => material?.dispose());
  });
}

function createGround() {
  const geometry = new THREE.CircleGeometry(86, 160);
  const material = new THREE.MeshPhysicalMaterial({
    color: 0x31443e,
    roughness: 0.74,
    metalness: 0.04,
    clearcoat: 0.2,
    clearcoatRoughness: 0.5,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.receiveShadow = true;
  return mesh;
}

function createGrid() {
  const grid = new THREE.GridHelper(120, 48, 0x7fd8c8, 0x49615d);
  grid.position.y = 0.012;
  grid.material.opacity = 0.22;
  grid.material.transparent = true;
  return grid;
}

function createCampusLamps() {
  const group = new THREE.Group();
  const lights = [];
  const heads = [];
  const positions = [
    [-28, 0, -22],
    [-12, 0, -28],
    [12, 0, -28],
    [28, 0, -22],
    [-30, 0, 16],
    [30, 0, 16],
  ];

  positions.forEach(([x, y, z]) => {
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.11, 4.2, 12),
      new THREE.MeshStandardMaterial({ color: 0x1b2221, metalness: 0.35, roughness: 0.55 }),
    );
    pole.position.set(x, y + 2.1, z);
    pole.castShadow = true;

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.34, 18, 12),
      new THREE.MeshStandardMaterial({
        color: 0xffedb6,
        emissive: 0xffb85c,
        emissiveIntensity: 0.65,
        roughness: 0.35,
      }),
    );
    head.position.set(x, y + 4.35, z);

    const light = new THREE.PointLight(0xffb36a, 0.65, 18, 1.8);
    light.position.copy(head.position);
    light.castShadow = true;
    light.shadow.mapSize.set(512, 512);
    lights.push(light);
    heads.push(head);
    group.add(pole, head, light);
  });

  return { group, lights, heads };
}

function createSunBeams() {
  const group = new THREE.Group();
  const material = new THREE.MeshBasicMaterial({
    color: 0xfff0b6,
    transparent: true,
    opacity: 0.2,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    toneMapped: false,
  });

  for (let i = 0; i < 10; i += 1) {
    const beam = new THREE.Mesh(new THREE.PlaneGeometry(5.2 + i * 0.55, 96), material.clone());
    beam.position.set(-31 + i * 7.1, 35 - i * 0.85, -24 + i * 3.4);
    beam.rotation.set(-0.92, 0.38, -0.34 + i * 0.032);
    beam.material.opacity = 0.09 + i * 0.011;
    group.add(beam);
  }

  return group;
}

function createDayLightHaze() {
  const group = new THREE.Group();
  const texture = createRadialTexture("rgba(255,220,150,0.12)", "rgba(255,210,120,0)");
  const placements = [
    [-28, 18, -24, 76, 28, 0.1],
    [18, 14, -32, 62, 24, 0.08],
    [-8, 22, 22, 84, 30, 0.07],
  ];

  placements.forEach(([x, y, z, sx, sy, opacity]) => {
    const haze = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: texture,
        color: 0xffddb2,
        transparent: true,
        opacity,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
        fog: false, // Prevent fog from washing out the daytime haze!
      }),
    );
    haze.position.set(x, y, z);
    haze.scale.set(sx, sy, 1);
    group.add(haze);
  });

  return group;
}

function createTreeLine() {
  const group = new THREE.Group();
  const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x5b4634, roughness: 0.85 });
  const leafMaterial = new THREE.MeshStandardMaterial({ color: 0x2f6f59, roughness: 0.9 });
  const positions = [];

  for (let i = 0; i < 18; i += 1) {
    positions.push([-48 + i * 5.6, 0, -38]);
    positions.push([-48 + i * 5.6, 0, 40]);
  }

  positions.forEach(([x, y, z], index) => {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.26, 2.6, 10), trunkMaterial);
    trunk.position.set(x, y + 1.3, z);
    trunk.castShadow = true;

    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1.35 + (index % 3) * 0.12, 1), leafMaterial);
    crown.position.set(x, y + 3.1, z);
    crown.castShadow = true;
    crown.receiveShadow = true;

    group.add(trunk, crown);
  });

  return group;
}

function createDayAtmosphere() {
  const group = new THREE.Group();
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(DAY_ATMOSPHERE_RADIUS, 48, 24),
    new THREE.MeshBasicMaterial({
      map: createDaySkyTexture(),
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      toneMapped: false,
    }),
  );
  sky.renderOrder = -1000;
  group.add(sky);

  const cloudTextures = Array.from({ length: 5 }, (_, index) => createCloudTexture(index));
  const cloudPivot = new THREE.Group();
  const cloudPlacements = [
    [-300, 128, -300, 82, 27, 0.28, 0.006],
    [-168, 138, -326, 90, 30, 0.31, 0.006],
    [-24, 132, -340, 96, 31, 0.32, 0.006],
    [124, 140, -316, 88, 29, 0.3, 0.006],
    [272, 134, -286, 80, 27, 0.26, 0.006],
    [-354, 154, -392, 66, 22, 0.2, 0.005],
    [-218, 164, -432, 70, 23, 0.2, 0.005],
    [-64, 158, -454, 74, 24, 0.21, 0.005],
    [104, 166, -428, 68, 22, 0.19, 0.005],
    [286, 154, -382, 64, 21, 0.18, 0.005],
    [-384, 156, -138, 68, 23, 0.2, 0.005],
    [-236, 168, -92, 70, 23, 0.19, 0.005],
    [-62, 174, -72, 72, 24, 0.19, 0.005],
    [148, 166, -82, 68, 22, 0.18, 0.005],
    [334, 156, -124, 64, 21, 0.17, 0.005],
  ].slice(0, DAY_CLOUD_COUNT);

  cloudPivot.renderOrder = 30;

  cloudPlacements.forEach(([x, y, z, sx, sy, opacity, speed], index) => {
    const cloud = createCloudCluster({
      texture: cloudTextures[index % cloudTextures.length],
      index,
      opacity: opacity * (index < 6 ? 1.04 : index < 15 ? 0.96 : 0.78),
      scale: new THREE.Vector2(sx * 0.92, sy * 0.88),
    });
    cloud.position.set(x * 0.82, y * 0.74, z * 0.82);
    cloud.userData.basePosition = cloud.position.clone();
    cloud.userData.baseOpacity = opacity;
    cloud.userData.phase = index * 1.73;
    cloud.userData.speed = speed;
    cloud.frustumCulled = false;
    cloudPivot.add(cloud);
  });
  group.add(cloudPivot);

  const particleGeometry = new THREE.BufferGeometry();
  const particlePositions = new Float32Array(DAY_PARTICLE_COUNT * 3);
  const particleSpeeds = new Float32Array(DAY_PARTICLE_COUNT);
  const particlePhases = new Float32Array(DAY_PARTICLE_COUNT);
  for (let i = 0; i < DAY_PARTICLE_COUNT; i += 1) {
    particlePhases[i] = Math.random() * Math.PI * 2;
    resetDayParticle(particlePositions, particleSpeeds, i, true);
  }
  particleGeometry.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3));

  const dustPivot = new THREE.Group();
  const particles = new THREE.Points(
    particleGeometry,
    new THREE.PointsMaterial({
      color: 0xffd891,
      size: 0.16,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.2,
      map: createRadialTexture("rgba(255,242,200,0.72)", "rgba(255,194,72,0)"),
      depthTest: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    }),
  );
  particles.frustumCulled = false;
  dustPivot.add(particles);
  group.add(dustPivot);

  group.userData = {
    sky,
    cloudPivot,
    dustPivot,
    particles,
    particlePositions,
    particleSpeeds,
    particlePhases,
  };

  return { group };
}

function createNightAtmosphere() {
  const group = new THREE.Group();
  const particleTexture = createRadialTexture("rgba(255,255,255,0.95)", "rgba(105,170,255,0)");

  const starGeometry = new THREE.BufferGeometry();
  const starPositions = new Float32Array(NIGHT_STAR_COUNT * 3);
  const starColors = new Float32Array(NIGHT_STAR_COUNT * 3);

  for (let i = 0; i < NIGHT_STAR_COUNT; i += 1) {
    const radius = THREE.MathUtils.randFloat(180, 520);
    const angle = Math.random() * Math.PI * 2;
    const y = THREE.MathUtils.randFloat(32, 220);
    const flatRadius = Math.sqrt(Math.max(radius * radius - y * y, 0));
    const index = i * 3;

    starPositions[index] = Math.cos(angle) * flatRadius;
    starPositions[index + 1] = y;
    starPositions[index + 2] = Math.sin(angle) * flatRadius;

    const tint = Math.random();
    const color = tint > 0.82
      ? new THREE.Color(0xffe5b7)
      : tint > 0.54
        ? new THREE.Color(0xa9cfff)
        : new THREE.Color(0xffffff);
    const brightness = THREE.MathUtils.randFloat(0.42, 1);
    color.multiplyScalar(brightness);
    starColors[index] = color.r;
    starColors[index + 1] = color.g;
    starColors[index + 2] = color.b;
  }

  starGeometry.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
  starGeometry.setAttribute("color", new THREE.BufferAttribute(starColors, 3));
  const stars = new THREE.Points(
    starGeometry,
    new THREE.PointsMaterial({
      size: 0.95,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.95,
      vertexColors: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  group.add(stars);

  const particleGeometry = new THREE.BufferGeometry();
  const particlePositions = new Float32Array(NIGHT_PARTICLE_COUNT * 3);
  const particleSpeeds = new Float32Array(NIGHT_PARTICLE_COUNT);
  for (let i = 0; i < NIGHT_PARTICLE_COUNT; i += 1) {
    resetNightParticle(particlePositions, particleSpeeds, i, true);
  }
  particleGeometry.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3));
  const dustPivot = new THREE.Group();
  const particles = new THREE.Points(
    particleGeometry,
    new THREE.PointsMaterial({
      color: 0xc9def2,
      size: 0.22,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.22,
      map: particleTexture,
      depthTest: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  particles.frustumCulled = false;
  particles.userData.speeds = particleSpeeds;
  dustPivot.add(particles);
  group.add(dustPivot);

  const moon = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: createRadialTexture("rgba(255,244,210,1)", "rgba(130,170,255,0)"),
      color: 0xfff2c9,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    }),
  );
  moon.position.set(-82, 76, -118);
  moon.scale.set(30, 30, 1);
  group.add(moon);

  const hazeTexture = createRadialTexture("rgba(120,185,255,0.38)", "rgba(20,35,85,0)");
  const hazePositions = [
    [-46, 15, -46, 72, 42, 0.2],
    [42, 11, -34, 54, 34, 0.14],
    [0, 18, 58, 80, 36, 0.1],
  ];
  hazePositions.forEach(([x, y, z, sx, sy, opacity]) => {
    const haze = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: hazeTexture,
        color: 0x7fb8ff,
        transparent: true,
        opacity,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    );
    haze.position.set(x, y, z);
    haze.scale.set(sx, sy, 1);
    group.add(haze);
  });

  const shootingStar = createShootingStar();
  group.add(shootingStar);

  group.userData = {
    stars,
    dustPivot,
    particles,
    particlePositions,
    particleSpeeds,
    moon,
    shootingStar,
    shootingStarTimer: 0,
  };

  return { group };
}

function createDaySkyTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const context = canvas.getContext("2d");

  const sky = context.createLinearGradient(0, 0, 0, canvas.height);
  sky.addColorStop(0, "#1a5b92");
  sky.addColorStop(0.48, "#5eb1f5");
  sky.addColorStop(1, "#eaf8ff");
  context.fillStyle = sky;
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.globalCompositeOperation = "source-over";
  const cloudBands = [
    [80, 150, 210, 36, 0.46],
    [355, 118, 260, 42, 0.42],
    [690, 160, 300, 46, 0.48],
    [850, 96, 220, 32, 0.34],
    [175, 250, 360, 54, 0.28],
    [620, 270, 420, 60, 0.24],
  ];

  cloudBands.forEach(([x, y, width, height, alpha], bandIndex) => {
    for (let i = 0; i < 11; i += 1) {
      const puffX = x + (i / 10) * width + Math.sin(i * 1.8 + bandIndex) * 18;
      const puffY = y + Math.cos(i * 1.35 + bandIndex) * height * 0.22;
      const radiusX = height * THREE.MathUtils.randFloat(0.8, 1.55);
      const radiusY = height * THREE.MathUtils.randFloat(0.32, 0.72);
      const gradient = context.createRadialGradient(puffX, puffY, 0, puffX, puffY, radiusX);
      gradient.addColorStop(0, `rgba(255,255,255,${alpha})`);
      gradient.addColorStop(0.56, `rgba(255,255,255,${alpha * 0.42})`);
      gradient.addColorStop(1, "rgba(255,255,255,0)");
      context.fillStyle = gradient;
      context.beginPath();
      context.ellipse(puffX, puffY, radiusX, radiusY, 0, 0, Math.PI * 2);
      context.fill();
    }
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.needsUpdate = true;
  return texture;
}

function createCloudCluster({ texture, index, opacity, scale }) {
  const cloud = new THREE.Group();
  const random = createSeededRandom(9001 + index * 97);
  const puffCount = 5;

  for (let i = 0; i < puffCount; i += 1) {
    const t = puffCount === 1 ? 0.5 : i / (puffCount - 1);
    const centerWeight = 1 - Math.abs(t - 0.5) * 1.55;
    const layerOffset = i - (puffCount - 1) / 2;
    const puffOpacity = Math.min(0.86, opacity * (1.28 + Math.max(centerWeight, 0) * 0.3 + random() * 0.04));
    const material = new THREE.SpriteMaterial({
      map: texture,
      color: i % 3 === 0 ? 0xfff7e8 : 0xffffff,
      transparent: true,
      opacity: puffOpacity,
      depthWrite: false,
      depthTest: true,
      toneMapped: false,
      fog: false,
    });
    material.rotation = (random() - 0.5) * 0.025;

    const puff = new THREE.Sprite(material);
    const width = scale.x * (0.64 + Math.max(centerWeight, 0) * 0.28 + random() * 0.035);
    const height = scale.y * (0.82 + Math.max(centerWeight, 0) * 0.16 + random() * 0.035);
    puff.position.set(
      (t - 0.5) * scale.x * 0.16 + (random() - 0.5) * scale.x * 0.025,
      Math.max(centerWeight, 0) * scale.y * 0.12 + (random() - 0.5) * scale.y * 0.035,
      layerOffset * 0.08,
    );
    puff.scale.set(width, height, 1);
    puff.renderOrder = 34 + index;
    puff.frustumCulled = false;
    puff.userData.baseOpacity = puffOpacity;
    cloud.add(puff);
  }

  cloud.userData.puffCount = puffCount;
  return cloud;
}

function createCloudTexture(variant = 0) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  const random = createSeededRandom(417 + variant * 131);

  context.clearRect(0, 0, canvas.width, canvas.height);

  const shadowGradient = context.createRadialGradient(260, 156, 10, 260, 156, 230);
  shadowGradient.addColorStop(0, "rgba(108,145,170,0.24)");
  shadowGradient.addColorStop(0.48, "rgba(124,160,184,0.14)");
  shadowGradient.addColorStop(1, "rgba(124,160,184,0)");
  context.fillStyle = shadowGradient;
  context.beginPath();
  context.ellipse(258, 154, 222, 58, 0, 0, Math.PI * 2);
  context.fill();

  const puffCount = 34;
  for (let i = 0; i < puffCount; i += 1) {
    const t = i / (puffCount - 1);
    const centerBias = 1 - Math.abs(t - 0.5) * 1.42;
    const x = 54 + t * 404 + (random() - 0.5) * 38;
    const y = 128 + Math.sin(t * Math.PI * 2 + variant * 0.9) * 14 - centerBias * 42 + (random() - 0.5) * 24;
    const rx = 42 + random() * 56 + centerBias * 42;
    const ry = 22 + random() * 28 + centerBias * 22;
    const alpha = 0.22 + random() * 0.18 + centerBias * 0.18;
    drawCloudPuff(context, x, y, rx, ry, alpha);
  }

  for (let i = 0; i < 18; i += 1) {
    const x = 78 + random() * 360;
    const y = 88 + random() * 58;
    const rx = 24 + random() * 48;
    const ry = 12 + random() * 24;
    drawCloudHighlight(context, x, y, rx, ry, 0.2 + random() * 0.24);
  }

  context.globalCompositeOperation = "destination-out";
  for (let i = 0; i < 18; i += 1) {
    const x = 30 + random() * 452;
    const y = 132 + random() * 82;
    const rx = 22 + random() * 56;
    const ry = 14 + random() * 34;
    const gradient = context.createRadialGradient(x, y, 0, x, y, rx);
    gradient.addColorStop(0, `rgba(0,0,0,${0.04 + random() * 0.08})`);
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    context.fillStyle = gradient;
    context.beginPath();
    context.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    context.fill();
  }
  context.globalCompositeOperation = "source-over";

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

function drawCloudPuff(context, x, y, rx, ry, alpha) {
  const gradient = context.createRadialGradient(x - rx * 0.18, y - ry * 0.28, 0, x, y, rx);
  gradient.addColorStop(0, `rgba(255,255,255,${alpha})`);
  gradient.addColorStop(0.42, `rgba(255,255,255,${alpha * 0.72})`);
  gradient.addColorStop(0.72, `rgba(230,242,252,${alpha * 0.28})`);
  gradient.addColorStop(1, "rgba(218,235,248,0)");
  context.fillStyle = gradient;
  context.beginPath();
  context.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  context.fill();
}

function drawCloudHighlight(context, x, y, rx, ry, alpha) {
  const gradient = context.createRadialGradient(x, y, 0, x, y, rx);
  gradient.addColorStop(0, `rgba(255,255,255,${alpha})`);
  gradient.addColorStop(0.48, `rgba(255,255,255,${alpha * 0.42})`);
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = gradient;
  context.beginPath();
  context.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  context.fill();
}

function createSeededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function createFocusMarker() {
  const marker = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: createFocusTargetTexture(),
      transparent: true,
      opacity: 0,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    }),
  );
  marker.visible = false;
  marker.renderOrder = 50;
  marker.userData.mode = "confirm";
  marker.userData.life = 0;
  return marker;
}

function createFocusTargetTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 160;
  canvas.height = 160;
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, canvas.width, canvas.height);

  context.shadowColor = "rgba(46, 211, 183, 0.65)";
  context.shadowBlur = 18;
  context.strokeStyle = "rgba(46, 211, 183, 0.98)";
  context.lineWidth = 5;
  context.beginPath();
  context.arc(80, 80, 34, 0, Math.PI * 2);
  context.stroke();

  context.shadowBlur = 10;
  context.strokeStyle = "rgba(255, 255, 255, 0.92)";
  context.lineWidth = 4;
  context.beginPath();
  context.moveTo(80, 22);
  context.lineTo(80, 52);
  context.moveTo(80, 108);
  context.lineTo(80, 138);
  context.moveTo(22, 80);
  context.lineTo(52, 80);
  context.moveTo(108, 80);
  context.lineTo(138, 80);
  context.stroke();

  context.shadowBlur = 0;
  context.fillStyle = "rgba(255, 255, 255, 0.98)";
  context.beginPath();
  context.arc(80, 80, 5, 0, Math.PI * 2);
  context.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createRadialTexture(innerColor, outerColor) {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, innerColor);
  gradient.addColorStop(0.38, innerColor);
  gradient.addColorStop(1, outerColor);
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createSunDiscTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 192;
  canvas.height = 192;
  const context = canvas.getContext("2d");
  const gradient = context.createRadialGradient(96, 96, 0, 96, 96, 96);
  gradient.addColorStop(0, "rgba(255,255,240,1)");
  gradient.addColorStop(0.5, "rgba(255,244,190,1)");
  gradient.addColorStop(0.68, "rgba(255,218,126,0.96)");
  gradient.addColorStop(0.82, "rgba(255,184,78,0.42)");
  gradient.addColorStop(1, "rgba(255,176,76,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createSharpSunRaysTexture() {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  const cx = size / 2;
  const cy = size / 2;
  const maxR = size / 2;

  context.clearRect(0, 0, size, size);

  const random = createSeededRandom(7331);
  const primaryCount = 14;
  const accentCount = 7;

  for (let i = 0; i < primaryCount; i += 1) {
    const angle = (i / primaryCount) * Math.PI * 2;
    const halfRad = (1.6 * Math.PI) / 180;
    const outerFrac = 0.52 + random() * 0.46;
    const alpha = 0.72 + random() * 0.22;
    const innerR = maxR * 0.17;
    const outerR = maxR * outerFrac;
    const tipX = cx + Math.cos(angle) * outerR;
    const tipY = cy + Math.sin(angle) * outerR;
    const b1x = cx + Math.cos(angle - halfRad) * innerR;
    const b1y = cy + Math.sin(angle - halfRad) * innerR;
    const b2x = cx + Math.cos(angle + halfRad) * innerR;
    const b2y = cy + Math.sin(angle + halfRad) * innerR;
    const gradient = context.createLinearGradient(
      cx + Math.cos(angle) * innerR,
      cy + Math.sin(angle) * innerR,
      tipX,
      tipY,
    );

    gradient.addColorStop(0, `rgba(255,255,255,${alpha})`);
    gradient.addColorStop(0.5, `rgba(255,255,255,${alpha * 0.4})`);
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    context.beginPath();
    context.moveTo(b1x, b1y);
    context.lineTo(tipX, tipY);
    context.lineTo(b2x, b2y);
    context.closePath();
    context.fillStyle = gradient;
    context.fill();
  }

  for (let i = 0; i < accentCount; i += 1) {
    const angle = ((i + 0.5) / accentCount) * Math.PI * 2;
    const halfRad = (0.7 * Math.PI) / 180;
    const outerFrac = 0.32 + random() * 0.28;
    const innerR = maxR * 0.17;
    const outerR = maxR * outerFrac;
    const tipX = cx + Math.cos(angle) * outerR;
    const tipY = cy + Math.sin(angle) * outerR;
    const b1x = cx + Math.cos(angle - halfRad) * innerR;
    const b1y = cy + Math.sin(angle - halfRad) * innerR;
    const b2x = cx + Math.cos(angle + halfRad) * innerR;
    const b2y = cy + Math.sin(angle + halfRad) * innerR;
    const gradient = context.createLinearGradient(
      cx + Math.cos(angle) * innerR,
      cy + Math.sin(angle) * innerR,
      tipX,
      tipY,
    );

    gradient.addColorStop(0, "rgba(255,255,255,0.5)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    context.beginPath();
    context.moveTo(b1x, b1y);
    context.lineTo(tipX, tipY);
    context.lineTo(b2x, b2y);
    context.closePath();
    context.fillStyle = gradient;
    context.fill();
  }

  const discR = maxR * 0.17;
  const discGradient = context.createRadialGradient(cx, cy, 0, cx, cy, discR);
  discGradient.addColorStop(0, "rgba(255,255,255,1)");
  discGradient.addColorStop(0.55, "rgba(255,255,255,1)");
  discGradient.addColorStop(0.85, "rgba(255,255,255,0.6)");
  discGradient.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = discGradient;
  context.beginPath();
  context.arc(cx, cy, discR, 0, Math.PI * 2);
  context.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createShootingStar() {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array([0, 0, 0, -22, -6, 0]), 3),
  );
  const line = new THREE.Line(
    geometry,
    new THREE.LineBasicMaterial({
      color: 0xd7ebff,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  resetShootingStar(line);
  return line;
}

function resetShootingStar(line) {
  line.position.set(
    THREE.MathUtils.randFloat(-90, 70),
    THREE.MathUtils.randFloat(68, 115),
    THREE.MathUtils.randFloat(-130, -70),
  );
  line.rotation.z = THREE.MathUtils.randFloat(-0.2, 0.15);
  line.userData.velocity = new THREE.Vector3(
    THREE.MathUtils.randFloat(32, 46),
    THREE.MathUtils.randFloat(-16, -9),
    THREE.MathUtils.randFloat(4, 12),
  );
  line.userData.life = 0;
  line.userData.duration = THREE.MathUtils.randFloat(0.9, 1.35);
  line.visible = false;
  line.material.opacity = 0;
}

function resetNightParticle(positions, speeds, index, randomY = false) {
  const offset = index * 3;
  const radius = Math.max(modelBounds.radius * 1.9, 58);
  const angle = Math.random() * Math.PI * 2;
  const distance = Math.sqrt(Math.random()) * radius;

  positions[offset] = Math.cos(angle) * distance + THREE.MathUtils.randFloatSpread(6);
  positions[offset + 1] = randomY
    ? THREE.MathUtils.randFloat(-modelBounds.size.y * 0.22, modelBounds.size.y * 1.15)
    : THREE.MathUtils.randFloat(-modelBounds.size.y * 0.08, modelBounds.size.y * 1.05);
  positions[offset + 2] = Math.sin(angle) * distance + THREE.MathUtils.randFloatSpread(6);
  speeds[index] = THREE.MathUtils.randFloat(0.12, 0.46);
}

function resetDayParticle(positions, speeds, index, randomY = false) {
  const offset = index * 3;
  const radius = Math.max(modelBounds.radius * 1.65, 52);
  const angle = Math.random() * Math.PI * 2;
  const distance = Math.sqrt(Math.random()) * radius;

  positions[offset] = Math.cos(angle) * distance + THREE.MathUtils.randFloatSpread(5);
  positions[offset + 1] = randomY
    ? THREE.MathUtils.randFloat(modelBounds.size.y * 0.02, modelBounds.size.y * 0.82)
    : THREE.MathUtils.randFloat(0.2, modelBounds.size.y * 0.78);
  positions[offset + 2] = Math.sin(angle) * distance + THREE.MathUtils.randFloatSpread(5);
  speeds[index] = THREE.MathUtils.randFloat(0.16, 0.52);
}

function refreshDayAtmosphere() {
  const { cloudPivot, dustPivot, particlePositions, particleSpeeds, particles } = dayAtmosphere.group.userData;
  cloudPivot.position.copy(modelBounds.center);
  dustPivot.position.copy(modelBounds.center);
  for (let i = 0; i < DAY_PARTICLE_COUNT; i += 1) {
    resetDayParticle(particlePositions, particleSpeeds, i, true);
  }
  particles.geometry.attributes.position.needsUpdate = true;
}

function refreshNightDust() {
  const { dustPivot, particlePositions, particleSpeeds, particles } = nightAtmosphere.group.userData;
  dustPivot.position.copy(modelBounds.center);
  for (let i = 0; i < NIGHT_PARTICLE_COUNT; i += 1) {
    resetNightParticle(particlePositions, particleSpeeds, i, true);
  }
  particles.geometry.attributes.position.needsUpdate = true;
}

function setDayAtmosphereActive(isActive) {
  dayAtmosphere.group.visible = isActive;
  updateCloudVisibility();
}

function updateCloudVisibility() {
  const { cloudPivot } = dayAtmosphere.group.userData;
  cloudPivot.visible = activePreset === "day" && cloudsEnabled;
  if (!cloudPivot.visible) {
    daySunOcclusion = 0;
  }
}

function setNightAtmosphereActive(isActive) {
  nightAtmosphere.group.visible = isActive;
  moonLight.visible = isActive;
}

function updateDayAtmosphere(delta) {
  if (!dayAtmosphere.group.visible) {
    return;
  }

  const elapsed = clock.elapsedTime;
  const { sky, cloudPivot, dustPivot, particles, particlePositions, particleSpeeds, particlePhases } = dayAtmosphere.group.userData;
  sky.position.copy(camera.position);
  sky.rotation.y += delta * 0.003;
  cloudPivot.position.lerp(modelBounds.center, 0.025);
  dustPivot.position.lerp(modelBounds.center, 0.04);
  const sunScreenPosition = getDistantSunPosition().project(camera);
  const cloudScreenPosition = new THREE.Vector3();
  const cloudWorldPosition = new THREE.Vector3();

  let nextSunOcclusion = 0;

  cloudPivot.children.forEach((cloud) => {
    const base = cloud.userData.basePosition;
    const opacityPulse = Math.sin(elapsed * 0.12 + cloud.userData.phase) * 0.04;
    cloud.position.x = base.x + Math.sin(elapsed * cloud.userData.speed + cloud.userData.phase) * 5;
    cloud.position.y = base.y + Math.cos(elapsed * cloud.userData.speed * 0.62 + cloud.userData.phase) * 0.7;
    cloud.rotation.z = 0;

    cloud.children.forEach((puff) => {
      const baseOpacity = puff.userData.baseOpacity;
      puff.getWorldPosition(cloudWorldPosition);
      cloudScreenPosition.copy(cloudWorldPosition).project(camera);
      const screenDistance = Math.hypot(
        cloudScreenPosition.x - sunScreenPosition.x,
        cloudScreenPosition.y - sunScreenPosition.y,
      );
      const coverMix = 1 - THREE.MathUtils.smoothstep(
        screenDistance,
        DAY_SUN_OCCLUSION_RADIUS,
        DAY_SUN_OCCLUSION_RADIUS + DAY_SUN_OCCLUSION_SOFTNESS,
      );
      const puffCover = coverMix * THREE.MathUtils.clamp(baseOpacity * 1.55, 0, 1);
      nextSunOcclusion = Math.max(nextSunOcclusion, puffCover);
      puff.material.opacity = THREE.MathUtils.clamp(baseOpacity + opacityPulse, 0.06, 0.68);
    });
  });
  daySunOcclusion = cloudsEnabled && cloudPivot.visible
    ? THREE.MathUtils.damp(daySunOcclusion, Math.min(nextSunOcclusion, 0.92), DAY_SUN_OCCLUSION_DAMPING, delta)
    : THREE.MathUtils.damp(daySunOcclusion, 0, DAY_SUN_OCCLUSION_DAMPING, delta);

  for (let i = 0; i < DAY_PARTICLE_COUNT; i += 1) {
    const offset = i * 3;
    const drift = particleSpeeds[i];
    const phase = particlePhases[i];
    particlePositions[offset] += Math.sin(elapsed * 0.28 + phase) * delta * drift * 0.72;
    particlePositions[offset + 1] += Math.cos(elapsed * 0.2 + phase) * delta * drift * 0.26;
    particlePositions[offset + 2] += Math.cos(elapsed * 0.24 + phase) * delta * drift;

    const radius = Math.max(modelBounds.radius * 1.65, 52);
    const horizontalDistance = Math.hypot(particlePositions[offset], particlePositions[offset + 2]);
    if (
      horizontalDistance > radius ||
      particlePositions[offset + 1] < -modelBounds.size.y * 0.08 ||
      particlePositions[offset + 1] > modelBounds.size.y * 0.9
    ) {
      resetDayParticle(particlePositions, particleSpeeds, i);
    }
  }
  particles.geometry.attributes.position.needsUpdate = true;
}

function updateNightAtmosphere(delta) {
  if (!nightAtmosphere.group.visible) {
    return;
  }

  const elapsed = clock.elapsedTime;
  const { stars, dustPivot, particles, particlePositions, particleSpeeds, moon, shootingStar } = nightAtmosphere.group.userData;
  stars.rotation.y += delta * 0.006;
  stars.material.opacity = 0.82 + Math.sin(elapsed * 0.45) * 0.08;
  moon.material.opacity = 0.82 + Math.sin(elapsed * 0.32) * 0.06;
  dustPivot.position.lerp(modelBounds.center, 0.035);

  for (let i = 0; i < NIGHT_PARTICLE_COUNT; i += 1) {
    const offset = i * 3;
    const drift = particleSpeeds[i];
    particlePositions[offset] += Math.sin(elapsed * 0.22 + i * 1.7) * delta * drift;
    particlePositions[offset + 1] += Math.cos(elapsed * 0.19 + i * 0.9) * delta * drift * 0.32;
    particlePositions[offset + 2] += Math.cos(elapsed * 0.24 + i * 1.2) * delta * drift;

    const radius = Math.max(modelBounds.radius * 1.9, 58);
    const horizontalDistance = Math.hypot(particlePositions[offset], particlePositions[offset + 2]);
    if (
      horizontalDistance > radius ||
      particlePositions[offset + 1] < -modelBounds.size.y * 0.24 ||
      particlePositions[offset + 1] > modelBounds.size.y * 1.18
    ) {
      resetNightParticle(particlePositions, particleSpeeds, i);
    }
  }
  particles.geometry.attributes.position.needsUpdate = true;

  updateShootingStar(shootingStar, delta);
}

function updateShootingStar(line, delta) {
  nightAtmosphere.group.userData.shootingStarTimer -= delta;
  if (!line.visible && nightAtmosphere.group.userData.shootingStarTimer <= 0) {
    resetShootingStar(line);
    line.visible = true;
  }

  if (!line.visible) {
    return;
  }

  line.userData.life += delta;
  line.position.addScaledVector(line.userData.velocity, delta);
  const progress = line.userData.life / line.userData.duration;
  line.material.opacity = Math.sin(Math.min(progress, 1) * Math.PI) * 0.78;

  if (progress >= 1) {
    line.visible = false;
    line.material.opacity = 0;
    nightAtmosphere.group.userData.shootingStarTimer = THREE.MathUtils.randFloat(3.2, 7.8);
  }
}

function buildPhysicsBounds(size) {
  const halfX = Math.max(24, size.x * 0.58);
  const halfZ = Math.max(24, size.z * 0.58);
  const wallHeight = 6;
  const thickness = 1.2;

  addWall(0, wallHeight / 2, halfZ + 8, halfX + 8, wallHeight, thickness);
  addWall(0, wallHeight / 2, -halfZ - 8, halfX + 8, wallHeight, thickness);
  addWall(halfX + 8, wallHeight / 2, 0, thickness, wallHeight, halfZ + 8);
  addWall(-halfX - 8, wallHeight / 2, 0, thickness, wallHeight, halfZ + 8);
}

function addWall(x, y, z, sx, sy, sz) {
  const body = new CANNON.Body({
    mass: 0,
    material: groundMaterial,
    shape: new CANNON.Box(new CANNON.Vec3(sx, sy, sz)),
    position: new CANNON.Vec3(x, y, z),
  });
  world.addBody(body);
}

function setWalkSpawn(size) {
  const z = Math.max(18, size.z * 0.42);
  playerBody.position.set(0, 2.5, z);
  playerBody.velocity.set(0, 0, 0);
  yaw = Math.PI;
}

function applyLightingPreset(preset) {
  activePreset = preset;
  const settings = {
    day: { exposure: 1.02, label: "Day" },
    night: { exposure: 0.64, label: "Night" },
  }[preset];

  exposureSlider.value = settings.exposure;
  renderer.toneMappingExposure = settings.exposure;
  lightingStatus.textContent = settings.label;
  presetButtons.forEach((button) => button.classList.toggle("is-active", button.dataset.preset === preset));
  setLighting(preset);
  loadModel(preset);
}

function setLighting(preset) {
  const isNight = preset === "night";
  scene.environment = isNight ? null : dayEnvironment;

  sunLight.visible = !isNight;
  sunLight.position.copy(DAY_SUN_LIGHT_POSITION);
  sunLight.intensity = isNight ? 0 : DAY_SUN_LIGHT_CLEAR_INTENSITY;
  sunLight.color.set(0xffc46f);

  hemisphereLight.intensity = isNight ? NIGHT_AMBIENT_INTENSITY : 1.04;
  hemisphereLight.color.set(isNight ? 0x53648f : 0xdaf1ff);
  hemisphereLight.groundColor.set(isNight ? 0x202838 : 0x4a3b2f);

  ambientLight.intensity = isNight ? NIGHT_FLAT_AMBIENT_INTENSITY : 0;
  ambientLight.color.set(isNight ? 0x6f7fa6 : 0xffffff);

  fillLight.intensity = isNight ? 0 : DAY_FILL_CLEAR_INTENSITY;
  fillLight.color.set(isNight ? 0x527dff : 0x9fcbff);

  moonLight.intensity = isNight ? 1.45 : 0;
  moonLight.color.set(0x8fb8ff);
  setDayAtmosphereActive(!isNight);
  setNightAtmosphereActive(isNight);
  updateCloudVisibility();
  shell.classList.toggle("is-night", isNight);
  daySunSprite.visible = !isNight;
  daySunGlow.visible = !isNight;
  daySunOuterGlow.visible = !isNight;
  dayLightHaze.visible = !isNight;
  if (sunRaysSprite) {
    sunRaysSprite.visible = !isNight;
  }

  lampLights.lights.forEach((light) => {
    light.intensity = isNight ? 0.62 : 0.02;
    light.distance = isNight ? 18 : 10;
  });
  lampLights.heads.forEach((head) => {
    head.material.emissiveIntensity = isNight ? 2.8 : 0.08;
    head.material.toneMapped = !isNight;
    head.material.needsUpdate = true;
  });

  sunBeams.visible = false;
  ground.material.color.set(isNight ? 0x18222a : 0x31443e);
  ground.material.roughness = isNight ? 0.58 : 0.74;

  if (bloomEffect) {
    bloomEffect.intensity = isNight ? NIGHT_BLOOM_STRENGTH * 3.5 : 0.16;
    bloomEffect.luminanceMaterial.threshold = isNight ? NIGHT_BLOOM_THRESHOLD : 0.72;
  }
  if (godRaysEffect) {
    godRaysEffect.enabled = !isNight;
  }
  if (sunLightMesh) {
    sunLightMesh.visible = !isNight;
  }
  if (toneMappingEffect) {
    toneMappingEffect.exposure = isNight ? 0.34 : 1.02;
  }

  scene.background = new THREE.Color(isNight ? 0x020611 : 0x86cfff);
  if (isNight) {
    if (!scene.fog) scene.fog = new THREE.Fog(0x020611, 60, 320);
    scene.fog.color.copy(scene.background);
    scene.fog.near = 60;
    scene.fog.far = 320;
  } else {
    scene.fog = null; // Remove fog entirely for daylight to prevent blur
  }
}

function updateBloomForCamera() {
  if (!bloomEffect) return;
  if (activePreset !== "night") {
    bloomEffect.intensity = 0.16;
    bloomEffect.luminanceMaterial.threshold = 0.72;
    return;
  }

  bloomEffect.intensity = NIGHT_BLOOM_STRENGTH * 3.5;
  bloomEffect.luminanceMaterial.threshold = NIGHT_BLOOM_THRESHOLD;
}

function updateDaySunEffects() {
  if (activePreset !== "day") {
    return;
  }

  const sunWorldPosition = getDistantSunPosition();
  const softCover = THREE.MathUtils.clamp(daySunOcclusion, 0, 1);
  const glowVisibility = THREE.MathUtils.lerp(1, 0.72, softCover);

  const sunScale = modelBounds.radius * DAY_SUN_VISUAL_SCALE;
  daySunSprite.position.copy(sunWorldPosition);
  daySunSprite.scale.setScalar(sunScale);
  daySunSprite.material.opacity = 0.82 * glowVisibility + Math.sin(clock.elapsedTime * 0.32) * 0.04;
  daySunGlow.position.copy(sunWorldPosition);
  daySunGlow.scale.setScalar(sunScale * 0.92);
  daySunGlow.material.opacity = 0.1 * glowVisibility;
  daySunOuterGlow.position.copy(sunWorldPosition);
  daySunOuterGlow.scale.setScalar(sunScale * 1.32);
  daySunOuterGlow.material.opacity = 0.045 * glowVisibility;
  dayLightHaze.position.copy(modelBounds.center);
  if (sunRaysSprite) {
    sunRaysSprite.visible = false;
  }
  if (godRaysEffect) {
    godRaysEffect.density = 0.28 * glowVisibility;
    godRaysEffect.weight = 0.06 * glowVisibility;
    godRaysEffect.exposure = 0.09 * glowVisibility;
  }
  if (sunLightMesh) {
    sunLightMesh.position.copy(sunWorldPosition);
    sunLightMesh.scale.setScalar(0.12);
    sunLightMesh.material.opacity = 0.95;
  }
  sunLight.intensity = THREE.MathUtils.lerp(
    DAY_SUN_LIGHT_CLEAR_INTENSITY,
    DAY_SUN_LIGHT_OCCLUDED_INTENSITY,
    softCover,
  );
  fillLight.intensity = THREE.MathUtils.lerp(DAY_FILL_CLEAR_INTENSITY, DAY_FILL_OCCLUDED_INTENSITY, softCover);
}

function getDistantSunPosition() {
  const sunDistance = Math.max(modelBounds.radius * 4.2, 210);
  return camera.position.clone().addScaledVector(DAY_SUN_DIRECTION, sunDistance);
}

function setFocusPickMode(enabled) {
  if (enabled && walkMode) {
    setWalkMode(false);
  }

  const isActive = Boolean(enabled) && !pendingExploreMode;
  focusPickState.active = isActive;
  focusPickState.pointerDown = null;
  shell.classList.toggle("is-picking-focus", isActive);
  pickFocusButton.classList.toggle("is-active", isActive);
  pickFocusButton.setAttribute("aria-pressed", String(isActive));
  const label = isActive ? "Cancel focus pick" : "Pick focus point";
  pickFocusButton.setAttribute("aria-label", label);
  pickFocusButton.title = label;
  controls.enabled = !isActive && !walkMode;
  controls.autoRotate = autoRotate.checked && !isActive && !walkMode;

  if (!isActive && focusMarker.userData.mode === "preview") {
    hideFocusMarker();
  }
}

function updateFocusPreview(event) {
  const hit = getFocusPick(event);
  if (!hit) {
    if (focusMarker.userData.mode === "preview") {
      hideFocusMarker();
    }
    return;
  }

  showFocusMarker(hit.point, hit.normal, "preview");
}

function pickFocusFromPointer(event) {
  const hit = getFocusPick(event);
  if (!hit) {
    return;
  }

  focusOnPickedPoint(hit.point, hit.normal);
}

function getFocusPick(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  focusPointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  focusPointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  focusRaycaster.setFromCamera(focusPointer, camera);

  if (currentModel) {
    const intersects = focusRaycaster
      .intersectObject(currentModel, true)
      .filter((hit) => hit.object?.isMesh && hit.object.visible);

    if (intersects.length > 0) {
      const hit = intersects[0];
      const normal = hit.face?.normal
        ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld).normalize()
        : new THREE.Vector3(0, 1, 0);

      return {
        point: clampFocusPoint(hit.point),
        normal,
      };
    }
  }

  if (
    focusRaycaster.ray.intersectPlane(focusGroundPlane, focusScratchPoint) &&
    isFocusPointInBounds(focusScratchPoint)
  ) {
    return {
      point: clampFocusPoint(focusScratchPoint),
      normal: new THREE.Vector3(0, 1, 0),
    };
  }

  return null;
}

function focusOnPickedPoint(point, normal) {
  const target = clampFocusPoint(point);
  setFocusPickMode(false);
  cameraState.preset = "custom";
  setCameraPresetActive("custom");
  cameraTransition.active = true;
  cameraTransition.elapsed = 0;
  cameraTransition.duration = 0.5;
  cameraTransition.fromPosition.copy(camera.position);
  cameraTransition.toPosition.copy(camera.position);
  cameraTransition.fromTarget.copy(controls.target);
  cameraTransition.toTarget.copy(target);
  showFocusMarker(target, normal, "confirm");
}

function getFocusPadding() {
  return Math.max(3, Math.max(modelBounds.size.x, modelBounds.size.z) * 0.08);
}

function isFocusPointInBounds(point) {
  const padding = getFocusPadding();
  return (
    point.x >= modelBounds.min.x - padding &&
    point.x <= modelBounds.max.x + padding &&
    point.z >= modelBounds.min.z - padding &&
    point.z <= modelBounds.max.z + padding
  );
}

function clampFocusPoint(point) {
  const padding = getFocusPadding();
  const minY = Math.max(MODEL_VERTICAL_OFFSET, modelBounds.min.y - 0.05);
  const maxY = Math.max(minY + 0.2, modelBounds.max.y + padding * 0.18);
  return new THREE.Vector3(
    THREE.MathUtils.clamp(point.x, modelBounds.min.x - padding, modelBounds.max.x + padding),
    THREE.MathUtils.clamp(point.y, minY, maxY),
    THREE.MathUtils.clamp(point.z, modelBounds.min.z - padding, modelBounds.max.z + padding),
  );
}

function showFocusMarker(point, normal = new THREE.Vector3(0, 1, 0), mode = "confirm") {
  focusMarker.position.copy(point).addScaledVector(normal, 0.14);
  focusMarker.visible = true;
  focusMarker.userData.mode = mode;
  focusMarker.userData.life = mode === "confirm" ? 2.6 : Number.POSITIVE_INFINITY;
  focusMarker.material.opacity = mode === "preview" ? 0.52 : 0.96;
}

function hideFocusMarker() {
  focusMarker.visible = false;
  focusMarker.userData.life = 0;
}

function updateFocusMarker(delta) {
  if (!focusMarker.visible) {
    return;
  }

  const distance = camera.position.distanceTo(focusMarker.position);
  const baseScale = THREE.MathUtils.clamp(distance * 0.035, 0.34, 1.45);
  const pulse = focusMarker.userData.mode === "confirm"
    ? 1 + Math.sin(clock.elapsedTime * 9) * 0.08
    : 1 + Math.sin(clock.elapsedTime * 6) * 0.04;
  focusMarker.scale.setScalar(baseScale * pulse);

  if (focusMarker.userData.mode !== "confirm") {
    focusMarker.material.opacity = 0.52;
    return;
  }

  focusMarker.userData.life -= delta;
  if (focusMarker.userData.life <= 0) {
    hideFocusMarker();
    return;
  }

  focusMarker.material.opacity = THREE.MathUtils.clamp(focusMarker.userData.life / 0.6, 0, 0.96);
}

function configureOrbitCamera(size) {
  const radius = Math.max(modelBounds.radius, 18);
  controls.minDistance = Math.max(4.5, radius * 0.18);
  controls.maxDistance = Math.max(ORBIT_MAX_DISTANCE_MIN, radius * ORBIT_MAX_DISTANCE_SCALE);
  controls.minPolarAngle = Math.PI * 0.13;
  controls.maxPolarAngle = Math.PI * 0.53;
  controls.maxTargetRadius = Math.max(size.x, size.z) * 0.68;
}

function constrainOrbitTarget() {
  controls.target.copy(clampFocusPoint(controls.target));
}

function setCameraPresetActive(preset) {
  cameraButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.camera === preset);
  });
}

function getCameraPreset(preset) {
  const radius = Math.max(modelBounds.radius, 18);
  const center = modelBounds.center.clone();
  const height = Math.max(modelBounds.size.y, 8);

  const presets = {
    overview: {
      target: center.clone().add(new THREE.Vector3(0, height * 0.18, 0)),
      offset: new THREE.Vector3(radius * 0.76, radius * 0.38, radius * 0.72),
    },
    close: {
      target: center.clone().add(new THREE.Vector3(0, height * 0.28, 0)),
      offset: new THREE.Vector3(radius * 0.38, radius * 0.18, radius * 0.34),
    },
    top: {
      target: center.clone(),
      offset: new THREE.Vector3(radius * 0.04, radius * 1.08, radius * 0.12),
    },
  };

  return presets[preset] || presets.overview;
}

function moveCameraToPreset(preset) {
  setFocusPickMode(false);
  cameraState.preset = preset;
  setCameraPresetActive(preset);
  const view = getCameraPreset(preset);
  cameraTransition.active = true;
  cameraTransition.elapsed = 0;
  cameraTransition.fromPosition.copy(camera.position);
  cameraTransition.toPosition.copy(view.target).add(view.offset);
  cameraTransition.fromTarget.copy(controls.target);
  cameraTransition.toTarget.copy(view.target);
}

function updateCameraTransition(delta) {
  if (!cameraTransition.active) {
    return false;
  }

  cameraTransition.elapsed += delta;
  const progress = THREE.MathUtils.clamp(cameraTransition.elapsed / cameraTransition.duration, 0, 1);
  const eased = 1 - Math.pow(1 - progress, 3);
  camera.position.lerpVectors(cameraTransition.fromPosition, cameraTransition.toPosition, eased);
  controls.target.lerpVectors(cameraTransition.fromTarget, cameraTransition.toTarget, eased);
  controls.update();

  if (progress >= 1) {
    cameraTransition.active = false;
  }

  return true;
}

function setWalkMode(enabled) {
  if (enabled) {
    setFocusPickMode(false);
    startExploreIntro();
    return;
  }

  pendingExploreMode = false;
  exploreIntro.active = false;
  walkMode = enabled;
  controls.enabled = !enabled;
  controls.autoRotate = autoRotate.checked && !enabled;
  modeStatus.textContent = enabled ? "Explore" : "Orbit";
  walkButton.textContent = enabled ? "Exit explore" : "Explore";
  heroWalkButton.textContent = enabled ? "Exit explore" : "Explore mode";
  cameraTransition.active = false;

  if (document.pointerLockElement === renderer.domElement) {
    document.exitPointerLock?.();
  }
  focusModel(cameraState.preset);
}

function focusModel(preset = "overview") {
  configureOrbitCamera(modelBounds.size);
  moveCameraToPreset(preset);

  if (walkMode) {
    explorePosition.copy(camera.position);
    exploreVelocity.set(0, 0, 0);
    exploreVelocityY = 0;
  }
}

function startExploreIntro() {
  if (walkMode || pendingExploreMode) {
    return;
  }

  pendingExploreMode = true;
  controls.enabled = false;
  controls.autoRotate = false;
  cameraTransition.active = false;
  exploreIntro.active = true;
  exploreIntro.elapsed = 0;
  exploreIntro.fromPosition.copy(camera.position);
  exploreIntro.toPosition.copy(getExploreSpawn());
  exploreIntro.fromLook.copy(controls.target);
  exploreIntro.toLook.copy(modelBounds.center).setY(MODEL_VERTICAL_OFFSET + EXPLORE_EYE_HEIGHT);
  modeStatus.textContent = "Entering";
  walkButton.textContent = "Entering...";
  heroWalkButton.textContent = "Entering...";
}

function finishExploreIntro() {
  pendingExploreMode = false;
  exploreIntro.active = false;
  walkMode = true;
  controls.enabled = false;
  controls.autoRotate = false;
  modeStatus.textContent = "Explore";
  walkButton.textContent = "Exit explore";
  heroWalkButton.textContent = "Exit explore";

  const direction = new THREE.Vector3();
  camera.getWorldDirection(direction);
  yaw = Math.atan2(direction.x, direction.z);
  pitch = Math.asin(THREE.MathUtils.clamp(direction.y, -0.98, 0.98));
  explorePosition.copy(exploreIntro.toPosition);
  exploreVelocity.set(0, 0, 0);
  exploreVelocityY = 0;
  exploreGrounded = true;
  exploreWalkTime = 0;
  camera.position.copy(explorePosition);
  renderer.domElement.requestPointerLock?.();
}

function updateExploreIntro(delta) {
  if (!exploreIntro.active) {
    return false;
  }

  exploreIntro.elapsed += delta;
  const progress = THREE.MathUtils.clamp(exploreIntro.elapsed / exploreIntro.duration, 0, 1);
  const eased = 1 - Math.pow(1 - progress, 3);
  camera.position.lerpVectors(exploreIntro.fromPosition, exploreIntro.toPosition, eased);
  const lookTarget = new THREE.Vector3().lerpVectors(exploreIntro.fromLook, exploreIntro.toLook, eased);
  camera.lookAt(lookTarget);

  if (progress >= 1) {
    finishExploreIntro();
  }

  return true;
}

function getExploreSpawn() {
  return new THREE.Vector3(
    modelBounds.center.x,
    MODEL_VERTICAL_OFFSET + EXPLORE_EYE_HEIGHT,
    modelBounds.center.z,
  );
}

function constrainExplorePosition() {
  const limitX = Math.max(18, modelBounds.size.x * 0.62);
  const limitZ = Math.max(18, modelBounds.size.z * 0.62);
  explorePosition.x = THREE.MathUtils.clamp(
    explorePosition.x,
    modelBounds.center.x - limitX,
    modelBounds.center.x + limitX,
  );
  explorePosition.z = THREE.MathUtils.clamp(
    explorePosition.z,
    modelBounds.center.z - limitZ,
    modelBounds.center.z + limitZ,
  );
}

const exploreRaycaster = new THREE.Raycaster();

function resolveExploreCollisions(previousPosition) {
  if (!currentModel) return;

  const origin = new THREE.Vector3(previousPosition.x, MODEL_VERTICAL_OFFSET + EXPLORE_EYE_HEIGHT * 0.5, previousPosition.z);
  const direction = new THREE.Vector3(explorePosition.x - previousPosition.x, 0, explorePosition.z - previousPosition.z);
  const distance = direction.length();

  if (distance < 0.0001) return;
  direction.normalize();

  exploreRaycaster.set(origin, direction);
  exploreRaycaster.near = 0;
  exploreRaycaster.far = distance + EXPLORE_COLLISION_RADIUS;

  const intersects = exploreRaycaster.intersectObject(currentModel, true);
  if (intersects.length > 0) {
    explorePosition.x = previousPosition.x;
    explorePosition.z = previousPosition.z;
    exploreVelocity.x = 0;
    exploreVelocity.z = 0;
  }
}

function animate() {
  const delta = Math.min(clock.getDelta(), 0.05);
  world.fixedStep(1 / 60, delta, 3);

  if (updateExploreIntro(delta)) {
    // Camera is flying into the first-person spawn point.
  } else if (walkMode) {
    updateWalkCamera(delta);
  } else {
    if (!updateCameraTransition(delta)) {
      constrainOrbitTarget();
      controls.update();
    }
  }

  updateBloomForCamera();
  updateDaySunEffects();
  updateDayAtmosphere(delta);
  updateNightAtmosphere(delta);
  updateFocusMarker(delta);
  composer.render();
  requestAnimationFrame(animate);
}

function updateWalkCamera(delta) {
  const forward = Number(keys.has("KeyW") || keys.has("ArrowUp")) - Number(keys.has("KeyS") || keys.has("ArrowDown"));
  const side = Number(keys.has("KeyD") || keys.has("ArrowRight")) - Number(keys.has("KeyA") || keys.has("ArrowLeft"));
  const targetSpeed = keys.has("ShiftLeft") || keys.has("ShiftRight") ? EXPLORE_RUN_SPEED : EXPLORE_WALK_SPEED;

  const moveForward = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
  const moveRight = new THREE.Vector3(-Math.cos(yaw), 0, Math.sin(yaw));
  const move = new THREE.Vector3()
    .addScaledVector(moveForward, forward)
    .addScaledVector(moveRight, side);

  const previousPosition = explorePosition.clone();
  if (move.lengthSq() > 0.001) {
    move.normalize().multiplyScalar(targetSpeed);
    exploreVelocity.x = THREE.MathUtils.damp(exploreVelocity.x, move.x, EXPLORE_ACCELERATION, delta);
    exploreVelocity.z = THREE.MathUtils.damp(exploreVelocity.z, move.z, EXPLORE_ACCELERATION, delta);
  } else {
    exploreVelocity.x = THREE.MathUtils.damp(exploreVelocity.x, 0, EXPLORE_FRICTION, delta);
    exploreVelocity.z = THREE.MathUtils.damp(exploreVelocity.z, 0, EXPLORE_FRICTION, delta);
  }

  explorePosition.x += exploreVelocity.x * delta;
  explorePosition.z += exploreVelocity.z * delta;
  resolveExploreCollisions(previousPosition);

  const groundY = MODEL_VERTICAL_OFFSET + EXPLORE_EYE_HEIGHT;
  if (keys.has("Space") && exploreGrounded) {
    exploreVelocityY = EXPLORE_JUMP_SPEED;
    exploreGrounded = false;
  }

  exploreVelocityY -= EXPLORE_GRAVITY * delta;
  explorePosition.y += exploreVelocityY * delta;
  if (explorePosition.y <= groundY) {
    explorePosition.y = groundY;
    exploreVelocityY = 0;
    exploreGrounded = true;
  }

  if (keys.has("KeyQ")) {
    yaw += delta * 1.8;
  }
  if (keys.has("KeyE")) {
    yaw -= delta * 1.8;
  }

  constrainExplorePosition();
  const horizontalSpeed = Math.hypot(exploreVelocity.x, exploreVelocity.z);
  if (exploreGrounded && horizontalSpeed > 0.08) {
    exploreWalkTime += delta * THREE.MathUtils.clamp(horizontalSpeed, 0, EXPLORE_RUN_SPEED) * 1.9;
  }
  const bob = exploreGrounded ? Math.sin(exploreWalkTime) * Math.min(horizontalSpeed / EXPLORE_RUN_SPEED, 1) * 0.045 : 0;
  camera.position.set(explorePosition.x, explorePosition.y + bob, explorePosition.z);

  const targetFov = (keys.has("ShiftLeft") || keys.has("ShiftRight")) && horizontalSpeed > 0.1 ? 58 : 48;
  camera.fov = THREE.MathUtils.damp(camera.fov, targetFov, 6, delta);
  camera.updateProjectionMatrix();

  const targetRoll = -side * 0.035;
  const currentRoll = Math.asin(camera.up.x);
  const nextRoll = THREE.MathUtils.damp(currentRoll || 0, targetRoll, 8, delta);

  const lookDirection = new THREE.Vector3(
    Math.sin(yaw) * Math.cos(pitch),
    Math.sin(pitch),
    Math.cos(yaw) * Math.cos(pitch),
  );

  camera.up.set(Math.sin(nextRoll), Math.cos(nextRoll), 0).normalize();
  camera.lookAt(camera.position.clone().add(lookDirection));
}
