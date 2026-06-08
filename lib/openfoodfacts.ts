export async function fetchFoodProducts(query: string, limit = 6) {
  const res = await fetch(
    `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&json=1&page_size=${limit}&fields=product_name,image_url,nutriscore_grade,brands`,
    { next: { revalidate: 3600 } }
  );
  if (!res.ok) throw new Error('OpenFoodFacts API error');
  const data = await res.json();
  type OFFProduct = { product_name?: string; image_url?: string; nutriscore_grade?: string; brands?: string };
  return (data.products as OFFProduct[])
    .filter((p) => p.image_url && p.product_name)
    .map((p) => ({
      name: p.product_name as string,
      imageUrl: p.image_url as string,
      nutriScore: (p.nutriscore_grade || 'unknown') as string,
      brand: (p.brands || '') as string,
    }));
}
