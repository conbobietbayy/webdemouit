import * as THREE from "three";
import {
  buildStudentRoutes,
  getNextRouteTargetIndex,
  getRoutePointWithLane,
  shouldYieldToStudent,
  STUDENT_ROUTES_URL,
} from "./studentRouteRuntime.js";

const STUDENT_COUNT = 11;
const STUDENT_MIN_DISTANCE = 0.42;
const STUDENT_SEPARATION_DISTANCE = 0.32;
const STUDENT_LANE_OFFSETS = [-0.18, 0, 0.18];

export class StudentCharacter {
  constructor(scene, route, speed, colorHex, hairColorHex, pantsColorHex, skinColorHex, id, options = {}) {
    this.scene = scene;
    this.route = route;
    this.routeIndex = options.routeIndex || 0;
    this.currentPointIndex = options.startPointIndex || 0;
    this.direction = options.direction || 1;
    this.targetPointIndex = getNextRouteTargetIndex(this.currentPointIndex, this.direction, this.route);
    this.laneOffset = options.laneOffset || 0;
    const startPoint = getRoutePointWithLane(this.route, this.currentPointIndex, this.laneOffset, this.direction);
    this.position = new THREE.Vector3(startPoint.x, startPoint.y, startPoint.z);
    this.speed = speed;
    this.id = id;
    this.state = "walking"; // "walking" or "idle"
    this.idleTimer = 0;
    this.avoidanceTimer = Math.random() * 0.25;

    this.group = new THREE.Group();
    this.group.position.copy(this.position);

    // Set up materials & meshes
    this.buildCharacter(colorHex, hairColorHex, pantsColorHex, skinColorHex);
    this.scene.add(this.group);
  }

