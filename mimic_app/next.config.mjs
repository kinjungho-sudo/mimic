/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@pdf-lib/fontkit', 'pptxgenjs', '@resvg/resvg-js'],
  },
};

export default nextConfig;
