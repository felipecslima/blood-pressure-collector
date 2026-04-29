const http = require("http");
const fs = require("fs");
const path = require("path");

const root = path.resolve(process.argv[2] || process.env.STATIC_ROOT || __dirname);
const port = Number(process.argv[3] || process.env.PORT || 4173);
const host = "127.0.0.1";

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

function resolveFile(requestPath) {
  const safePath = path.normalize(requestPath).replace(/^(\.\.[/\\])+/, "");
  const targetPath = safePath === "/" ? "/index.html" : safePath;
  return path.join(root, targetPath);
}

http
  .createServer((req, res) => {
    const filePath = resolveFile(req.url || "/");

    fs.readFile(filePath, (error, content) => {
      if (error) {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Arquivo nao encontrado.");
        return;
      }

      const extension = path.extname(filePath).toLowerCase();
      const contentType = mimeTypes[extension] || "application/octet-stream";
      res.writeHead(200, { "Content-Type": contentType });
      res.end(content);
    });
  })
  .listen(port, host, () => {
    console.log(`Servidor em http://${host}:${port} servindo ${root}`);
  });
