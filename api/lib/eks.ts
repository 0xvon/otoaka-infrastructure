import * as cdk from '@aws-cdk/core';
import {
    Vpc,
    InstanceType,
    SubnetType,
} from '@aws-cdk/aws-ec2';
import {
    Cluster,
    KubernetesVersion,
} from '@aws-cdk/aws-eks';
import {
    Role,
    ServicePrincipal,
    ManagedPolicy,
    PolicyStatement,
} from '@aws-cdk/aws-iam';
import {
    UpdatePolicy,
} from '@aws-cdk/aws-autoscaling';
import {
    Repository,
} from '@aws-cdk/aws-ecr';
import {
    LinuxBuildImage,
    BuildSpec,
    PipelineProject,
} from '@aws-cdk/aws-codebuild';
import {
    Artifact, Pipeline,
} from '@aws-cdk/aws-codepipeline';
import {
    GitHubSourceAction,
    CodeBuildAction,
} from '@aws-cdk/aws-codepipeline-actions';
import { appLabel, deployment, service } from './manifest';

interface EKSStackProps extends cdk.StackProps {
    appName: string
    vpc: Vpc
    clusterEndpoint: string
    rdsUsername: string
    rdsPassword: string
    githubOwner: string
    githubRepo: string
    githubBranch: string
}

export class EKSStack extends cdk.Stack {
    eks: Cluster;
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

        const workerRole = new Role(this, `${props.appName}-WorkerRole`, {
            assumedBy: new ServicePrincipal('ec2.amazonaws.com'),
        });

        const cluster = new Cluster(this, `${props.appName}-cluster`, {
            vpc: props.vpc,
            kubectlEnabled: true,
            defaultCapacity: 0,
            mastersRole: eksRole,
            version: KubernetesVersion.V1_17,
            clusterName: `${props.appName}-cluster`,
        });
        cluster.addNodegroupCapacity(`${props.appName}-capacity`, {
            desiredSize: 2,
            instanceType: new InstanceType('t2.small'),
        });
        cluster.addManifest(`${props.appName}-pod`, service, deployment);
        this.eks = cluster;

        const ecrRepository = new Repository(this, `${props.appName}-ECR`, {
            repositoryName: `${props.appName}`,
        });

        cluster.addAutoScalingGroupCapacity(`${props.appName}-nodes`, {
            autoScalingGroupName: `${props.appName}-EKS-ASG`,
            instanceType: new InstanceType('t3.medium'),
            minCapacity: 1,
            maxCapacity: 10,
            vpcSubnets: {
                subnetType: SubnetType.PUBLIC,
            },
            updatePolicy: UpdatePolicy.rollingUpdate(),
        });

        const githubToken = cdk.SecretValue.secretsManager('GITHUB_TOKEN')

        const sourceOutput = new Artifact();
        const sourceAction = new GitHubSourceAction({
            actionName: `${props.appName}-SourceAction`,
            owner: props.githubOwner,
            repo: props.githubRepo,
            oauthToken: githubToken,
            output: sourceOutput,
            branch: props.githubBranch,
        });

        const codeBuildProject = new PipelineProject(this, `${props.appName}-CodeBuildProj`, {
            projectName: `${props.appName}-CodeBuildProj`,
            environment: {
                buildImage: LinuxBuildImage.AMAZON_LINUX_2_3,
                privileged: true,
            },
            environmentVariables: {
                'CLUSTER_NAME': {
                    value: `${cluster.clusterName}`,
                },
                'ECR_REPO_URI': {
                    value: `${ecrRepository.repositoryUri}`,
                },
                'APP_NAME': {
                    value: `${appLabel.app}`,
                },
            },
            buildSpec: BuildSpec.fromObject({
                version: "0.2",
                phases: {
                    pre_build: {
                        commands: [
                            'env',
                            'export TAG=${CODEBUILD_RESOLVED_SOURCE_VERSION}',
                            // '/usr/local/bin/entrypoint.sh',
                        ],
                    },
                    build: {
                        commands: [
                            'docker build -t $ECR_REPO_URI:$TAG .',
                            '$(aws ecr get-login --no-include-email)',
                            'docker push $ECR_REPO_URI:$TAG',
                        ],
                    },
                    post_build: {
                        commands: [
                            'kubectl get no',
                            'kubectl set image deployment $APP_NAME $APP_NAME=$ECR_REPO_URI:$TAG'
                        ],
                    },
                },
            })
        });
        cluster.awsAuth.addMastersRole(codeBuildProject.role!);
        codeBuildProject.addToRolePolicy(new PolicyStatement({
            actions: ['eks:DescribeCluster'],
            resources: [`${cluster.clusterArn}`],
        }));

        const buildAction = new CodeBuildAction({
            actionName: `${props.appName}-BuildAction`,
            project: codeBuildProject,
            input: sourceOutput,
            outputs: [new Artifact()],
        })

        const pipeline = new Pipeline(this, `${props.appName}-Pipeline`, {
            pipelineName: `${props.appName}-Pipeline`,
            stages: [
                {
                    stageName: 'Source',
                    actions: [sourceAction],
                },
                {
                    stageName: 'Build',
                    actions: [buildAction],
                },
            ],
        });
    }
}
