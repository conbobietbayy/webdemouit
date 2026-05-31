import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const STORAGE_KEY = "uit-route-painter-routes";
const TARGET_MODEL_SIZE = 42;

const canvas = document.querySelector("#viewport");
const statusText = document.querySelector("#status");
const modelSelect = document.querySelector("#model-select");
const jsonOutput = document.querySelector("#json-output");
const buttons = {
  newRoute: document.querySelector("#new-route"),
  finishRoute: document.querySelector("#finish-route"),
  undoPoint: document.querySelector("#undo-point"),
  clearAll: document.querySelector("#clear-all"),
  saveJson: document.querySelector("#save-json"),
  copyJson: document.querySelector("#copy-json"),
};

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9fc5cf);

const camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.08, 1200);
camera.position.set(16, 38, 18);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 0, 0);
controls.maxPolarAngle = Math.PI * 0.48;

scene.add(new THREE.HemisphereLight(0xe8f7ff, 0x24302a, 2.2));
const sun = new THREE.DirectionalLight(0xffffff, 2.4);
sun.position.set(-30, 60, 30);
scene.add(sun);

const grid = new THREE.GridHelper(50, 50, 0xffffff, 0x668a8f);
grid.material.opacity = 0.28;
grid.material.transparent = true;
scene.add(grid);

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const routeGroup = new THREE.Group();
scene.add(routeGroup);

let model = null;
let activeRoute = [];
let routes = loadStoredRoutes();

buttons.newRoute.addEventListener("click", startRoute);
buttons.finishRoute.addEventListener("click", finishRoute);
buttons.undoPoint.addEventListener("click", undoPoint);
buttons.clearAll.addEventListener("click", clearAll);
buttons.saveJson.addEventListener("click", saveJson);
buttons.copyJson.addEventListener("click", copyJson);
modelSelect.addEventListener("change", () => loadModel(modelSelect.value));
canvas.addEventListener("pointerdown", addPointFromPointer);
window.addEventListener("resize", resize);
window.addEventListener("keydown", handleKeydown);

loadModel(modelSelect.value);
updateOutput();
animate();

function loadModel(url) {
  statusText.textContent = "Dang tai model...";
  if (model) {
    scene.remove(model);
    disposeObject(model);
    model = null;
  }

  new GLTFLoader().load(
    url,
    (gltf) => {
      model = gltf.scene;
      normalizeModel(model);
      model.traverse((node) => {
        if (node.isMesh) {
          node.castShadow = false;
          node.receiveShadow = true;
        }
      });
      scene.add(model);
      statusText.textContent = `${routes.length} tuyen, ${activeRoute.length} point dang ve`;
      redrawRoutes();
    },
    undefined,
    (error) => {
      console.error(error);
      statusText.textContent = "Khong tai duoc model";
    },
  );
}

function normalizeModel(target) {
  const rawBox = new THREE.Box3().setFromObject(target);
  const rawSize = rawBox.getSize(new THREE.Vector3());
  const maxDimension = Math.max(rawSize.x, rawSize.y, rawSize.z);
  const scale = maxDimension > 0 ? TARGET_MODEL_SIZE / maxDimension : 1;
  target.scale.setScalar(scale);

  const scaledBox = new THREE.Box3().setFromObject(target);
  const scaledCenter = scaledBox.getCenter(new THREE.Vector3());
  target.position.sub(scaledCenter);

  const finalBox = new THREE.Box3().setFromObject(target);
  target.position.y -= finalBox.min.y;
  target.updateWorldMatrix(true, true);

  const box = new THREE.Box3().setFromObject(target);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  controls.target.copy(center);
  camera.position.set(center.x + size.x * 0.18, Math.max(size.y * 2.2, 34), center.z + size.z * 0.18);
  controls.update();
}

function addPointFromPointer(event) {
  if (event.button !== 0 || event.target !== canvas) return;

  const rect = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);

  const hits = model ? raycaster.intersectObject(model, true) : [];
  const hitPoint = hits.find((hit) => hit.point)?.point;
  const planePoint = raycaster.ray.intersectPlane(groundPlane, new THREE.Vector3());
  const point = hitPoint || planePoint;
  if (!point) return;

  const rounded = {
    x: round(point.x),
    y: round(point.y + 0.04),
    z: round(point.z),
  };

  if (event.shiftKey && activeRoute.length > 0) {
    activeRoute.splice(activeRoute.length - 1, 0, rounded);
  } else {
    activeRoute.push(rounded);
  }
  redrawRoutes();
  updateOutput();
}

