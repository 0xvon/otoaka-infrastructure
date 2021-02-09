import * as cdk from '@aws-cdk/core';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as lambda from '@aws-cdk/aws-lambda';
import * as apigw from '@aws-cdk/aws-apigateway';
import * as s3 from '@aws-cdk/aws-s3';
import { Vpc } from '@aws-cdk/aws-ec2';
import { Config } from '../typing';

interface LambdaStackProps extends cdk.StackProps {
    config: Config,
    vpc: Vpc,
    dbProxyUrl: string,
    dbSecurityGroupId: string,
}

export class LambdaStack extends cdk.Stack {
    props: LambdaStackProps;

    constructor(scope: cdk.Construct, id: string, props: LambdaStackProps) {
        super(scope, id, props);
        this.props = props;

        const bucketName: string = 'rocket-dev-lambda'

        const adminLambdaSG = new ec2.SecurityGroup(this, `${props.config.appName}-adminLambdaSG`, {
            vpc: props.vpc,
        });
        const rdsSecurityGroup = ec2.SecurityGroup.fromSecurityGroupId(this, `${this.props.config.appName}-DB-SG`, props.dbSecurityGroupId);
        rdsSecurityGroup.addIngressRule(adminLambdaSG, ec2.Port.tcp(3306), `allow ${props.config.appName} admin lambda connection`);

        const adminLambda = new lambda.Function(this, `${props.config.appName}-adminLambda`, {
            runtime: lambda.Runtime.PROVIDED_AL2,
            code: new lambda.S3Code(s3.Bucket.fromBucketName(this, `${props.config.appName}-bucket`, bucketName), 'RocketAdmin.zip'),
            handler: 'Handler',
            vpc: props.vpc,
            securityGroups: [adminLambdaSG],
            environment: {
                SNS_PLATFORM_APPLICATION_ARN: this.props.config.environment === 'prd' ? 'arn:aws:sns:ap-northeast-1:960722127407:app/APNS/rocket-ios-prod' : 'arn:aws:sns:ap-northeast-1:960722127407:app/APNS_SANDBOX/rocket-ios-dev',
                DATABASE_URL: props.dbProxyUrl,
            }
        });

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