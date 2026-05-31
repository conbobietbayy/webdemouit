import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const toolRoot = resolve(fileURLToPath(new URL(".", import.meta.url)));
const projectRoot = resolve(toolRoot, "../..");
const publicRoot = resolve(projectRoot, "public");
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

createServer((request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host}`);
  const requestedPath = url.pathname === "/" ? "tools/route-painter/index.html" : decodeURIComponent(url.pathname.slice(1));
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
    if (isPublicPath && existsSync(publicPath)) {
      filePath = publicPath;
    }
  }

  if (!existsSync(filePath)) {
    response.writeHead(404);
    response.end("Not found");
    return;
  }

  const type = mimeTypes.get(extname(filePath).toLowerCase()) || "application/octet-stream";
  response.writeHead(200, {
    "Content-Type": type,
    "Cache-Control": "no-store",
  });
  createReadStream(filePath).pipe(response);
}).listen(port, () => {
  console.log(`UIT Route Painter running at http://localhost:${port}`);
});
