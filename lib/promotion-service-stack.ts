import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import { Construct } from 'constructs';
import * as dotenv from 'dotenv';
import { join } from 'path';

dotenv.config({ path: join(__dirname, '..", 'promotion-service', '.env') });

export class PromotionServiceStack extends cdk.Stack {
  public readonly handler: lambda.Function;
  public readonly api: apigw.RestApi;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.handler = new lambda.Function(this, 'PromotionHandler', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'handler.handler',
      code: lambda.Code.fromAsset(join(__dirname, '..", 'promotion-service', 'dist')),
      environment: {
        MONGO_URI: process.env.MONGO_URI || '',
        JWT_SECRET: process.env.JWT_SECRET || '',
        JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || '',
        NODE_ENV: 'development',
        USER_API: process.env.USER_API || 'http://127.0.0.1:3000',
        COMPANY_API: process.env.COMPANY_API || 'http://127.0.0.1:3001',
        PRODUCT_API: process.env.PRODUCT_API || 'http://127.0.0.1:3002',
        ORDER_API: process.env.ORDER_API || 'http://127.0.0.1:3003',
        CART_API: process.env.CART_API || 'http://127.0.0.1:3004',
        CHECKOUT_API: process.env.CHECKOUT_API || 'http://127.0.0.1:3005',
        PAYMENT_API: process.env.PAYMENT_API || 'http://127.0.0.1:3006',
        SHIPPING_API: process.env.SHIPPING_API || 'http://127.0.0.1:3007',
        PROMOTION_API: process.env.PROMOTION_API || 'http://127.0.0.1:3008',
      },
      timeout: cdk.Duration.seconds(30),
    });

    this.api = new apigw.RestApi(this, 'PromotionApi', {
      restApiName: 'PromotionService',
      deployOptions: {
        stageName: 'dev',
      },
    });

    const promotionResource = this.api.root.addResource('promotion');
    promotionResource.addMethod('POST', new apigw.LambdaIntegration(this.handler));
  }
}