import * as THREE from "three";

const UP = new THREE.Vector3(0, 1, 0);

export function buildCampusFence(fenceData, materials) {
  const group = new THREE.Group();
  group.name = "CampusFence";

  fenceData.segments.forEach((segment) => {
    const start = fenceData.points[segment.from];
    const end = fenceData.points[segment.to];
    if (!start || !end || segment.type === "gap") return;

    if (segment.type === "gate") {
      group.add(createAccordionGate(start, end, materials));
      return;
    }

    if (segment.type === "sign") {
      group.add(createUITSign(start, end, materials));
      return;
    }

    group.add(createFenceSegment(start, end, materials));
  });

  return group;
}

function createFenceSegment(start, end, materials) {
  const group = createSegmentGroup(start, end, "FenceSegment");
  const length = group.userData.length;
  const postCount = Math.max(2, Math.ceil(length / 0.7));

  for (let index = 0; index < postCount; index += 1) {
    const x = (index / (postCount - 1)) * length;
    group.add(createPost(x, 0, 1.05, 0.035, materials.whiteMetal));
  }

  group.add(createRail(length / 2, 0, 0.42, length, 0.055, materials.whiteMetal));
  group.add(createRail(length / 2, 0, 0.86, length, 0.055, materials.whiteMetal));
  return group;
}

function createAccordionGate(start, end, materials) {
  const group = createSegmentGroup(start, end, "UITAccordionGate");
  const length = group.userData.length;
  const height = 1.28;
  const barCount = Math.max(6, Math.ceil(length / 0.42));
  const step = length / Math.max(1, barCount - 1);

  group.add(createGateBox(0, height / 2, materials.darkMetal));
  group.add(createGateBox(length, height / 2, materials.darkMetal));

  for (let index = 0; index < barCount; index += 1) {
    const x = index * step;
    group.add(createPost(x, 0, height, 0.032, materials.whiteMetal));

    if (index < barCount - 1) {
      const centerX = x + step / 2;
      group.add(createBrace(centerX, 0.62, step, 0.9, 1, materials.whiteMetal));
      group.add(createBrace(centerX, 0.62, step, 0.9, -1, materials.whiteMetal));
    }
  }

  group.add(createRail(length / 2, 0, 0.16, length, 0.045, materials.darkMetal));
  return group;
}

function createUITSign(start, end, materials) {
  const group = createSegmentGroup(start, end, "UITGraniteSign");
  const width = Math.max(group.userData.length, 4.2);
  const height = 1.32;
  const depth = 0.22;
  const centerX = width / 2;
  const baseHeight = 0.16;
  const centerY = baseHeight + height / 2;
  const frontZ = -depth / 2 - 0.232;

  const slab = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), materials.signStone);
  slab.position.set(centerX, centerY, -0.12);
  slab.castShadow = true;
  slab.receiveShadow = true;
  group.add(slab);

  const backLip = new THREE.Mesh(new THREE.BoxGeometry(width + 0.08, height + 0.08, 0.04), materials.signStone);
  backLip.position.set(centerX, centerY, 0.02);
  backLip.castShadow = true;
  backLip.receiveShadow = true;
  group.add(backLip);

  const base = new THREE.Mesh(new THREE.BoxGeometry(width + 0.26, baseHeight, 0.34), materials.darkMetal);
  base.position.set(centerX, baseHeight / 2, -0.12);
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  const label = createSignLabel(width);
  label.position.set(centerX, centerY, frontZ);
  label.rotation.y = Math.PI;
  group.add(label);
  group.add(createStoneEdgeSet(width, height, depth, centerY, materials.signStone));
  return group;
}

function createSegmentGroup(start, end, name) {
  const group = new THREE.Group();
  group.name = name;

  const direction = new THREE.Vector3(end.x - start.x, 0, end.z - start.z);
  const length = direction.length();
  const angle = Math.atan2(direction.z, direction.x);
  const y = Math.max(start.y || 0, end.y || 0) + 0.03;

  group.position.set(start.x, y, start.z);
  group.rotation.y = -angle;
  group.userData.length = length;
  return group;
}

