#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { VPCStack } from '../lib/vpc';
import { RDSStack } from '../lib/rds';
// import { EKSStack } from '../lib/eks';
import { LambdaStack } from '../lib/lambda';
import { ECSStack } from '../lib/ecs';
import { Config } from '../typing';

const config: Config = {
    appName: process.env.APP_NAME ?? 'sample-app',
    environment: process.env.ENVIRONMENT ?? 'dev',
    rdsPassword: process.env.RDS_PASSWORD ?? 'rocketpassword',
    awsAccountId:  process.env.AWS_ACCOUNT_ID ?? '900000',
    awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID ?? 'HOGE',
    awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? 'HOGE',
    awsRegion: process.env.AWS_DEFAULT_REGION ?? 'ap-northeast-1',
    mackerelApiKey: process.env.MACKEREL_APIKEY ?? 'hogehoge',
    acmCertificateArn: 'arn:aws:acm:ap-northeast-1:960722127407:certificate/a32583f3-ec6e-420a-8dd4-9c5aa26a3215', // need to create in the same region as a Load Balancer
    domainZone: 'rocketfor.band.',
    domainName: process.env.ENVIRONMENT == 'prd' ? 'api.rocketfor.band' : 'api-dev.rocketfor.band',
};

const app = new cdk.App();
const vpcStack = new VPCStack(app, `${config.appName}-vpc`, {
    appName: config.appName,
    env: {
        region: config.awsRegion,
    },
});

const rdsStack = new RDSStack(app, `${config.appName}-rds`, {
    config: config,
    vpc: vpcStack.vpc,
    rdsDBName: 'rocketdatabase',
    rdsUserName: 'rocketuser',
    useSnapshot: config.environment === 'prd',
    env: {
        region: config.awsRegion,
    },
});

// const ecsStack = new ECSStack(app, `${config.appName}-ecs`, {
//     config: config,
//     vpc: vpcStack.vpc,
//     mysqlUrl: rdsStack.mysqlUrl,
//     mysqlSecurityGroupId: rdsStack.rdsSecurityGroupId,
// });

// const eksStack = new EKSStack(app, `${config.appName}-eks`, {
//     config: config,
//     vpc: vpcStack.vpc,
//     mysqlUrl: rdsStack.mysqlUrl,
//     mysqlSecurityGroupId: rdsStack.rdsSecurityGroupId,
//     env: {
//         region: config.awsRegion,
//     },
// });

const lambdaStack = new LambdaStack(app, `${config.appName}-lambda`, {
    config: config,
    vpc: vpcStack.vpc,
    dbProxyUrl: rdsStack.dbProxyUrl,
    dbSecurityGroupId: rdsStack.rdsSecurityGroupId,
    env: {
        region: config.awsRegion,
    },
});

app.synth();