function startRoute() {
  if (activeRoute.length >= 2) {
    finishRoute();
  }
  activeRoute = [];
  redrawRoutes();
  updateOutput();
}

function finishRoute() {
  if (activeRoute.length >= 2) {
    routes.push(activeRoute);
    activeRoute = [];
    saveStoredRoutes();
    redrawRoutes();
    updateOutput();
  }
}

function undoPoint() {
  if (activeRoute.length > 0) {
    activeRoute.pop();
  } else if (routes.length > 0) {
    activeRoute = routes.pop();
  }
  saveStoredRoutes();
  redrawRoutes();
  updateOutput();
}

function clearAll() {
  routes = [];
  activeRoute = [];
  localStorage.removeItem(STORAGE_KEY);
  redrawRoutes();
  updateOutput();
}

async function saveJson() {
  finishRoute();
  const payload = getJsonText();
  if ("showSaveFilePicker" in window) {
    const handle = await window.showSaveFilePicker({
      suggestedName: "student-routes.json",
      types: [{ description: "JSON", accept: { "application/json": [".json"] } }],
    });
    const writable = await handle.createWritable();
    await writable.write(payload);
    await writable.close();
    return;
  }

  const url = URL.createObjectURL(new Blob([payload], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "student-routes.json";
  link.click();
  URL.revokeObjectURL(url);
}

async function copyJson() {
  await navigator.clipboard.writeText(getJsonText());
  statusText.textContent = "Da copy JSON";
}

function redrawRoutes() {
  routeGroup.clear();
  routes.forEach((route, index) => drawRoute(route, index, false));
  drawRoute(activeRoute, routes.length, true);
  statusText.textContent = `${routes.length} tuyen, ${activeRoute.length} point dang ve`;
}

function drawRoute(route, routeIndex, active) {
  if (!route.length) return;

  const color = active ? 0x00e5ff : 0xff2f2f;
  const pointMaterial = new THREE.MeshBasicMaterial({ color });
  const pointGeometry = new THREE.SphereGeometry(active ? 0.14 : 0.11, 12, 12);
  route.forEach((point) => {
    const mesh = new THREE.Mesh(pointGeometry, pointMaterial);
    mesh.position.set(point.x, point.y + 0.12, point.z);
    routeGroup.add(mesh);
  });

  if (route.length >= 2) {
    const points = route.map((point) => new THREE.Vector3(point.x, point.y + 0.12, point.z));
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(points),
      new THREE.LineBasicMaterial({ color: active ? 0x00e5ff : routeColor(routeIndex) }),
    );
    routeGroup.add(line);
  }
}

function updateOutput() {
  saveStoredRoutes();
  jsonOutput.value = getJsonText();
}

function getJsonText() {
  return JSON.stringify({
    version: 1,
    model: modelSelect.value.split("/").pop(),
    targetModelSize: TARGET_MODEL_SIZE,
    routes: activeRoute.length >= 2 ? [...routes, activeRoute] : routes,
  }, null, 2);
}

function loadStoredRoutes() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : parsed.routes || [];
  } catch {
    return [];
  }
}

function saveStoredRoutes() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(routes));
}

function handleKeydown(event) {
  if (event.code === "Enter") {
    event.preventDefault();
    finishRoute();
  }
  if (event.code === "Backspace") {
    event.preventDefault();
    undoPoint();
  }
  if (event.code === "KeyN") {
    startRoute();
  }
  if (event.code === "KeyS" && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    saveJson();
  }
}

function resize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

function disposeObject(object) {
  object.traverse((node) => {
    node.geometry?.dispose?.();
    if (Array.isArray(node.material)) {
      node.material.forEach((material) => material.dispose?.());
    } else {
      node.material?.dispose?.();
    }
  });
}

function routeColor(index) {
  const colors = [0xff3b30, 0xffcc00, 0x34c759, 0x0a84ff, 0xbf5af2, 0xff9f0a];
  return colors[index % colors.length];
}

function round(value) {
  return Math.round(value * 1000) / 1000;
}
