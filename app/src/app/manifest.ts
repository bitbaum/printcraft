import type { MetadataRoute } from 'next';

/**
 * The web app manifest. Without it Android and desktop browsers never offer
 * "Install app", so the site could only be pinned as a bookmark. The PNGs in
 * public/app-icons/ are rasterised from src/app/icon.svg (192, 512, and a maskable 512
 * with the icon inside the 80% safe zone); regenerate them when it changes.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'PrintCraft — Scene Composer for Physical Art',
    short_name: 'PrintCraft',
    description:
      'Turn separate photos of real people into one unified artwork — printed on surfaces that matter.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#0a0a0a',
    theme_color: '#0a0a0a',
    icons: [
      { src: '/app-icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/app-icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      {
        src: '/app-icons/maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
