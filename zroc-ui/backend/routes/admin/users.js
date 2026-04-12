// backend/routes/admin/users.js
'use strict';

const express = require('express');
const { authenticate, requireAdmin } = require('../../middleware/authenticate');
const authentik = require('../../authentik');
const logger = require('../../logger');

const router = express.Router();

router.use(authenticate, requireAdmin);

router.get('/', async (req, res) => {
  try {
    const { search = '', page = '1', pageSize = '50' } = req.query;
    const result = await authentik.listUsers({
      search,
      page:     parseInt(page, 10),
      pageSize: parseInt(pageSize, 10),
    });
    res.json(result);
  } catch (err) {
    logger.error('[Users] List failed:', err.message);
    res.status(502).json({ error: 'Failed to list users', detail: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const user = await authentik.getUser(req.params.id);
    res.json(user);
  } catch (err) {
    const status = err.response?.status === 404 ? 404 : 502;
    res.status(status).json({ error: 'User not found', detail: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { username, name, email, isActive = true, groups = [], password } = req.body;
    if (!username || !name || !email) {
      return res.status(400).json({ error: 'username, name, and email are required' });
    }
    const user = await authentik.createUser({ username, name, email, isActive, groups, password });
    logger.info(`[Users] ${req.user.username} created user ${username}`);
    res.status(201).json(user);
  } catch (err) {
    const detail = err.response?.data || err.message;
    logger.error('[Users] Create failed:', detail);
    res.status(err.response?.status === 400 ? 400 : 502).json({ error: 'Failed to create user', detail });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const { name, email, isActive, groups } = req.body;
    const user = await authentik.updateUser(req.params.id, { name, email, isActive, groups });
    logger.info(`[Users] ${req.user.username} updated user ${user.username}`);
    res.json(user);
  } catch (err) {
    logger.error('[Users] Update failed:', err.message);
    res.status(502).json({ error: 'Failed to update user', detail: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const targetId = parseInt(req.params.id, 10);
    if (String(targetId) === String(req.user.id) || req.user.username === 'akadmin') {
      return res.status(400).json({ error: 'Cannot delete your own account or the akadmin account' });
    }
    await authentik.deleteUser(targetId);
    logger.info(`[Users] ${req.user.username} deleted user ${targetId}`);
    res.status(204).send();
  } catch (err) {
    logger.error('[Users] Delete failed:', err.message);
    res.status(502).json({ error: 'Failed to delete user', detail: err.message });
  }
});

router.post('/:id/set-password', async (req, res) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    await authentik.setPassword(req.params.id, password);
    logger.info(`[Users] ${req.user.username} reset password for user ${req.params.id}`);
    res.json({ success: true });
  } catch (err) {
    logger.error('[Users] Password reset failed:', err.message);
    res.status(502).json({ error: 'Failed to set password', detail: err.message });
  }
});

router.post('/:id/setup-2fa', async (req, res) => {
  try {
    const { setupUrl, qrDataUrl } = await authentik.generateTwoFactorSetupLink(req.params.id);
    logger.info(`[Users] ${req.user.username} generated 2FA setup link for user ${req.params.id}`);
    res.json({ setupUrl, qrDataUrl });
  } catch (err) {
    logger.error('[Users] 2FA setup failed:', err.message);
    res.status(502).json({ error: 'Failed to generate 2FA setup link', detail: err.message });
  }
});

router.get('/meta/groups', async (req, res) => {
  try {
    const groups = await authentik.listGroups();
    res.json(groups);
  } catch (err) {
    logger.error('[Users] Groups list failed:', err.message);
    res.status(502).json({ error: 'Failed to list groups', detail: err.message });
  }
});

module.exports = router;
