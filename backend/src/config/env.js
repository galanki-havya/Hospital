import dotenv from 'dotenv';

dotenv.config();

function required(name, fallback) {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    // eslint-disable-next-line no-console
    console.error(`[config] Missing required env var: ${name}`);
    process.exit(1);
  }
  return value;
}

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '5000', 10),

  DATABASE_URL: required('DATABASE_URL'),

  JWT_ACCESS_SECRET: required('JWT_ACCESS_SECRET', 'dev-access-secret-change-me'),
  JWT_REFRESH_SECRET: required('JWT_REFRESH_SECRET', 'dev-refresh-secret-change-me'),
  JWT_ACCESS_EXPIRES_IN: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '7d',

  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:5173',

  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
  RATE_LIMIT_MAX: parseInt(process.env.RATE_LIMIT_MAX || '300', 10),

  BCRYPT_SALT_ROUNDS: parseInt(process.env.BCRYPT_SALT_ROUNDS || '10', 10),

  // Hospitals are now provisioned by a SuperAdmin via /api/v1/platform/hospitals.
  // Public self-serve signup (POST /api/v1/auth/register) is off by default;
  // flip this on only if you deliberately want open sign-up alongside it.
  ALLOW_SELF_SERVE_TENANT_SIGNUP: (process.env.ALLOW_SELF_SERVE_TENANT_SIGNUP || 'false') === 'true',

  // Bootstrap credentials for the very first Developer account, consumed
  // only by `npm run seed:platform` — never exposed over HTTP.
  BOOTSTRAP_DEVELOPER_EMAIL: process.env.BOOTSTRAP_DEVELOPER_EMAIL,
  BOOTSTRAP_DEVELOPER_PASSWORD: process.env.BOOTSTRAP_DEVELOPER_PASSWORD,
};

export const isProd = env.NODE_ENV === 'production';
