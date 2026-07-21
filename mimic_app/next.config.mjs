/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@pdf-lib/fontkit', 'pptxgenjs', '@resvg/resvg-js'],
  },
  async headers() {
    return [
      {
        source: '/downloads/ParroDesktopSetup.exe',
        headers: [
          { key: 'Content-Type', value: 'application/vnd.microsoft.portable-executable' },
          { key: 'Content-Disposition', value: 'attachment; filename="ParroDesktopSetup.exe"' },
          { key: 'Cache-Control', value: 'private, no-store' },
        ],
      },
    ];
  },
};

export default nextConfig;