  buildCharacter(shirtColor, hairColor, pantsColor, skinColor) {
    // 1. Torso (Body)
    const textureLoader = new THREE.TextureLoader();
    
    // Load UIT shirt front and back textures
    const frontTex = textureLoader.load("public/uit1.webp");
    const backTex = textureLoader.load("public/uit2.webp");
    
    // Correct color space for modern Three.js (0.150+)
    frontTex.colorSpace = THREE.SRGBColorSpace;
    backTex.colorSpace = THREE.SRGBColorSpace;

    // Crop the central torso part of the shirt images (cropping out sleeves and blank background margins)
    frontTex.repeat.set(0.5, 0.82);
    frontTex.offset.set(0.25, 0.08);
    backTex.repeat.set(0.5, 0.82);
    backTex.offset.set(0.25, 0.08);

    // Clamp texture wrapping
    frontTex.wrapS = THREE.ClampToEdgeWrapping;
    frontTex.wrapT = THREE.ClampToEdgeWrapping;
    backTex.wrapS = THREE.ClampToEdgeWrapping;
    backTex.wrapT = THREE.ClampToEdgeWrapping;

    // Materials for the 6 faces of the Torso Box
    // Face Order: Right (+X), Left (-X), Top (+Y), Bottom (-Y), Front (+Z), Back (-Z)
    const torsoColorMat = new THREE.MeshStandardMaterial({
      color: shirtColor,
      roughness: 0.7,
      metalness: 0.1
    });

    const torsoFrontMat = new THREE.MeshStandardMaterial({
      map: frontTex,
      color: shirtColor,
      roughness: 0.7,
      metalness: 0.1
    });

    const torsoBackMat = new THREE.MeshStandardMaterial({
      map: backTex,
      color: shirtColor,
      roughness: 0.7,
      metalness: 0.1
    });

    const torsoMaterials = [
      torsoColorMat, // Right
      torsoColorMat, // Left
      torsoColorMat, // Top
      torsoColorMat, // Bottom
      torsoFrontMat, // Front
      torsoBackMat   // Back
    ];

    // Create Torso mesh (width: 0.14, height: 0.22, depth: 0.08)
    const torsoGeom = new THREE.BoxGeometry(0.14, 0.22, 0.08);
    this.torso = new THREE.Mesh(torsoGeom, torsoMaterials);
    this.torso.position.y = 0.26; // Center height of torso
    this.torso.castShadow = true;
    this.torso.receiveShadow = true;
    this.group.add(this.torso);

    // 2. Head (0.10 cube)
    const skinMat = new THREE.MeshStandardMaterial({
      color: skinColor,
      roughness: 0.8,
      metalness: 0.0
    });
    
    const headGeom = new THREE.BoxGeometry(0.10, 0.10, 0.10);
    this.head = new THREE.Mesh(headGeom, skinMat);
    this.head.position.y = 0.42; // Above torso
    this.head.castShadow = true;
    this.head.receiveShadow = true;
    this.group.add(this.head);

    // 3. Hair (blocky cap)
    const hairMat = new THREE.MeshStandardMaterial({
      color: hairColor,
      roughness: 0.9,
      metalness: 0.0
    });
    const hairGeom = new THREE.BoxGeometry(0.106, 0.04, 0.106);
    this.hair = new THREE.Mesh(hairGeom, hairMat);
    this.hair.position.set(0, 0.455, -0.005);
    this.hair.castShadow = true;
    this.group.add(this.hair);

    // 4. Arms (Hierarchical model)
    const sleeveMat = new THREE.MeshStandardMaterial({
      color: shirtColor,
      roughness: 0.7,
      metalness: 0.1
    });

    const armWidth = 0.035;
    const armHeight = 0.20;
    const armDepth = 0.035;

    // Left Arm Pivot
    this.leftArmPivot = new THREE.Group();
    this.leftArmPivot.position.set(-0.09, 0.34, 0); // Position at shoulder
    this.group.add(this.leftArmPivot);

    // Left Arm Mesh (split into upper blue sleeve and lower skin arm)
    const upperArmGeom = new THREE.BoxGeometry(armWidth, armHeight * 0.5, armDepth);
    const lowerArmGeom = new THREE.BoxGeometry(armWidth, armHeight * 0.5, armDepth);

    const leftUpperArm = new THREE.Mesh(upperArmGeom, sleeveMat);
    leftUpperArm.position.y = -armHeight * 0.25;
    leftUpperArm.castShadow = true;
    leftUpperArm.receiveShadow = true;
    this.leftArmPivot.add(leftUpperArm);

    const leftLowerArm = new THREE.Mesh(lowerArmGeom, skinMat);
    leftLowerArm.position.y = -armHeight * 0.75;
    leftLowerArm.castShadow = true;
    leftLowerArm.receiveShadow = true;
    this.leftArmPivot.add(leftLowerArm);

    // Right Arm Pivot
    this.rightArmPivot = new THREE.Group();
    this.rightArmPivot.position.set(0.09, 0.34, 0);
    this.group.add(this.rightArmPivot);

    const rightUpperArm = new THREE.Mesh(upperArmGeom, sleeveMat);
    rightUpperArm.position.y = -armHeight * 0.25;
    rightUpperArm.castShadow = true;
    rightUpperArm.receiveShadow = true;
    this.rightArmPivot.add(rightUpperArm);

    const rightLowerArm = new THREE.Mesh(lowerArmGeom, skinMat);
    rightLowerArm.position.y = -armHeight * 0.75;
    rightLowerArm.castShadow = true;
    rightLowerArm.receiveShadow = true;
    this.rightArmPivot.add(rightLowerArm);

    // 5. Legs (Hierarchical model)
    const pantsMat = new THREE.MeshStandardMaterial({
      color: pantsColor,
      roughness: 0.8,
      metalness: 0.0
    });
    const shoeMat = new THREE.MeshStandardMaterial({
      color: 0xfcfcfc, // White sneakers
      roughness: 0.6,
      metalness: 0.0
    });

    const legWidth = 0.04;
    const legHeight = 0.18;
    const legDepth = 0.04;

    // Left Leg Pivot
    this.leftLegPivot = new THREE.Group();
    this.leftLegPivot.position.set(-0.045, 0.16, 0); // Position at hip joint
    this.group.add(this.leftLegPivot);

    // Left Leg Mesh
    const upperLegGeom = new THREE.BoxGeometry(legWidth, legHeight * 0.6, legDepth);
    const lowerLegGeom = new THREE.BoxGeometry(legWidth, legHeight * 0.4, legDepth);

    const leftUpperLeg = new THREE.Mesh(upperLegGeom, pantsMat);
    leftUpperLeg.position.y = -legHeight * 0.3;
    leftUpperLeg.castShadow = true;
    leftUpperLeg.receiveShadow = true;
    this.leftLegPivot.add(leftUpperLeg);

    const leftLowerLeg = new THREE.Mesh(lowerLegGeom, shoeMat);
    leftLowerLeg.position.y = -legHeight * 0.8;
    leftLowerLeg.castShadow = true;
    leftLowerLeg.receiveShadow = true;
    this.leftLegPivot.add(leftLowerLeg);

    // Right Leg Pivot
    this.rightLegPivot = new THREE.Group();
    this.rightLegPivot.position.set(0.045, 0.16, 0);
    this.group.add(this.rightLegPivot);

    const rightUpperLeg = new THREE.Mesh(upperLegGeom, pantsMat);
    rightUpperLeg.position.y = -legHeight * 0.3;
    rightUpperLeg.castShadow = true;
    rightUpperLeg.receiveShadow = true;
    this.rightLegPivot.add(rightUpperLeg);

    const rightLowerLeg = new THREE.Mesh(lowerLegGeom, shoeMat);
    rightLowerLeg.position.y = -legHeight * 0.8;
    rightLowerLeg.castShadow = true;
    rightLowerLeg.receiveShadow = true;
    this.rightLegPivot.add(rightLowerLeg);
  }

