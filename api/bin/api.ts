#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { VPCStack } from '../lib/vpc';
import { RDSStack } from '../lib/rds';
import { EKSStack } from '../lib/eks';

require('dotenv').config();

const appName = process.env.APP_NAME ? process.env.APP_NAME : 'sample';

const app = new cdk.App();
const vpcStack = new VPCStack(app, `${appName}-vpc`, {
    appName,
    env: {
        region: 'ap-northeast-1',
    },
});

const eksStack = new EKSStack(app, `${appName}-eks`, {
    appName,
    vpc: vpcStack.vpc,
    env: {
        region: 'ap-northeast-1',
    },
});

const rdsStack = new RDSStack(app, `${appName}-rds`, {
    appName,
    vpc: vpcStack.vpc,
    appSGId: eksStack.eks.clusterSecurityGroupId,
    env: {
        region: 'ap-northeast-1',
    },
});
