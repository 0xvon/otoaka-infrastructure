export const appLabel = {
    app: 'api',
};

interface DaemonSetConfig {
    appName: string,
}

export const daemonSet = (config: DaemonSetConfig) => {
    return {
        apiVersion: 'apps/v1',
        kind: 'DaemonSet',
        metadata: {
            name: 'fluentd',
            namespace: 'kube-system',
            labels: {
                'k8s-app': 'fluentd-logging',
                version: 'v1',
            },
        },
        spec: {
            selector: {
                matchLabels: {
                    'k8s-app': 'fluentd-logging',
                    version: 'v1',
                },
            },
            template: {
                metadata: {
                    annotations: {
                        'iam.amazonaws.com/role': 'ap-northeast-1a.staging.kubernetes.ruist.io-service-role',
                    },
                    labels: {
                        'k8s-app': 'fluentd-logging',
                        version: 'v1',
                    },
                },
                spec: {
                    serviceAccount: 'fluentd',
                    serviceAccountName: 'fluentd',
                    torelations: [
                        {
                            key: 'node-role.kubernetes.io/master',
                            effect: 'NoSchedule',
                        },
                    ],
                    containers: [
                        {
                            name: 'fluentd',
                            image: 'fluent/fluentd-kubernetes-daemonset:v1-debian-cloudwatch',
                            env: [
                                {
                                    name: 'LOG_GROUP_NAME',
                                    value: config.appName,
                                },
                                {
                                    name: 'AWS_REGION',
                                    value: 'ap-northeast-1',
                                }
                            ],
                            resources: {
                                limits: {
                                    memory: '200Mi',
                                },
                                requests: {
                                    cpu: '100m',
                                    memory: '200Mi',
                                },
                            },
                            volumeMounts: [
                                {
                                    name: 'varlog',
                                    mountPath: '/var/log',
                                },
                                {
                                    name: 'varlibdockercontainers',
                                    mountPath: '/var/lib/docker/containers',
                                    readOnly: true,
                                },
                            ]
                        }
                    ],
                    terminationGracePeriodSeconds: 30,
                    volumes: [
                        {
                            name: 'varlog',
                            hostPath: {
                                path: '/var/log',
                            },
                        },
                        {
                            name: 'varlibdockercontainers',
                            hostPath: {
                                path: '/var/lib/docker/containers',
                            },
                        },
                    ],
                },
            },
        },
    };
};

export const serviceAccount =  {
    apiVersion: 'v1',
    kind: 'ServiceAccount',
    metadata: {
        name: `fluentd`,
        namespace: 'kube-system',
    },
};

export const clusterRole =  {
    apiVersion: 'rbac.authorization.k8s.io/v1',
    kind: 'ClusterRole',
    metadata: {
        name: `fluentd-clusterrole`,
        namespace: 'kube-system',
    },
    rules: [
        {
            apiGroups: [''],
            resources: [
                'pods',
                'namespaces',
            ],
            verbs: [
                'get',
                'list',
                'watch',
            ],
        },
    ],
};

export const clusterRoleBinding =  {
    apiVersion: 'rbac.authorization.k8s.io/v1',
    kind: 'ClusterRoleBinding',
    metadata: {
        name: `fluentd-clusterrolebinding`,
    },
    roleRef: {
        apiGroup: 'rbac.authorization.k8s.io',
        kind: 'ClusterRole',
        name: `fluentd-clusterrole`,
    },
    subjects:[
        {
            kind: 'ServiceAccount',
            name: `fluentd`,
            namespace: 'kube-system',
        },
    ],
};
