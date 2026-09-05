const fs = require('fs');
const os = require('os');
const path = require('path');

function preferLanIp() {
  const preferred = [];
  const other = [];
  for (const nets of Object.values(os.networkInterfaces())) {
    for (const net of nets || []) {
      const v4 = net.family === 'IPv4' || net.family === 4;
      if (!v4 || net.internal) continue;
      const ip = net.address;
      if (ip.startsWith('198.18.')) continue; // VPN / WARP
      if (ip.startsWith('192.168.') || ip.startsWith('10.') || /^172\.(1[6-9]|2\d|3[01])\./.test(ip)) {
        preferred.push(ip);
      } else {
        other.push(ip);
      }
    }
  }
  return preferred[0] || other[0] || null;
}

function loadAppJson() {
  return JSON.parse(fs.readFileSync(path.join(__dirname, 'app.json'), 'utf8'));
}

/** @param {{ config?: Record<string, unknown> }} ctx */
module.exports = ({ config } = {}) => {
  const raw = loadAppJson();
  const expo = raw.expo || raw;
  const lan = preferLanIp();
  const fromEnv = (process.env.EXPO_PUBLIC_API_URL || '').trim().replace(/\/$/, '');
  const apiUrl =
    fromEnv ||
    (lan ? `http://${lan}:8787` : 'http://127.0.0.1:8787');

  if (!process.env.EXPO_PUBLIC_API_URL) {
    process.env.EXPO_PUBLIC_API_URL = apiUrl;
  }

  return {
    ...expo,
    ...config,
    extra: {
      ...(expo.extra || {}),
      ...(config?.extra || {}),
      apiUrl,
      lanHost: lan,
    },
  };
};
