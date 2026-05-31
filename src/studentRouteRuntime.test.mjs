import assert from "node:assert/strict";
import {
  buildStudentRoutes,
  getRoutePointWithLane,
  getNextRouteTargetIndex,
  shouldYieldToStudent,
} from "./studentRouteRuntime.js";

const payload = {
  routes: [
    [
      { x: 0, y: 0.1, z: 0 },
      { x: 0, y: 0.1, z: 10 },
      { x: 5, y: 0.1, z: 10 },
    ],
    [{ x: 1, y: 0.2, z: 1 }],
  ],
};

const routes = buildStudentRoutes(payload);
assert.equal(routes.length, 1);
assert.equal(routes[0].id, "route-1");
assert.equal(routes[0].points.length, 3);

assert.equal(getNextRouteTargetIndex(0, 1, routes[0]), 1);
assert.equal(getNextRouteTargetIndex(2, 1, routes[0]), 1);
assert.equal(getNextRouteTargetIndex(0, -1, routes[0]), 1);

const lanePoint = getRoutePointWithLane(routes[0], 0, 0.25, 1);
assert.equal(lanePoint.x, -0.25);
assert.equal(lanePoint.z, 0);

assert.equal(
  shouldYieldToStudent(
    { x: 0, z: 0 },
    { x: 0, z: 1 },
    { x: 0, z: 0.32 },
    0.5,
  ),
  true,
);
assert.equal(
  shouldYieldToStudent(
    { x: 0, z: 0 },
    { x: 0, z: 1 },
    { x: 0, z: -0.32 },
    0.5,
  ),
  false,
);
assert.equal(
  shouldYieldToStudent(
    { x: 0, z: 0 },
    { x: 0, z: 1 },
    { x: 0, z: 0.32 },
    0.5,
    2,
    1,
    { x: 0, z: -1 },
  ),
  true,
);
assert.equal(
  shouldYieldToStudent(
    { x: 0, z: 0.32 },
    { x: 0, z: -1 },
    { x: 0, z: 0 },
    0.5,
    1,
    2,
    { x: 0, z: 1 },
  ),
  false,
);

console.log("studentRouteRuntime tests passed");
