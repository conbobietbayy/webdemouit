export const STUDENT_ROUTES_URL = "./route_students/student-routes.json";

export function buildStudentRoutes(payload) {
  const routes = Array.isArray(payload) ? payload : payload?.routes;
  if (!Array.isArray(routes)) {
    return [];
  }

  return routes
    .map((route, routeIndex) => {
      const points = Array.isArray(route)
        ? route
            .map((point) => ({
              x: roundCoord(Number(point.x)),
              y: roundCoord(Number(point.y)),
              z: roundCoord(Number(point.z)),
            }))
            .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y) && Number.isFinite(point.z))
        : [];

      return {
        id: `route-${routeIndex + 1}`,
        points,
      };
    })
    .filter((route) => route.points.length >= 2);
}

export function getNextRouteTargetIndex(currentIndex, direction, route) {
  const lastIndex = route.points.length - 1;
  if (currentIndex <= 0 && direction < 0) {
    return 1;
  }
  if (currentIndex >= lastIndex && direction > 0) {
    return lastIndex - 1;
  }
  return currentIndex + direction;
}

export function getRouteDirectionAt(route, index, direction) {
  const point = route.points[index];
  const nextIndex = getNextRouteTargetIndex(index, direction, route);
  const nextPoint = route.points[nextIndex] || point;
  const dx = nextPoint.x - point.x;
  const dz = nextPoint.z - point.z;
  const length = Math.hypot(dx, dz) || 1;
  return { x: dx / length, z: dz / length };
}

export function getRoutePointWithLane(route, index, laneOffset = 0, direction = 1) {
  const point = route.points[index];
  const routeDirection = getRouteDirectionAt(route, index, direction);
  return {
    x: roundCoord(point.x - routeDirection.z * laneOffset),
    y: point.y,
    z: roundCoord(point.z + routeDirection.x * laneOffset),
  };
}

export function shouldYieldToStudent(
  position,
  target,
  otherPosition,
  minDistance,
  selfId = 0,
  otherId = 0,
  otherTarget = null,
) {
  const moveX = target.x - position.x;
  const moveZ = target.z - position.z;
  const moveLength = Math.hypot(moveX, moveZ);
  if (moveLength < 0.0001) {
    return false;
  }

  const toOtherX = otherPosition.x - position.x;
  const toOtherZ = otherPosition.z - position.z;
  const distance = Math.hypot(toOtherX, toOtherZ);
  if (distance > minDistance) {
    return false;
  }

  const aheadDot = (moveX / moveLength) * toOtherX + (moveZ / moveLength) * toOtherZ;
  if (aheadDot <= 0) {
    return false;
  }

  if (otherTarget && selfId && otherId) {
    const otherMoveX = otherTarget.x - otherPosition.x;
    const otherMoveZ = otherTarget.z - otherPosition.z;
    const otherMoveLength = Math.hypot(otherMoveX, otherMoveZ);
    if (otherMoveLength > 0.0001) {
      const otherToSelfX = position.x - otherPosition.x;
      const otherToSelfZ = position.z - otherPosition.z;
      const otherAheadDot =
        (otherMoveX / otherMoveLength) * otherToSelfX +
        (otherMoveZ / otherMoveLength) * otherToSelfZ;
      const bothFacing = otherAheadDot > 0;
      if (bothFacing) {
        return selfId > otherId;
      }
    }
  }

  return true;
}

function roundCoord(value) {
  return Math.round(value * 1000) / 1000;
}
