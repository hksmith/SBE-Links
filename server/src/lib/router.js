// Minimal router: router.get('/api/accounts/:id', handler). Handlers receive (req, res, ctx)
// where ctx = { params, url }. Patterns ending in "/*" also match deeper paths (ctx.params.rest).
function compile(pattern) {
  const parts = pattern.split('/').filter(Boolean);
  return pathname => {
    const segs = pathname.split('/').filter(Boolean).map(s => { try { return decodeURIComponent(s); } catch { return s; } });
    const params = {};
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      if (p === '*') { params.rest = segs.slice(i).join('/'); return segs.length > i ? params : null; }
      if (i >= segs.length) return null;
      if (p.startsWith(':')) params[p.slice(1)] = segs[i];
      else if (p !== segs[i]) return null;
    }
    return segs.length === parts.length ? params : null;
  };
}

class Router {
  constructor() { this.routes = []; }
  add(method, pattern, handler) { this.routes.push({ method, match: compile(pattern), handler }); return this; }
  get(p, h) { return this.add('GET', p, h); }
  post(p, h) { return this.add('POST', p, h); }
  put(p, h) { return this.add('PUT', p, h); }
  delete(p, h) { return this.add('DELETE', p, h); }
  all(p, h) { return this.add('*', p, h); }

  // Returns true if a route handled the request.
  async handle(req, res, url) {
    for (const r of this.routes) {
      if (r.method !== '*' && r.method !== req.method && !(r.method === 'GET' && req.method === 'HEAD')) continue;
      const params = r.match(url.pathname);
      if (!params) continue;
      const result = await r.handler(req, res, { params, url });
      if (result !== false) return true; // a handler may return false to pass to the next route
    }
    return false;
  }
}

module.exports = Router;
