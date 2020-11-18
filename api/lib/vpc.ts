import * as cdk from '@aws-cdk/core';
import {
    Vpc,
    SubnetType,
} from '@aws-cdk/aws-ec2';

interface VPCStackProps extends cdk.StackProps {
    appName: string
}

export class VPCStack extends cdk.Stack {
    vpc: Vpc;

    constructor(scope: cdk.Construct, id: string, props: VPCStackProps) {
        super(scope, id, props);

        const vpc: Vpc = new Vpc(this, `${props.appName}-vpc`, {
            cidr: '192.168.0.0/16',
            natGateways: 0,
            subnetConfiguration: [
                {
                    cidrMask: 24,
                    name: `${props.appName}-public1`,
                    subnetType: SubnetType.PUBLIC,
                },
                {
                    cidrMask: 24,
                    name: `${props.appName}-public2`,
                    subnetType: SubnetType.PUBLIC,
                },
                {
                    cidrMask: 24,
                    name: `${props.appName}-isolated1`,
                    subnetType: SubnetType.ISOLATED,
                },
                {
                    cidrMask: 24,
                    name: `${props.appName}-isolated2`,
                    subnetType: SubnetType.ISOLATED,
                },
            ],
        });
        this.vpc = vpc;
    }
}
