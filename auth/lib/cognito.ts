import * as cdk from '@aws-cdk/core';
import {
    UserPool,
    UserPoolDomain,
    UserPoolIdentityProviderFacebook,
    UserPoolIdentityProviderGoogle,
    Mfa,
    AccountRecovery,
    VerificationEmailStyle,
    ProviderAttribute,
    OAuthScope,
    CfnUserPool,
} from '@aws-cdk/aws-cognito';
import {
    PolicyDocument,
    PolicyStatement,
    Effect,
} from '@aws-cdk/aws-iam';
import { IdentityPool } from './identityPool';

interface CognitoStackProps extends cdk.StackProps {
    appName: string,
    bucketName: string,
    signinCallbackUrl: string,
    signoutCallbackUrl: string,
    googleWebClientId: string,
    googleWebAppSecret: string,
    facebookAppId: string,
    facebookAppSecret: string,
}

export class CognitoStack extends cdk.Stack {
    constructor(scope: cdk.App, id: string, props: CognitoStackProps) {
        super(scope, id, props);

        const userPool = new UserPool(this, `${props.appName}-user-pool`, {
            userPoolName: `${props.appName}-user-pool`,
            mfa: Mfa.OFF,
            selfSignUpEnabled: true,
            accountRecovery: AccountRecovery.EMAIL_ONLY,
            autoVerify: {
                email: true,
            },
            signInAliases: {
                username: true,
                email: true,
            },
            passwordPolicy: {
                minLength: 8,
                requireDigits: false,
                requireLowercase: true,
                requireUppercase: false,
                requireSymbols: false,
            },
            standardAttributes: {
                email: {
                    mutable: true,
                    required: true,
                },
            },
            userVerification: {
                emailSubject: 'Rocket for Bands II ログイン認証コード',
                emailBody: '認証コードは{####}です',
                emailStyle: VerificationEmailStyle.CODE,
                smsMessage: 'Rocket for Bands IIの認証コードは{####}です',
            }
        });

        const userPoolDomain = new UserPoolDomain(this, `${props.appName}-UserPoolDomain`, {
            userPool: userPool,
            cognitoDomain: {
                domainPrefix: props.appName,
            },
        });

        const googleIdProvider = new UserPoolIdentityProviderGoogle(this, `${props.appName}-googleIdProvider`, {
            userPool: userPool,
            clientId: props.googleWebClientId,
            clientSecret: props.googleWebAppSecret,
            scopes: [
                'email',
                'openid',
                'profile',
            ],
            attributeMapping: {
                email: ProviderAttribute.GOOGLE_EMAIL,
            },
        });

        const facebookIdProvider = new UserPoolIdentityProviderFacebook(this, `${props.appName}-facebookIdProvider`, {
            userPool: userPool,
            clientId: props.facebookAppId,
            clientSecret: props.facebookAppSecret,
            scopes: [
                'public_profile',
                'email',
            ],
            attributeMapping: {
                email: ProviderAttribute.FACEBOOK_EMAIL,
            },
        });

        const appClient = userPool.addClient(`${props.appName}-AppClient`, {
            userPoolClientName: `${props.appName}-app-client`,
            generateSecret: true,
            oAuth: {
                flows: {
                    authorizationCodeGrant: true,
                    implicitCodeGrant: true,
                },
                scopes: [
                    OAuthScope.PHONE,
                    OAuthScope.EMAIL,
                    OAuthScope.OPENID,
                    OAuthScope.COGNITO_ADMIN,
                    OAuthScope.PROFILE,
                ],
                callbackUrls: [
                    props.signinCallbackUrl,
                ],
                logoutUrls: [
                    props.signoutCallbackUrl,
                ],

            },
        });

        const unauthenticatedPolicyDocument = new PolicyDocument({
            statements: [
                new PolicyStatement({
                    sid: "VisualEditor0",
                    effect: Effect.ALLOW,
                    actions: [
                        "mobileanalytics:PutEvents",
                        "cognito-sync:*",
                        "cognito-identity:*",
                        "s3:CreateJob",
                    ],
                    resources: ["*"],
                }),
                new PolicyStatement({
                    sid: "VisualEditor1",
                    effect: Effect.ALLOW,
                    actions: [
                        "s3:PutObject",
                        "s3:GetObject",
                        "s3:deleteObject",
                    ],
                    resources: [
                        `arn:aws:s3:::${props.bucketName}/assets/\${cognito-identity.amazonaws.com:sub}/*`,
                        `arn:aws:s3:::${props.bucketName}/assets/\${cognito-identity.amazonaws.com:sub}`,
                        // `arn:aws:s3:::${props.bucketName}/assets/*`,
                    ],
                }),
            ]
        });

        const idPool = new IdentityPool(this, `${props.appName}-idPool`, {
            unauthenticatedPolicyDocument: unauthenticatedPolicyDocument,
            allowUnauthenticatedIdentities: true,
            identityPoolName: `${props.appName}-id-pool`,
        });
    }
}

