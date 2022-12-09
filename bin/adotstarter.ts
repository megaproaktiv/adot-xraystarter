#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { XraystarterStack } from '../lib/xraystarter-stack';

const app = new cdk.App();
new XraystarterStack(app, 'adotstarter-auto', {
  // env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },


});