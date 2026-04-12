// backend/routes/prometheus.js
'use strict';

const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const config = require('../config');
const { authenticate } = require('../middleware/authenticate');

const router = express.Router();

router.use(authenticate);

const prometheusProxy = createProxyMiddleware({
  target: config.prometheus_url,
  changeOrigin: true,
  pathRewrite: { '^/api/prometheus': '' },
  on: {
    error: (err, req, res) => {
      res.status(502).json({ error: 'Prometheus unreachable', detail: err.message });
    },
  },
});

router.use('/', prometheusProxy);

module.exports = router;
