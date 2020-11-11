import * as cdk from '@aws-cdk/core';
import {
    Vpc,
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

interface ALBStackProps extends cdk.StackProps {
    appName: string
    vpc: Vpc
}

export class ALBStack extends cdk.Stack {
    constructor(scope: cdk.Construct, id: string, props: ALBStackProps) {
        super(scope, id, props);

        const albSecurityGroup = new SecurityGroup(this, `${props.appName}-ALB-SG`, {
            allowAllOutbound: true,
            securityGroupName: `${props.appName}-ALB-SG`,
            vpc: props.vpc,
        });
        albSecurityGroup.addIngressRule(
            Peer.anyIpv4(),
            Port.tcp(80),
            'allow http access from alb',
        );

        const alb = new ApplicationLoadBalancer(this, `${props.appName}-ALB`, {
            internetFacing: true,
            loadBalancerName: `${props.appName}-ALB`,
            securityGroup: albSecurityGroup,
            vpc: props.vpc,
            vpcSubnets: {
                subnets: props.vpc.publicSubnets,
                onePerAz: true,
            },
        });

        // const targetGroup = new ApplicationTargetGroup(this, `${props.appName}-TG`, {
        //     healthCheck: {
        //         healthyHttpCodes: '200',
        //         healthyThresholdCount: 2,
        //         interval: Duration.seconds(30),
        //         path: '/',
        //         timeout: Duration.seconds(5),
        //         unhealthyThresholdCount: 2,
        //     },
        //     port: 80,
        //     protocol: ApplicationProtocol.HTTP,
        //     targetGroupName: `${props.appName}-TG`,
        //     vpc: props.vpc,
        // });
        // alb.addListener(`${props.appName}-listener80`, {
        //     defaultTargetGroups: [targetGroup],
        //     open: true,
        //     port: 80,
        // });
    }
}
