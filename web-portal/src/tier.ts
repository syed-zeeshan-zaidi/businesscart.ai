// Tier computation — pure logic, derives current pricing tier from this month's
// orders. Used on the company dashboard, sidebar badge, and (later) admin
// billing page. The tier is NEVER stored on the Company model; it is always
// derived from order data so it stays self-correcting on refunds/cancellations.
//
// Brackets (matches exclude/APPLICATION.md and the marketing pages):
//   Starter:    ≤100 orders/mo  → $0/mo + 6% per order, capped at $5/order
//   Growth:     101–1,000/mo    → $499/mo + 1% per order
//   Enterprise: 1,001+/mo       → $1,999/mo + 0.25% per order
import { Order } from './types';

export type TierName = 'Starter' | 'Growth' | 'Enterprise';

export interface TierInfo {
  tier: TierName;
  monthOrderCount: number;
  monthGrandTotal: number;
  nextTierThreshold: number | null;
  nextTierName: TierName | null;
  ordersToNextTier: number | null;
  monthlyFee: number;
  perOrderRate: number;
  perOrderCap: number | null;
  estimatedBill: number;
}

// The billing month is the UTC calendar month, everywhere.
//
// This used to read the LOCAL month, which meant the dashboard estimate and the
// statement could disagree about which month an order fell in: the seller saw an
// order in month N and was billed for it in month N-1. The boundary is now the
// same instant here, on the Billing page and in the snapshot, so the estimate a
// seller reads always covers the period they are invoiced for. The cost is that
// near midnight UTC the dashboard rolls over before local midnight; agreeing
// with the invoice is worth more than agreeing with the wall clock.
export function computeTier(orders: Order[], now: Date = new Date()): TierInfo {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();

  const monthOrders = orders.filter((o) => {
    if (o.status === 'cancelled') return false;
    const d = new Date(o.createdAt);
    return d.getUTCFullYear() === y && d.getUTCMonth() === m;
  });

  const count = monthOrders.length;
  const grandTotal = monthOrders.reduce((s, o) => s + (o.grandTotal || 0), 0);

  let tier: TierName;
  let monthlyFee: number;
  let perOrderRate: number;
  let perOrderCap: number | null;
  let nextTierThreshold: number | null;
  let nextTierName: TierName | null;

  if (count <= 100) {
    tier = 'Starter';
    monthlyFee = 0;
    perOrderRate = 0.06;
    perOrderCap = 5;
    nextTierThreshold = 100;
    nextTierName = 'Growth';
  } else if (count <= 1000) {
    tier = 'Growth';
    monthlyFee = 499;
    perOrderRate = 0.01;
    perOrderCap = null;
    nextTierThreshold = 1000;
    nextTierName = 'Enterprise';
  } else {
    tier = 'Enterprise';
    monthlyFee = 1999;
    perOrderRate = 0.0025;
    perOrderCap = null;
    nextTierThreshold = null;
    nextTierName = null;
  }

  // Fees are charged on NET revenue, mirroring Order.NetTotal and the fee loop in
  // checkout-service/internal/statement/compute.go. Both must stay in step or the
  // dashboard's estimated bill contradicts the statement the seller is actually
  // sent: a $209.97 order refunded $174.98 estimates $5.00 here (6% of gross, hit
  // the cap) against $2.10 billed (6% of net). Clamped at 0 like NetTotal so an
  // over-refund cannot produce a negative fee.
  // Rounded to cents to mirror statement.Compute's round2. Without it the
  // dashboard estimate shows a fraction of a cent the invoice never charges.
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const perOrderFees = monthOrders.reduce((s, o) => {
    const refunded = (o.refunds || []).reduce((r, x) => r + (x.amount || 0), 0);
    const net = Math.max(0, (o.grandTotal || 0) - refunded);
    const fee = perOrderRate * net;
    return s + (perOrderCap !== null ? Math.min(fee, perOrderCap) : fee);
  }, 0);

  const ordersToNextTier =
    nextTierThreshold !== null ? Math.max(0, nextTierThreshold + 1 - count) : null;

  return {
    tier,
    monthOrderCount: count,
    monthGrandTotal: grandTotal,
    nextTierThreshold,
    nextTierName,
    ordersToNextTier,
    monthlyFee,
    perOrderRate,
    perOrderCap,
    estimatedBill: round2(monthlyFee + round2(perOrderFees)),
  };
}
