// Builds the "answer-first" quotable sentence for shoe pages and segment pages.
// Same string used at runtime AND inside prerendered HTML so crawlers can quote it verbatim.

export type AggregateInput = {
  brand?: string | null;
  model: string;
  reviewCount: number;
  avgRating?: number | null;
  topAttribute?: string | null; // e.g. "stability on mixed terrain"
  segmentLabel?: string | null; // e.g. "wide-footed marathon runners"
};

export function shoeAggregateSentence(i: AggregateInput): string {
  if (!i.reviewCount || i.reviewCount === 0) {
    return `${[i.brand, i.model].filter(Boolean).join(" ")} doesn't have community reviews yet — be the first to rate it.`;
  }
  const name = [i.brand, i.model].filter(Boolean).join(" ");
  const rating = i.avgRating != null ? `averages ${Number(i.avgRating).toFixed(1)}/10` : "is rated by the community";
  const attr = i.topAttribute ? `, rated strongest for ${i.topAttribute}` : "";
  const seg = i.segmentLabel ? ` among ${i.segmentLabel}` : "";
  const verified = i.reviewCount === 1 ? "1 verified review" : `${i.reviewCount} verified reviews`;
  return `Across ${verified}, the ${name} ${rating}${attr}${seg}.`;
}

export function segmentLeadSentence(opts: {
  segmentTitle: string;
  reviewCount: number;
  topShoe?: string | null;
  topShoePrice?: number | null;
  topShoeRating?: number | null;
  topAttribute?: string | null;
}): string {
  if (!opts.topShoe || !opts.reviewCount) {
    return `${opts.segmentTitle}: we're still gathering enough reviews to publish a verified top pick. Check back soon.`;
  }
  const price = opts.topShoePrice ? ` ($${opts.topShoePrice})` : "";
  const score = opts.topShoeRating != null ? `${Number(opts.topShoeRating).toFixed(1)}/10` : "highly";
  const attr = opts.topAttribute ? ` for ${opts.topAttribute}` : "";
  return `Based on ${opts.reviewCount} verified reviews from this segment, the ${opts.topShoe}${price} is the top match — reviewers rated it ${score}${attr}.`;
}

export function formatUpdated(date?: string | Date | null): string {
  const d = date ? new Date(date) : new Date();
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}
