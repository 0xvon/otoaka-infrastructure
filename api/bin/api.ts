#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { VPCStack } from '../lib/vpc';
import { RDSStack } from '../lib/rds';
import { EKSStack } from '../lib/eks';

const appName = process.env.APP_NAME ?? 'sample';
const rdsdbname = process.env.RDS_DB_NAME ?? 'sample';
const rdsUserName = process.env.RDS_USERNAME ?? 'admin';
const rdsPassword = process.env.RDS_PASSWORD ?? 'password';
const githubOwner = process.env.OWNER ?? 'something';
const githubRepo = process.env.REPO ?? 'something';
const githubBranch = process.env.BRANCH ?? 'master';
const awsAccessKeyId = process.env.AWS_ACCESS_KEY_ID ?? 'HOGE';
const awsSecretAccessKey = process.env.AWS_SECRET_ACCESS_KEY ?? 'HOGE';
const awsRegion = process.env.AWS_REGION ?? 'ap-northeast-1';
const cognitoUserPoolId = process.env.COGNITO_USER_POOL_ID ?? 'ap-northeast-1_cZhPmp0Td';
const snsPlatformApplicationArn = process.env.SNS_PLATFORM_APPLICATION_ARN ?? 'arn:aws:sns:ap-northeast-1:960722127407:app/APNS_SANDBOX/rocket-ios-dev';

const app = new cdk.App();
const vpcStack = new VPCStack(app, `${appName}-vpc`, {
    appName,
    env: {
        region: 'ap-northeast-1',
    },
});

// const rdsStack = new RDSStack(app, `${appName}-rds`, {
//     appName,
//     dbname: rdsdbname,
//     username: rdsUserName,
//     password: rdsPassword,
//     vpc: vpcStack.vpc,
//     env: {
//         region: 'ap-northeast-1',
//     },
// });

const eksStack = new EKSStack(app, `${appName}-eks`, {
    appName,
    // rdsSecurityGroupId: rdsStack.rdsSecurityGroupId,
    // clusterEndpoint: rdsStack.rds.clusterEndpoint.hostname,
    dbname: rdsdbname,
    rdsUsername: rdsUserName,
    rdsPassword: rdsPassword,
    awsAccessKeyId: awsAccessKeyId,
    awsSecretAccessKey: awsSecretAccessKey,
    snsPlatformApplicationArn: snsPlatformApplicationArn,
    cognitoUserPoolId: cognitoUserPoolId,
    awsRegion: awsRegion,
    vpc: vpcStack.vpc,
    githubOwner: githubOwner,
    githubRepo: githubRepo,
    githubBranch: githubBranch,
    env: {
        region: 'ap-northeast-1',
    },
});

app.synth();
