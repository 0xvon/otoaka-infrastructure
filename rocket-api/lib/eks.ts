import * as cdk from '@aws-cdk/core';
import {
    Vpc,
    InstanceType,
} from '@aws-cdk/aws-ec2';
import {
    FargateCluster,
    KubernetesVersion,
} from '@aws-cdk/aws-eks';
import {
    Role,
    ServicePrincipal,
    ManagedPolicy,
    PolicyStatement,
} from '@aws-cdk/aws-iam';
import { deployment, service } from './manifest';

interface EKSStackProps extends cdk.StackProps {
    appName: string
    vpc: Vpc
}

export class EKSStack extends cdk.Stack {
    constructor(scope: cdk.Construct, id: string, props: EKSStackProps) {
        super(scope, id, props);

        const eksRole = new Role(this, `${props.appName}-EKSRole`, {
            assumedBy: new ServicePrincipal('eks.amazonaws.com'),
            managedPolicies: [
                ManagedPolicy.fromAwsManagedPolicyName('AmazonEKSClusterPolicy'),
                ManagedPolicy.fromAwsManagedPolicyName('AmazonEKSServicePolicy'),
            ],
        });
        eksRole.addToPolicy(
            new PolicyStatement({
                resources: ['*'],
                actions: [
                    'elasticloadbalancing:*',
                    'ec2:CreateSecurityGroup',
                    'ec2:Describe*',
                ],
            }),
        );

        const cluster = new FargateCluster(this, `${props.appName}-cluster`, {
            vpc: props.vpc,
            mastersRole: eksRole,
            version: KubernetesVersion.V1_18,
            clusterName: `${props.appName}-cluster`,
        });
        cluster.addNodegroupCapacity(`${props.appName}-capacity`, {
            desiredSize: 2,
            instanceType: new InstanceType('t2.small'),
        });
        cluster.addManifest(`${props.appName}-pod`, service, deployment);
    }
}
