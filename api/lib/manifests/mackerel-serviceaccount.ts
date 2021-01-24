export const serviceAccount =  {
    apiVersion: 'v1',
    kind: 'ServiceAccount',
    metadata: {
        name: `mackerel-serviceaccount`,
        namespace: 'default',
    },
};

export const clusterRole = {
    apiVersion: 'rbac.authorization.k8s.io/v1',
    kind: 'ClusterRole',
    metadata: {
        name: `mackerel-container-agent-clusterrole`,
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

export const clusterRoleBinding =  {
    apiVersion: 'rbac.authorization.k8s.io/v1',
    kind: 'ClusterRoleBinding',
    metadata: {
        name: `mackerel-clusterrolebinding`,
        namespace: 'default',
    },
    roleRef: {
        apiGroup: 'rbac.authorization.k8s.io',
        kind: 'ClusterRole',
        name: `mackerel-container-agent-clusterrole`,
    },
    subjects:[
        {
            kind: 'ServiceAccount',
            name: `mackerel-serviceaccount`,
            namespace: 'default',
        },
    ],
};

