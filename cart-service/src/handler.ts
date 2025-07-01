import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { connectDB } from './services/db-service';
import { CartService } from './services/cart-service';
import { createCartItemSchema, updateCartItemSchema } from './validation';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'OPTIONS,POST,GET,PUT,DELETE',
  };

  if (event.httpMethod === 'OPTIONS') {
    
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }
  try {
    await connectDB();
    const userId = event.requestContext.authorizer?.userId;
    const userRole = event.requestContext.authorizer?.userRole || 'customer';
    if (!userId) {
      return {
        statusCode: 401,
        body: JSON.stringify({ message: 'No token provided' }),
      };
    }

    const cartService = new CartService();
    const { httpMethod, pathParameters, body } = event;

    if (httpMethod === 'POST' && !pathParameters) {
      // Add item to cart
      let input;
      try {
        input = JSON.parse(body || '{}');
      } catch (error) {
        return {
          statusCode: 400,
          body: JSON.stringify({ message: 'Invalid JSON body' }),
          headers,
        };
      }
      const parsed = createCartItemSchema.safeParse(input);
      if (!parsed.success) {
        return {
          statusCode: 400,
          body: JSON.stringify({ errors: parsed.error.errors.map((e) => ({ message: e.message, path: e.path })) }),
          headers,
        };
      }
      const cart = await cartService.createCartItem(parsed.data.entity, userId, userRole);
      return {
        statusCode: 200,
        body: JSON.stringify(cart),
        headers,
      };
    }

    if (httpMethod === 'GET' && event.path === '/cart') {
      // Get cart
      const companyId = event.queryStringParameters?.companyId;
      if (!companyId) {
        return {
          statusCode: 400,
          body: JSON.stringify({ message: 'Company ID is required for getting a cart' }),
          headers,
        };
      }
      try {
        const cart = await cartService.getCart(userId, userRole, companyId);
        return {
          statusCode: 200,
          body: JSON.stringify(cart),
          headers,
        };
      } catch (error: any) {
        if (error.message === 'Cart not found') {
          return {
            statusCode: 200,
            body: JSON.stringify({ userId: userId, companyId: companyId, items: [] }),
            headers,
          };
        }
        throw error; // Re-throw other errors
      }
    }

    if (httpMethod === 'PUT' && pathParameters?.itemId) {
      // Update item quantity
      const companyId = event.queryStringParameters?.companyId;
      if (!companyId) {
        return {
          statusCode: 400,
          body: JSON.stringify({ message: 'Company ID is required for updating a cart item' }),
          headers,
        };
      }
      const input = JSON.parse(body || '{}');
      const parsed = updateCartItemSchema.safeParse(input);
      if (!parsed.success) {
        return {
          statusCode: 400,
          body: JSON.stringify({ errors: parsed.error.errors.map((e) => ({ message: e.message, path: e.path })) }),
          headers,
        };
      }
      const cart = await cartService.updateCartItem(pathParameters.itemId, parsed.data.entity, userId, companyId);
      return {
        statusCode: 200,
        body: JSON.stringify(cart),
        headers,
      };
    }

    if (httpMethod === 'DELETE' && pathParameters?.itemId) {
      // Remove item from cart
      const companyId = event.queryStringParameters?.companyId;
      if (!companyId) {
        return {
          statusCode: 400,
          body: JSON.stringify({ message: 'Company ID is required for removing a cart item' }),
          headers,
        };
      }
      const cart = await cartService.deleteCartItem(pathParameters.itemId, userId, companyId);
      return {
        statusCode: 200,
        body: JSON.stringify(cart),
        headers,
      };
    }

    if (httpMethod === 'DELETE' && event.path === '/cart') {
      // Clear cart
      const companyId = event.queryStringParameters?.companyId;
      if (!companyId) {
        return {
          statusCode: 400,
          body: JSON.stringify({ message: 'Company ID is required for clearing a cart' }),
          headers,
        };
      }
      const cart = await cartService.clearCart(userId, companyId);
      return {
        statusCode: 200,
        body: JSON.stringify(cart),
        headers,
      };
    }

    return {
      statusCode: 405,
      body: JSON.stringify({ message: 'Method not allowed' }),
      headers,
    };
  } catch (error: any) {
    
    let statusCode = 500;
    let message = error.message || 'Internal server error';

    if (message.includes('Unauthorized')) {
      statusCode = 403;
    } else if (message.includes('not found') || message.includes('Invalid')) {
      statusCode = 404;
    } else if (message.includes('Validation Error') || message.includes('required') || message.includes('must be')) {
      statusCode = 400;
    }

    return {
      statusCode,
      body: JSON.stringify({ message }),
      headers,
    };
  }
};