export const FENCE_DATA_URL = "/fence/campus-fence-boundary.json";

export async function loadFenceData(url = FENCE_DATA_URL) {
  const response = await fetch(`${url}?v=${Date.now()}`);
  if (!response.ok) {
    throw new Error(`Cannot load fence data: ${response.status}`);
  }

  const data = await response.json();
  return normalizeFenceData(data);
}

function normalizeFenceData(data) {
  const points = Array.isArray(data.points)
    ? data.points.map((point) => ({ x: Number(point.x), y: Number(point.y || 0), z: Number(point.z) }))
    : [];

  const segments = Array.isArray(data.segments)
    ? data.segments.map((segment) => ({
        from: Number(segment.from),
        to: Number(segment.to),
        type: normalizeType(segment.type),
        length: Number(segment.length || 0),
      }))
    : [];

  return {
    ...data,
    points,
    segments: segments.filter((segment) => isValidSegment(segment, points)),
  };
}

function isValidSegment(segment, points) {
  return (
    Number.isInteger(segment.from) &&
    Number.isInteger(segment.to) &&
    segment.from >= 0 &&
    segment.to >= 0 &&
    segment.from < points.length &&
    segment.to < points.length &&
    segment.from !== segment.to &&
    segment.length >= 0.2
  );
}

function normalizeType(type) {
  return ["fence", "gate", "sign", "gap"].includes(type) ? type : "fence";
}
