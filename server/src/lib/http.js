// Small response/request helpers on top of Node's http module.
const fs = require('fs');
const path = require('path');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
};

function json(res, body, status = 200, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers });
  res.end(JSON.stringify(body));
}

function html(res, body, status = 200) {
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
}

function redirect(res, location, status = 302, headers = {}) {
  res.writeHead(status, { Location: location, 'Cache-Control': 'no-store', ...headers });
  res.end();
}

function notFound(res) {
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not found');
}

// Reads a JSON body (default limit 25 MB). Resolves to null when the body is not valid JSON.
function readJson(req, limit = 25e6) {
  return new Promise(resolve => {
    const chunks = [];
    let size = 0;
    req.on('data', c => {
      size += c.length;
      if (size > limit) { resolve(null); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch { resolve(null); }
    });
    req.on('error', () => resolve(null));
  });
}

// Reads a raw request body (file uploads). Resolves to a Buffer, or null when it is larger than `limit`.
function readRaw(req, limit) {
  return new Promise(resolve => {
    if (+req.headers['content-length'] > limit) { req.resume(); req.on('end', () => resolve(null)); req.on('error', () => resolve(null)); return; }
    const chunks = [];
    let size = 0, over = false;
    req.on('data', c => { size += c.length; if (size > limit) over = true; else chunks.push(c); });
    req.on('end', () => resolve(over ? null : Buffer.concat(chunks)));
    req.on('error', () => resolve(null));
  });
}

// Serves a file from `root`, refusing anything that would escape it.
function sendStatic(res, root, relPath, { cache = 'no-cache' } = {}) {
  const file = path.resolve(root, '.' + path.posix.normalize('/' + relPath));
  if (!file.startsWith(path.resolve(root) + path.sep)) return notFound(res);
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return notFound(res);
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Content-Length': st.size, 'Cache-Control': cache });
    fs.createReadStream(file).pipe(res);
  });
}

// The site address as the visitor sees it (also behind Vercel / Caddy, which pass the original host on).
const origin = req => `${String(req.headers['x-forwarded-proto'] || 'http').split(',')[0]}://${String(req.headers['x-forwarded-host'] || req.headers.host).split(',')[0]}`;

function sendFile(res, buf, name, type) {
  res.writeHead(200, { 'Content-Type': type, 'Content-Length': buf.length, 'Cache-Control': 'no-store',
    'Content-Disposition': `attachment; filename="${name.replace(/[^\w.-]+/g, '_')}"; filename*=UTF-8''${encodeURIComponent(name)}` });
  res.end(buf);
}

module.exports = { origin, sendFile, json, html, redirect, notFound, readJson, readRaw, sendStatic };
