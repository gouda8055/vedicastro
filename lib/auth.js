// Password hashing + session tokens, built entirely on Node's built-in
// `crypto` module — no bcrypt/jsonwebtoken dependency required.
//
// Password hashing: scrypt with a random salt per user (scrypt is what
// Node's own docs recommend when you don't want an extra dependency).
// Session tokens: a minimal HMAC-signed token, same idea as a JWT
// (header.payload.signature, base64url-encoded) but hand-rolled so there's
// nothing extra to install.

const crypto = require('crypto');

const SCRYPT_KEYLEN = 64;

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, SCRYPT_KEYLEN).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = String(stored).split(':');
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, SCRYPT_KEYLEN);
  const expected = Buffer.from(hash, 'hex');
  if (candidate.length !== expected.length) return false;
  return crypto.timingSafeEqual(candidate, expected);
}

function base64url(input) {
  return Buffer.from(input).toString('base64url');
}

function signToken(payload, secret, expiresInSeconds = 60 * 60 * 24 * 7) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const body = { ...payload, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + expiresInSeconds };
  const headerPart = base64url(JSON.stringify(header));
  const bodyPart = base64url(JSON.stringify(body));
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${headerPart}.${bodyPart}`)
    .digest('base64url');
  return `${headerPart}.${bodyPart}.${signature}`;
}

function verifyToken(token, secret) {
  if (typeof token !== 'string' || token.split('.').length !== 3) return null;
  const [headerPart, bodyPart, signature] = token.split('.');
  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(`${headerPart}.${bodyPart}`)
    .digest('base64url');

  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null; // bad signature
  }

  let body;
  try {
    body = JSON.parse(Buffer.from(bodyPart, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (typeof body.exp === 'number' && Date.now() / 1000 > body.exp) {
    return null; // expired
  }
  return body;
}

module.exports = { hashPassword, verifyPassword, signToken, verifyToken };
