#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { VPCStack } from '../lib/vpc';
import { RDSStack } from '../lib/rds';
import { EKSStack } from '../lib/eks';

require('dotenv').config();

const appName = process.env.APP_NAME ? process.env.APP_NAME : 'sample';
const rdsdbname = process.env.RDS_DB_NAME ? process.env.RDS_DB_NAME : 'sample';
const rdsUserName = process.env.RDS_USERNAME ? process.env.RDS_USERNAME : 'admin';
const rdsPassword = process.env.RDS_PASSWORD ? process.env.RDS_PASSWORD : 'password';

const app = new cdk.App();
const vpcStack = new VPCStack(app, `${appName}-vpc`, {
    appName,
    env: {
        region: 'ap-northeast-1',
    },
});

const rdsStack = new RDSStack(app, `${appName}-rds`, {
    appName,
    dbname: rdsdbname,
    username: rdsUserName,
    password: rdsPassword,
    vpc: vpcStack.vpc,
    env: {
        region: 'ap-northeast-1',
    },
});

const eksStack = new EKSStack(app, `${appName}-eks`, {
    appName,
    clusterEndpoint: rdsStack.rds.clusterEndpoint.hostname,
    rdsUsername: rdsUserName,
    rdsPassword: rdsPassword,
    vpc: vpcStack.vpc,
    env: {
        region: 'ap-northeast-1',
    },
});

rdsStack.injectSecurityGroup(eksStack.eks.clusterSecurityGroupId);