function createPost(x, y, height, radius, material) {
  const post = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 10), material);
  post.position.set(x, height / 2 + y, 0);
  post.castShadow = true;
  post.receiveShadow = true;
  return post;
}

function createRail(x, y, z, length, thickness, material) {
  const rail = new THREE.Mesh(new THREE.BoxGeometry(length, thickness, thickness), material);
  rail.position.set(x, z, y);
  rail.castShadow = true;
  rail.receiveShadow = true;
  return rail;
}

function createGateBox(x, z, material) {
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 1.32), material);
  box.position.set(x, z, 0);
  box.castShadow = true;
  box.receiveShadow = true;
  return box;
}

function createBrace(x, z, width, height, slope, material) {
  const length = Math.hypot(width, height);
  const brace = new THREE.Mesh(new THREE.BoxGeometry(length, 0.035, 0.035), material);
  brace.position.set(x, z, 0);
  brace.rotation.z = slope * Math.atan2(height, width);
  brace.castShadow = true;
  brace.receiveShadow = true;
  return brace;
}

function createLogo(x, z, materials) {
  const group = new THREE.Group();
  group.position.set(x, z, -0.02);

  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.055, 40), materials.logoBlue);
  disc.rotation.x = Math.PI / 2;
  group.add(disc);

  const core = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.065, 40), materials.logoGold);
  core.rotation.x = Math.PI / 2;
  core.position.z = -0.02;
  group.add(core);

  const strokeA = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.04, 0.035), materials.logoBlue);
  strokeA.position.set(0, 0.05, -0.055);
  group.add(strokeA);

  const strokeB = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.22, 0.035), materials.logoBlue);
  strokeB.position.set(0.08, -0.04, -0.055);
  group.add(strokeB);

  return group;
}

function createStoneEdgeSet(width, height, depth, centerY, material) {
  const group = new THREE.Group();
  const edgeDepth = 0.035;
  const z = -depth / 2 - 0.255;
  const topY = centerY + height / 2 - edgeDepth / 2;
  const bottomY = centerY - height / 2 + edgeDepth / 2;

  group.add(createStoneEdge(width / 2, topY, z, width - 0.08, edgeDepth, material));
  group.add(createStoneEdge(width / 2, bottomY, z, width - 0.08, edgeDepth, material));
  group.add(createStoneEdge(edgeDepth / 2 + 0.02, centerY, z, edgeDepth, height - 0.05, material));
  group.add(createStoneEdge(width - edgeDepth / 2 - 0.02, centerY, z, edgeDepth, height - 0.05, material));
  return group;
}

function createStoneEdge(x, y, z, width, height, material) {
  const edge = new THREE.Mesh(new THREE.BoxGeometry(width, height, 0.025), material);
  edge.position.set(x, y, z);
  edge.castShadow = true;
  edge.receiveShadow = true;
  return edge;
}

function createSignLabel(width) {
  const canvas = document.createElement("canvas");
  canvas.width = 1600;
  canvas.height = 560;
  const ctx = canvas.getContext("2d");

  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, "#d0b58c");
  gradient.addColorStop(0.28, "#b9976b");
  gradient.addColorStop(0.68, "#ad8458");
  gradient.addColorStop(1, "#d6bc95");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawStoneNoise(ctx, canvas.width, canvas.height);
  drawStoneInset(ctx, canvas.width, canvas.height);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";

  drawSilverRaisedText(ctx, "ĐẠI HỌC QUỐC GIA THÀNH PHỐ HỒ CHÍ MINH", canvas.width / 2, 92, 38, 1.0);
  drawSilverRaisedText(ctx, "TRƯỜNG ĐẠI HỌC", canvas.width / 2, 178, 62, 1.1);
  drawSilverRaisedText(ctx, "CÔNG NGHỆ THÔNG TIN", canvas.width / 2, 298, 86, 1.25);
  drawSilverRaisedText(ctx, "KHU PHỐ 6, P. LINH TRUNG, TP. THỦ ĐỨC - TP. HCM", canvas.width / 2, 410, 29, 0.75);
  drawSilverRaisedText(ctx, "ĐT: 028.3725.2002     FAX: 028.3725.2148     Website: www.uit.edu.vn", canvas.width / 2, 468, 28, 0.72);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const label = new THREE.Mesh(new THREE.PlaneGeometry(width * 0.96, 1.16), material);
  label.renderOrder = 10;
  return label;
}

