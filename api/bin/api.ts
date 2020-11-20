#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { VPCStack } from '../lib/vpc';
import { RDSStack } from '../lib/rds';
import { EKSStack } from '../lib/eks';

const appName = process.env.APP_NAME ? process.env.APP_NAME : 'sample';
const rdsdbname = process.env.RDS_DB_NAME ? process.env.RDS_DB_NAME : 'sample';
const rdsUserName = process.env.RDS_USERNAME ? process.env.RDS_USERNAME : 'admin';
const rdsPassword = process.env.RDS_PASSWORD ? process.env.RDS_PASSWORD : 'password';
const githubOwner = process.env.OWNER ? process.env.OWNER : 'something';
const githubRepo = process.env.REPO ? process.env.REPO : 'something';
const githubBranch = process.env.BRANCH ? process.env.BRANCH : 'master';
const awsAccessKeyId = process.env.AWS_ACCESS_KEY_ID ? process.env.AWS_ACCESS_KEY_ID : 'HOGE';
const awsSecretAccessKey = process.env.AWS_SECRET_ACCESS_KEY ? process.env.AWS_SECRET_ACCESS_KEY : 'HOGE';
const awsRegion = process.env.AWS_REGION ? process.env.AWS_REGION : 'ap-northeast-1';

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
    // clusterEndpoint: rdsStack.rds.clusterEndpoint.hostname,
    rdsUsername: rdsUserName,
    rdsPassword: rdsPassword,
    awsAccessKeyId: awsAccessKeyId,
    awsSecretAccessKey: awsSecretAccessKey,
    awsRegion: awsRegion,
    vpc: vpcStack.vpc,
    githubOwner: githubOwner,
    githubRepo: githubRepo,
    githubBranch: githubBranch,
    env: {
        region: 'ap-northeast-1',
    },
});

// rdsStack.injectSecurityGroup(eksStack.eks.clusterSecurityGroupId);
app.synth();