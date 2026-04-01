import { NextResponse } from 'next/server';
import { fetchFoodProducts } from '@/lib/openfoodfacts';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get('query') || 'chocolate';

  try {
    const products = await fetchFoodProducts(query, 10);
    const withScore = products.filter((p: { nutriScore: string }) => p.nutriScore && p.nutriScore !== 'unknown');
    if (withScore.length < 2) {
      return NextResponse.json({ error: 'Not enough data' }, { status: 404 });
    }
    const a = withScore[Math.floor(Math.random() * withScore.length)];
    let b = withScore[Math.floor(Math.random() * withScore.length)];
    while (b === a) b = withScore[Math.floor(Math.random() * withScore.length)];
    return NextResponse.json({ foods: [a, b] });
  } catch {
    return NextResponse.json({ error: 'API error' }, { status: 500 });
  }
}
