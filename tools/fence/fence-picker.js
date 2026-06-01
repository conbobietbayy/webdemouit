import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const STORAGE_KEY = "uit-fence-boundary-v2";
const LEGACY_STORAGE_KEY = "uit-fence-boundary-v1";
const TARGET_MODEL_SIZE = 42;
const SEGMENT_PICK_THRESHOLD = 0.9;
const TYPE_COLORS = {
  fence: 0xf8fafc,
  gate: 0x67e8f9,
  sign: 0xfbbf24,
  gap: 0xfb7185,
};

const canvas = document.querySelector("#viewport");
const statusText = document.querySelector("#status");
const modelSelect = document.querySelector("#model-select");
const editModeSelect = document.querySelector("#edit-mode");
const segmentTypeSelect = document.querySelector("#segment-type");
const fileNameInput = document.querySelector("#file-name");
const jsonOutput = document.querySelector("#json-output");
const buttons = {
  closeLoop: document.querySelector("#close-loop"),
  undoPoint: document.querySelector("#undo-point"),
  clearAll: document.querySelector("#clear-all"),
  copyJson: document.querySelector("#copy-json"),
  downloadJson: document.querySelector("#download-json"),
  saveJson: document.querySelector("#save-json"),
};

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0d1517);

const camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.08, 1200);
camera.position.set(16, 38, 18);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.49;
controls.target.set(0, 0, 0);

scene.add(new THREE.HemisphereLight(0xe8f7ff, 0x18211d, 2.15));
const sun = new THREE.DirectionalLight(0xffffff, 2.4);
sun.position.set(-30, 60, 30);
scene.add(sun);

const grid = new THREE.GridHelper(56, 56, 0xffffff, 0x4b6b70);
grid.material.opacity = 0.24;
grid.material.transparent = true;
scene.add(grid);

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const boundaryGroup = new THREE.Group();
scene.add(boundaryGroup);

let model = null;
let selectedSegmentIndex = -1;
let state = loadStoredState();

buttons.closeLoop.addEventListener("click", closeLoop);
buttons.undoPoint.addEventListener("click", undoPoint);
buttons.clearAll.addEventListener("click", clearAll);
buttons.copyJson.addEventListener("click", copyJson);
buttons.downloadJson.addEventListener("click", downloadJson);
buttons.saveJson.addEventListener("click", saveJsonToPublic);
modelSelect.addEventListener("change", () => loadModel(modelSelect.value));
canvas.addEventListener("pointerdown", handleCanvasClick);
window.addEventListener("resize", resize);
window.addEventListener("keydown", handleKeydown);

loadModel(modelSelect.value);
updateOutput();
animate();

function loadModel(url) {
  statusText.textContent = "Đang tải model...";
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
      redrawBoundary();
    },
    undefined,
    (error) => {
      console.error(error);
      statusText.textContent = "Không tải được model";
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

function handleCanvasClick(event) {
  if (event.button !== 0 || event.target !== canvas) return;
  const point = getPickPoint(event);
  if (!point) return;

  if (editModeSelect.value === "segment") {
    setNearestSegmentType(point);
    return;
  }

  addBoundaryPoint(point);
}

function addBoundaryPoint(point) {
  if (state.closed) state.closed = false;
  state.points.push({ x: round(point.x), y: round(point.y + 0.04), z: round(point.z) });
  selectedSegmentIndex = -1;
  redrawBoundary();
  updateOutput();
}

function setNearestSegmentType(point) {
  const result = findNearestSegment(point);
  if (!result || result.distance > SEGMENT_PICK_THRESHOLD) {
    statusText.textContent = "Chưa click đủ gần đoạn rào/cổng";
    return;
  }

  state.segmentTypes[result.index] = segmentTypeSelect.value;
  selectedSegmentIndex = result.index;
  redrawBoundary();
  updateOutput();
}

function getPickPoint(event) {
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);

  const hits = model ? raycaster.intersectObject(model, true) : [];
  const hitPoint = hits.find((hit) => hit.point)?.point;
  return hitPoint || raycaster.ray.intersectPlane(groundPlane, new THREE.Vector3());
}

