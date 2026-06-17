const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 8080;
const WORKSPACE_DIR = __dirname;

const server = http.createServer((req, res) => {
  let urlPath = req.url.split('?')[0];

  // Static File Serving
  let filePath = path.join(WORKSPACE_DIR, urlPath === '/' ? 'index.html' : urlPath);
  const extname = String(path.extname(filePath)).toLowerCase();
  const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.json': 'application/json',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.aac': 'audio/aac',
  };

  const contentType = mimeTypes[extname] || 'application/octet-stream';

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if(error.code == 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end('404 Not Found');
      } else {
        res.writeHead(500);
        res.end('Server Error: '+error.code+'\n');
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, () => {
  console.log('\n==================================================');
  console.log('Rádio SomBR Player local server is running!');
  console.log(`Access the player at: http://localhost:${PORT}/`);
  console.log('==================================================\n');
});
