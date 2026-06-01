import { loadFenceData } from "./fenceData.js";
import { buildCampusFence } from "./fenceGeometry.js";
import { createFenceMaterials } from "./fenceMaterials.js";

export async function loadCampusFence(scene, options = {}) {
  const data = await loadFenceData(options.url);
  const materials = createFenceMaterials();
  const group = buildCampusFence(data, materials);

  group.name = "CampusFenceRuntime";
  group.userData.materials = materials;
  scene.add(group);

  return group;
}

export function disposeCampusFence(group) {
  if (!group) return;
  group.parent?.remove(group);
  group.traverse((node) => {
    node.geometry?.dispose?.();
    if (Array.isArray(node.material)) {
      node.material.forEach((material) => disposeMaterial(material));
    } else {
      disposeMaterial(node.material);
    }
  });

  Object.values(group.userData.materials || {}).forEach(disposeMaterial);
}

function disposeMaterial(material) {
  if (!material) return;
  material.map?.dispose?.();
  material.dispose?.();
}