function closeLoop() {
  state.closed = state.points.length >= 3;
  selectedSegmentIndex = -1;
  redrawBoundary();
  updateOutput();
}

function undoPoint() {
  if (state.points.length === 0) return;
  state.points.pop();
  state.closed = false;
  selectedSegmentIndex = -1;
  pruneSegmentTypes();
  redrawBoundary();
  updateOutput();
}

function clearAll() {
  state = { closed: false, points: [], segmentTypes: {} };
  selectedSegmentIndex = -1;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(LEGACY_STORAGE_KEY);
  redrawBoundary();
  updateOutput();
}

async function copyJson() {
  await navigator.clipboard.writeText(getJsonText());
  statusText.textContent = "Đã copy JSON";
}

function downloadJson() {
  const url = URL.createObjectURL(new Blob([getJsonText()], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = sanitizeFileName(fileNameInput.value);
  link.click();
  URL.revokeObjectURL(url);
}

async function saveJsonToPublic() {
  const response = await fetch("/api/save-fence", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileName: sanitizeFileName(fileNameInput.value), payload: getPayload() }),
  });

  if (!response.ok) {
    statusText.textContent = "Không lưu được. Hãy chạy server.mjs của tool.";
    return;
  }

  const result = await response.json();
  statusText.textContent = `Đã lưu ${result.path}`;
}

function redrawBoundary() {
  clearGroup(boundaryGroup);
  drawSegments();
  drawPoints();
  statusText.textContent = `${state.points.length} điểm, ${countGateSegments()} đoạn cổng`;
}

function drawPoints() {
  const geometry = new THREE.SphereGeometry(0.09, 12, 12);
  const material = new THREE.MeshBasicMaterial({ color: 0xe2e8f0 });
  state.points.forEach((point, index) => {
    const marker = new THREE.Mesh(geometry, material);
    marker.position.set(point.x, point.y + 0.14, point.z);
    boundaryGroup.add(marker);

    const label = createPointLabel(index + 1);
    label.position.set(point.x, point.y + 0.45, point.z);
    boundaryGroup.add(label);
  });
}

function drawSegments() {
  getSegments().forEach((segment, index) => {
    if (segment.length < 0.2) return;
    const start = state.points[segment.from];
    const end = state.points[segment.to];
    const color = TYPE_COLORS[segment.type] || TYPE_COLORS.fence;
    const yOffset = index === selectedSegmentIndex ? 0.34 : 0.22;
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(start.x, start.y + yOffset, start.z),
      new THREE.Vector3(end.x, end.y + yOffset, end.z),
    ]);
    const material = new THREE.LineBasicMaterial({ color });
    boundaryGroup.add(new THREE.Line(geometry, material));

    if (index === selectedSegmentIndex) drawSegmentMidMarker(start, end, color);
  });
}

function drawSegmentMidMarker(start, end, color) {
  const marker = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.5, 0.5),
    new THREE.MeshBasicMaterial({ color }),
  );
  marker.position.set((start.x + end.x) / 2, Math.max(start.y, end.y) + 0.75, (start.z + end.z) / 2);
  boundaryGroup.add(marker);
}

function createPointLabel(text) {
  const canvas2d = document.createElement("canvas");
  canvas2d.width = 96;
  canvas2d.height = 48;
  const context = canvas2d.getContext("2d");
  context.fillStyle = "#111827";
  context.fillRect(0, 0, canvas2d.width, canvas2d.height);
  context.fillStyle = "#f8fafc";
  context.font = "bold 24px Inter, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(String(text), 48, 24);

  const texture = new THREE.CanvasTexture(canvas2d);
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(0.48, 0.24, 1);
  return sprite;
}

function updateOutput() {
  pruneSegmentTypes();
  saveStoredState();
  jsonOutput.value = getJsonText();
}

