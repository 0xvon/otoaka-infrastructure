#!/usr/bin/env node
import * as cdk from '@aws-cdk/core';
import { CognitoStack } from '../lib/cognito';

const appName = process.env.APP_NAME ? process.env.APP_NAME : 'sample';
const signinCallbackUrl = process.env.SIGNIN_CALLBACK_URL ? process.env.SIGNIN_CALLBACK_URL : 'https://sample.com';
const signoutCallbackUrl = process.env.SIGNOUT_CALLBACK_URL ? process.env.SIGNOUT_CALLBACK_URL : 'https://sample.com';
const googleWebClientId = process.env.GOOGLE_WEB_CLIENT_ID ? process.env.GOOGLE_WEB_CLIENT_ID : 'sample';
const googleWebAppSecret = process.env.GOOGLE_WEB_APP_SECRET ? process.env.GOOGLE_WEB_APP_SECRET : 'sample';
const appBundleId = process.env.APP_BUNDLE_ID ? process.env.APP_BUNDLE_ID : 'dev.sample.hoge';
const facebookAppId = process.env.FACEBOOK_APP_ID ? process.env.FACEBOOK_APP_ID : 'sample';
const facebookAppSecret = process.env.FACEBOOK_APP_SECRET ? process.env.FACEBOOK_APP_SECRET : 'dev.sample.hoge';

const app = new cdk.App();
const cognitoUserPoolStack = new CognitoStack(app, `${appName}-cognito`, {
    appName,
    signinCallbackUrl: signinCallbackUrl,
    signoutCallbackUrl: signoutCallbackUrl,
    googleWebClientId: googleWebClientId,
    googleWebAppSecret: googleWebAppSecret,
    facebookAppId: facebookAppId,
    facebookAppSecret: facebookAppSecret,
    env: {
        region: 'ap-northeast-1',
    },
});
