export interface SSMSecret {
    name: string;
    value: string;
}

declare module '*/environment.json' {
    interface Environment {
        Secrets: SSMSecret[];
    }

    const env: Environment;
    export default env;
}

export interface Config {
    appName: string,
    environment: string,
    rdsPassword: string,
    awsAccountId: string,
    awsAccessKeyId: string,
    awsSecretAccessKey: string,
    awsRegion: string,
    mackerelApiKey: string,
    acmCertificateArn: string,
    domainZone: string,
    domainName: string,
}