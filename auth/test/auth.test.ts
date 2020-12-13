import { expect as expectCDK, haveResource } from '@aws-cdk/assert';
import * as cdk from '@aws-cdk/core';
import * as Cognito from '../lib/cognito';

test('SQS Queue Created', () => {
    const app = new cdk.App();
    // WHEN
    const stack = new Cognito.CognitoStack(app, `CognitoUserPool`, {
        appName: 'sample',
        signinCallbackUrl: 'https://sample.com',
        signoutCallbackUrl: 'https://sample.com',
        googleWebClientId: 'sample',
        googleWebAppSecret: 'sample',
        facebookAppId: 'sample',
        facebookAppSecret: 'sample',
        env: {
            region: 'ap-northeast-1',
        },
    });
    // THEN
    expectCDK(stack).to(haveResource("AWS::SQS::Queue",{
        VisibilityTimeout: 300
    }));
});

test('SNS Topic Created', () => {
    const app = new cdk.App();
    // WHEN
    const stack = new Cognito.CognitoStack(app, `CognitoUserPool`, {
        appName: 'sample',
        signinCallbackUrl: 'https://sample.com',
        signoutCallbackUrl: 'https://sample.com',
        googleWebClientId: 'sample',
        googleWebAppSecret: 'sample',
        facebookAppId: 'sample',
        facebookAppSecret: 'sample',
        env: {
            region: 'ap-northeast-1',
        },
    });
    // THEN
    expectCDK(stack).to(haveResource("AWS::SNS::Topic"));
});
