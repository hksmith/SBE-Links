// Small response/request helpers on top of Node's http module.
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

module.exports = { json, html, redirect, notFound, readJson };
