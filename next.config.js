/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
       // Allow images served locally during development (e.g., from public folder)
       {
         protocol: 'http',
         hostname: 'localhost',
         // Add the port if your dev server uses a specific one (e.g., '3000', '9002')
         port: '9002', // Example: Adjust if needed
         pathname: '/**',
       },
       // Allow images from the ComfyUI server on the local network during development
       {
         protocol: 'http',
         hostname: '192.168.50.144', // Allow specific local network IP
         port: '8188', // ComfyUI port
         pathname: '/view/**', // Allow images from the /view endpoint
       },
       // Allow images from Google Cloud Storage
       {
         protocol: 'https',
         hostname: 'storage.googleapis.com',
         port: '',
         pathname: '/**',
       },
    ],
    // Allow serving local files via `next/image`
    // Note: This is generally for development. For production, use a dedicated image host or CDN.
    // If you absolutely need to serve local files in production this way, be mindful of performance.
    // dangerouslyAllowSVG: true, // If you have SVGs
    // contentDispositionType: 'attachment',
    // contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
};

module.exports = nextConfig;