  update(delta, time, students = []) {
    if (this.state === "walking") {
      const targetPoint = getRoutePointWithLane(this.route, this.targetPointIndex, this.laneOffset, this.direction);
      const targetX = targetPoint.x;
      const targetZ = targetPoint.z;
      const dx = targetX - this.position.x;
      const dz = targetZ - this.position.z;
      const distanceToTarget = Math.sqrt(dx * dx + dz * dz);

      if (distanceToTarget < 0.12) {
        this.arriveAtTarget();
      } else {
        const target = { x: targetX, y: targetPoint.y, z: targetZ };
        const mustYield = students.some((other) => {
          if (other === this) return false;
          const otherTargetPoint = other.getCurrentTargetPoint();
          return shouldYieldToStudent(
            this.position,
            target,
            other.position,
            STUDENT_MIN_DISTANCE,
            this.id,
            other.id,
            otherTargetPoint,
          );
        });

        const separation = this.getSeparation(students);
        this.avoidanceTimer = mustYield ? this.avoidanceTimer + delta : 0;
        const speedScale = mustYield ? (this.avoidanceTimer > 0.8 ? 0.28 : 0) : 1;
        const moveDist = this.speed * speedScale * delta;
        if (moveDist > 0) {
          this.position.x += (dx / distanceToTarget) * moveDist;
          this.position.z += (dz / distanceToTarget) * moveDist;
        }
        this.position.x += separation.x * delta;
        this.position.z += separation.z * delta;
        this.position.y = THREE.MathUtils.damp(this.position.y, targetPoint.y, 10, delta);
        this.group.position.copy(this.position);

        if (!mustYield || distanceToTarget > 0.25) {
          this.rotateToward(dx, dz, delta);
        }
      }
    } else if (this.state === "idle") {
      this.idleTimer -= delta;
      if (this.idleTimer <= 0) {
        this.state = "walking";
      }
    }

    // Walking animation swing (proportional to actual velocity)
    let swingAngle = 0;
    const swingFreq = 9; // swing cycle speed
    if (this.state === "walking") {
      const swingAmp = 0.4; // swing range
      swingAngle = swingAmp * Math.sin(time * swingFreq * (this.speed / 0.45));
    }

    // Smoothly damp rotations when transitioning to/from idle
    // If walking, target rotation is swingAngle. If idle, target is 0.
    const currentLegX = this.leftLegPivot.rotation.x;
    const targetLegX = swingAngle;
    this.leftLegPivot.rotation.x = THREE.MathUtils.damp(currentLegX, targetLegX, 8, delta);
    this.rightLegPivot.rotation.x = THREE.MathUtils.damp(this.rightLegPivot.rotation.x, -targetLegX, 8, delta);

    this.leftArmPivot.rotation.x = THREE.MathUtils.damp(this.leftArmPivot.rotation.x, -targetLegX * 1.1, 8, delta);
    this.leftArmPivot.rotation.z = THREE.MathUtils.damp(this.leftArmPivot.rotation.z, Math.abs(targetLegX) * 0.1, 8, delta);

    this.rightArmPivot.rotation.x = THREE.MathUtils.damp(this.rightArmPivot.rotation.x, targetLegX * 1.1, 8, delta);
    this.rightArmPivot.rotation.z = THREE.MathUtils.damp(this.rightArmPivot.rotation.z, -Math.abs(targetLegX) * 0.1, 8, delta);

    // Subtle idle breathing sway (always active but slightly different during idle)
    const bobFreq = this.state === "walking" ? swingFreq * 2 : 2.5;
    const bobAmp = this.state === "walking" ? 0.004 : 0.002;
    const bobOffset = bobAmp * Math.sin(time * bobFreq);
    
    this.head.position.y = 0.42 + bobOffset;
    this.hair.position.y = 0.455 + bobOffset;
    
    if (this.state === "idle") {
      // Gentle breathing body sway during idle
      this.torso.position.y = 0.26 + 0.0015 * Math.sin(time * 2.5);
    } else {
      this.torso.position.y = 0.26;
    }
  }

