import * as cdk from '@aws-cdk/core';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as lambda from '@aws-cdk/aws-lambda';
import * as apigw from '@aws-cdk/aws-apigateway';
import * as iam from '@aws-cdk/aws-iam';
import * as s3 from '@aws-cdk/aws-s3';
import { Config } from '../typing';

interface LambdaStackProps extends cdk.StackProps {
    config: Config,
    vpcId: string,
    dbProxyUrl: string,
    dbSecurityGroupId: string,
}

export class LambdaStack extends cdk.Stack {
    props: LambdaStackProps;

    constructor(scope: cdk.Construct, id: string, props: LambdaStackProps) {
        super(scope, id, props);
        this.props = props;

        const bucketName: string = 'rocket-dev-lambda';
        const snsPlatformArn: string = this.props.config.environment === 'prd' ? 'arn:aws:sns:ap-northeast-1:960722127407:app/APNS/rocket-ios-prod' : 'arn:aws:sns:ap-northeast-1:960722127407:app/APNS_SANDBOX/rocket-ios-dev';
        const vpc = ec2.Vpc.fromLookup(this, 'vpc', { vpcId: props.vpcId });

        const adminLambdaSG = new ec2.SecurityGroup(this, `${props.config.appName}-adminLambdaSG`, {
            vpc: vpc,
        });
        const rdsSecurityGroup = ec2.SecurityGroup.fromSecurityGroupId(this, `${this.props.config.appName}-DB-SG`, props.dbSecurityGroupId);
        rdsSecurityGroup.addIngressRule(adminLambdaSG, ec2.Port.tcp(3306), `allow ${props.config.appName} admin lambda connection`);

        const adminLambdaRole = new iam.Role(this, `${props.config.appName}-adminLambdaRole`, {
            assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
        });
        adminLambdaRole.addToPolicy(new iam.PolicyStatement({
            actions: ['SNS:Publish'],
            resources: [snsPlatformArn],
        }))
        adminLambdaRole.addToPolicy(new iam.PolicyStatement({
            actions: [
                "logs:CreateLogGroup",
                "logs:CreateLogStream",
                "logs:PutLogEvents",
                "ec2:CreateNetworkInterface",
                "ec2:DescribeNetworkInterfaces",
                "ec2:DeleteNetworkInterface",
                "ec2:AssignPrivateIpAddresses",
                "ec2:UnassignPrivateIpAddresses",
            ],
            resources: ['*'],
        }))

        const adminLambda = new lambda.Function(this, `${props.config.appName}-adminLambda`, {
            runtime: lambda.Runtime.PROVIDED_AL2,
            code: new lambda.S3Code(s3.Bucket.fromBucketName(this, `${props.config.appName}-bucket`, bucketName), 'RocketAdmin.zip'),
            handler: 'Handler',
            vpc: vpc,
            vpcSubnets: {
                subnets: vpc.privateSubnets,
            },
            timeout: cdk.Duration.seconds(300),
            securityGroups: [adminLambdaSG],
            role: adminLambdaRole,
            environment: {
                SNS_PLATFORM_APPLICATION_ARN: snsPlatformArn,
                DATABASE_URL: props.dbProxyUrl,
                AWS_ACCESS_KEY_ID_TMP: props.config.awsAccessKeyId,
                AWS_SECRET_ACCESS_KEY_TMP: props.config.awsSecretAccessKey,
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
        adminResource.addMethod('POST', adminLambdaIntegration, { apiKeyRequired: true });
        restApi.addApiKey('ApiKey', { apiKeyName: `${props.config.appName}-gas` });
    }
}