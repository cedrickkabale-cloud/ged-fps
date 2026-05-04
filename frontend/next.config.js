/** @type {import('next').NextConfig} */
const backendBase = (process.env.BACKEND_URL || 'http://localhost:5000').replace(/\/$/, '');
const uploadsBase = (process.env.BACKEND_UPLOADS_URL || backendBase).replace(/\/$/, '');

const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${backendBase}/api/:path*`,
      },
      {
        source: '/uploads/:path*',
        destination: `${uploadsBase}/uploads/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
