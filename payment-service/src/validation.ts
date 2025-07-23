import { z } from 'zod';

export const processPaymentSchema = z.object({
  amount: z.number().min(0),
  token: z.string(), // Mock token for now
});
