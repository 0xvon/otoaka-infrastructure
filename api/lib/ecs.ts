import * as cdk from '@aws-cdk/core';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as ecs from '@aws-cdk/aws-ecs';
import * as iam from '@aws-cdk/aws-iam';
import { Repository } from '@aws-cdk/aws-ecr';
import { LinuxBuildImage, BuildSpec, PipelineProject } from '@aws-cdk/aws-codebuild';
import { Artifact, Pipeline } from '@aws-cdk/aws-codepipeline';
import { GitHubSourceAction, CodeBuildAction, EcsDeployAction } from '@aws-cdk/aws-codepipeline-actions';
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

        const cpuSize = 512;
        const memorySize = 1024;

        const ecrRepository = new Repository(this, `ECR`, {
            repositoryName: `${props.config.appName}`,
        });

        const serviceSecurityGroup = new ec2.SecurityGroup(this, `ServiceSecurityGroup`, {
            allowAllOutbound: true,
            vpc: props.vpc,
            securityGroupName: `${props.config.appName}-APP-SG`,
        });

        const application = new ecsPatterns.ApplicationLoadBalancedFargateService(this, 'ecs-service', {
            vpc: props.vpc,
            platformVersion: ecs.FargatePlatformVersion.VERSION1_4,
            memoryLimitMiB: memorySize,
            cpu: cpuSize,
            securityGroups: [serviceSecurityGroup],
            assignPublicIp: true,
            publicLoadBalancer: true,

            taskImageOptions: {
                containerName: 'api',
                image: ecs.ContainerImage.fromEcrRepository(ecrRepository),
                containerPort: 8080,
                environment: {
                    DATABASE_URL: this.props.mysqlUrl ?? 'mysql://mqmxmrqzd9ju4jrx:l53q2rdezr37fbvp@s0znzigqvfehvff5.cbetxkdyhwsb.us-east-1.rds.amazonaws.com:3306/k6wzwtd2rxfh67wk',
                    AWS_ACCESS_KEY_ID: this.props.config.awsAccessKeyId,
                    AWS_SECRET_ACCESS_KEY: this.props.config.awsSecretAccessKey,
                    AWS_REGION: this.props.config.awsRegion,
                    AUTH0_DOMAIN: this.props.config.auth0Domain,
                    LOG_LEVEL: 'DEBUG',
                    CONGNITO_IDP_USER_POOL_ID: this.props.config.environment === 'prd' ? 'ap-northeast-1_6SJ90evpD' : 'ap-northeast-1_JgZtZFWS8',
                    SNS_PLATFORM_APPLICATION_ARN: this.props.config.environment === 'prd' ? 'arn:aws:sns:ap-northeast-1:960722127407:app/APNS/rocket-ios-prod' : 'arn:aws:sns:ap-northeast-1:960722127407:app/APNS_SANDBOX/rocket-ios-dev',
                },
            },

            domainZone: HostedZone.fromLookup(this, 'hostZone', { domainName: props.config.domainZone }),
            domainName: props.config.domainName,
            certificate: Certificate.fromCertificateArn(this, 'certificate', props.config.acmCertificateArn),
            redirectHTTP: true,
        });

        if (props.mysqlSecurityGroupId) {
            this.injectSecurityGroup([serviceSecurityGroup.securityGroupId], props.mysqlSecurityGroupId);
        }

        this.buildPipeline(application.service, ecrRepository);
    }

    private injectSecurityGroup(appSGIds: string[], rdsSecurityGroupId: string) {
        const rdsSecurityGroup = ec2.SecurityGroup.fromSecurityGroupId(this, `${this.props.config.appName}-DB-SG`, rdsSecurityGroupId);
        appSGIds.forEach((appSGId) => {
            rdsSecurityGroup.addIngressRule(
                ec2.SecurityGroup.fromSecurityGroupId(this, `APP-SG`, appSGId),
                ec2.Port.tcp(3306),
            );
        })
    };

    private buildPipeline(service: ecs.FargateService, ecrRepository: Repository) {
        const githubOwner = 'wall-of-death';
        const githubRepo = 'rocket-api';
        const githubBranch = this.props.config.environment === 'prd' ? 'master' : 'develop';
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

        const buildOutput = new Artifact();

        const codeBuildProject = new PipelineProject(this, `${this.props.config.appName}-CodeBuildProj`, {
            projectName: `${this.props.config.appName}-CodeBuildProj`,
            environment: {
                buildImage: LinuxBuildImage.AMAZON_LINUX_2_3,
                privileged: true,
            },
            environmentVariables: {
                'ECR_REPO_URI': {
                    value: ecrRepository.repositoryUri,
                },
                'DOCKER_HUB_ID': {
                    value: this.props.config.dockerHubUsernmae,
                },
                'DOCKER_HUB_PASSWORD': {
                    value: this.props.config.dockerHubPassword,
                },
                'APP_NAME': {
                    value: 'api',
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
                            'aws ecr get-login-password --region ap-northeast-1 | docker login --username AWS --password-stdin ${ECR_REPO_URI}',
                            'echo Logging in to Docker Hub...',
                            'echo ${DOCKER_HUB_PASSWORD} | docker login -u ${DOCKER_HUB_ID} --password-stdin',
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
                            'echo "[{\\"name\\":\\"${APP_NAME}\\",\\"imageUri\\":\\"${ECR_REPO_URI}:${TAG}\\"}]" > imagedefinitions.json',
                            'cat imagedefinitions.json',
                        ],
                    },
                },
                artifacts: {
                    files: 'imagedefinitions.json',
                }
            }),
        });
        ecrRepository.grantPullPush(codeBuildProject.role!);
        codeBuildProject.addToRolePolicy(new iam.PolicyStatement({
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
            outputs: [buildOutput],
        });

        const deployAction = new EcsDeployAction({
            actionName: `${this.props.config.appName}-DeployAction`,
            service: service,
            input: buildOutput,
        });

        const pipeline = new Pipeline(this, `${this.props.config.appName}-Pipeline`, {
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
                {
                    stageName: 'Deploy',
                    actions: [deployAction],
                },
            ],
        });

        pipeline.addToRolePolicy(new iam.PolicyStatement({
            actions: [
                'ecs:RegisterTaskDefinition',
                'ecs:DeregisterTaskDefinition',
                'ecs:CreateService',
                'ecs:Delete*',
                'logs:Delete*',
                'cloudwatch:Delete*',
                'sts:AssumeRole',
            ],
            resources: ['*'],
        }));
    }
}