// import * as cdk from '@aws-cdk/core';
// import {
//     Vpc,
//     InstanceType,
// } from '@aws-cdk/aws-ec2';
// import {
//     EksOptimizedImage,
//     FargateCluster,
//     Cluster,
//     KubernetesVersion,
//     NodeType,
// } from '@aws-cdk/aws-eks';
// import {
//     Role,
//     ServicePrincipal,
//     ManagedPolicy,
//     PolicyStatement,
// } from '@aws-cdk/aws-iam';
// import {
//     AutoScalingGroup,
//     UpdatePolicy,
// } from '@aws-cdk/aws-autoscaling';
// import { deployment, service } from './manifest';
// import {
//     Repository,
// } from '@aws-cdk/aws-ecr';

// interface EKSStackProps extends cdk.StackProps {
//     appName: string
//     vpc: Vpc
// }

// export class EKSStack extends cdk.Stack {
//     constructor(scope: cdk.Construct, id: string, props: EKSStackProps) {
//         super(scope, id, props);

//         const eksRole = new Role(this, `${props.appName}-EKSRole`, {
//             assumedBy: new ServicePrincipal('eks.amazonaws.com'),
//             managedPolicies: [
//                 ManagedPolicy.fromAwsManagedPolicyName('AmazonEKSClusterPolicy'),
//                 ManagedPolicy.fromAwsManagedPolicyName('AmazonEKSServicePolicy'),
//             ],
//         });
//         eksRole.addToPolicy(
//             new PolicyStatement({
//                 resources: ['*'],
//                 actions: [
//                     'elasticloadbalancing:*',
//                     'ec2:CreateSecurityGroup',
//                     'ec2:Describe*',
//                 ],
//             }),
//         );

//         const workerRole = new Role(this, `${props.appName}-WorkerRole`, {
//             assumedBy: new ServicePrincipal('ec2.amazonaws.com'),
//         });

//         const cluster = new Cluster(this, `${props.appName}-cluster`, {
//             vpc: props.vpc,
//             kubectlEnabled: true,
//             defaultCapacity: 0,
//             mastersRole: eksRole,
//             version: KubernetesVersion.V1_17,
//             clusterName: `${props.appName}-cluster`,
//         });
//         cluster.addNodegroupCapacity(`${props.appName}-capacity`, {
//             desiredSize: 2,
//             instanceType: new InstanceType('t2.small'),
//         });
//         cluster.addManifest(`${props.appName}-pod`, service, deployment);

//         const ecrRepository = new Repository(this, `${props.appName}-ECR`, {
//             repositoryName: `${props.appName}`,
//         });

//         const asg = new AutoScalingGroup(this, `${props.appName}-EKS-ASG`, {
//             vpc: props.vpc,
//             role: workerRole,
//             minCapacity: 1,
//             maxCapacity: 10,
//             instanceType: new InstanceType('t3.medium'),
//             machineImage: new EksOptimizedImage({
//                 kubernetesVersion: '1.17',
//                 nodeType: NodeType.STANDARD,
//             }),
//             updatePolicy: UpdatePolicy.rollingUpdate(),
//         });
//     }
// }
