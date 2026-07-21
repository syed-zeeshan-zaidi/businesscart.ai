// Per-product quantity rules (Roadmap #39): minimum, order increment (case pack),
// and maximum. Buyer-side enforcement lives here and is reused across the cart,
// quick-order, and add-to-cart surfaces (server-side enforcement is deferred to the
// full-UOM epic #38, since checkout-service must not call catalog).

export interface QtyRuleProduct {
  minOrderQty?: number;
  orderIncrement?: number;
  maxOrderQty?: number;
}

export const orderIncrementOf = (p?: QtyRuleProduct): number =>
  p?.orderIncrement && p.orderIncrement > 0 ? p.orderIncrement : 1;

export const minOrderQtyOf = (p?: QtyRuleProduct): number => {
  const inc = orderIncrementOf(p);
  return p?.minOrderQty && p.minOrderQty > 0 ? p.minOrderQty : inc;
};

// Snap a desired quantity to the rule grid: a multiple of the increment, at least the
// minimum, at most the maximum. Rounds to the nearest increment for friendly stepping,
// then guarantees >= min.
export const clampQty = (p: QtyRuleProduct | undefined, desired: number): number => {
  const inc = orderIncrementOf(p);
  const min = minOrderQtyOf(p);
  const rawMax = p?.maxOrderQty && p.maxOrderQty > 0 ? p.maxOrderQty : 0;
  // Ignore a contradictory max (below min) so the result never snaps under the minimum.
  const max = rawMax > 0 && rawMax < min ? 0 : rawMax;

  let q = isNaN(desired) ? min : desired;
  if (q < 1) q = min;
  q = Math.round(q / inc) * inc;
  if (q < min) q = Math.ceil(min / inc) * inc;
  if (max > 0 && q > max) q = Math.floor(max / inc) * inc;
  return Math.max(q, 1);
};

// Short human label, e.g. "Cases of 24 · Min 48 · Max 240". Null when no rules set.
export const qtyRuleLabel = (p?: QtyRuleProduct): string | null => {
  if (!p) return null;
  const parts: string[] = [];
  if (p.orderIncrement && p.orderIncrement > 1) parts.push(`Cases of ${p.orderIncrement}`);
  if (p.minOrderQty && p.minOrderQty > 1) parts.push(`Min ${p.minOrderQty}`);
  if (p.maxOrderQty && p.maxOrderQty > 0) parts.push(`Max ${p.maxOrderQty}`);
  return parts.length ? parts.join(' · ') : null;
};
