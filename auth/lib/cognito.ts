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

        const userPool = new UserPool(this, `${props.appName}-userPool`, {
            userPoolName: `${props.appName}-UserPool`,
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
                requireDigits: true,
                requireLowercase: true,
                requireUppercase: true,
                requireSymbols: true,
            },
            standardAttributes: {
                email: {
                    mutable: false,
                    required: true,
                },
            },
            userVerification: {
                emailSubject: 'Rocket for Bandsログイン認証コード',
                emailBody: '認証コードは{####}です',
                emailStyle: VerificationEmailStyle.CODE,
                smsMessage: 'Rocket for Bandsの認証コードは{####}です',
            }
        });

        const userPoolDomain = new UserPoolDomain(this, `${props.appName}-userPoolDomain`, {
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
                'phone',
                'email',
                'openid',
                'aws.cognito.signin.user.admin',
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
                'phone',
                'email',
                'openid',
                'aws.cognito.signin.user.admin',
                'profile',
            ],
            attributeMapping: {
                email: ProviderAttribute.FACEBOOK_EMAIL,
            },
        });

        const appClient = userPool.addClient(`${props.appName}-appClient`, {
            userPoolClientName: `${props.appName}-appClient`,
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

        const authenticatedPolicyDocument = new PolicyDocument({
            statements: [
                new PolicyStatement({
                    effect: Effect.ALLOW,
                    actions: [
                        "cognito-sync:*",
                        "cognito-identity:*",
                        "mobileanalytics:PutEvents",
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
                    ],
                    resources: [
                        `arn:aws:s3:::${props.bucketName}/\${cognito-identity.amazonaws.com:sub}/*`,
                        `arn:aws:s3:::${props.bucketName}/\${cognito-identity.amazonaws.com:sub}`,
                    ],
                }),
            ]
        });

        const idPool = new IdentityPool(this, `${props.appName}-idPool`, {
            authenticatedPolicyDocument: authenticatedPolicyDocument,
            allowUnauthenticatedIdentities: true,
            identityPoolName: `${props.appName}-idPool`,
        });
    }
}