  arriveAtTarget() {
    const targetPoint = getRoutePointWithLane(this.route, this.targetPointIndex, this.laneOffset, this.direction);
    this.position.set(targetPoint.x, targetPoint.y, targetPoint.z);
    this.group.position.copy(this.position);
    this.currentPointIndex = this.targetPointIndex;

    const lastIndex = this.route.points.length - 1;
    if (this.currentPointIndex === 0 || this.currentPointIndex === lastIndex) {
      this.direction *= -1;
      this.state = "idle";
      this.idleTimer = 0.15 + Math.random() * 0.45;
    }

    this.targetPointIndex = getNextRouteTargetIndex(this.currentPointIndex, this.direction, this.route);
  }

  getCurrentTargetPoint() {
    return getRoutePointWithLane(this.route, this.targetPointIndex, this.laneOffset, this.direction);
  }

  getSeparation(students) {
    const push = new THREE.Vector3();
    students.forEach((other) => {
      if (other === this) return;
      const dx = this.position.x - other.position.x;
      const dz = this.position.z - other.position.z;
      const distance = Math.hypot(dx, dz);
      if (distance <= 0.0001 || distance >= STUDENT_SEPARATION_DISTANCE) return;
      const strength = (STUDENT_SEPARATION_DISTANCE - distance) / STUDENT_SEPARATION_DISTANCE;
      push.x += (dx / distance) * strength * 0.22;
      push.z += (dz / distance) * strength * 0.22;
    });
    return push;
  }

  rotateToward(dx, dz, delta) {
    const targetAngle = Math.atan2(dx, dz);
    let angleDiff = targetAngle - this.group.rotation.y;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    this.group.rotation.y += angleDiff * Math.min(delta * 8, 1);
  }

  destroy() {
    this.scene.remove(this.group);
    
    // Dispose of materials and geometries
    this.group.traverse((node) => {
      if (node.isMesh) {
        node.geometry.dispose();
        if (Array.isArray(node.material)) {
          node.material.forEach(m => m.dispose());
        } else {
          node.material.dispose();
        }
      }
    });
  }
}

