import * as cdk from '@aws-cdk/core';
import {
    Vpc,
    IVpc,
    InstanceType,
    InstanceClass,
    InstanceSize,
    SecurityGroup,
    Port,
    SubnetType,
} from '@aws-cdk/aws-ec2';
import {
    DatabaseCluster,
    DatabaseClusterEngine,
    AuroraMysqlEngineVersion,
    MysqlEngineVersion,
    Credentials,
    DatabaseInstance,
    DatabaseInstanceEngine,
    ParameterGroup,
} from '@aws-cdk/aws-rds';

interface RDSStackProps extends cdk.StackProps {
    appName: string
    vpc: Vpc
    appSGId: string
}

export class RDSStack extends cdk.Stack {
    constructor(scope: cdk.Construct, id: string, props: RDSStackProps) {
        super(scope, id, props);
        const rdsSecurityGroup = new SecurityGroup(this, `${props.appName}-DB-SG`, {
            allowAllOutbound: true,
            vpc: props.vpc,
            securityGroupName: `${props.appName}-DB-SG`,
        });
        rdsSecurityGroup.addIngressRule(
            SecurityGroup.fromSecurityGroupId(this, `${props.appName}-APP-SG`, props.appSGId),
            Port.tcp(3306),
        );

        const rdsParameterGroup = new ParameterGroup(this, `${props.appName}-PG`, {
            engine: DatabaseClusterEngine.auroraMysql({
                version: AuroraMysqlEngineVersion.VER_2_08_1,
            }),
            parameters: {
                character_set_server: 'utf8mb4',
                character_set_database: 'utf8mb4',
                character_set_client: 'utf8mb4',
                character_set_results: 'utf8mb4',
                collation_server: 'utf8mb4_bin',
                log_warnings: '1',
                performance_schema: '1',
                log_queries_not_using_indexes: '0',
                net_write_timeout: '120',
                max_allowed_packet: '67108864',
                server_audit_logging: '1',
                time_zone: 'Asia/Tokyo',
                slow_query_log: '1',
                long_query_time: '1',
                innodb_print_all_deadlocks: '1',
            },
        });

        const cluster = new DatabaseCluster(this, `${props.appName}-DB-cluster`, {
            engine: DatabaseClusterEngine.auroraMysql({
                version: AuroraMysqlEngineVersion.VER_2_08_1,
            }),
            credentials: Credentials.fromPassword('admin', new cdk.SecretValue('adminpassword')),
            instanceProps: {
                vpcSubnets: {
                    subnets: props.vpc.privateSubnets,
                },
                vpc: props.vpc,
                securityGroups: [rdsSecurityGroup],
                autoMinorVersionUpgrade: true,
            },
            cloudwatchLogsExports: [
                'slowquery',
                'error',
            ],
            parameterGroup: rdsParameterGroup,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
    }
}
