#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { BusinessCartStack } from '../lib/business-cart-stack';

const app = new cdk.App();

// Determine the stage from a context variable or environment variable
// To deploy prod, you'd run: cdk deploy -c stage=prod
const stage = app.node.tryGetContext('stage');
if (!stage) {
  throw new Error("Context variable 'stage' must be passed to cdk command. E.g., cdk deploy -c stage=prod");
}

// You can define stage-specific configurations here or in a separate file
type StageConfig = {
  [key: string]: { account: string; region: string };
};

const stageConfig: StageConfig = {
    prod: { account: '532697846782', region: 'us-east-1' },
    staging: { account: '532697846782', region: 'us-west-2' },
    local: { account: '000000000000', region: 'us-east-1' } // Dummy values for local synth
    // Add more configs as needed
};

new BusinessCartStack(app, `BusinessCartStack-${stage}`, {
  env: stageConfig[stage],
  stage: stage, // Pass the stage down to the stack
});
