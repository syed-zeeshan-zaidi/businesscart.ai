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

export function computeTier(orders: Order[], now: Date = new Date()): TierInfo {
  const y = now.getFullYear();
  const m = now.getMonth();

  const monthOrders = orders.filter((o) => {
    if (o.status === 'cancelled') return false;
    const d = new Date(o.createdAt);
    return d.getFullYear() === y && d.getMonth() === m;
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

  const perOrderFees = monthOrders.reduce((s, o) => {
    const fee = perOrderRate * (o.grandTotal || 0);
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
    estimatedBill: monthlyFee + perOrderFees,
  };
}
