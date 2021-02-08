import * as cdk from '@aws-cdk/core';
import {
    Vpc,
    SecurityGroup,
    Port,
} from '@aws-cdk/aws-ec2';
import {
    DatabaseCluster,
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
    AccountRootPrincipal,
    ManagedPolicy,
    PolicyStatement,
    AccountPrincipal,
    Effect,
} from '@aws-cdk/aws-iam';
import { Secret, ISecret } from '@aws-cdk/aws-secretsmanager';
import { Config } from '../typing';

interface RDSStackProps extends cdk.StackProps {
    vpc: Vpc,
    config: Config,

    rdsUserName: string,
    rdsDBName: string,
};

export class RDSStack extends cdk.Stack {
    props: RDSStackProps;
    mysqlUrl: string;
    dbProxyUrl: string;
    rdsSecurityGroupId: string;
    dbSecret: ISecret;

    constructor(scope: cdk.Construct, id: string, props: RDSStackProps) {
        super(scope, id, props);
        this.props = props

        const rdsSecurityGroup = new SecurityGroup(this, `${props.config.appName}-DB-SG`, {
            allowAllOutbound: true,
            vpc: props.vpc,
            securityGroupName: `${props.config.appName}-DB-SG`,
        });
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

        const cluster = new DatabaseCluster(this, `${props.config.appName}-DB-cluster`, {
            engine: DatabaseClusterEngine.auroraMysql({
                version: AuroraMysqlEngineVersion.VER_2_08_1,
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
        });
        const [dbSecret, dbProxy] = this.addProxy(cluster, rdsSecurityGroup);

        this.mysqlUrl = `mysql://${props.rdsUserName}:${props.config.rdsPassword}@${cluster.clusterEndpoint.hostname}:${cluster.clusterEndpoint.port}/${props.rdsDBName}`;
        this.dbSecret = dbSecret;
        this.dbProxyUrl = `mysql://${props.rdsUserName}:${props.config.rdsPassword}@${dbProxy.endpoint}:${cluster.clusterEndpoint.port}/${props.rdsDBName}`;
    }

    addProxy(dbCluster: DatabaseCluster, dbSecurityGroup: SecurityGroup): [ISecret, DatabaseProxy] {
        const databaseCredentialsSecret = Secret.fromSecretNameV2(this, `${this.props.config.appName}-rdsSecret`, `${this.props.config.appName}/rds`);
        
        const dbProxyRole = new Role(this, `${this.props.config.appName}-rdsproxyrole`, {
            assumedBy: new AccountPrincipal(this.account),
        });
        dbProxyRole.addToPolicy(
            new PolicyStatement({
                resources: [databaseCredentialsSecret.secretArn],
                effect: Effect.ALLOW,
                actions: [
                    "secretsmanager:GetSecretValue",
                    "secretsmanager:DescribeSecret",
                ],
            })
        );
        
        const dbProxy = new DatabaseProxy(this, `${this.props.config.appName}-rdsproxy`, {
            proxyTarget: ProxyTarget.fromCluster(dbCluster),
            secrets: [databaseCredentialsSecret],
            vpc: this.props.vpc,
            role: dbProxyRole,
            vpcSubnets: {
                subnets: this.props.vpc.publicSubnets,
            },
        });
        // const dbProxy = dbCluster.addProxy(`${this.props.config.appName}-proxy`, {
        //     secrets: [databaseCredentialsSecret],
        //     debugLogging: true,
        //     vpc: this.props.vpc,
        //     vpcSubnets: {
        //         subnets: this.props.vpc.publicSubnets,
        //     },
        //     securityGroups: [dbSecurityGroup],
        // });
        dbProxy.connections.allowFromAnyIpv4(Port.tcp(3306));

        return [databaseCredentialsSecret, dbProxy];
    }
}
