const http = require('http');
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

const monorepoRoot = path.resolve(__dirname, '..');
config.watchFolders = [path.join(monorepoRoot, 'marche-dore/assets')];

if (!config.resolver.assetExts.includes('wasm')) {
  config.resolver.assetExts.push('wasm');
}

const API_HOST = '127.0.0.1';
const API_PORT = Number(process.env.SUPERU_API_PORT || 8787);

function shouldProxy(url) {
  return (
    url.startsWith('/ops') ||
    url.startsWith('/comms') ||
    url.startsWith('/catalog') ||
    url.startsWith('/stores') ||
    url.startsWith('/health')
  );
}

function proxyToSuperU(req, res) {
  const headers = { ...req.headers, host: `${API_HOST}:${API_PORT}` };
  delete headers['connection'];
  const upstream = http.request(
    {
      hostname: API_HOST,
      port: API_PORT,
      path: req.url,
      method: req.method,
      headers,
    },
    (incoming) => {
      res.writeHead(incoming.statusCode || 502, incoming.headers);
      incoming.pipe(res);
    },
  );
  upstream.on('error', () => {
    res.statusCode = 502;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        error: `API SuperU injoignable sur ${API_HOST}:${API_PORT}. À la racine : npm run dev:api`,
      }),
    );
  });
  req.pipe(upstream);
}

const previous = config.server?.enhanceMiddleware;
config.server = {
  ...config.server,
  enhanceMiddleware: (middleware, metroServer) => {
    const next = previous ? previous(middleware, metroServer) : middleware;
    return (req, res, nxt) => {
      if (req.url && shouldProxy(req.url.split('?')[0] || '')) {
        proxyToSuperU(req, res);
        return;
      }
      return next(req, res, nxt);
    };
  },
};

module.exports = config;
