import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import { GoFunction } from '@aws-cdk/aws-lambda-go-alpha';
import { Construct } from 'constructs';
import { join } from 'path';

export interface BusinessCartStackProps extends cdk.StackProps {
  stage: string;
}

export class BusinessCartStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: BusinessCartStackProps) {
    super(scope, id, props);

    cdk.Tags.of(this).add('Project', 'BusinessCart');
    cdk.Tags.of(this).add('Stage', props.stage);

    const mongoUri = ssm.StringParameter.valueForStringParameter(this, `/BusinessCart/${props.stage}/MONGO_URI`);
    const jwtSecret = ssm.StringParameter.valueForStringParameter(this, `/BusinessCart/${props.stage}/JWT_SECRET`);
    const jwtRefreshSecret = ssm.StringParameter.valueForStringParameter(this, `/BusinessCart/${props.stage}/JWT_REFRESH_SECRET`);

    const rawOrigins =
      props.stage === 'local'
        ? '*' // local dev – allow all
        : ssm.StringParameter.valueForStringParameter(
            this,
            `/BusinessCart/${props.stage}/CORS_ALLOWED_ORIGINS`
          );
    const allowedOrigins = rawOrigins.split(',').map((o: string) => o.trim());

    const sharedGoFunctionProps = {
      runtime: lambda.Runtime.PROVIDED_AL2023,
      architecture: props.stage === 'local' ? lambda.Architecture.X86_64 : lambda.Architecture.ARM_64,
      timeout: cdk.Duration.seconds(60),
      memorySize: 128,
      environment: {
        MONGO_URI: mongoUri,
        JWT_SECRET: jwtSecret,
        JWT_REFRESH_SECRET: jwtRefreshSecret,
        NODE_ENV: props.stage,
      },
    };

    const accountService = new GoFunction(this, 'AccountHandler', {
      ...sharedGoFunctionProps,
      functionName: `AccountHandler-${props.stage}`,
      entry: join(__dirname, '..', 'account-service', 'cmd', 'server'),
      environment: {
        ...sharedGoFunctionProps.environment,
        CORS_ALLOWED_ORIGINS: allowedOrigins.join(','),
      },
    });

    const catalogService = new GoFunction(this, 'CatalogHandler', {
      ...sharedGoFunctionProps,
      functionName: `CatalogHandler-${props.stage}`,
      entry: join(__dirname, '..', 'catalog-service', 'cmd', 'server'),
      environment: {
        ...sharedGoFunctionProps.environment,
        CORS_ALLOWED_ORIGINS: allowedOrigins.join(','),
      },
    });

    const checkoutService = new GoFunction(this, 'CheckoutHandler', {
      ...sharedGoFunctionProps,
      functionName: `CheckoutHandler-${props.stage}`,
      entry: join(__dirname, '..', 'checkout-service', 'cmd', 'server'),
    });

    const api = new apigw.RestApi(this, 'UnifiedApi', {
      restApiName: `BusinessCart-API-${props.stage}`,
      description: 'Consolidated API for all BusinessCart services.',
      deployOptions: { stageName: props.stage },
      defaultCorsPreflightOptions: {
        allowOrigins: allowedOrigins,
        allowMethods: apigw.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization', 'Cookie'],
      },
    });

    /* =====  CORS – 2xx/4xx/5xx must carry header  ===== */
    const corsOrigin = props.stage === 'local'
      ? "'*'"
      : `'${ssm.StringParameter.valueFromLookup(this, `/BusinessCart/${props.stage}/CORS_ALLOWED_ORIGINS`)}'`;

    api.addGatewayResponse('Cors4XX', {
      type: apigw.ResponseType.DEFAULT_4XX,
      responseHeaders: { 'Access-Control-Allow-Origin': corsOrigin },
    });
    api.addGatewayResponse('Cors5XX', {
      type: apigw.ResponseType.DEFAULT_5XX,
      responseHeaders: { 'Access-Control-Allow-Origin': corsOrigin },
    });

