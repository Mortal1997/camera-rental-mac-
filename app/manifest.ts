import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'BANG BANG 租赁管理',
    short_name: 'BANG BANG',
    description: '相机租赁排期、订单、库存与运营工作台',
    start_url: '/admin/operations',
    display: 'standalone',
    background_color: '#f0f0f5',
    theme_color: '#1a1a1a',
    lang: 'zh-CN',
    icons: [
      {
        src: '/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  };
}