function drawStoneNoise(ctx, width, height) {
  const image = ctx.getImageData(0, 0, width, height);
  for (let index = 0; index < image.data.length; index += 4) {
    const noise = (Math.random() - 0.5) * 18;
    image.data[index] = clampColor(image.data[index] + noise);
    image.data[index + 1] = clampColor(image.data[index + 1] + noise * 0.9);
    image.data[index + 2] = clampColor(image.data[index + 2] + noise * 0.72);
  }
  ctx.putImageData(image, 0, 0);

  ctx.globalAlpha = 0.2;
  for (let i = 0; i < 1300; i += 1) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const radius = Math.random() * 1.35 + 0.25;
    ctx.fillStyle = Math.random() > 0.55 ? "#ead0a8" : "#7a5a38";
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = 0.12;
  for (let i = 0; i < 18; i += 1) {
    const y = Math.random() * height;
    ctx.strokeStyle = i % 2 ? "#f1d5ad" : "#775537";
    ctx.lineWidth = Math.random() * 1.2 + 0.35;
    ctx.beginPath();
    ctx.moveTo(-20, y);
    ctx.bezierCurveTo(width * 0.3, y - 8 + Math.random() * 16, width * 0.72, y - 10 + Math.random() * 20, width + 20, y - 6 + Math.random() * 12);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawStoneInset(ctx, width, height) {
  const edge = ctx.createLinearGradient(0, 0, 0, height);
  edge.addColorStop(0, "rgba(255,255,255,0.22)");
  edge.addColorStop(1, "rgba(37,25,16,0.24)");
  ctx.fillStyle = edge;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "rgba(92, 67, 44, 0.42)";
  ctx.lineWidth = 16;
  ctx.strokeRect(16, 16, width - 32, height - 32);
  ctx.strokeStyle = "rgba(235, 207, 165, 0.3)";
  ctx.lineWidth = 4;
  ctx.strokeRect(34, 34, width - 68, height - 68);
}

function drawSilverRaisedText(ctx, text, x, y, size, strokeScale) {
  ctx.font = `900 ${size}px Georgia, 'Times New Roman', serif`;

  ctx.shadowColor = "rgba(18, 14, 11, 0.82)";
  ctx.shadowBlur = size * 0.045;
  ctx.shadowOffsetX = 5;
  ctx.shadowOffsetY = 6;
  ctx.strokeStyle = "rgba(42, 35, 30, 0.9)";
  ctx.lineWidth = Math.max(2.5, size * 0.09 * strokeScale);
  ctx.strokeText(text, x, y);

  const metal = ctx.createLinearGradient(0, y - size * 0.65, 0, y + size * 0.65);
  metal.addColorStop(0, "#fffdf3");
  metal.addColorStop(0.25, "#e9e2d4");
  metal.addColorStop(0.55, "#7e7b75");
  metal.addColorStop(0.76, "#c9c2b5");
  metal.addColorStop(1, "#f5ead7");
  ctx.fillStyle = metal;
  ctx.fillText(text, x, y);

  ctx.shadowColor = "transparent";
  ctx.strokeStyle = "rgba(255,255,255,0.62)";
  ctx.lineWidth = Math.max(1, size * 0.02);
  ctx.strokeText(text, x - 2, y - 2.5);

  ctx.strokeStyle = "rgba(55,48,42,0.28)";
  ctx.lineWidth = Math.max(1, size * 0.015);
  ctx.strokeText(text, x + 2.5, y + 3);
}

function clampColor(value) {
  return Math.max(0, Math.min(255, value));
}
