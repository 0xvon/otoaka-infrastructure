import * as cdk from '@aws-cdk/core';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as lambda from '@aws-cdk/aws-lambda';
import * as apigw from '@aws-cdk/aws-apigateway';
import * as rds from '@aws-cdk/aws-rds';
import * as s3 from '@aws-cdk/aws-s3';
import * as secrets from '@aws-cdk/aws-secretsmanager';
import { Vpc } from '@aws-cdk/aws-ec2';
import { Secret } from '@aws-cdk/aws-secretsmanager';
import { Config } from '../typing';
import { DatabaseInstance, DatabaseProxy } from '@aws-cdk/aws-rds';

interface LambdaStackProps extends cdk.StackProps {
    config: Config,
    vpc: Vpc,
    dbSecret: Secret,
    dbProxy: DatabaseProxy,
    rdsInstancde: DatabaseInstance,
    rdsDBName: string,
    rdsUserName: string,
}

export class LambdaStack extends cdk.Stack {
    props: LambdaStackProps;

    constructor(scope: cdk.Construct, id: string, props: LambdaStackProps) {
        super(scope, id, props);
        this.props = props;

        const bucketName: string = 'rocket-dev-lambda'

        const adminLambda = new lambda.Function(this, `${props.config.appName}-adminLambda`, {
            runtime: lambda.Runtime.PROVIDED_AL2,
            code: new lambda.S3Code(s3.Bucket.fromBucketName(this, `${props.config.appName}-bucket`, bucketName), 'RocketAdmin.zip'),
            handler: 'Handler',
            vpc: props.vpc,
            securityGroups: [],
            environment: {
                AWS_ACCESS_KEY_ID: props.config.awsAccessKeyId,
                AWS_SECRET_ACCESS_KEY: props.config.awsSecretAccessKey,
                AWS_REGION: props.config.awsRegion,
                SNS_PLATFORM_APPLICATION_ARN: this.props.config.environment === 'prd' ? 'arn:aws:sns:ap-northeast-1:960722127407:app/APNS/rocket-ios-prod' : 'arn:aws:sns:ap-northeast-1:960722127407:app/APNS_SANDBOX/rocket-ios-dev',
                DATABASE_URL: props.dbProxy.endpoint,
            }
        });

        props.dbSecret.grantRead(adminLambda);

        const restApi = new apigw.RestApi(this, 'RestApi', {
            restApiName: `${props.config.appName}-admin`,
            apiKeySourceType: apigw.ApiKeySourceType.HEADER,
            deployOptions: {
              stageName: props.config.environment,
            },
        });

        const adminLambdaIntegration = new apigw.LambdaIntegration(adminLambda);
        const adminResource = restApi.root.addResource('admin');
        adminResource.addMethod('POST', adminLambdaIntegration);
    }
}