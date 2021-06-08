import * as cdk from '@aws-cdk/core';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as ecs from '@aws-cdk/aws-ecs';
import * as iam from '@aws-cdk/aws-iam';
import { Repository } from '@aws-cdk/aws-ecr';
import { LinuxBuildImage, BuildSpec, PipelineProject } from '@aws-cdk/aws-codebuild';
import { Artifact, Pipeline } from '@aws-cdk/aws-codepipeline';
import { GitHubSourceAction, CodeBuildAction } from '@aws-cdk/aws-codepipeline-actions';
import {
    LogGroup,
} from '@aws-cdk/aws-logs';
import { Config } from '../typing';
import * as ecsPatterns from '@aws-cdk/aws-ecs-patterns';
import { Certificate } from '@aws-cdk/aws-certificatemanager';
import { HostedZone } from '@aws-cdk/aws-route53';

interface ECSStackProps extends cdk.StackProps {
    config: Config,
    vpc: ec2.Vpc,
    mysqlUrl?: string,
    mysqlSecurityGroupId?: string,
}

export class ECSStack extends cdk.Stack {
    props: ECSStackProps;

    constructor(scope: cdk.Construct, id: string, props: ECSStackProps) {
        super(scope, id, props);
        this.props = props;

        const cpuSize = 1;
        const memorySize = 2;

        // const executionRole = new iam.Role(this, `ECSTackExecutionRole`, {
        //     roleName: `${props.config.appName}-TaskExecutionRole`,
        //     assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
        //     managedPolicies: [
        //         iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy'),
        //     ],
        // });

        // const serviceTaskRole = new iam.Role(this, `ECSServiceTaskRole`, {
        //     roleName: `${props.config.appName}-ServiceTaskRole`,
        //     assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
        // });

        // const logGroup = new LogGroup(this, `ECSLogGroup`, {
        //     logGroupName: this.node.tryGetContext('serviceName'),
        // });

        // const taskDefinition = new ecs.FargateTaskDefinition(this, 'TaskDefinition', {
        //     family: this.node.tryGetContext('serviceName'),
        //     cpu: cpuSize,
        //     memoryLimitMiB: memorySize,
        //     executionRole: executionRole,
        //     taskRole: serviceTaskRole,
        // });

        // taskDefinition.addContainer('TaskContainerDefinition', {
        //     image: ecs.ContainerImage.fromEcrRepository(ecrRepository),
        //     cpu: cpuSize,
        //     memoryLimitMiB: memorySize,
        //     memoryReservationMiB: memorySize,
        //     secrets: {}, // TODO
        //     logging: ecs.LogDriver.awsLogs({
        //         streamPrefix: this.node.tryGetContext('serviceName'),
        //         logGroup,
        //     })
        // }).addPortMappings({
        //     containerPort: 8080,
        //     hostPort: 8080,
        //     protocol: ecs.Protocol.TCP,
        // });

        // const service = new ecs.FargateService(this, `ECSService`, {
        //     cluster: cluster,
        //     assignPublicIp: true,
        //     vpcSubnets: { subnets: props.vpc.publicSubnets },
        //     serviceName: `app`,
        //     desiredCount: 1,
        //     taskDefinition: taskDefinition,
        // });

        // const ecrRepository = new Repository(this, `ECR`, {
        //     repositoryName: `${props.config.appName}`,
        // });

        const application = new ecsPatterns.ApplicationLoadBalancedFargateService(this, 'ecs-service', {
            vpc: props.vpc,
            platformVersion: ecs.FargatePlatformVersion.VERSION1_4,
            memoryLimitMiB: memorySize,
            cpu: cpuSize,

            assignPublicIp: true,
            publicLoadBalancer: true,
            taskImageOptions: {
                image: ecs.ContainerImage.fromRegistry("amazon/amazon-ecs-sample"),
            },

            // domainZone: HostedZone.fromLookup(this, 'hostZone', {domainName: props.config.domainZone}),
            // domainName: props.config.domainName,
            // certificate: Certificate.fromCertificateArn(this, 'certificate', props.config.acmCertificateArn),
        });

        // if (props.mysqlSecurityGroupId) {
        //     this.injectSecurityGroup(application.loadBalancer.loadBalancerSecurityGroups, props.mysqlSecurityGroupId);
        // }
    }

