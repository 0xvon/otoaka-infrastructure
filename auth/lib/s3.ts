import * as cdk from '@aws-cdk/core';
import {
    PolicyStatement,
    Effect,
    AnyPrincipal,
} from '@aws-cdk/aws-iam';
import {
    Bucket,
} from '@aws-cdk/aws-s3';

interface S3StackProps extends cdk.StackProps {
    appName: string,
};

export class S3Stack extends cdk.Stack {
    bucket: Bucket;
    constructor(scope: cdk.App, id: string, props: S3StackProps) {
        super(scope, id, props);

        const bucket = new Bucket(this, `${props.appName}`, {
            bucketName: `${props.appName}-storage`,
        });

        bucket.addToResourcePolicy(new PolicyStatement({
            effect: Effect.ALLOW,
            actions: [
                's3:GetObject',
            ],
            resources: [bucket.bucketArn],
            principals: [new AnyPrincipal()],
        }));
        this.bucket = bucket;
    }
}
