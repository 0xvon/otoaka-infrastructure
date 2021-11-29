import * as cdk from '@aws-cdk/core';
import {
    Vpc,
    SecurityGroup,
    Port,
    IVpc,
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
    dbProxyUrl: string;
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
                version: AuroraMysqlEngineVersion.VER_2_08_1,
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
                version: AuroraMysqlEngineVersion.VER_2_08_1,
            }),
            credentials: Credentials.fromPassword(props.rdsUserName, new cdk.SecretValue(props.config.rdsPassword)),
            defaultDatabaseName: props.rdsDBName,
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
            instances: 1
        });
        const [dbSecret, dbProxy] = this.addProxy(cluster, rdsSecurityGroup);

        this.mysqlUrl = `mysql://${props.rdsUserName}:${props.config.rdsPassword}@${cluster.clusterEndpoint.hostname}:3306/${props.rdsDBName}`;
        this.dbProxyUrl = `mysql://${props.rdsUserName}:${props.config.rdsPassword}@${dbProxy.endpoint}:3306/${props.rdsDBName}`;
    }

    addProxy(dbCluster: DatabaseCluster | DatabaseClusterFromSnapshot, dbSecurityGroup: SecurityGroup): [ISecret, DatabaseProxy] {
        const databaseCredentialsSecret = Secret.fromSecretCompleteArn(
            this,
            `${this.props.config.appName}-rdsSecret`,
            this.props.config.environment === 'prd' ? 'arn:aws:secretsmanager:ap-northeast-1:960722127407:secret:rocket-api/rds-CBs3zG' : 'arn:aws:secretsmanager:ap-northeast-1:960722127407:secret:rocket-api-dev/rds-E0r1ph',
        );
        
        const dbProxyRole = new Role(this, `${this.props.config.appName}-rdsproxyrole`, {
            assumedBy: new ServicePrincipal('rds.amazonaws.com'),
        });
        dbProxyRole.addToPolicy(
            new PolicyStatement({
                resources: ['*'],
                effect: Effect.ALLOW,
                actions: [
                    "secretsmanager:GetSecretValue",
                    "secretsmanager:DescribeSecret",
                ],
            })
        );

        const dbProxy = new DatabaseProxy(this, `${this.props.config.appName}-rdsproxy`, {
            dbProxyName: `${this.props.config.appName}-rdsproxy`,
            proxyTarget: ProxyTarget.fromCluster(dbCluster),
            requireTLS: false,
            secrets: [databaseCredentialsSecret],
            vpc: this.props.vpc,
            vpcSubnets: {
                subnets: this.props.vpc.privateSubnets,
            },
            role: dbProxyRole,
            securityGroups: [dbSecurityGroup],
        });

        return [databaseCredentialsSecret, dbProxy];
    }

    createClusterFromSnapshots(rdsSecurityGroup: SecurityGroup, rdsParameterGroup: ParameterGroup): DatabaseClusterFromSnapshot {
        const snapshotID = 'arn:aws:rds:ap-northeast-1:960722127407:cluster-snapshot:rds-snapshot';

        const cluster = new DatabaseClusterFromSnapshot(this, `${this.props.config.appName}-clusterFromSnapShot`, {
            engine: DatabaseClusterEngine.auroraMysql({
                version: AuroraMysqlEngineVersion.VER_2_08_2,
            }),
            clusterIdentifier: `${this.props.config.appName}-rds-cluster`,
            snapshotIdentifier: snapshotID,
            defaultDatabaseName: this.props.rdsDBName,
            instanceProps: {
                vpcSubnets: {
                    subnets: this.props.vpc.privateSubnets,
                },
                vpc: this.props.vpc,
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

        return cluster;
    }
}
