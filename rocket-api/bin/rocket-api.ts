#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { RocketApiStack } from '../lib/rocket-api-stack';

require('dotenv').config();

const appName = process.env.APP_NAME;

const app = new cdk.App();
new RocketApiStack(app, `${appName}`, {
    env: {
        region: 'ap-northeast-1',
    },
});
