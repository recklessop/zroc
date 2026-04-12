// backend/routes/auth.js — OIDC login / callback / logout
'use strict';

const express = require('express');
const { Issuer, generators } = require('openid-client');
const config  = require('../config');
const logger  = require('../logger');
const { authenticate } = require('../middleware/authenticate');

const router = express.Router();

let oidcClient = null;

async function getOidcClient() {
  if (oidcClient) return oidcClient;

  const issuerUrl = `${config.authentik_url}/application/o/${config.authentik_client_id}/`;
  logger.info(`[Auth] Discovering OIDC issuer at ${issuerUrl}`);

  const issuer = await Issuer.discover(issuerUrl);
  oidcClient = new issuer.Client({
    client_id:     config.authentik_client_id,
    client_secret: config.authentik_client_secret,
    redirect_uris: [`${config.public_url}/api/auth/callback`],
    response_types: ['code'],
  });

  logger.info('[Auth] OIDC client initialised');
  return oidcClient;
}

router.get('/login', async (req, res) => {
  try {
    const client = await getOidcClient();
    const state    = generators.state();
    const nonce    = generators.nonce();
    const verifier = generators.codeVerifier();
    const challenge = generators.codeChallenge(verifier);

    req.session.oidc = { state, nonce, verifier };

    const redirectTo = req.query.redirect || '/';
    req.session.postLoginRedirect = redirectTo;

    const authUrl = client.authorizationUrl({
      scope: 'openid profile email groups',
      state,
      nonce,
      code_challenge:        challenge,
      code_challenge_method: 'S256',
    });

    res.redirect(authUrl);
  } catch (err) {
    logger.error('[Auth] Login redirect failed:', err);
    res.status(502).json({ error: 'Identity provider unavailable' });
  }
});

router.get('/callback', async (req, res) => {
  try {
    const client = await getOidcClient();
    const { state, nonce, verifier } = req.session.oidc || {};

    if (!state) {
      return res.redirect('/?error=session_expired');
    }

    const params      = client.callbackParams(req);
    const tokenSet    = await client.callback(
      `${config.public_url}/api/auth/callback`,
      params,
      { state, nonce, code_verifier: verifier }
    );
    const userinfo    = await client.userinfo(tokenSet.access_token);

    const groups = userinfo.groups ?? [];
    const role = groups.includes(config.admin_group)
      ? 'admin'
      : groups.includes(config.viewer_group)
        ? 'viewer'
        : 'viewer';

    req.session.user = {
      id:           userinfo.sub,
      username:     userinfo.preferred_username,
      name:         userinfo.name,
      email:        userinfo.email,
      role,
      groups,
      accessToken:  tokenSet.access_token,
      refreshToken: tokenSet.refresh_token,
      expiresAt:    tokenSet.expires_at,
    };

    delete req.session.oidc;

    const redirect = req.session.postLoginRedirect || '/';
    delete req.session.postLoginRedirect;

    logger.info(`[Auth] User ${userinfo.preferred_username} (${role}) logged in`);
    res.redirect(redirect);
  } catch (err) {
    logger.error('[Auth] Callback failed:', err);
    res.redirect('/?error=auth_failed');
  }
});

router.post('/logout', authenticate, async (req, res) => {
  const username = req.user?.username;
  const idToken  = req.session.user?.accessToken;

  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    logger.info(`[Auth] User ${username} logged out`);

    const endSessionUrl = `${config.authentik_url}/application/o/${config.authentik_client_id}/end-session/`;
    const params = new URLSearchParams({ post_logout_redirect_uri: config.public_url });
    if (idToken) params.set('id_token_hint', idToken);
    res.json({ redirectUrl: `${endSessionUrl}?${params}` });
  });
});

router.get('/me', authenticate, (req, res) => {
  const { id, username, name, email, role, groups } = req.user;
  res.json({ id, username, name, email, role, groups });
});

router.get('/status', (req, res) => {
  if (req.session?.user) {
    const { id, username, name, email, role } = req.session.user;
    res.json({ authenticated: true, user: { id, username, name, email, role } });
  } else {
    res.status(401).json({ authenticated: false });
  }
});

module.exports = router;
