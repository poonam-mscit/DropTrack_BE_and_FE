/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Static export — produces a plain HTML/JS/CSS bundle in `out/` for S3.
  output: 'export',
  // S3 serves /about/index.html as /about, but the canonical Next.js export
  // produces /about.html. Trailing slash mode aligns the two (/about/ → /about/index.html).
  trailingSlash: true,
  // Disable next/image optimisation (needs a server). All images use plain <img>.
  images: { unoptimized: true },
};
export default nextConfig;
