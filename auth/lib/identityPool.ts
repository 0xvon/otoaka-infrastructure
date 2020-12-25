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
                    sid: "VisualEditor0",
                    effect: iam.Effect.ALLOW,
                    actions: [
                        "s3:GetAccessPoint",
                        "s3:GetAccountPublicAccessBlock",
                        "s3:ListAllMyBuckets",
                        "s3:ListAccessPoints",
                        "s3:ListJobs",
                        "mobileanalytics:PutEvents",
                        "s3:CreateJob",
                        "cognito-sync:*",
                    ],
                    resources: ["*"],
                }),
                new iam.PolicyStatement({
                    sid: "VisualEditor1",
                    effect: iam.Effect.ALLOW,
                    actions: [
                        "s3:PutAnalyticsConfiguration",
                        "s3:GetObjectVersionTagging",
                        "s3:DeleteAccessPoint",
                        "s3:CreateBucket",
                        "s3:ReplicateObject",
                        "s3:GetObjectAcl",
                        "s3:GetBucketObjectLockConfiguration",
                        "s3:DeleteBucketWebsite",
                        "s3:PutLifecycleConfiguration",
                        "s3:GetObjectVersionAcl",
                        "s3:DeleteObject",
                        "s3:GetBucketPolicyStatus",
                        "s3:GetObjectRetention",
                        "s3:GetBucketWebsite",
                        "s3:GetJobTagging",
                        "s3:PutReplicationConfiguration",
                        "s3:PutObjectLegalHold",
                        "s3:GetObjectLegalHold",
                        "s3:GetBucketNotification",
                        "s3:PutBucketCORS",
                        "s3:GetReplicationConfiguration",
                        "s3:ListMultipartUploadParts",
                        "s3:PutObject",
                        "s3:GetObject",
                        "s3:PutBucketNotification",
                        "s3:DescribeJob",
                        "s3:PutBucketLogging",
                        "s3:GetAnalyticsConfiguration",
                        "s3:PutBucketObjectLockConfiguration",
                        "s3:GetObjectVersionForReplication",
                        "s3:CreateAccessPoint",
                        "s3:GetLifecycleConfiguration",
                        "s3:GetInventoryConfiguration",
                        "s3:GetBucketTagging",
                        "s3:PutAccelerateConfiguration",
                        "s3:DeleteObjectVersion",
                        "s3:GetBucketLogging",
                        "s3:ListBucketVersions",
                        "s3:RestoreObject",
                        "s3:ListBucket",
                        "s3:GetAccelerateConfiguration",
                        "s3:GetBucketPolicy",
                        "s3:PutEncryptionConfiguration",
                        "s3:GetEncryptionConfiguration",
                        "s3:GetObjectVersionTorrent",
                        "s3:AbortMultipartUpload",
                        "s3:GetBucketRequestPayment",
                        "s3:DeleteBucketOwnershipControls",
                        "s3:GetAccessPointPolicyStatus",
                        "s3:UpdateJobPriority",
                        "s3:GetObjectTagging",
                        "s3:GetMetricsConfiguration",
                        "s3:GetBucketOwnershipControls",
                        "s3:DeleteBucket",
                        "s3:PutBucketVersioning",
                        "s3:GetBucketPublicAccessBlock",
                        "s3:ListBucketMultipartUploads",
                        "s3:PutMetricsConfiguration",
                        "s3:PutBucketOwnershipControls",
                        "s3:UpdateJobStatus",
                        "s3:GetBucketVersioning",
                        "s3:GetBucketAcl",
                        "s3:PutInventoryConfiguration",
                        "s3:GetObjectTorrent",
                        "s3:PutBucketWebsite",
                        "s3:PutBucketRequestPayment",
                        "s3:PutObjectRetention",
                        "s3:GetBucketCORS",
                        "s3:GetBucketLocation",
                        "s3:GetAccessPointPolicy",
                        "s3:ReplicateDelete",
                        "s3:GetObjectVersion",
                    ],
                    resources: [
                        "arn:aws:s3:ap-northeast-1:960722127407:accesspoint/*",
                        "arn:aws:s3:*:960722127407:job/*",
                        "arn:aws:s3:::rocket-for-bands-dev",
                        "arn:aws:s3:::rocket-for-bands-dev/*",
                    ],
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