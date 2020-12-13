import * as cdk from '@aws-cdk/core';
import * as iam from '@aws-cdk/aws-iam';
import * as cognito from '@aws-cdk/aws-cognito';

export interface IdentityPoolProps extends cognito.CfnIdentityPoolProps {
    authenticatedPolicyDocument?: iam.PolicyDocument,
    unauthenticatedPolicyDocument?: iam.PolicyDocument,
}

export class IdentityPool extends cdk.Construct {
    readonly pool: cognito.CfnIdentityPool;

    constructor(scope: cdk.Construct, id: string, props: IdentityPoolProps) {
        super(scope, id);

        const authenticatedPolicyDocument = props.authenticatedPolicyDocument ?? new iam.PolicyDocument({
            statements: [
                new iam.PolicyStatement({
                    effect: iam.Effect.ALLOW,
                    actions: [
                        "cognito-sync:*",
                        "cognito-identity:*",
                        "mobileanalytics:PutEvents",
                    ],
                    resources: ["*"],
                })
            ]
        });

        const unauthenticatedPolicyDocument = props.unauthenticatedPolicyDocument ?? new iam.PolicyDocument({
            statements: [
                new iam.PolicyStatement({
                    effect: iam.Effect.ALLOW,
                    actions: [
                        "cognito-sync:*",
                        "s3:*",
                        "mobileanalytics:PutEvents",
                    ],
                    resources: ["*"],
                })
            ]
        });

        const identityPool = new cognito.CfnIdentityPool(this, 'identityPool', {
            ...props,
            allowUnauthenticatedIdentities: props.allowUnauthenticatedIdentities,
            identityPoolName: props.identityPoolName,
        })

        const authenticatedRole = new iam.Role(this, 'authRole', {
            assumedBy:
                new iam.FederatedPrincipal("cognito-identity.amazonaws.com", {
                    "StringEquals": { "cognito-identity.amazonaws.com:aud": identityPool.ref },
                    "ForAnyValue:StringLike": { "cognito-identity.amazonaws.com:amr": "authenticated" },
                }),
            inlinePolicies: { 'policy': authenticatedPolicyDocument },
        });

        const unauthenticatedRole = new iam.Role(this, 'unauthRole', {
            assumedBy:
                new iam.FederatedPrincipal("cognito-identity.amazonaws.com", {
                    "StringEquals": { "cognito-identity.amazonaws.com:aud": identityPool.ref },
                    "ForAnyValue:StringLike": { "cognito-identity.amazonaws.com:amr": "unauthenticated" },
                }),
            inlinePolicies: { 'policy': unauthenticatedPolicyDocument },
            });

        new cognito.CfnIdentityPoolRoleAttachment(this, 'roleAttachment', {
            identityPoolId: identityPool.ref,
            roles: {
                "authenticated": authenticatedRole.roleArn,
                "unauthenticated": unauthenticatedRole.roleArn,
            }
        })
    }
}