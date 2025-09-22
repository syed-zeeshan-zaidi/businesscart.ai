import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';
import { join } from 'path';

export interface BusinessCartStackProps extends cdk.StackProps {
  stage: string;
}

export class BusinessCartStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: BusinessCartStackProps) {
    super(scope, id, props);

    // Fetch secrets from SSM
    const mongoUri = ssm.StringParameter.valueForStringParameter(this, `/BusinessCart/${props.stage}/MONGO_URI`);
    const jwtSecret = ssm.StringParameter.valueForStringParameter(this, `/BusinessCart/${props.stage}/JWT_SECRET`);
    const jwtRefreshSecret = ssm.StringParameter.valueForStringParameter(this, `/BusinessCart/${props.stage}/JWT_REFRESH_SECRET`);

    // Account Service
    const accountService = new lambda.Function(this, 'AccountHandler', {
      functionName: `AccountHandler-${props.stage}`,
      runtime: lambda.Runtime.GO_1_X,
      handler: 'bootstrap',
      code: lambda.Code.fromAsset(join(__dirname, '..', 'account-service'), {
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
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: {
        MONGO_URI: mongoUri,
        JWT_SECRET: jwtSecret,
        JWT_REFRESH_SECRET: jwtRefreshSecret,
        NODE_ENV: props.stage,
      },
    });

    // Catalog Service
    const catalogService = new lambda.Function(this, 'CatalogHandler', {
        functionName: `CatalogHandler-${props.stage}`,
        runtime: lambda.Runtime.GO_1_X,
        handler: 'bootstrap',
        code: lambda.Code.fromAsset(join(__dirname, '..', 'catalog-service'), {
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
        timeout: cdk.Duration.seconds(30),
        memorySize: 256,
        environment: {
          MONGO_URI: mongoUri,
          JWT_SECRET: jwtSecret,
          JWT_REFRESH_SECRET: jwtRefreshSecret,
          NODE_ENV: props.stage,
        },
      });

    // Checkout Service
    const checkoutService = new lambda.Function(this, 'CheckoutHandler', {
        functionName: `CheckoutHandler-${props.stage}`,
        runtime: lambda.Runtime.GO_1_X,
        handler: 'server',
        code: lambda.Code.fromAsset(join(__dirname, '..', 'checkout-service'), {
          bundling: {
            image: lambda.Runtime.GO_1_X.bundlingImage,
            command: [
              'bash',
              '-c',
              'go build -o /asset-output/server ./cmd/server',
            ],
            user: 'root',
          },
        }),
        timeout: cdk.Duration.seconds(30),
        memorySize: 256,
        environment: {
          MONGO_URI: mongoUri,
          JWT_SECRET: jwtSecret,
          JWT_REFRESH_SECRET: jwtRefreshSecret,
          NODE_ENV: props.stage,
        },
      });

    // API Gateway
    const api = new apigw.RestApi(this, 'UnifiedApi', {
      restApiName: `BusinessCart-API-${props.stage}`,
      description: 'Consolidated API for all BusinessCart services.',
      deployOptions: { stageName: props.stage },
      defaultCorsPreflightOptions: {
        allowOrigins: apigw.Cors.ALL_ORIGINS,
        allowMethods: apigw.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization', 'Cookie'],
      },
    });

    // Account Service Integration
    const accountInteg = new apigw.LambdaIntegration(accountService, {
        requestTemplates: {
          'application/json': JSON.stringify({
            resourcePath: '$context.resourcePath',
            httpMethod: '$context.httpMethod',
            pathParameters: '$input.params()',
            queryStringParameters: '$input.params()',
            headers: {
              '#foreach($h in $input.params().header.keySet())':
                '"$h": "$util.escapeJavaScript($input.params().header.get($h))"',
              '#if($foreach.hasNext),#end': '',
              '#end': '',
            },
                      }),
        },
        proxy: false,
      });
      const accountsRoot = api.root.addResource('accounts');
      accountsRoot.addResource('register').addMethod('POST', accountInteg);
      accountsRoot.addResource('login').addMethod('POST', accountInteg);
      accountsRoot.addResource('refresh').addMethod('POST', accountInteg);
      accountsRoot.addResource('logout').addMethod('POST', accountInteg);
      accountsRoot.addMethod('GET', accountInteg);
      const accountById = accountsRoot.addResource('{id}');
      accountById.addMethod('GET', accountInteg);
      accountById.addMethod('PATCH', accountInteg);
      accountById.addMethod('DELETE', accountInteg);
      accountById.addMethod('PUT', accountInteg);
      const locations = accountsRoot.addResource('locations');
      const locationByAccount = locations.addResource('{accountID}');
      locationByAccount.addMethod('GET', accountInteg);
      locationByAccount.addMethod('POST', accountInteg);
      const locationById = locationByAccount.addResource('{locationID}');
      locationById.addMethod('DELETE', accountInteg);
      const codes = api.root.addResource('codes');
      codes.addMethod('POST', accountInteg);
      codes.addMethod('GET', accountInteg);
      const codeByCode = codes.addResource('{code}');
      codeByCode.addMethod('GET', accountInteg);
      const customers = api.root.addResource('customers');
      const customerById = customers.addResource('{customerId}');
      const customerConfig = customerById.addResource('configuration');
      customerConfig.addMethod('PATCH', accountInteg);

    // Catalog Service Integration
    const catalogInteg = new apigw.LambdaIntegration(catalogService);
    const products = api.root.addResource('products');
    products.addMethod('POST', catalogInteg);
    products.addMethod('GET', catalogInteg);
    const productId = products.addResource('{productId}');
    productId.addMethod('GET', catalogInteg);
    productId.addMethod('PUT', catalogInteg);
    productId.addMethod('DELETE', catalogInteg);

    // Checkout Service Integration
    const checkoutInteg = new apigw.LambdaIntegration(checkoutService);
    const checkoutRoot = api.root.addResource('checkout');
    checkoutRoot.addMethod('POST', checkoutInteg);
    const cart = checkoutRoot.addResource('cart');
    cart.addMethod('POST', checkoutInteg);
    cart.addMethod('GET', checkoutInteg);
    cart.addMethod('DELETE', checkoutInteg);
    const cartItem = cart.addResource('{itemId}');
    cartItem.addMethod('PUT', checkoutInteg);
    cartItem.addMethod('DELETE', checkoutInteg);
    const quotes = checkoutRoot.addResource('quotes');
    quotes.addMethod('POST', checkoutInteg);
    const quoteId = quotes.addResource('{quoteId}');
    quoteId.addMethod('GET', checkoutInteg);
    quoteId.addMethod('DELETE', checkoutInteg);
    const orders = checkoutRoot.addResource('orders');
    orders.addMethod('POST', checkoutInteg);
    orders.addMethod('GET', checkoutInteg);

    new cdk.CfnOutput(this, 'UnifiedApiUrl', { value: api.url });

    // Web Portal
    const portalBucket = new s3.Bucket(this, 'WebPortalBucket', {
        bucketName: `web-portal-bucket-${props.stage}`,
        websiteIndexDocument: 'index.html',
        publicReadAccess: true,
        blockPublicAccess: new s3.BlockPublicAccess({ blockPublicAcls: false, blockPublicPolicy: false, ignorePublicAcls: false, restrictPublicBuckets: false }),
        removalPolicy: cdk.RemovalPolicy.DESTROY,
        autoDeleteObjects: true,
      });
  
      new s3deploy.BucketDeployment(this, 'DeployWebPortal', {
        sources: [s3deploy.Source.asset(join(__dirname, '..', 'web-portal', 'dist'))],
        destinationBucket: portalBucket,
      });
  
      new cdk.CfnOutput(this, 'WebPortalUrl', {
        value: portalBucket.bucketWebsiteUrl,
      });
  }
}