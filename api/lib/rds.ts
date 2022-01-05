import * as cdk from '@aws-cdk/core';
import {
    Vpc,
    SecurityGroup,
    Port,
    IVpc,
    InstanceType,
    InstanceClass,
    InstanceSize,
} from '@aws-cdk/aws-ec2';
import {
    DatabaseCluster,
    DatabaseClusterFromSnapshot,
    DatabaseClusterEngine,
    AuroraMysqlEngineVersion,
    Credentials,
    ParameterGroup,
    DatabaseProxy,
    ProxyTarget,
} from '@aws-cdk/aws-rds';
import {
    Role,
    ServicePrincipal,
    PolicyStatement,
    Effect,
} from '@aws-cdk/aws-iam';
import { Secret, ISecret } from '@aws-cdk/aws-secretsmanager';
import { Config } from '../typing';

interface RDSStackProps extends cdk.StackProps {
    vpc: Vpc,
    config: Config,

    rdsUserName: string,
    rdsDBName: string,
    useSnapshot: boolean,
};

export class RDSStack extends cdk.Stack {
    props: RDSStackProps;
    vpc: IVpc;
    mysqlUrl: string;
    rdsSecurityGroupId: string;

    constructor(scope: cdk.Construct, id: string, props: RDSStackProps) {
        super(scope, id, props);
        this.props = props

        const rdsSecurityGroup = new SecurityGroup(this, `${props.config.appName}-DB-SG`, {
            allowAllOutbound: true,
            vpc: props.vpc,
            securityGroupName: `${props.config.appName}-DB-SG`,
        });
        rdsSecurityGroup.addIngressRule(rdsSecurityGroup, Port.tcp(3306), `allow ${props.config.appName} admin db connection`);
        this.rdsSecurityGroupId = rdsSecurityGroup.securityGroupId;

        const rdsParameterGroup = new ParameterGroup(this, `${props.config.appName}-PG`, {
            engine: DatabaseClusterEngine.auroraMysql({
                version: AuroraMysqlEngineVersion.VER_3_01_0,
            }),
            parameters: {
                character_set_server: 'utf8mb4',
                character_set_database: 'utf8mb4',
                character_set_client: 'utf8mb4',
                character_set_results: 'utf8mb4',
                collation_server: 'utf8mb4_general_ci',
                collation_connection: 'utf8mb4_general_ci',
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
                lower_case_table_names: '1',
            },
        });

        const cluster = props.useSnapshot ? this.createClusterFromSnapshots(rdsSecurityGroup, rdsParameterGroup) : new DatabaseCluster(this, `${props.config.appName}-DB-cluster`, {
            engine: DatabaseClusterEngine.auroraMysql({
                version: AuroraMysqlEngineVersion.VER_3_01_0,
            }),
            credentials: Credentials.fromPassword(props.rdsUserName, new cdk.SecretValue(props.config.rdsPassword)),
            defaultDatabaseName: props.rdsDBName,
            instanceProps: {
                vpcSubnets: {
                    subnets: props.vpc.isolatedSubnets,
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
            instances: 1
        });

        this.mysqlUrl = `mysql://${props.rdsUserName}:${props.config.rdsPassword}@${cluster.clusterEndpoint.hostname}:3306/${props.rdsDBName}`;
    }

    createClusterFromSnapshots(rdsSecurityGroup: SecurityGroup, rdsParameterGroup: ParameterGroup): DatabaseClusterFromSnapshot {
        const snapshotID = 'arn:aws:rds:ap-northeast-1:960722127407:cluster-snapshot:rds-snapshot';

        const cluster = new DatabaseClusterFromSnapshot(this, `${this.props.config.appName}-clusterFromSnapShot`, {
            engine: DatabaseClusterEngine.auroraMysql({
                version: AuroraMysqlEngineVersion.VER_3_01_0,
            }),
            clusterIdentifier: `${this.props.config.appName}-rds-cluster`,
            snapshotIdentifier: snapshotID,
            defaultDatabaseName: this.props.rdsDBName,
            instanceProps: {
                vpcSubnets: {
                    subnets: this.props.vpc.isolatedSubnets,
                },
                vpc: this.props.vpc,
                securityGroups: [rdsSecurityGroup],
                autoMinorVersionUpgrade: true,
                instanceType: InstanceType.of(InstanceClass.M4, InstanceSize.LARGE)
            },
            cloudwatchLogsExports: [
                'slowquery',
                'error',
            ],
            parameterGroup: rdsParameterGroup,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            instances: 1
        });

        return cluster;
    }
}
