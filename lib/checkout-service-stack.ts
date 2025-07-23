import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';

import * as apigw from 'aws-cdk-lib/aws-apigateway';
import { Construct } from 'constructs';
import * as dotenv from 'dotenv';
import { join } from 'path';

dotenv.config({ path: join(__dirname, '..', 'checkout-service', '.env') });

export class CheckoutServiceStack extends cdk.Stack {
  public readonly handler: lambda.Function;
  public readonly api: apigw.RestApi;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.handler = new lambda.Function(this, 'CheckoutOrchestrationHandler', {
      runtime: lambda.Runtime.GO_1_X,
      handler: 'server',
      code: lambda.Code.fromAsset(join(__dirname, '..', 'checkout-service'), {
        bundling: {
          image: lambda.Runtime.GO_1_X.bundlingImage,
          command: [
            'bash', '-c',
            'go build -o /asset-output/server ./cmd/server',
          ],
          user: 'root',
        },
      }),
      environment: {
        MONGO_URI: process.env.MONGO_URI || '',
        JWT_SECRET: process.env.JWT_SECRET || '',
        JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || '',
        NODE_ENV: 'development',
        
      },
      timeout: cdk.Duration.seconds(30),
    });

    this.api = new apigw.RestApi(this, 'CheckoutOrchestrationApi', {
      restApiName: 'CheckoutOrchestrationService',
      deployOptions: {
        stageName: 'dev',
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigw.Cors.ALL_ORIGINS,
        allowMethods: apigw.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization'],
      },
    });

    const checkoutResource = this.api.root.addResource('checkout');
    checkoutResource.addMethod('POST', new apigw.LambdaIntegration(this.handler));

    // Add /cart resource and methods
    const cartResource = this.api.root.addResource('cart');
    cartResource.addMethod('POST', new apigw.LambdaIntegration(this.handler)); // Add item to cart
    cartResource.addMethod('GET', new apigw.LambdaIntegration(this.handler));  // Get cart
    cartResource.addMethod('DELETE', new apigw.LambdaIntegration(this.handler)); // Clear cart

    // Add /cart/{itemId} resource and methods
    const cartItemResource = cartResource.addResource('{itemId}');
    cartItemResource.addMethod('PUT', new apigw.LambdaIntegration(this.handler));    // Update item quantity
    cartItemResource.addMethod('DELETE', new apigw.LambdaIntegration(this.handler)); // Remove item from cart

    // Add /quotes resource and methods
    const quotesResource = this.api.root.addResource('quotes');
    quotesResource.addMethod('POST', new apigw.LambdaIntegration(this.handler)); // Create a new quote

    const quoteIdResource = quotesResource.addResource('{quoteId}');
    quoteIdResource.addMethod('GET', new apigw.LambdaIntegration(this.handler)); // Get quote by ID
    quoteIdResource.addMethod('DELETE', new apigw.LambdaIntegration(this.handler)); // Delete quote by ID

    // Add /orders resource and methods
    const ordersResource = this.api.root.addResource('orders');
    ordersResource.addMethod('POST', new apigw.LambdaIntegration(this.handler)); // Place an order from a quote
  }
}