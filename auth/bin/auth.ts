#!/usr/bin/env node
import * as cdk from '@aws-cdk/core';
import { CognitoUserPoolStack } from '../lib/cognitoUserPool';

const appName = process.env.APP_NAME ? process.env.APP_NAME : 'sample';
const googleWebClientId = process.env.GOOGLE_WEB_CLIENT_ID ? process.env.GOOGLE_WEB_CLIENT_ID : 'sample';
const googleWebAppSecret = process.env.GOOGLE_WEB_APP_SECRET ? process.env.GOOGLE_WEB_APP_SECRET : 'sample';
const appBundleId = process.env.APP_BUNDLE_ID ? process.env.APP_BUNDLE_ID : 'dev.sample.hoge';

const app = new cdk.App();
const eksStack = new CognitoUserPoolStack(app, `${appName}-cognitoUserPool`, {
    appName,
    env: {
        region: 'ap-northeast-1',
    },
});