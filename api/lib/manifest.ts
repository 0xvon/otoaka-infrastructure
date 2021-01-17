import environment from './environment.json';
import { SSMSecret } from '../typing';

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

export const deployment = (imageUrl: string, containerEnvironments: ContainerEnv[], mackerelApiKey: string) => {
    return {
        apiVersion: 'apps/v1',
        kind: 'Deployment',
        metadata: { name: appLabel.app },
        spec: {
            replicas: 0,
            selector: { matchLabels: appLabel },
            template: {
                metadata: { labels: appLabel },
                spec: {
                    restartPolicy: 'Always',
                    containers: [
                        {
                            name: appLabel.app,
                            image: `${imageUrl}:latest`,
                            ports: [{ containerPort: 8080 }],
                            env: containerEnvironments,
                        },
                        {
                            name: 'mackerel-container-agent',
                            image: 'mackerel/mackerel-container-agent:latest',
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
                                    value: mackerelApiKey,
                                },
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
            annotations: {
                'service.beta.kubernetes.io/aws-load-balancer-ssl-cert': acmCertificateArn,
                'service.beta.kubernetes.io/aws-load-balancer-backend-protocol': 'http',
                'service.beta.kubernetes.io/aws-load-balancer-ssl-ports': 'https',
            },
        },
        spec: {
            type: 'LoadBalancer',
            ports: [
                {
                    name: 'https',
                    protocol: 'TCP',
                    port: 443,
                    targetPort: 8080
                },
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

export const serviceAccount = () => {
    return {
        apiVersion: 'v1',
        kind: 'ServiceAccount',
        metadata: {
            name: `${appLabel.app}-serviceaccount`
        }
    };
};

export const clusterRole = () => {
    return {
        apiVersion: 'rbac.authorization.k8s.io/v1',
        kind: 'ClusterRole',
        metadata: {
            name: `${appLabel.app}-mackerel-container-agent-cluster-role`,
        },
        rules: [
            {
                apiGroups: [''],
                resources: [
                    'nodes/proxy',
                    'nodes/stats',
                    'nodes/spec',
                ],
                verbs: [
                    'get',
                ],
            },
        ],
    };
};

export const clusterRoleBinding = () => {
    return {
        apiVersion: 'rbac.authorization.k8s.io/v1',
        kind: 'ClusterRoleBinding',
        metadata: {
            name: `${appLabel.app}-mackerel-clusterrolebinding`,
        },
        roleRef: {
            apiGroup: 'rbac.authorization.k8s.io',
            kind: 'ClusterRole',
            name: `${appLabel.app}-mackerel-container-agent-cluster-role`,
        },
        subjects:[
            {
                kind: 'ServiceAccount',
                name: `${appLabel.app}-serviceaccount`,
                namespace: 'default',
            },
        ],
    };
};
