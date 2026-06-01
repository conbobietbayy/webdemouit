import * as THREE from "three";

export function createFenceMaterials() {
  return {
    whiteMetal: new THREE.MeshStandardMaterial({
      color: 0xf7fbff,
      roughness: 0.28,
      metalness: 0.55,
    }),
    darkMetal: new THREE.MeshStandardMaterial({
      color: 0x1f2933,
      roughness: 0.42,
      metalness: 0.65,
    }),
    gateAccent: new THREE.MeshStandardMaterial({
      color: 0x36c7d7,
      roughness: 0.26,
      metalness: 0.48,
      emissive: 0x062b31,
      emissiveIntensity: 0.18,
    }),
    signStone: new THREE.MeshStandardMaterial({
      color: 0xb78645,
      roughness: 0.72,
      metalness: 0.04,
    }),
    signText: new THREE.MeshBasicMaterial({ color: 0xfff4cf }),
    logoBlue: new THREE.MeshStandardMaterial({ color: 0x16a7d8, roughness: 0.34, metalness: 0.12 }),
    logoGold: new THREE.MeshStandardMaterial({ color: 0xf2c94c, roughness: 0.38, metalness: 0.08 }),
  };
}
