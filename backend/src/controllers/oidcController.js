const authService = require('../services/authService');
const oidcService = require('../services/oidcService');
const { asyncHandler } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

function requireOidcConfigured(req, res) {
  if (!oidcService.isOidcConfigured()) {
    res.status(404).json({
      success: false,
      message: 'Not found',
    });
    return false;
  }
  return true;
}

function frontendLoginErrorRedirect(message) {
  const base = (process.env.FRONTEND_URL || 'http://localhost:4001').replace(/\/+$/, '');
  const url = new URL(`${base}/login`);
  url.searchParams.set('ssoError', message);
  return url.toString();
}

function setRefreshCookie(res, refreshToken) {
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.COOKIE_SAME_SITE || 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

/**
 * Start OIDC login (SP-initiated)
 * GET /api/auth/oidc/login
 */
exports.login = asyncHandler(async (req, res) => {
  if (!requireOidcConfigured(req, res)) return;

  const state = oidcService.generateState();
  const nonce = oidcService.generateNonce();
  const codeVerifier = oidcService.generateCodeVerifier();
  const codeChallenge = oidcService.generateCodeChallenge(codeVerifier);

  const authorizeUrl = await oidcService.buildAuthorizeUrl({
    state,
    nonce,
    codeChallenge,
  });

  const cookieOpts = oidcService.oidcCookieOptions();
  res.cookie(oidcService.OIDC_STATE_COOKIE, state, cookieOpts);
  res.cookie(oidcService.OIDC_VERIFIER_COOKIE, codeVerifier, cookieOpts);
  res.cookie(oidcService.OIDC_NONCE_COOKIE, nonce, cookieOpts);

  return res.redirect(302, authorizeUrl);
});

/**
 * OIDC callback (SP-initiated and IdP-initiated)
 * GET /api/auth/oidc/callback
 */
exports.callback = asyncHandler(async (req, res) => {
  if (!requireOidcConfigured(req, res)) return;

  const clearOpts = oidcService.clearOidcCookieOptions();
  res.clearCookie(oidcService.OIDC_STATE_COOKIE, clearOpts);
  res.clearCookie(oidcService.OIDC_VERIFIER_COOKIE, clearOpts);
  res.clearCookie(oidcService.OIDC_NONCE_COOKIE, clearOpts);

  const {
    code,
    state,
    code_verifier: codeVerifierFromQuery,
    error,
    error_description: errorDescription,
  } = req.query;

  if (error) {
    logger.warn(`OIDC callback error from Hub: ${error}`);
    return res.redirect(
      303,
      frontendLoginErrorRedirect(errorDescription || error || 'SSO login failed')
    );
  }

  try {
    const claims = await oidcService.completeOidcCallback({
      code,
      state,
      codeVerifierFromQuery,
      cookieState: req.cookies[oidcService.OIDC_STATE_COOKIE],
      cookieVerifier: req.cookies[oidcService.OIDC_VERIFIER_COOKIE],
      cookieNonce: req.cookies[oidcService.OIDC_NONCE_COOKIE],
    });

    const user = await authService.resolveOidcUser(claims);
    const handoff = await oidcService.createHandoffToken(user.id);

    const frontendBase = (process.env.FRONTEND_URL || 'http://localhost:4001').replace(/\/+$/, '');
    const redirectUrl = new URL(`${frontendBase}/login/sso`);
    redirectUrl.searchParams.set('handoff', handoff);

    return res.redirect(303, redirectUrl.toString());
  } catch (err) {
    logger.warn(`OIDC callback failed: ${err.name || 'Error'}: ${err.message}`);
    return res.redirect(
      303,
      frontendLoginErrorRedirect(err.message || 'SSO login failed')
    );
  }
});

/**
 * Exchange short-lived handoff for app JWTs
 * POST /api/auth/oidc/complete
 */
exports.complete = asyncHandler(async (req, res) => {
  if (!requireOidcConfigured(req, res)) return;

  const handoff = req.body?.handoff;
  if (!handoff || typeof handoff !== 'string') {
    return res.status(400).json({
      success: false,
      message: 'handoff token is required',
    });
  }

  const { userId } = await oidcService.verifyHandoffToken(handoff);

  const metadata = {
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  };

  const result = await authService.completeSsoHandoff(userId, metadata);
  setRefreshCookie(res, result.refreshToken);

  res.json({
    success: true,
    message: 'Login successful',
    data: {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      user: result.user,
    },
  });
});
