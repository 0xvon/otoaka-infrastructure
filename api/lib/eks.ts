import * as cdk from '@aws-cdk/core';
import {
    Vpc,
    InstanceType,
    SecurityGroup,
    Port,
    SubnetType,
} from '@aws-cdk/aws-ec2';
import {
    Cluster,
    EndpointAccess,
    KubernetesVersion,
    AwsAuth,
    Nodegroup,
} from '@aws-cdk/aws-eks';
import {
    Role,
    ServicePrincipal,
    AccountRootPrincipal,
    ManagedPolicy,
    PolicyStatement,
} from '@aws-cdk/aws-iam';
import { UpdatePolicy } from '@aws-cdk/aws-autoscaling';
import { Repository } from '@aws-cdk/aws-ecr';
import { LinuxBuildImage, BuildSpec, PipelineProject } from '@aws-cdk/aws-codebuild';
import { Artifact, Pipeline } from '@aws-cdk/aws-codepipeline';
import { GitHubSourceAction, CodeBuildAction } from '@aws-cdk/aws-codepipeline-actions';

import * as ApplicationManifest from './manifests/application';
import * as MackerelServiceAccount from './manifests/mackerel-serviceaccount';
import * as FluentdManifest from './manifests/fluentd';
import { users } from '../config';
import { Config } from '../typing';

interface EKSStackProps extends cdk.StackProps {
    config: Config,
    vpc: Vpc,
    mysqlUrl?: string,
    mysqlSecurityGroupId?: string,
}

export class EKSStack extends cdk.Stack {
    eks: Cluster;
    props: EKSStackProps;

