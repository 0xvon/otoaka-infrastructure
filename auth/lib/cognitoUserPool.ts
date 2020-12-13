import * as cdk from '@aws-cdk/core';
import {
    UserPool,
    UserPoolDomain,
    UserPoolIdentityProviderFacebook,
    UserPoolIdentityProviderGoogle,
    Mfa,
    AccountRecovery,
    VerificationEmailStyle,
    UserPoolClientIdentityProvider,
    ProviderAttribute,
    OAuthScope,
} from '@aws-cdk/aws-cognito';

interface CognitoUserPoolStackProps extends cdk.StackProps {
    appName: string,
    signinCallbackUrl: string,
    signoutCallbackUrl: string,
    googleWebClientId: string,
    googleWebAppSecret: string,
    facebookAppId: string,
    facebookAppSecret: string,
}

export class CognitoUserPoolStack extends cdk.Stack {
    constructor(scope: cdk.App, id: string, props: CognitoUserPoolStackProps) {
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
            supportedIdentityProviders: [
                UserPoolClientIdentityProvider.GOOGLE,
                UserPoolClientIdentityProvider.COGNITO,
                UserPoolClientIdentityProvider.FACEBOOK,
            ],
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
    }
}

