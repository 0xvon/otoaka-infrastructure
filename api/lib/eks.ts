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
// import * as FluentdManifest from './manifests/fluentd';
import { users } from '../config';

interface EKSStackProps extends cdk.StackProps {
    appName: string
    vpc: Vpc

    // clusterEndpoint: string
    // rdsSecurityGroupId: string,
    dbname: string
    rdsUsername: string
    rdsPassword: string

    awsRegion: string,
    awsAccessKeyId: string,
    awsSecretAccessKey: string,
    awsAccountId: string,
    
    githubOwner: string,
    githubRepo: string,
    githubBranch: string,

    acmCertificateArn: string,
    mackerelApiKey: string,
    configBucketName: string,
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

            return eksRole;
        })()
        
        // Admin IAM Role for EKS
        const adminRole: Role = new Role(this, `${props.appName}-EKSAdminRole`, {
            assumedBy: new AccountRootPrincipal(),
        });

        // ECR Repository
        const ecrRepository = new Repository(this, `${props.appName}-ECR`, {
            repositoryName: `${props.appName}`,
        });

        // EKS Cluster
        const cluster = new Cluster(this, `${props.appName}-cluster`, {
            vpc: props.vpc,
            vpcSubnets: [
                { subnets: props.vpc.publicSubnets },
            ],
            endpointAccess: EndpointAccess.PUBLIC,
            defaultCapacity: 0,
            role: eksRole,
            mastersRole: adminRole,
            version: KubernetesVersion.V1_18,
            clusterName: `${props.appName}-cluster`,
        });

        // Node Group
        const ng = cluster.addNodegroupCapacity(`${props.appName}-capacity`, {
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
        // this.injectSecurityGroup(cluster.clusterSecurityGroupId);

        // Auto Scaling Policy
        cluster.addAutoScalingGroupCapacity(`${props.appName}-nodes`, {
            autoScalingGroupName: `${props.appName}-EKS-ASG`,
            instanceType: new InstanceType(instanceType),
            minCapacity: minCapacity,
            maxCapacity: maxCapacity,
            vpcSubnets: { subnetType: SubnetType.PUBLIC },
            updatePolicy: UpdatePolicy.rollingUpdate(),
        });

        // Code Pipeline
        this.buildPipeline(cluster, ecrRepository);

        this.eks = cluster;
    }

    private injectContainerEnv(): [ApplicationManifest.Obj, ApplicationManifest.ContainerEnv[]] {
        var newStringData = ApplicationManifest.stringData;

        // newStringData["DATABASE_HOST"] = this.clusterEndpoint
        // newStringData["DATABASE_NAME"] = this.dbname
        // newStringData["DATABASE_PASSWORD"] = this.rdsPassword;
        // newStringData["DATABASE_USERNAME"] = this.rdsUsername;
        // newStringData["DATABASE_URL"] = `mysql://${this.rdsUsername}:${this.rdsPassword}@${this.clusterEndpoint}:3306/${this.dbname}`;
        newStringData['DATABASE_URL'] = 'mysql://mqmxmrqzd9ju4jrx:l53q2rdezr37fbvp@s0znzigqvfehvff5.cbetxkdyhwsb.us-east-1.rds.amazonaws.com:3306/k6wzwtd2rxfh67wk'
        newStringData["AWS_ACCESS_KEY_ID"] = this.props.awsAccessKeyId;
        newStringData["AWS_SECRET_ACCESS_KEY"] = this.props.awsSecretAccessKey;
        newStringData["AWS_REGION"] = this.props.awsRegion;

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
            `${this.props.appName}-pod`,
            ApplicationManifest.service(this.props.acmCertificateArn),
            ApplicationManifest.secret(newStringData),
            ApplicationManifest.deployment({
                bucketName: this.props.configBucketName,
                imageUrl: ecrRepository.repositoryUri,
                containerEnvironments: newContainerEnvironments,
                mackerelApiKey: this.props.mackerelApiKey,
            }),
            MackerelServiceAccount.serviceAccount,
            MackerelServiceAccount.clusterRole,
            MackerelServiceAccount.clusterRoleBinding,
            // FluentdManifest.daemonSet({
            //     appName: this.appName,
            // }),
            // FluentdManifest.serviceAccount,
            // FluentdManifest.clusterRole,
            // FluentdManifest.clusterRoleBinding,
        );
    }

    private addAuth(cluster: Cluster, adminRole: Role, ng: Nodegroup) {
        const awsAuth = new AwsAuth(this, `${this.props.appName}-AwsAuth`, { cluster: cluster });
        awsAuth.addRoleMapping(ng.role, {
            groups: ["system:bootstrappers", "system:nodes"],
            username: "system:node:{{EC2PrivateDNSName}}",
        });
        awsAuth.addMastersRole(adminRole, adminRole.roleName);
        users.forEach(user => { awsAuth.addMastersRole(adminRole, user) });
    }

    private injectSecurityGroup(appSGId: string, rdsSecurityGroupId: string) {
        const rdsSecurityGroup = SecurityGroup.fromSecurityGroupId(this, `${this.props.appName}-DB-SG`, rdsSecurityGroupId);
        rdsSecurityGroup.addIngressRule(
            SecurityGroup.fromSecurityGroupId(this, `APP-SG`, appSGId),
            Port.tcp(3306),
        );
    };

    private buildPipeline(cluster: Cluster, ecrRepository: Repository) {
        const githubToken = cdk.SecretValue.secretsManager('GITHUB_TOKEN')
        const sourceOutput = new Artifact();
        const sourceAction = new GitHubSourceAction({
            actionName: `${this.props.appName}-SourceAction`,
            owner: this.props.githubOwner,
            repo: this.props.githubRepo,
            oauthToken: githubToken,
            output: sourceOutput,
            branch: this.props.githubBranch,
        });

        const codeBuildProject = new PipelineProject(this, `${this.props.appName}-CodeBuildProj`, {
            projectName: `${this.props.appName}-CodeBuildProj`,
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
            actionName: `${this.props.appName}-BuildAction`,
            project: codeBuildProject,
            input: sourceOutput,
            outputs: [new Artifact()],
        })

        new Pipeline(this, `${this.props.appName}-Pipeline`, {
            pipelineName: `${this.props.appName}-Pipeline`,
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
