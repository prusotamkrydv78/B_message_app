export const config = {
  env: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 4000,
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  },
  db: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/messaging_app',
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'dev_access_secret',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev_refresh_secret',
    accessExpiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '30d',
  },
};
