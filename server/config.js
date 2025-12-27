export default {
  db: {
    host: process.env.DB_HOST || '175.24.139.148',
    port: parseInt(process.env.DB_PORT) || 8386,
    database: process.env.DB_NAME || 'strategic',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || ''
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'sism-jwt-secret-key-2025',
    expiresIn: '24h'
  },
  server: {
    port: parseInt(process.env.SERVER_PORT) || 8080
  }
};
