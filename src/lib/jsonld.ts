// Builds Schema.org JSON-LD objects. Stringify with JSON.stringify before injecting.
export function productJsonLd(opts: {
  url: string;
  name: string;
  brand?: string;
  image?: string;
  description?: string;
  category?: string;
  msrp?: number | null;
  avgRating?: number | null;
  reviewCount?: number;
  reviews?: Array<{ author?: string | null; rating?: number | null; body?: string | null; date?: string | null }>;
  dateModified?: string;
}) {
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: opts.name,
    url: opts.url,
    ...(opts.brand ? { brand: { "@type": "Brand", name: opts.brand } } : {}),
    ...(opts.image ? { image: opts.image } : {}),
    ...(opts.description ? { description: opts.description } : {}),
    ...(opts.category ? { category: opts.category } : {}),
    ...(opts.msrp ? { offers: { "@type": "Offer", price: String(opts.msrp), priceCurrency: "USD", availability: "https://schema.org/InStock" } } : {}),
    ...(opts.dateModified ? { dateModified: opts.dateModified } : {}),
  };

  if (opts.avgRating != null && opts.reviewCount && opts.reviewCount > 0) {
    data.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: Number(opts.avgRating).toFixed(2),
      reviewCount: opts.reviewCount,
      bestRating: "10",
      worstRating: "1",
    };
  }

  const reviews = (opts.reviews ?? [])
    .filter((r) => r.body && r.body.trim().length > 0)
    .slice(0, 5)
    .map((r) => ({
      "@type": "Review",
      ...(r.rating ? { reviewRating: { "@type": "Rating", ratingValue: r.rating, bestRating: "10", worstRating: "1" } } : {}),
      author: { "@type": "Person", name: r.author || "Verified runner" },
      reviewBody: (r.body || "").slice(0, 600),
      ...(r.date ? { datePublished: r.date.slice(0, 10) } : {}),
    }));
  if (reviews.length > 0) data.review = reviews;

  return data;
}

export function itemListJsonLd(opts: {
  url: string;
  name: string;
  items: Array<{ url: string; name: string; image?: string | null }>;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: opts.name,
    url: opts.url,
    numberOfItems: opts.items.length,
    itemListElement: opts.items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: it.url,
      name: it.name,
      ...(it.image ? { image: it.image } : {}),
    })),
  };
}

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Shoe Sherpa",
    url: "https://shoe-sherpa.com",
  };
}
