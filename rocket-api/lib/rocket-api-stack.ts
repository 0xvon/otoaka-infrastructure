import * as cdk from '@aws-cdk/core';
import {
    Vpc,
    SubnetType,
    SecurityGroup,
    Peer,
    Port,
} from '@aws-cdk/aws-ec2';
import {
    ApplicationLoadBalancer,
    ApplicationProtocol,
    ApplicationTargetGroup,
} from '@aws-cdk/aws-elasticloadbalancingv2';
import { Duration } from '@aws-cdk/core';

require('dotenv').config();

const appName = process.env.APP_NAME;

export class RocketApiStack extends cdk.Stack {
    constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        // VPC and subnets
        const vpc = new Vpc(this, `${appName}-vpc`, {
            cidr: '192.168.0.0/16',
            subnetConfiguration: [
                {
                    cidrMask: 24,
                    name: `${appName}-public1`,
                    subnetType: SubnetType.PUBLIC,
                },
                {
                    cidrMask: 24,
                    name: `${appName}-public2`,
                    subnetType: SubnetType.PUBLIC,
                },
                {
                    cidrMask: 24,
                    name: `${appName}-private1`,
                    subnetType: SubnetType.PRIVATE,
                },
                {
                    cidrMask: 24,
                    name: `${appName}-private2`,
                    subnetType: SubnetType.PRIVATE,
                },
            ],
        });

        // Security Group for ALB
        const albSecurityGroup = new SecurityGroup(this, `${appName}-ALB-SG`, {
            allowAllOutbound: true,
            securityGroupName: `${appName}-ALB-SG`,
            vpc,
        });
        albSecurityGroup.addIngressRule(Peer.anyIpv4(), Port.tcp(80));

        // ALB
        const alb = new ApplicationLoadBalancer(this, `${appName}-ALB`, {
            internetFacing: true,
            loadBalancerName: `${appName}-ALB`,
            securityGroup: albSecurityGroup,
            vpc,
            vpcSubnets: {
                subnets: vpc.publicSubnets,
            },
        });

        // Target Group
        const targetGroup = new ApplicationTargetGroup(this, `${appName}-TG`, {
            healthCheck: {
                healthyHttpCodes: '200',
                healthyThresholdCount: 2,
                interval: Duration.seconds(30),
                path: '/',
                timeout: Duration.seconds(5),
                unhealthyThresholdCount: 2,
            },
            port: 80,
            protocol: ApplicationProtocol.HTTP,
            targetGroupName: `${appName}-TG`,
            vpc,
        });
        alb.addListener(`${appName}-listener80`, {
            defaultTargetGroups: [targetGroup],
            open: true,
            port: 80,
        });
    }
}