    // private injectSecurityGroup(appSGIds: string[], rdsSecurityGroupId: string) {
    //     const rdsSecurityGroup = ec2.SecurityGroup.fromSecurityGroupId(this, `${this.props.config.appName}-DB-SG`, rdsSecurityGroupId);
    //     appSGIds.forEach((appSGId) => {
    //         rdsSecurityGroup.addIngressRule(
    //             ec2.SecurityGroup.fromSecurityGroupId(this, `APP-SG`, appSGId),
    //             ec2.Port.tcp(3306),
    //         );
    //     })
    // };

    // private buildPipeline(cluster: ecs.Cluster, ecrRepository: Repository) {
    //     const githubOwner = 'wall-of-death';
    //     const githubRepo = 'rocket-api';
    //     const githubBranch = this.props.config.environment === 'prd' ? 'master' : 'develop';
    //     const githubToken = cdk.SecretValue.secretsManager('GITHUB_TOKEN')

    //     const sourceOutput = new Artifact();
    //     const sourceAction = new GitHubSourceAction({
    //         actionName: `${this.props.config.appName}-SourceAction`,
    //         owner: githubOwner,
    //         repo: githubRepo,
    //         oauthToken: githubToken,
    //         output: sourceOutput,
    //         branch: githubBranch,
    //     });

    //     const codeBuildProject = new PipelineProject(this, `${this.props.config.appName}-CodeBuildProj`, {
    //         projectName: `${this.props.config.appName}-CodeBuildProj`,
    //         environment: {
    //             buildImage: LinuxBuildImage.AMAZON_LINUX_2_3,
    //             privileged: true,
    //         },
    //         environmentVariables: {
    //             'CLUSTER_NAME': {
    //                 value: `${cluster.clusterName}`,
    //             },
    //             'ECR_REPO_URI': {
    //                 value: `${ecrRepository.repositoryUri}`,
    //             },
    //             'APP_NAME': {
    //                 value: 'api',
    //             },
    //             'DOCKER_BUILDKIT': {
    //                 value: '1',
    //             },
    //         },
    //         buildSpec: BuildSpec.fromObject({
    //             version: "0.2",
    //             phases: {
    //                 pre_build: {
    //                     commands: [
    //                         'env',
    //                         'export TAG=latest',
    //                         'aws ecr get-login-password --region ap-northeast-1 | docker login --username AWS --password-stdin 960722127407.dkr.ecr.ap-northeast-1.amazonaws.com',
    //                     ],
    //                 },
    //                 build: {
    //                     commands: [
    //                         'docker build -t $ECR_REPO_URI:$TAG .',
    //                         'docker push $ECR_REPO_URI:$TAG',
    //                     ],
    //                 },
    //                 post_build: {
    //                     commands: [
    //                         'kubectl rollout restart deployments/api',
    //                     ],
    //                 },
    //             },
    //         })
    //     });
    //     ecrRepository.grantPullPush(codeBuildProject.role!);
    //     codeBuildProject.addToRolePolicy(new iam.PolicyStatement({
    //         actions: [
    //             'ecr:GetAuthorizationToken',
    //             'ecr:BatchCheckLayerAvailability',
    //             'ecr:CompleteLayerUpload',
    //             'ecr:InitiateLayerUpload',
    //             'ecr:PutImage',
    //             'ecr:UploadLayerPart',
    //             'sts:AssumeRole',
    //         ],
    //         resources: ['*'],
    //     }));

    //     const buildAction = new CodeBuildAction({
    //         actionName: `${this.props.config.appName}-BuildAction`,
    //         project: codeBuildProject,
    //         input: sourceOutput,
    //         outputs: [new Artifact()],
    //     })

    //     new Pipeline(this, `${this.props.config.appName}-Pipeline`, {
    //         pipelineName: `${this.props.config.appName}-Pipeline`,
    //         stages: [
    //             {
    //                 stageName: 'Source',
    //                 actions: [sourceAction],
    //             },
    //             {
    //                 stageName: 'Build',
    //                 actions: [buildAction],
    //             },
    //         ],
    //     });
    // }
}