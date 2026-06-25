/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Transpile workspace packages.
  transpilePackages: ['@droptrack/db'],
  // Allow LAN dev-server requests (so coworkers on the same Wi-Fi can hit
  // http://<your-mac-IP>:3002). Covers the common 192.168.x.x and 10.x.x.x
  // home/office ranges. Dev-only — has no effect on production builds.
  allowedDevOrigins: ['192.168.*.*', '10.*.*.*', '172.16.*.*'],
  // Proxy /api/* to the NestJS API in dev.
  async rewrites() {
    return [
      { source: '/api/:path*', destination: 'http://localhost:3001/api/:path*' },
    ];
  },
};
export default nextConfig;
