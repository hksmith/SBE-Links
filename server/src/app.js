// Builds the HTTP request handler from the route modules.
const Router = require('./lib/router');
const { notFound } = require('./lib/http');

function createApp() {
  const router = new Router();
  require('./routes/admin')(router);
  require('./routes/api')(router);
  require('./routes/public')(router); // last: contains the catch-all "/:slug"

  return async (req, res) => {
    try {
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
