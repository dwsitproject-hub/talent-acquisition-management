const crypto = require('crypto');
const { createRemoteJWKSet, jwtVerify, SignJWT } = require('jose');

const OIDC_STATE_COOKIE = 'oidc_state';
const OIDC_VERIFIER_COOKIE = 'oidc_code_verifier';
const OIDC_NONCE_COOKIE = 'oidc_nonce';
const HANDOFF_TYP = 'sso_handoff';
const HANDOFF_TTL_SECONDS = 60;

let discoveryCache = null;
let discoveryCachedAt = 0;
const DISCOVERY_TTL_MS = 10 * 60 * 1000;

let jwks;
let jwksUriCached;

function isOidcConfigured() {
  return Boolean(
    process.env.OIDC_DISCOVERY_URL &&
      process.env.OIDC_CLIENT_ID &&
      process.env.OIDC_REDIRECT_URI
  );
}

function getOidcConfig() {
  if (!isOidcConfigured()) {
    throw new Error('OIDC is not configured');
  }

  return {
    discoveryUrl: process.env.OIDC_DISCOVERY_URL.trim(),
    clientId: process.env.OIDC_CLIENT_ID.trim(),
    redirectUri: process.env.OIDC_REDIRECT_URI.trim(),
    scopes: (process.env.OIDC_SCOPES || 'openid email profile').trim(),
  };
}

function base64UrlEncode(buffer) {
  return Buffer.from(buffer)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function generateCodeVerifier() {
  return base64UrlEncode(crypto.randomBytes(32));
}

function generateCodeChallenge(verifier) {
  const hash = crypto.createHash('sha256').update(verifier).digest();
  return base64UrlEncode(hash);
}

function generateState() {
  return base64UrlEncode(crypto.randomBytes(24));
}

function generateNonce() {
  return base64UrlEncode(crypto.randomBytes(24));
}

async function loadDiscovery(force = false) {
  const { discoveryUrl } = getOidcConfig();
  const now = Date.now();

  if (!force && discoveryCache && now - discoveryCachedAt < DISCOVERY_TTL_MS) {
    return discoveryCache;
  }

  const response = await fetch(discoveryUrl, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`OIDC discovery failed: HTTP ${response.status}`);
  }

  const meta = await response.json();
  if (!meta.authorization_endpoint || !meta.token_endpoint || !meta.jwks_uri || !meta.issuer) {
    throw new Error('OIDC discovery document is missing required fields');
  }

  discoveryCache = meta;
  discoveryCachedAt = now;
  return meta;
}

function getJwks(jwksUri) {
  if (!jwks || jwksUriCached !== jwksUri) {
    jwks = createRemoteJWKSet(new URL(jwksUri));
    jwksUriCached = jwksUri;
  }
  return jwks;
}

function buildAuthorizeUrl({ state, nonce, codeChallenge }) {
  const { clientId, redirectUri, scopes } = getOidcConfig();

  return loadDiscovery().then((meta) => {
    const url = new URL(meta.authorization_endpoint);
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('scope', scopes);
    url.searchParams.set('code_challenge', codeChallenge);
    url.searchParams.set('code_challenge_method', 'S256');
    url.searchParams.set('state', state);
    url.searchParams.set('nonce', nonce);
    return url.toString();
  });
}

async function exchangeCodeForTokens({ code, codeVerifier }) {
  const { clientId, redirectUri } = getOidcConfig();
  const meta = await loadDiscovery();

  // Hub requires JSON body (not form-urlencoded).
  const response = await fetch(meta.token_endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      code_verifier: codeVerifier,
    }),
  });

  const text = await response.text();
  let payload;
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { error: 'invalid_json', raw: text.slice(0, 200) };
  }

  if (!response.ok) {
    const detail = payload.error || text.slice(0, 200) || `HTTP ${response.status}`;
    throw new Error(`OIDC token exchange failed: ${detail}`);
  }

  if (!payload.id_token) {
    throw new Error('OIDC token response missing id_token');
  }

  return { tokenResponse: payload, meta };
}

async function verifyIdToken(idToken, meta, expectedNonce) {
  const { clientId } = getOidcConfig();
  const keySet = getJwks(meta.jwks_uri);

  const { payload } = await jwtVerify(idToken, keySet, {
    issuer: meta.issuer,
    audience: clientId,
  });

  if (expectedNonce) {
    if (!payload.nonce || String(payload.nonce) !== expectedNonce) {
      throw new Error('Invalid OIDC nonce');
    }
  }

  return payload;
}

/**
 * Complete OIDC callback for both SP-initiated and IdP-initiated flows.
 * IdP-initiated: Hub passes code_verifier in the query string.
 */
async function completeOidcCallback({
  code,
  state,
  codeVerifierFromQuery,
  cookieState,
  cookieVerifier,
  cookieNonce,
}) {
  if (!code) {
    throw new Error('Missing authorization code');
  }

  let codeVerifier;
  let expectedNonce;

  if (codeVerifierFromQuery) {
    // IdP-initiated — no local state cookie to validate
    codeVerifier = codeVerifierFromQuery;
  } else {
    if (!cookieState || !state || cookieState !== state) {
      throw new Error('Invalid OIDC state');
    }
    if (!cookieVerifier) {
      throw new Error('Missing PKCE code verifier');
    }
    if (!cookieNonce) {
      throw new Error('Missing OIDC nonce');
    }
    codeVerifier = cookieVerifier;
    expectedNonce = cookieNonce;
  }

  const { tokenResponse, meta } = await exchangeCodeForTokens({
    code,
    codeVerifier,
  });

  const claims = await verifyIdToken(tokenResponse.id_token, meta, expectedNonce);
  const sub = claims.sub ? String(claims.sub) : '';
  const email = (claims.email || '').toString().trim().toLowerCase();

  if (!sub) {
    throw new Error('Invalid token payload (no subject)');
  }
  if (!email) {
    throw new Error('Invalid token payload (no email)');
  }

  return { sub, email, claims };
}

function getHandoffSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is required for SSO handoff');
  }
  return new TextEncoder().encode(secret);
}

async function createHandoffToken(userId) {
  return new SignJWT({ typ: HANDOFF_TYP, userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${HANDOFF_TTL_SECONDS}s`)
    .sign(getHandoffSecret());
}

async function verifyHandoffToken(token) {
  const { payload } = await jwtVerify(token, getHandoffSecret(), {
    algorithms: ['HS256'],
  });

  if (payload.typ !== HANDOFF_TYP || !payload.userId) {
    throw new Error('Invalid SSO handoff token');
  }

  return { userId: String(payload.userId) };
}

function oidcCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.COOKIE_SAME_SITE || 'lax',
    maxAge: 10 * 60 * 1000, // 10 minutes
    path: '/api/auth/oidc',
  };
}

function clearOidcCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.COOKIE_SAME_SITE || 'lax',
    path: '/api/auth/oidc',
  };
}

module.exports = {
  OIDC_STATE_COOKIE,
  OIDC_VERIFIER_COOKIE,
  OIDC_NONCE_COOKIE,
  isOidcConfigured,
  getOidcConfig,
  generateCodeVerifier,
  generateCodeChallenge,
  generateState,
  generateNonce,
  buildAuthorizeUrl,
  completeOidcCallback,
  createHandoffToken,
  verifyHandoffToken,
  oidcCookieOptions,
  clearOidcCookieOptions,
  // exported for tests / diagnostics
  loadDiscovery,
};