    const accountInteg = new apigw.LambdaIntegration(accountService);

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
    const customerAssociate = customerById.addResource('associate');
    customerAssociate.addMethod('PATCH', accountInteg);

    const catalogInteg = new apigw.LambdaIntegration(catalogService);
    const products = api.root.addResource('products');
    products.addMethod('POST', catalogInteg);
    products.addMethod('GET', catalogInteg);
    const productId = products.addResource('{productId}');
    productId.addMethod('GET', catalogInteg);
    productId.addMethod('PUT', catalogInteg);
    productId.addMethod('DELETE', catalogInteg);

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

    const portalBucket = new s3.Bucket(this, 'WebPortalBucket', {
      bucketName: `web-portal-bucket-${props.stage}`,
      websiteIndexDocument: 'index.html',
      versioned: false,
      intelligentTieringConfigurations: [
        // { name: 'FreeTier', prefix: 'web-portal/' },
      ],
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const viteApiUrl = props.stage === 'local'
      ? 'http://127.0.0.1:3000 '
      : ssm.StringParameter.valueFromLookup(
          this,
          `/BusinessCart/${props.stage}/ApiUrl`
        );
    
    new s3deploy.BucketDeployment(this, 'DeployWebPortal', {
      sources: [
        s3deploy.Source.asset(join(__dirname, '..', 'web-portal'), {
          bundling: {
            image: cdk.DockerImage.fromRegistry('public.ecr.aws/bitnami/node:18'),
            command: [
              'bash',
              '-c',
              'npm install && npm run build && mv dist/* /asset-output/',
            ],
            environment: {
              VITE_API_URL: viteApiUrl,
            },
            user: 'root',
          },
        }),
      ],
      destinationBucket: portalBucket,
    });
    new cdk.CfnOutput(this, 'ViteApiUrlFromSsm', { value: viteApiUrl });

    new cdk.CfnOutput(this, 'WebPortalUrl', { value: portalBucket.bucketWebsiteUrl });

    // --- Custom Domain and CDN for Web Portal ---

    const domainName = 'businesscart.ai';
    const zoneName = 'businesscart.ai';
    const hostedZoneId = 'Z08097461K3514HDMUTR6';

    // Look up the hosted zone in Route 53
    const hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, 'HostedZone', {
      hostedZoneId: hostedZoneId,
      zoneName: zoneName,
    });

    // Create an SSL/TLS certificate in ACM (must be in us-east-1 for CloudFront)
    const certificate = new acm.Certificate(this, 'SiteCertificate', {
      domainName: domainName,
      subjectAlternativeNames: [`www.${domainName}`],
      validation: acm.CertificateValidation.fromDns(hostedZone),
    });

    // Create a CloudFront distribution
    const distribution = new cloudfront.Distribution(this, 'SiteDistribution', {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(portalBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      domainNames: [domainName, `www.${domainName}`],
      certificate: certificate,
      defaultRootObject: 'index.html',
    });

    // Create a Route 53 'A' record to point the domain to the CloudFront distribution
    new route53.ARecord(this, 'SiteAliasRecord', {
      recordName: domainName,
      target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(distribution)),
      zone: hostedZone,
    });

    new route53.ARecord(this, 'WwwSiteAliasRecord', {
      recordName: `www.${domainName}`,
      target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(distribution)),
      zone: hostedZone,
    });

    // --- Namecheap Private Email DNS Records ---

    new route53.MxRecord(this, 'PrivateEmailMxRecord1', {
      zone: hostedZone,
      values: [
        {
          hostName: 'mx1.privateemail.com',
          priority: 10,
        },
      ],
    });

    // Output the CloudFront distribution domain name
    new cdk.CfnOutput(this, 'DistributionDomainName', {
      value: distribution.distributionDomainName,
    });
  }
}