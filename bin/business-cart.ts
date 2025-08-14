#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { AccountServiceStack } from '../lib/account-service-stack';
import { ProductServiceStack } from '../lib/product-service-stack';
import { WebPortalStack } from '../lib/web-portal-stack';
import { CheckoutServiceStack } from '../lib/checkout-service-stack';


const app = new cdk.App();

// Account Service Stack
new AccountServiceStack(app, 'AccountServiceStack', {
  env: { region: 'us-east-1' },
});

// Product Service Stack
new ProductServiceStack(app, 'ProductServiceStack', {
  env: { region: 'us-east-1' },
});

// Checkout Service Stack
new CheckoutServiceStack(app, 'CheckoutServiceStack', {
  env: { region: 'us-east-1' },
});



new WebPortalStack(app, 'WebPortalStack', {
  env: { region: 'us-east-1' },
  userApiUrl: 'https://user-api.example.com', // TODO: Replace with userServiceStack output
  companyApiUrl: 'https://company-api.example.com', // TODO: Replace with companyServiceStack output
  productApiUrl: 'https://product-api.example.com', // TODO: Replace with productServiceStack output
});
