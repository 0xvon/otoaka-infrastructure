#!/usr/bin/env node
import * as cdk from '@aws-cdk/core';
import { CognitoStack } from '../lib/cognito';
import { S3Stack } from '../lib/s3';

const appName = process.env.APP_NAME ? process.env.APP_NAME : 'sample';
const signinCallbackUrl = process.env.SIGNIN_CALLBACK_URL ? process.env.SIGNIN_CALLBACK_URL : 'https://sample.com';
const signoutCallbackUrl = process.env.SIGNOUT_CALLBACK_URL ? process.env.SIGNOUT_CALLBACK_URL : 'https://sample.com';
const googleWebClientId = process.env.GOOGLE_WEB_CLIENT_ID ? process.env.GOOGLE_WEB_CLIENT_ID : 'sample';
const googleWebAppSecret = process.env.GOOGLE_WEB_APP_SECRET ? process.env.GOOGLE_WEB_APP_SECRET : 'sample';
const facebookAppId = process.env.FACEBOOK_APP_ID ? process.env.FACEBOOK_APP_ID : 'sample';
const facebookAppSecret = process.env.FACEBOOK_APP_SECRET ? process.env.FACEBOOK_APP_SECRET : 'dev.sample.hoge';

const app = new cdk.App();

const s3Stack = new S3Stack(app, `${appName}-s3`, {
    appName,
});

const cognitoUserPoolStack = new CognitoStack(app, `${appName}-cognito`, {
    appName,
    bucketName: s3Stack.bucket.bucketName,
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
