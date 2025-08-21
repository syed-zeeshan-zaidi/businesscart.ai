import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as path from 'path';
import { Construct } from 'constructs';

export class CatalogServiceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Catalog Service Lambda
    const catalogServiceLambda = new lambda.Function(this, 'CatalogService', {
      runtime: lambda.Runtime.GO_1_X,
      handler: 'bootstrap',
      code: lambda.Code.fromAsset(path.join(__dirname, '..', 'catalog-service'), {
        bundling: {
          image: lambda.Runtime.GO_1_X.bundlingImage,
          command: [
            'bash',
            '-c',
            'go build -o /asset-output/bootstrap ./cmd/server/main.go',
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

    // API Gateway
    const api = new apigateway.RestApi(this, 'CatalogApi', {
      restApiName: 'Catalog Service API',
      description: 'API for Catalog Service',
      deployOptions: {
        stageName: 'dev',
      },
    });

    // API Routes
    const products = api.root.addResource('products');
    const productId = products.addResource('{productId}');

    // Integrations
    const catalogIntegration = new apigateway.LambdaIntegration(catalogServiceLambda);
    products.addMethod('POST', catalogIntegration);
    products.addMethod('GET', catalogIntegration);
    productId.addMethod('GET', catalogIntegration);
    productId.addMethod('PUT', catalogIntegration);
    productId.addMethod('DELETE', catalogIntegration);

    // CORS
    products.addCorsPreflight({ allowOrigins: ['*'], allowMethods: ['GET', 'POST', 'OPTIONS'] });
    productId.addCorsPreflight({ allowOrigins: ['*'], allowMethods: ['GET', 'PUT', 'DELETE', 'OPTIONS'] });

    // Output API Endpoint
    new cdk.CfnOutput(this, 'CatalogApiUrl', {
      value: api.url,
      description: 'Catalog Service API Endpoint',
    });
  }
}