function getPayload() {
  return {
    version: 2,
    source: "tools/fence",
    coordinateSpace: "normalized-uit-model-42",
    note: "Day.glb và Night.glb dùng chung tọa độ trong tool này.",
    targetModelSize: TARGET_MODEL_SIZE,
    referenceModel: modelSelect.value.split("/").pop(),
    closed: state.closed,
    points: state.points,
    segments: getSegments(),
  };
}

function getSegments() {
  if (state.points.length < 2) return [];
  const segmentCount = state.closed ? state.points.length : state.points.length - 1;
  return Array.from({ length: segmentCount }, (_, index) => {
    const start = state.points[index];
    const end = state.points[(index + 1) % state.points.length];
    return {
      from: index,
      to: (index + 1) % state.points.length,
      type: state.segmentTypes[index] || "fence",
      length: round(distanceXZ(start, end)),
    };
  });
}

function findNearestSegment(point) {
  return getSegments().reduce((nearest, segment, index) => {
    const start = state.points[segment.from];
    const end = state.points[segment.to];
    const distance = distancePointToSegmentXZ(point, start, end);
    if (!nearest || distance < nearest.distance) return { index, distance };
    return nearest;
  }, null);
}

function getJsonText() {
  return JSON.stringify(getPayload(), null, 2);
}

function loadStoredState() {
  return loadStateFromStorage(STORAGE_KEY) || loadLegacyState() || { closed: false, points: [], segmentTypes: {} };
}

function loadStateFromStorage(key) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "null");
    if (!parsed || !Array.isArray(parsed.points)) return null;
    return {
      closed: Boolean(parsed.closed),
      points: parsed.points.map(({ x, y, z }) => ({ x, y, z })),
      segmentTypes: parsed.segmentTypes || getSegmentTypesFromSegments(parsed.segments),
    };
  } catch {
    return null;
  }
}

function loadLegacyState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY) || "null");
    if (!parsed || !Array.isArray(parsed.points)) return null;
    return {
      closed: Boolean(parsed.closed),
      points: parsed.points.map(({ x, y, z }) => ({ x, y, z })),
      segmentTypes: parsed.points.reduce((types, point, index) => {
        if (point.type && point.type !== "fence") types[index] = point.type;
        return types;
      }, {}),
    };
  } catch {
    return null;
  }
}

function getSegmentTypesFromSegments(segments) {
  if (!Array.isArray(segments)) return {};
  return segments.reduce((types, segment, index) => {
    if (segment.type && segment.type !== "fence") types[index] = segment.type;
    return types;
  }, {});
}

function saveStoredState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function pruneSegmentTypes() {
  const maxSegments = state.closed ? state.points.length : Math.max(0, state.points.length - 1);
  state.segmentTypes = Object.fromEntries(
    Object.entries(state.segmentTypes).filter(([index]) => Number(index) < maxSegments),
  );
}

function handleKeydown(event) {
  if (event.code === "Backspace") {
    event.preventDefault();
    undoPoint();
  }
  if (event.code === "KeyC") closeLoop();
  if (event.code === "KeyP") editModeSelect.value = "point";
  if (event.code === "KeyE") editModeSelect.value = "segment";
  if (event.code === "KeyS" && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    saveJsonToPublic();
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

function clearGroup(group) {
  while (group.children.length > 0) {
    const child = group.children.pop();
    disposeObject(child);
  }
}

function countGateSegments() {
  return getSegments().filter((segment) => segment.type === "gate").length;
}

function distanceXZ(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function distancePointToSegmentXZ(point, start, end) {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const lengthSquared = dx * dx + dz * dz;
  if (lengthSquared === 0) return distanceXZ(point, start);

  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.z - start.z) * dz) / lengthSquared));
  const projection = { x: start.x + t * dx, z: start.z + t * dz };
  return Math.hypot(point.x - projection.x, point.z - projection.z);
}

function sanitizeFileName(value) {
  const fallback = "campus-fence-boundary.json";
  const clean = String(value || fallback).replace(/[\\/:*?"<>|]/g, "-").trim();
  return clean.endsWith(".json") ? clean : `${clean}.json`;
}

function round(value) {
  return Math.round(value * 1000) / 1000;
}