    constructor(scope: cdk.Construct, id: string, props: EKSStackProps) {
        super(scope, id, props);
        this.props = props

        const instanceType = 'm5.large';
        const minCapacity = 1;
        const maxCapacity = 10;

        // IAM Role for EKS
        const eksRole: Role = (() => {
            const eksRole = new Role(this, `${props.config.appName}-EKSRole`, {
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

            return eksRole;
        })()
        
        // Admin IAM Role for EKS
        const adminRole: Role = new Role(this, `${props.config.appName}-EKSAdminRole`, {
            assumedBy: new AccountRootPrincipal(),
        });

        // ECR Repository
        const ecrRepository = new Repository(this, `${props.config.appName}-ECR`, {
            repositoryName: `${props.config.appName}`,
        });

        // EKS Cluster
        const cluster = new Cluster(this, `${props.config.appName}-cluster`, {
            vpc: props.vpc,
            vpcSubnets: [
                { subnets: props.vpc.publicSubnets },
            ],
            endpointAccess: EndpointAccess.PUBLIC,
            defaultCapacity: 0,
            role: eksRole,
            mastersRole: adminRole,
            version: KubernetesVersion.V1_18,
            clusterName: `${props.config.appName}-cluster`,
        });

        // Node Group
        const ng = cluster.addNodegroupCapacity(`${props.config.appName}-capacity`, {
            desiredSize: minCapacity,
            subnets: { subnetType: SubnetType.PUBLIC },
            instanceType: new InstanceType(instanceType),
        });
        ["service-role/AmazonEC2RoleforSSM", "AmazonEC2ContainerRegistryPowerUser", "CloudWatchLogsFullAccess"].forEach((policyName) => {
            ng.role.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName(policyName));
        });

        // add manifest for cluster
        this.addManifest(cluster, ecrRepository);

        // add aws-auth for cluster
        this.addAuth(cluster, adminRole, ng);
        
        // Inject RDS Inbound Security Group Rule
        if (props.mysqlSecurityGroupId) {
            this.injectSecurityGroup(cluster.clusterSecurityGroupId, props.mysqlSecurityGroupId);
        }

        // Auto Scaling Policy
        // const asg = cluster.addAutoScalingGroupCapacity(`${props.config.appName}-nodes`, {
        //     autoScalingGroupName: `${props.config.appName}-EKS-ASG`,
        //     instanceType: new InstanceType(instanceType),
        //     minCapacity: minCapacity,
        //     maxCapacity: maxCapacity,
        //     vpcSubnets: { subnetType: SubnetType.PUBLIC },
        //     updatePolicy: UpdatePolicy.rollingUpdate(),
        // });
        // cluster.connectAutoScalingGroupCapacity(asg, {});

        // Code Pipeline
        this.buildPipeline(cluster, ecrRepository);

        this.eks = cluster;
    }

    private injectContainerEnv(): [ApplicationManifest.Obj, ApplicationManifest.ContainerEnv[]] {
        var newStringData = ApplicationManifest.stringData;
        
        // inject open/dynamic environment variables
        newStringData["DATABASE_URL"] = this.props.mysqlUrl ?? 'mysql://mqmxmrqzd9ju4jrx:l53q2rdezr37fbvp@s0znzigqvfehvff5.cbetxkdyhwsb.us-east-1.rds.amazonaws.com:3306/k6wzwtd2rxfh67wk';
        newStringData["AWS_ACCESS_KEY_ID"] = this.props.config.awsAccessKeyId;
        newStringData["AWS_SECRET_ACCESS_KEY"] = this.props.config.awsSecretAccessKey;
        newStringData["AWS_REGION"] = this.props.config.awsRegion;
        newStringData["LOG_LEVEL"] = 'INFO';
        newStringData["CONGNITO_IDP_USER_POOL_ID"] = this.props.config.environment === 'prd' ? 'ap-northeast-1_9vZdbAQB5' : 'ap-northeast-1_cZhPmp0Td';
        newStringData["SNS_PLATFORM_APPLICATION_ARN"] = this.props.config.environment === 'prd' ? 'arn:aws:sns:ap-northeast-1:960722127407:app/APNS/rocket-ios-prod' : 'arn:aws:sns:ap-northeast-1:960722127407:app/APNS_SANDBOX/rocket-ios-dev';

        const containerEnvironments: ApplicationManifest.ContainerEnv[] = Object.keys(newStringData).map(key => {
            return {
                name: key,
                valueFrom: {
                    secretKeyRef: {
                        name: 'api',
                        key: key,
                    },
                },
            };
        })

        return [ newStringData, containerEnvironments ];
    }

    private addManifest(cluster: Cluster, ecrRepository: Repository) {
        const [ newStringData, newContainerEnvironments ] = this.injectContainerEnv();
        cluster.addManifest(
            `${this.props.config.appName}-pod`,
            ApplicationManifest.service(this.props.config.acmCertificateArn),
            ApplicationManifest.secret(newStringData),
            ApplicationManifest.deployment({
                mackerelConfigPath: 's3:/rocket-config/api/mackerel-config.yaml',
                imageUrl: ecrRepository.repositoryUri,
                containerEnvironments: newContainerEnvironments,
                mackerelApiKey: this.props.config.mackerelApiKey,
            }),
            MackerelServiceAccount.serviceAccount,
            MackerelServiceAccount.clusterRole,
            MackerelServiceAccount.clusterRoleBinding,
            FluentdManifest.daemonSet({
                appName: this.props.config.appName,
            }),
            FluentdManifest.serviceAccount,
            FluentdManifest.clusterRole,
            FluentdManifest.clusterRoleBinding,
        );
    }

    private addAuth(cluster: Cluster, adminRole: Role, ng: Nodegroup) {
        const awsAuth = new AwsAuth(this, `${this.props.config.appName}-AwsAuth`, { cluster: cluster });
        awsAuth.addRoleMapping(ng.role, {
            groups: ["system:bootstrappers", "system:nodes"],
            username: "system:node:{{EC2PrivateDNSName}}",
        });
        awsAuth.addMastersRole(adminRole, adminRole.roleName);
        users.forEach(user => { awsAuth.addMastersRole(adminRole, user) });
    }

    private injectSecurityGroup(appSGId: string, rdsSecurityGroupId: string) {
        const rdsSecurityGroup = SecurityGroup.fromSecurityGroupId(this, `${this.props.config.appName}-DB-SG`, rdsSecurityGroupId);
        rdsSecurityGroup.addIngressRule(
            SecurityGroup.fromSecurityGroupId(this, `APP-SG`, appSGId),
            Port.tcp(3306),
        );
    };

    private buildPipeline(cluster: Cluster, ecrRepository: Repository) {
        const githubOwner = 'wall-of-death';
        const githubRepo = 'rocket-api';
        const githubBranch = this.props.config.environment === 'prd' ? 'master' : 'master';
        const githubToken = cdk.SecretValue.secretsManager('GITHUB_TOKEN')

        const sourceOutput = new Artifact();
        const sourceAction = new GitHubSourceAction({
            actionName: `${this.props.config.appName}-SourceAction`,
            owner: githubOwner,
            repo: githubRepo,
            oauthToken: githubToken,
            output: sourceOutput,
            branch: githubBranch,
        });

        const codeBuildProject = new PipelineProject(this, `${this.props.config.appName}-CodeBuildProj`, {
            projectName: `${this.props.config.appName}-CodeBuildProj`,
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
                    value: `${ApplicationManifest.appLabel.app}`,
                },
                'ROLE_ARN': {
                    value: `${cluster.adminRole.roleArn}`,
                },
                'DOCKER_BUILDKIT': {
                    value: '1',
                },
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
            actionName: `${this.props.config.appName}-BuildAction`,
            project: codeBuildProject,
            input: sourceOutput,
            outputs: [new Artifact()],
        })

        new Pipeline(this, `${this.props.config.appName}-Pipeline`, {
            pipelineName: `${this.props.config.appName}-Pipeline`,
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
