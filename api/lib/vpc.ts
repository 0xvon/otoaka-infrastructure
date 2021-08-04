import * as cdk from '@aws-cdk/core';
import {
    Vpc,
    SubnetType,
    NatProvider,
    GatewayVpcEndpointOptions,
    GatewayVpcEndpointAwsService,
} from '@aws-cdk/aws-ec2';

interface VPCStackProps extends cdk.StackProps {
    appName: string,
};

export class VPCStack extends cdk.Stack {
    vpc: Vpc;

    constructor(scope: cdk.Construct, id: string, props: VPCStackProps) {
        super(scope, id, props);

        const vpc: Vpc = new Vpc(this, `${props.appName}-vpc`, {
            cidr: '192.168.0.0/16',
            maxAzs: 2,
            natGateways: 1,
            natGatewayProvider: NatProvider.gateway(),
            gatewayEndpoints: {
                's3': {
                    service: GatewayVpcEndpointAwsService.S3,
                    subnets: [
                        {
                            subnetType: SubnetType.PRIVATE,
                        },
                    ],
                },
            },
            subnetConfiguration: [
                {
                    cidrMask: 24,
                    name: `${props.appName}-app`,
                    subnetType: SubnetType.PUBLIC,
                },
                {
                    cidrMask: 24,
                    name: `${props.appName}-rds`,
                    subnetType: SubnetType.PRIVATE,
                },
            ],
        });
        // vpc.publicSubnets.forEach(subnet => {
        //     cdk.Tags.of(subnet).add(`kubernetes.io/cluster/${props.appName}-cluster`, 'shared');
        //     cdk.Tags.of(subnet).add(`kubernetes.io/role/elb`, '1');
        // });
        this.vpc = vpc;
    }
}
