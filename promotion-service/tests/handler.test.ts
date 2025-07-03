import { handler } from '../src/handler';

describe('Promotion Service', () => {
  it('should return a 200 status code', async () => {
    const event = {}; // Mock an empty event

    const response = await handler(event as unknown);

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).message).toBe('Promotion Service is running!');
  });
});