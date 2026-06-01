import { createReadStream, existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const toolRoot = resolve(fileURLToPath(new URL(".", import.meta.url)));
const projectRoot = resolve(toolRoot, "../..");
const publicRoot = resolve(projectRoot, "public");
const fenceRoot = resolve(publicRoot, "fence");
const port = Number(process.env.PORT || 4174);

const mimeTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".glb", "model/gltf-binary"],
  [".gltf", "model/gltf+json"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webp", "image/webp"],
  [".svg", "image/svg+xml"],
]);

createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host}`);

  if (request.method === "POST" && url.pathname === "/api/save-fence") {
    await saveFenceJson(request, response);
    return;
  }

  serveStatic(url.pathname, response);
}).listen(port, () => {
  console.log(`UIT Fence Picker running at http://localhost:${port}`);
});

function serveStatic(pathname, response) {
  const requestedPath = pathname === "/" ? "tools/fence/index.html" : decodeURIComponent(pathname.slice(1));
  const safePath = normalize(requestedPath).replace(/^(\.\.[/\\])+/, "");
  let filePath = resolve(join(projectRoot, safePath));

  if (filePath !== projectRoot && !filePath.startsWith(`${projectRoot}${sep}`)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  if (existsSync(filePath) && statSync(filePath).isDirectory()) {
    filePath = join(filePath, "index.html");
  }

  if (!existsSync(filePath)) {
    const publicPath = resolve(join(publicRoot, safePath));
    const isPublicPath = publicPath === publicRoot || publicPath.startsWith(`${publicRoot}${sep}`);
    if (isPublicPath && existsSync(publicPath)) filePath = publicPath;
  }

  if (!existsSync(filePath)) {
    response.writeHead(404);
    response.end("Not found");
    return;
  }

  response.writeHead(200, {
    "Content-Type": mimeTypes.get(extname(filePath).toLowerCase()) || "application/octet-stream",
    "Cache-Control": "no-store",
  });
  createReadStream(filePath).pipe(response);
}

async function saveFenceJson(request, response) {
  try {
    const body = await readRequestBody(request);
    const data = JSON.parse(body);
    const fileName = sanitizeFileName(data.fileName);
    const filePath = resolve(fenceRoot, fileName);

    if (!filePath.startsWith(`${fenceRoot}${sep}`)) {
      response.writeHead(400);
      response.end("Invalid file name");
      return;
    }

    mkdirSync(fenceRoot, { recursive: true });
    writeFileSync(filePath, `${JSON.stringify(data.payload, null, 2)}\n`, "utf8");
    response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ ok: true, path: `/fence/${fileName}` }));
  } catch (error) {
    console.error(error);
    response.writeHead(500);
    response.end("Cannot save fence JSON");
  }
}

function readRequestBody(request) {
  return new Promise((resolveBody, rejectBody) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 2_000_000) request.destroy();
    });
    request.on("end", () => resolveBody(body));
    request.on("error", rejectBody);
  });
}

function sanitizeFileName(value) {
  const fallback = "campus-fence-boundary.json";
  const clean = String(value || fallback).replace(/[\\/:*?"<>|]/g, "-").trim();
  return clean.endsWith(".json") ? clean : `${clean}.json`;
}
