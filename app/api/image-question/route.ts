import { NextResponse } from 'next/server';
import { fetchUnsplashImage } from '@/lib/unsplash';

const AI_IMAGES = [
  '/ai/img001.jpg', '/ai/img002.jpg', '/ai/img003.jpg',
  '/ai/img004.jpg', '/ai/img005.jpg',
];

const QUERIES = ['nature landscape', 'portrait', 'architecture', 'food', 'animals'];

export async function GET() {
  const query = QUERIES[Math.floor(Math.random() * QUERIES.length)];
  const aiImg = AI_IMAGES[Math.floor(Math.random() * AI_IMAGES.length)];
  const isRealA = Math.random() > 0.5;

  try {
    const real = await fetchUnsplashImage(query);
    const choices = isRealA
      ? [
          { url: real.url, isReal: true, label: 'A', credit: real.photographer },
          { url: aiImg, isReal: false, label: 'B' },
        ]
      : [
          { url: aiImg, isReal: false, label: 'A' },
          { url: real.url, isReal: true, label: 'B', credit: real.photographer },
        ];
    return NextResponse.json({ choices });
  } catch {
    const choices = isRealA
      ? [
          { url: `https://picsum.photos/seed/${Date.now()}/400`, isReal: true, label: 'A', credit: 'Sample' },
          { url: aiImg, isReal: false, label: 'B' },
        ]
      : [
          { url: aiImg, isReal: false, label: 'A' },
          { url: `https://picsum.photos/seed/${Date.now()}/400`, isReal: true, label: 'B', credit: 'Sample' },
        ];
    return NextResponse.json({ choices });
  }
}
