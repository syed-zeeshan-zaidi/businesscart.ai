#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { BusinessCartStack } from '../lib/business-cart-stack';

const app = new cdk.App();
new BusinessCartStack(app, 'BusinessCartStack', {
  env: { region: 'us-east-1' },
});
