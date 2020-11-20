import * as cdk from '@aws-cdk/core';
import {
    Vpc,
    InstanceType,
    SubnetType,
} from '@aws-cdk/aws-ec2';
import {
    Cluster,
    EndpointAccess,
    KubernetesVersion,
    AwsAuth,
} from '@aws-cdk/aws-eks';
import {
    Role,
    ServicePrincipal,
    AccountRootPrincipal,
    ManagedPolicy,
    PolicyStatement,
    User,
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
import { appLabel, deployment, secret, service, stringData, ContainerEnv, Obj } from './manifest';
import { SSMSecret } from '../typing';
import { users } from '../config';

interface EKSStackProps extends cdk.StackProps {
    appName: string
    vpc: Vpc
    // clusterEndpoint: string
    rdsUsername: string
    rdsPassword: string
    awsAccessKeyId: string,
    awsSecretAccessKey: string,
    awsRegion: string,
    githubOwner: string
    githubRepo: string
    githubBranch: string
}

export class EKSStack extends cdk.Stack {
    eks: Cluster;
    appName: string;
    rdsUsername: string;
    rdsPassword: string;
    awsAccessKeyId: string;
    awsSecretAccessKey: string;
    awsRegion: string;
    constructor(scope: cdk.Construct, id: string, props: EKSStackProps) {
        super(scope, id, props);

        this.appName = props.appName;
        this.rdsUsername = props.rdsUsername;
        this.rdsPassword = props.rdsPassword;
        this.awsAccessKeyId = props.awsAccessKeyId;
        this.awsSecretAccessKey = props.awsSecretAccessKey;
        this.awsRegion = props.awsRegion;

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
        const adminRole = new Role(this, `${props.appName}-EKSAdminRole`, {
            assumedBy: new AccountRootPrincipal(),
        });

        const ecrRepository = new Repository(this, `${props.appName}-ECR`, {
            repositoryName: `${props.appName}`,
        });

        const cluster = new Cluster(this, `${props.appName}-cluster`, {
            vpc: props.vpc,
            vpcSubnets: [
                {
                    subnets: props.vpc.publicSubnets,
                },
            ],
            endpointAccess: EndpointAccess.PUBLIC,
            defaultCapacity: 0,
            role: eksRole,
            mastersRole: adminRole,
            version: KubernetesVersion.V1_18,
            clusterName: `${props.appName}-cluster`,
        });
        const ng = cluster.addNodegroupCapacity(`${props.appName}-capacity`, {
            desiredSize: 1,
            subnets: {
                subnets: props.vpc.publicSubnets,
            },
            instanceType: new InstanceType('t2.medium'),
        });
        ng.role.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName("service-role/AmazonEC2RoleforSSM"));
        ng.role.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName("AmazonEC2ContainerRegistryPowerUser"));
        const [ newStringData, newContainerEnvironments ] = this.injectContainerEnv();
        cluster.addManifest(`${props.appName}-pod`, service, secret(newStringData), deployment(ecrRepository.repositoryUri, newContainerEnvironments));
        const awsAuth = new AwsAuth(this, `${props.appName}-AwsAuth`, {
            cluster: cluster,
        });
        awsAuth.addRoleMapping(ng.role, {
            groups: ["system:bootstrappers", "system:nodes"],
            username: "system:node:{{EC2PrivateDNSName}}",
        });
        awsAuth.addMastersRole(
            adminRole,
            adminRole.roleName
        );
        users.forEach(user => {
            awsAuth.addUserMapping(User.fromUserName(this, user, user), {
                username: user,
                groups: ["system:masters"],
            });
        });
        this.eks = cluster;

        cluster.addAutoScalingGroupCapacity(`${props.appName}-nodes`, {
            autoScalingGroupName: `${props.appName}-EKS-ASG`,
            instanceType: new InstanceType('t3.medium'),
            minCapacity: 1,
            maxCapacity: 10,
            vpcSubnets: {
                subnets: props.vpc.publicSubnets,
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
                'ROLE_ARN': {
                    value: `${adminRole.roleArn}`,
                }
            },
            buildSpec: BuildSpec.fromObject({
                version: "0.2",
                phases: {
                    pre_build: {
                        commands: [
                            'env',
                            'export TAG=latest',
                            '$(aws ecr get-login --no-include-email)',
                            'aws eks update-kubeconfig --name $CLUSTER_NAME --role-arn $ROLE_ARN',
                            'kubectl get no',
                        ],
                    },
                    build: {
                        commands: [
                            'docker build -t $ECR_REPO_URI:$TAG .',
                            'docker push $ECR_REPO_URI:$TAG',
                        ],
                    },
                    post_build: {
                        commands: [
                            'kubectl get no',
                            'kubectl set image deployment $APP_NAME $APP_NAME=$ECR_REPO_URI:$TAG',
                        ],
                    },
                },
            })
        });
        ecrRepository.grantPullPush(codeBuildProject.role!);
        cluster.awsAuth.addMastersRole(codeBuildProject.role!);
        codeBuildProject.addToRolePolicy(new PolicyStatement({
            actions: ['eks:DescribeCluster'],
            resources: [`${cluster.clusterArn}`],
        }));
        codeBuildProject.addToRolePolicy(new PolicyStatement({
            actions: [
                'ecr:GetAuthorizationToken',
                'ecr:BatchCheckLayerAvailability',
                'ecr:CompleteLayerUpload',
                'ecr:InitiateLayerUpload',
                'ecr:PutImage',
                'ecr:UploadLayerPart',
                'sts:AssumeRole',
            ],
            resources: ['*'],
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

    private injectContainerEnv(): [Obj, ContainerEnv[]] {
        var newStringData = stringData;

        newStringData["DATABASE_HOST"] = "s0znzigqvfehvff5.cbetxkdyhwsb.us-east-1.rds.amazonaws.com";
        newStringData["DATABASE_NAME"] = "k6wzwtd2rxfh67wk";
        newStringData["DATABASE_PASSWORD"] = "l53q2rdezr37fbvp";
        newStringData["DATABASE_USERNAME"] = "mqmxmrqzd9ju4jrx";
        newStringData["AWS_ACCESS_KEY_ID"] = this.awsAccessKeyId;
        newStringData["AWS_SECRET_ACCESS_KEY"] = this.awsSecretAccessKey;
        newStringData["AWS_REGION"] = this.awsRegion;
        newStringData["SNS_PLATFORM_APPLICATION_ARN"] = "arn:aws:sns:ap-northeast-1:960722127407:app/APNS_SANDBOX/rocket-ios-dev";

        const containerEnvironments: ContainerEnv[] = Object.keys(newStringData).map(key => {
            return {
                name: key,
                valueFrom: {
                    secretKeyRef: {
                        name: 'api',
                        key: newStringData[key],
                    },
                },
            };
        })

        return [ newStringData, containerEnvironments ];
    }
}
