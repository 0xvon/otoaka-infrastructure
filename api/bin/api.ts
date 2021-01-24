#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { VPCStack } from '../lib/vpc';
import { RDSStack } from '../lib/rds';
import { EKSStack } from '../lib/eks';
import { Config } from '../typing';


const config: Config = {
    environment: process.env.ENVIRONMENT ?? 'dev',
    rdsPassword: process.env.RDS_PASSWORD ?? 'password',
    awsAccountId:  process.env.AWS_ACCOUNT_ID ?? '900000',
    awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID ?? 'HOGE',
    awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? 'HOGE',
    awsRegion: process.env.AWS_DEFAULT_REGION ?? 'ap-northeast-1',
    mackerelApiKey: process.env.MACKEREL_APIKEY ?? 'hogehoge',
    acmCertificateArn: 'arn:aws:acm:ap-northeast-1:960722127407:certificate/a32583f3-ec6e-420a-8dd4-9c5aa26a3215', // need to create in the same region as a Load Balancer
};
const appName = config.environment === 'prd' ? 'rocket-api' : 'rocket-api-dev';

const app = new cdk.App();
const vpcStack = new VPCStack(app, `${appName}-vpc`, {
    appName,
    env: {
        region: config.awsRegion,
    },
});

// const rdsStack = new RDSStack(app, `${appName}-rds`, {
//     appName,
//     config: config,
//     vpc: vpcStack.vpc,
//     rdsDBName: 'database',
//     rdsUserName: 'username',
//     env: {
//         region: config.awsRegion,
//     },
// });

const eksStack = new EKSStack(app, `${appName}-eks`, {
    appName,
    config: config,
    vpc: vpcStack.vpc,
    // mysqlUrl: rdsStack.mysqlUrl,
    env: {
        region: config.awsRegion,
    },
});

app.synth();
