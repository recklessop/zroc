// backend/authentik.js
'use strict';

const axios = require('axios');
const QRCode = require('qrcode');
const config = require('./config');
const logger = require('./logger');

const api = axios.create({
  baseURL: `${config.authentik_url}/api/v3`,
  headers: {
    Authorization: `Bearer ${config.authentik_admin_token}`,
    'Content-Type': 'application/json',
  },
  timeout: 10_000,
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err.response?.status;
    const detail = err.response?.data?.detail || err.message;
    logger.error(`[Authentik API] ${err.config?.method?.toUpperCase()} ${err.config?.url} → ${status}: ${detail}`);
    return Promise.reject(err);
  }
);

async function listUsers({ search = '', page = 1, pageSize = 50 } = {}) {
  const params = { page, page_size: pageSize };
  if (search) params.search = search;

  const { data } = await api.get('/core/users/', { params });

  const totpDevices = await listAllTotpDevices();
  const totpByUser = new Map();
  for (const d of totpDevices) {
    totpByUser.set(d.user, true);
  }

  const users = data.results.map((u) => ({
    id:            u.pk,
    username:      u.username,
    name:          u.name,
    email:         u.email,
    isActive:      u.is_active,
    isSuperuser:   u.is_superuser,
    groups:        u.groups_obj?.map((g) => ({ id: g.pk, name: g.name })) ?? [],
    avatar:        u.avatar,
    lastLogin:     u.last_login,
    dateJoined:    u.date_joined,
    totpEnrolled:  totpByUser.has(u.pk),
    type:          u.type,
  }));

  return { users, count: data.count, page, pageSize };
}

async function getUser(userId) {
  const { data: u } = await api.get(`/core/users/${userId}/`);
  return {
    id:           u.pk,
    username:     u.username,
    name:         u.name,
    email:        u.email,
    isActive:     u.is_active,
    isSuperuser:  u.is_superuser,
    groups:       u.groups_obj?.map((g) => ({ id: g.pk, name: g.name })) ?? [],
    avatar:       u.avatar,
    lastLogin:    u.last_login,
    dateJoined:   u.date_joined,
    type:         u.type,
  };
}

async function createUser({ username, name, email, isActive = true, groups = [], password }) {
  const payload = {
    username, name, email, is_active: isActive, groups, type: 'internal',
  };
  const { data: u } = await api.post('/core/users/', payload);
  if (password) { await setPassword(u.pk, password); }
  return getUser(u.pk);
}

async function updateUser(userId, { name, email, isActive, groups }) {
  const payload = {};
  if (name     !== undefined) payload.name      = name;
  if (email    !== undefined) payload.email     = email;
  if (isActive !== undefined) payload.is_active = isActive;
  if (groups   !== undefined) payload.groups    = groups;
  await api.patch(`/core/users/${userId}/`, payload);
  return getUser(userId);
}

async function deleteUser(userId) {
  await api.delete(`/core/users/${userId}/`);
}

async function setPassword(userId, password) {
  await api.post(`/core/users/${userId}/set_password/`, { password });
}

async function listGroups({ search = '' } = {}) {
  const params = { page_size: 100 };
  if (search) params.search = search;
  const { data } = await api.get('/core/groups/', { params });
  return data.results.map((g) => ({
    id: g.pk, name: g.name, userCount: g.num_pk ?? 0,
  }));
}

async function listAllTotpDevices() {
  const { data } = await api.get('/authenticators/totp/', { params: { page_size: 1000 } });
  return data.results;
}

async function revokeTotpForUser(userId) {
  const { data } = await api.get('/authenticators/totp/', {
    params: { user: userId, page_size: 100 },
  });
  await Promise.all(data.results.map((d) => api.delete(`/authenticators/totp/${d.pk}/`)));
  return data.results.length;
}

async function generateTwoFactorSetupLink(userId) {
  await revokeTotpForUser(userId);
  const { data } = await api.post(`/core/users/${userId}/recovery/`);
  const setupUrl = data.link;
  const qrDataUrl = await QRCode.toDataURL(setupUrl, {
    width: 280, margin: 2,
    color: { dark: '#0ea5e9', light: '#0a0f1e' },
    errorCorrectionLevel: 'M',
  });
  return { setupUrl, qrDataUrl };
}

async function validateAdminToken() {
  try {
    await api.get('/core/users/me/');
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  listUsers, getUser, createUser, updateUser, deleteUser, setPassword,
  listGroups, revokeTotpForUser, generateTwoFactorSetupLink, validateAdminToken,
};
