import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'DropTrack Dropper',
    short_name: 'Dropper',
    description: 'DropTrack Dropper — GPS-verified leaflet distribution',
    start_url: '/dropper',
    scope: '/dropper',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0F1029',
    theme_color: '#0F1029',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
