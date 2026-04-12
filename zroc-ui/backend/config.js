// backend/config.js  — central configuration with validation
'use strict';

function require_env(name) {
  const val = process.env[name];
  if (!val) throw new Error(`Required environment variable ${name} is not set`);
  return val;
}

function optional_env(name, fallback = '') {
  return process.env[name] || fallback;
}

const config = {
  port: parseInt(optional_env('PORT', '3001'), 10),
  node_env: optional_env('NODE_ENV', 'production'),
  is_dev: optional_env('NODE_ENV', 'production') === 'development',
  session_secret: optional_env('SESSION_SECRET', 'CHANGE_ME_IN_PRODUCTION_' + Math.random()),
  session_max_age_ms: parseInt(optional_env('SESSION_MAX_AGE_HOURS', '24'), 10) * 60 * 60 * 1000,
  prometheus_url: optional_env('PROMETHEUS_URL', 'http://prometheus:9090'),
  authentik_url: optional_env('AUTHENTIK_URL', 'http://authentik-server:9000'),
  authentik_client_id: optional_env('AUTHENTIK_CLIENT_ID', 'zroc-dashboard'),
  authentik_client_secret: optional_env('AUTHENTIK_CLIENT_SECRET', ''),
  authentik_admin_token: optional_env('AUTHENTIK_ADMIN_TOKEN', ''),
  public_url: optional_env('PUBLIC_URL', 'https://localhost:8443'),
  admin_group: optional_env('AUTHENTIK_ADMIN_GROUP', 'zroc-admins'),
  viewer_group: optional_env('AUTHENTIK_VIEWER_GROUP', 'zroc-viewers'),
  redis_url: optional_env('REDIS_URL', ''),
};

if (!config.authentik_client_secret) {
  console.warn('[CONFIG] AUTHENTIK_CLIENT_SECRET not set — auth will fail until configured');
}
if (!config.authentik_admin_token) {
  console.warn('[CONFIG] AUTHENTIK_ADMIN_TOKEN not set — user management API will be unavailable');
}
if (config.session_secret.startsWith('CHANGE_ME')) {
  console.warn('[CONFIG] SESSION_SECRET not set — using random value, sessions will not survive restart');
}

module.exports = config;