export class StudentManager {
  constructor(scene) {
    this.scene = scene;
    this.students = [];
    this.routes = [];
    this.routesReady = false;
    this.spawnRequested = false;
    this.setupPaths();
    this.routesPromise = this.loadSavedRoutes();
    
    // Debug visualization of waypoints & paths (only if url has ?debug=true or window.debugPaths is true)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("debug") === "true" || window.debugPaths) {
      this.debugGroup = new THREE.Group();
      this.scene.add(this.debugGroup);
      this.refreshDebugPaths();
    }
  }

  setupPaths() {
    const groundY = 0.08;

    this.waypoints = [
      { id: "B1", x: -12.5, y: groundY, z: 16.4, neighbors: ["B2"] },
      { id: "B2", x: -7.0, y: groundY, z: 16.4, neighbors: ["B1", "B3"] },
      { id: "B3", x: -1.5, y: groundY, z: 16.4, neighbors: ["B2", "B4"] },
      { id: "B4", x: 4.0, y: groundY, z: 15.8, neighbors: ["B3", "B5"] },
      { id: "B5", x: 8.5, y: groundY, z: 14.6, neighbors: ["B4", "B6"] },
      { id: "B6", x: 11.5, y: groundY, z: 12.8, neighbors: ["B5"] },

      { id: "L1", x: -13.2, y: groundY, z: 14.0, neighbors: ["L2"] },
      { id: "L2", x: -13.2, y: groundY, z: 10.8, neighbors: ["L1", "L3"] },
      { id: "L3", x: -12.8, y: groundY, z: 7.4, neighbors: ["L2", "L4"] },
      { id: "L4", x: -11.8, y: groundY, z: 4.8, neighbors: ["L3"] },

      { id: "C1", x: -9.4, y: groundY, z: 13.3, neighbors: ["C2", "C5"] },
      { id: "C2", x: -6.2, y: groundY, z: 13.2, neighbors: ["C1", "C3"] },
      { id: "C3", x: -3.0, y: groundY, z: 12.8, neighbors: ["C2", "C4"] },
      { id: "C4", x: -0.8, y: groundY, z: 11.0, neighbors: ["C3", "C8"] },
      { id: "C5", x: -9.2, y: groundY, z: 10.5, neighbors: ["C1", "C6"] },
      { id: "C6", x: -6.0, y: groundY, z: 10.0, neighbors: ["C5", "C7"] },
      { id: "C7", x: -3.0, y: groundY, z: 9.9, neighbors: ["C6", "C8"] },
      { id: "C8", x: -0.8, y: groundY, z: 11.0, neighbors: ["C4", "C7"] },

      { id: "MR1", x: 0.8, y: groundY, z: 9.0, neighbors: ["MR2"] },
      { id: "MR2", x: 4.0, y: groundY, z: 7.2, neighbors: ["MR1", "MR3"] },
      { id: "MR3", x: 7.4, y: groundY, z: 5.3, neighbors: ["MR2", "MR4"] },
      { id: "MR4", x: 10.8, y: groundY, z: 3.6, neighbors: ["MR3"] },

      { id: "ER1", x: 10.8, y: groundY, z: 11.8, neighbors: ["ER2"] },
      { id: "ER2", x: 13.0, y: groundY, z: 9.4, neighbors: ["ER1", "ER3"] },
      { id: "ER3", x: 14.6, y: groundY, z: 6.4, neighbors: ["ER2", "ER4"] },
      { id: "ER4", x: 14.8, y: groundY, z: 3.2, neighbors: ["ER3", "ER5"] },
      { id: "ER5", x: 13.4, y: groundY, z: 0.6, neighbors: ["ER4"] },

      { id: "RR1", x: 9.8, y: groundY, z: 0.8, neighbors: ["RR2"] },
      { id: "RR2", x: 12.0, y: groundY, z: -2.2, neighbors: ["RR1", "RR3"] },
      { id: "RR3", x: 13.7, y: groundY, z: -5.2, neighbors: ["RR2", "RR4"] },
      { id: "RR4", x: 14.6, y: groundY, z: -8.2, neighbors: ["RR3", "RR5"] },
      { id: "RR5", x: 14.8, y: groundY, z: -11.2, neighbors: ["RR4", "RR6"] },
      { id: "RR6", x: 13.6, y: groundY, z: -13.6, neighbors: ["RR5"] }
    ];
    this.fallbackRouteGroups = [
      ["B1", "B2", "B3", "B4", "B5", "B6"],
      ["L1", "L2", "L3", "L4"],
      ["C1", "C2", "C3", "C4", "C8", "C7", "C6", "C5"],
      ["MR1", "MR2", "MR3", "MR4"],
      ["ER1", "ER2", "ER3", "ER4", "ER5"],
      ["RR1", "RR2", "RR3", "RR4", "RR5", "RR6"]
    ];
  }

  async loadSavedRoutes() {
    try {
      const response = await fetch(STUDENT_ROUTES_URL, { cache: "no-store" });
      if (!response.ok) throw new Error(`Route HTTP ${response.status}`);
      const payload = await response.json();
      this.routes = buildStudentRoutes(payload);
    } catch (error) {
      console.warn("Falling back to built-in student routes.", error);
      this.routes = this.buildFallbackRoutes();
    }

    if (this.routes.length === 0) {
      this.routes = this.buildFallbackRoutes();
    }

    this.routesReady = true;
    this.refreshDebugPaths();
    if (this.spawnRequested) {
      this.spawnStudents();
    }
  }

  buildFallbackRoutes() {
    return this.fallbackRouteGroups
      .map((group, index) => ({
        id: `fallback-${index + 1}`,
        points: group
          .map((id) => this.waypoints.find((waypoint) => waypoint.id === id))
          .filter(Boolean)
          .map((waypoint) => ({ x: waypoint.x, y: waypoint.y, z: waypoint.z })),
      }))
      .filter((route) => route.points.length >= 2);
  }

  refreshDebugPaths() {
    if (!this.debugGroup) return;
    this.debugGroup.clear();

    const wpGeom = new THREE.SphereGeometry(0.15, 8, 8);
    const wpMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const lineMat = new THREE.LineBasicMaterial({ color: 0x00ff00 });
    const routes = this.routes.length > 0 ? this.routes : this.buildFallbackRoutes();

    routes.forEach((route) => {
      route.points.forEach((point, index) => {
        const sphere = new THREE.Mesh(wpGeom, wpMat);
        sphere.position.set(point.x, point.y + 0.15, point.z);
        this.debugGroup.add(sphere);

        const nextPoint = route.points[index + 1];
        if (!nextPoint) return;
        const points = [
          new THREE.Vector3(point.x, point.y + 0.15, point.z),
          new THREE.Vector3(nextPoint.x, nextPoint.y + 0.15, nextPoint.z)
        ];
        const lineGeom = new THREE.BufferGeometry().setFromPoints(points);
        this.debugGroup.add(new THREE.Line(lineGeom, lineMat));
      });
    });
  }

  spawnStudents() {
    this.spawnRequested = true;
    if (!this.routesReady) {
      return;
    }

    this.clearStudents();

    const skinTones = [0xffdbac, 0xe0ac69, 0xf1c27d];
    const hairColors = [0x5c4033, 0x111111, 0xe6c280, 0x3d2314];
    const pantsColors = [0x2e3d52, 0x333333, 0x111111, 0xc3a375, 0x005697];

    for (let i = 0; i < STUDENT_COUNT; i++) {
      const route = this.routes[i % this.routes.length];
      const startPointIndex = Math.floor(i / this.routes.length) % route.points.length;
      const direction = i % 2 === 0 ? 1 : -1;
      const laneOffset = STUDENT_LANE_OFFSETS[i % STUDENT_LANE_OFFSETS.length];
      
      const speed = 0.26 + Math.random() * 0.08;
      const shirtColor = 0xffffff;
      const hairColor = hairColors[i % hairColors.length];
      const pantsColor = pantsColors[i % pantsColors.length];
      const skinColor = skinTones[i % skinTones.length];

      const student = new StudentCharacter(
        this.scene,
        route,
        speed,
        shirtColor,
        hairColor,
        pantsColor,
        skinColor,
        i + 1,
        {
          routeIndex: i % this.routes.length,
          startPointIndex,
          direction,
          laneOffset,
        }
      );
      this.students.push(student);
    }
  }

  update(delta, time) {
    this.students.forEach(student => {
      student.update(delta, time, this.students);
    });
  }

  clearStudents() {
    this.students.forEach(student => student.destroy());
    this.students = [];
  }
}
