const {
  resolveCallbackSecrets,
  useSecureCookies,
} = require('../../src/services/oidcService');

describe('resolveCallbackSecrets', () => {
  test('uses Hub code_verifier for IdP-initiated callbacks', () => {
    const result = resolveCallbackSecrets({
      code: 'auth-code',
      state: 'hub-state',
      codeVerifierFromQuery: 'hub-verifier',
      cookieState: undefined,
      cookieVerifier: undefined,
      cookieNonce: undefined,
    });

    expect(result).toEqual({
      codeVerifier: 'hub-verifier',
      expectedNonce: undefined,
    });
  });

  test('uses cookies for SP-initiated callbacks', () => {
    const result = resolveCallbackSecrets({
      code: 'auth-code',
      state: 'local-state',
      cookieState: 'local-state',
      cookieVerifier: 'local-verifier',
      cookieNonce: 'local-nonce',
    });

    expect(result).toEqual({
      codeVerifier: 'local-verifier',
      expectedNonce: 'local-nonce',
    });
  });

  test('rejects SP-initiated callback without matching state cookie', () => {
    expect(() =>
      resolveCallbackSecrets({
        code: 'auth-code',
        state: 'hub-state',
        cookieState: undefined,
        cookieVerifier: undefined,
        cookieNonce: undefined,
      })
    ).toThrow('Invalid OIDC state');
  });

  test('rejects missing authorization code', () => {
    expect(() => resolveCallbackSecrets({})).toThrow('Missing authorization code');
  });
});

describe('useSecureCookies', () => {
  const keys = ['COOKIE_SECURE', 'FRONTEND_URL', 'OIDC_REDIRECT_URI', 'NODE_ENV'];
  const snapshot = {};

  beforeEach(() => {
    keys.forEach((key) => {
      snapshot[key] = process.env[key];
    });
  });

  afterEach(() => {
    keys.forEach((key) => {
      if (snapshot[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = snapshot[key];
      }
    });
  });

  test('follows explicit COOKIE_SECURE override', () => {
    process.env.COOKIE_SECURE = 'false';
    process.env.NODE_ENV = 'production';
    expect(useSecureCookies()).toBe(false);
  });

  test('is false when FRONTEND_URL is http', () => {
    delete process.env.COOKIE_SECURE;
    process.env.NODE_ENV = 'production';
    process.env.FRONTEND_URL = 'http://tas.example.com';
    process.env.OIDC_REDIRECT_URI = 'http://tas.example.com/api/auth/oidc/callback';
    expect(useSecureCookies()).toBe(false);
  });

  test('is true when FRONTEND_URL is https', () => {
    delete process.env.COOKIE_SECURE;
    process.env.FRONTEND_URL = 'https://tas.example.com';
    expect(useSecureCookies()).toBe(true);
  });
});
