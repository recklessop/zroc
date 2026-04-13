// backend/server.js — zROC UI backend entry point
'use strict';

const path    = require('path');
const express = require('express');
const session = require('express-session');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');

const config  = require('./config');
const logger  = require('./logger');

const authRoutes      = require('./routes/auth');
const prometheusRoute = require('./routes/prometheus');
const adminUserRoutes = require('./routes/admin/users');

const app = express();

app.set('trust proxy', 1);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

const sessionMiddleware = session({
  secret:            config.session_secret,
  resave:            false,
  saveUninitialized: false,
  cookie: {
    secure:   !config.is_dev,
    httpOnly: true,
    sameSite: 'lax',
    maxAge:   config.session_max_age_ms,
  },
});
app.use(sessionMiddleware);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});
app.use('/api/auth', authLimiter);

app.use('/api/auth',          authRoutes);
app.use('/api/prometheus',    prometheusRoute);
app.use('/api/admin/users',   adminUserRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', ts: new Date().toISOString() });
});

const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath));
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.sendFile(path.join(distPath, 'index.html'));
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(config.port, () => {
  logger.info(`[Server] zROC UI backend listening on port ${config.port}`);
  logger.info(`[Server] Environment: ${config.node_env}`);
  logger.info(`[Server] Prometheus: ${config.prometheus_url}`);
  logger.info(`[Server] Authentik:  ${config.authentik_url}`);
});
