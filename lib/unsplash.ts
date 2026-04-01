export async function fetchUnsplashImage(query: string) {
  const res = await fetch(
    `https://api.unsplash.com/photos/random?query=${encodeURIComponent(query)}&orientation=squarish`,
    {
      headers: {
        Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}`,
      },
      next: { revalidate: 60 },
    }
  );
  if (!res.ok) throw new Error('Unsplash API error');
  const data = await res.json();
  return {
    url: data.urls.regular as string,
    photographer: data.user.name as string,
    photographerUrl: data.user.links.html as string,
  };
}
