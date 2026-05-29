/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@pdf-lib/fontkit', 'pptxgenjs'],
  },
};

export default nextConfig;
