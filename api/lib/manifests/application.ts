import environment from './environment.json';
import { SSMSecret } from '../../typing';
import { Container } from 'cdk8s-plus';

export interface Obj {
    [index: string]: string;
}
export const stringData: Obj = {}
environment.Secrets.map(function(secret: SSMSecret) { stringData[secret.name]=secret.value });

interface KeyRef {
    name: string;
    key: string;
    optional?: boolean;
}
interface ValueFrom {
    secretKeyRef: KeyRef;
}
export interface ContainerEnv {
    name: string;
    valueFrom: ValueFrom;
}

export const appLabel = {
    app: 'api',
};

export const secret = (stringData: Obj) => {
    return {
        apiVersion: 'v1',
        kind: 'Secret',
        metadata: { name: appLabel.app },
        stringData: stringData,
    };
};

interface DeploymentConfig {
    bucketName: string,
    imageUrl: string,
    containerEnvironments: ContainerEnv[],
    mackerelApiKey: string,
};

export const deployment = (config: DeploymentConfig) => {
    return {
        apiVersion: 'apps/v1',
        kind: 'Deployment',
        metadata: { name: appLabel.app },
        spec: {
            replicas: 1,
            selector: { matchLabels: appLabel },
            template: {
                metadata: { labels: appLabel },
                spec: {
                    restartPolicy: 'Always',
                    serviceAccountName: 'mackerel-serviceaccount',
                    containers: [
                        {
                            name: appLabel.app,
                            image: `${config.imageUrl}:latest`,
                            ports: [{ containerPort: 8080 }],
                            env: config.containerEnvironments,
                        },
                        {
                            name: 'hello-kubernetes',
                            image: `paulbouwer/hello-kubernetes:1.5`,
                            ports: [{ containerPort: 8081 }],
                            env: [
                                {
                                    name: 'PORT',
                                    value: '8081',
                                },
                            ],
                        },
                        {
                            name: 'mackerel-container-agent',
                            image: 'mackerel/mackerel-container-agent:plugins',
                            imagePullPolicy: 'Always',
                            resources: {
                                limits: {
                                    memory: '128Mi'
                                },
                            },
                            env: [
                                {
                                    name: 'MACKEREL_KUBERNETES_KUBELET_READ_ONLY_PORT',
                                    value: '0',
                                },
                                {
                                    name: 'MACKEREL_CONTAINER_PLATFORM',
                                    value: 'kubernetes',                                    
                                },
                                {
                                    name: 'MACKEREL_APIKEY',
                                    value: config.mackerelApiKey,
                                },
                                // {
                                //     name: 'MACKEREL_AGENT_CONFIG',
                                //     value: `s3://${config.bucketName}/api/mackerel-config.yaml`,
                                // },
                                {
                                    name: 'MACKEREL_KUBERNETES_NAMESPACE',
                                    valueFrom: {
                                        fieldRef: {
                                            fieldPath: 'metadata.namespace'
                                        },
                                    },
                                },
                                {
                                    name: 'MACKEREL_KUBERNETES_KUBELET_HOST',
                                    valueFrom: {
                                        fieldRef: {
                                            fieldPath: 'status.hostIP'
                                        },
                                    },
                                },
                                {
                                    name: 'MACKEREL_KUBERNETES_POD_NAME',
                                    valueFrom: {
                                        fieldRef: {
                                            fieldPath: 'metadata.name'
                                        },
                                    },
                                },
                            ]
                        }
                    ],
                },
            },
        },
    };
};

export const service = (acmCertificateArn: string) => {
    return { 
        apiVersion: 'v1',
        kind: 'Service',
        metadata: {
            name: appLabel.app,
            // annotations: {
            //     'service.beta.kubernetes.io/aws-load-balancer-ssl-cert': acmCertificateArn,
            //     'service.beta.kubernetes.io/aws-load-balancer-backend-protocol': 'http',
            //     'service.beta.kubernetes.io/aws-load-balancer-ssl-ports': 'https',
            // },
        },
        spec: {
            type: 'LoadBalancer',
            ports: [
                // {
                //     name: 'https',
                //     protocol: 'TCP',
                //     port: 443,
                //     targetPort: 8080
                // },
                {
                    name: 'http',
                    protocol: 'TCP',
                    port: 80,
                    targetPort: 8080
                },
            ],
            selector: appLabel,
        },
    };
};
