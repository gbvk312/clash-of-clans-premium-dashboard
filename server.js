const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

// Rate Limiting Configuration
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 30; // max 30 requests per window per IP
const rateLimitStore = new Map();

function checkRateLimit(ip) {
  const now = Date.now();
  if (!rateLimitStore.has(ip)) {
    rateLimitStore.set(ip, { count: 1, windowStart: now });
    return true;
  }
  const entry = rateLimitStore.get(ip);
  if (now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    entry.count = 1;
    entry.windowStart = now;
    return true;
  }
  entry.count++;
  return entry.count <= RATE_LIMIT_MAX_REQUESTS;
}

// Cleanup stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitStore) {
    if (now - entry.windowStart > RATE_LIMIT_WINDOW_MS * 2) {
      rateLimitStore.delete(ip);
    }
  }
}, 5 * 60 * 1000);

const PORT = 3000;

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml'
};

const server = http.createServer((req, res) => {
  // CORS Headers for all local dev requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Handle API proxying
  if (req.url.startsWith('/api/')) {
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    if (!checkRateLimit(clientIp)) {
      res.writeHead(429, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: 'Rate limit exceeded',
        message: `Maximum ${RATE_LIMIT_MAX_REQUESTS} API requests per minute. Please wait before trying again.`,
        retryAfter: Math.ceil(RATE_LIMIT_WINDOW_MS / 1000)
      }));
      return;
    }

    let apiPath = req.url.substring(4); // Remove "/api" prefix

    // Input sanitization: strip any characters that aren't alphanumeric, %, /, ?, =, &, #, +, -, _, .
    apiPath = apiPath.replace(/[^a-zA-Z0-9%\/?=&#\+\-_.]/g, '');

    // Allowlisted Clash of Clans API path patterns
    const ALLOWED_API_PATTERNS = [
      /^\/clans(\/|$|\?)/,
      /^\/players(\/|$|\?)/,
      /^\/locations(\/|$|\?)/,
      /^\/leagues(\/|$|\?)/,
      /^\/warleagues(\/|$|\?)/,
      /^\/goldpass(\/|$|\?)/,
      /^\/labels(\/|$|\?)/,
    ];

    const isAllowed = ALLOWED_API_PATTERNS.some(pattern => pattern.test(apiPath));
    if (!isAllowed) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: 'Invalid API path',
        message: 'The requested API path is not allowed. Permitted endpoints: /clans, /players, /locations, /leagues, /warleagues, /goldpass, /labels.'
      }));
      return;
    }

    const cocUrl = `https://api.clashofclans.com/v1${apiPath}`;
    
    const authHeader = req.headers['authorization'];
    
    const options = {
      method: req.method,
      headers: {
        'Accept': 'application/json'
      }
    };
    
    if (authHeader) {
      options.headers['Authorization'] = authHeader;
    }

    const proxyReq = https.request(cocUrl, options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, {
        'Content-Type': proxyRes.headers['content-type'] || 'application/json',
        'Access-Control-Allow-Origin': '*',
        'X-Proxy-Validated': 'true',
        'X-RateLimit-Limit': RATE_LIMIT_MAX_REQUESTS.toString(),
        'X-RateLimit-Remaining': Math.max(0, RATE_LIMIT_MAX_REQUESTS - (rateLimitStore.get(clientIp)?.count || 0)).toString(),
      });
      proxyRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
      console.error('Local Proxy Request Error:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Proxy request failed', details: err.message }));
    });

    req.pipe(proxyReq);
    return;
  }

  // Handle static file serving
  const urlPath = req.url.split('?')[0];
  let filePath = path.join(__dirname, urlPath === '/' ? 'index.html' : urlPath);
  
  // Guard against directory traversal
  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  const ext = path.extname(filePath);
  let contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end('<h1>404 File Not Found</h1>', 'utf-8');
      } else {
        res.writeHead(500);
        res.end(`Server Error: ${err.code}`);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🛡️ Clash Command Center Proxy Server Active!`);
  console.log(`👉 Open: http://localhost:${PORT}`);
  console.log(`======================================================\n`);
});
