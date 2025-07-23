export class PaymentService {
  processPayment(amount: number, token: string): boolean {
    // For now, a simple mock payment processing. Succeeds if token is 'valid-token'.
    if (token === 'valid-token') {
      console.log(`Processing payment of $${amount} with token ${token}. Success.`);
      return true;
    }
    console.log(`Processing payment of $${amount} with token ${token}. Failure.`);
    return false;
  }
}
