// Builds the HTTP request handler from the route modules.
const Router = require('./lib/router');
const { notFound } = require('./lib/http');
const { guard } = require('./lib/cors');

function createApp() {
  const router = new Router();
  require('./routes/session')(router);
  require('./routes/api')(router);
  require('./routes/public')(router); // last: contains the catch-all "/:slug"

  return async (req, res) => {
    try {
      if (guard(req, res)) return;
      const url = new URL(req.url, 'http://localhost');
      if (!(await router.handle(req, res, url))) notFound(res);
    } catch (e) {
      console.error(e);
      if (!res.headersSent) { res.writeHead(500, { 'Content-Type': 'text/plain' }); res.end('Server error'); }
      else res.end();
    }
  };
}

module.exports = { createApp };
