import * as cdk from '@aws-cdk/core';
import { Vpc, SubnetType } from '@aws-cdk/aws-ec2';

require('dotenv').config();

const appName = process.env.APP_NAME;

export class RocketApiStack extends cdk.Stack {
    constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        const vpc = new Vpc(this, `${appName}-vpc`, {
            cidr: '192.168.0.0/16',
            subnetConfiguration: [
                {
                    cidrMask: 24,
                    name: `${appName}-public1`,
                    subnetType: SubnetType.PUBLIC,
                },
            ],
        });
    }
}
