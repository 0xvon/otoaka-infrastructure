export const namespace = {
    apiVersion: 'v1',
    metadata: {
        name: 'amazon-cloudwatch',
        labels: {
            name: 'amazon-cloudwatch',
        },
    },
};

export const serviceAccount = {
    apiVersion: 'v1',
    kind: 'ServiceAccount',
    metadata: {
        name: 'cloudwatch-agent',
        namespace: 'amazon-cloudwatch',
    },
};

export const clusterRole = {
    apiVersion: 'rbac.authorization.k8s.io/v1',
    kind: 'ClusterRole',
    metadata: {
        name: 'cloudwatch-agent-role',
    },
    rules: [
        {
            apiGroups: [''],
            resources: ["pods", "nodes", "endpoints"],
            verbs: ["list", "watch"],
        },
        {
            apiGroups: ["apps"],
            resources: ["replicasets"],
            verbs: ["list", "watch"],
        },
        {
            apiGroups: ["batch"],
            resources: ["jobs"],
            verbs: ["list", "watch"],
        },
        {
            apiGroups: [""],
            resources: ["nodes/proxy"],
            verbs: ["get"],
        },
        {
            apiGroups: [""],
            resources: ["nodes/stats", "configmaps", "events"],
            verbs: ["create"],
        },
        {
            apiGroups: [""],
            resources: ["configmaps"],
            resourceNames: ["cwagent-clusterleader"],
            verbs: ["get","update"],
        },
    ],
};

export const clusterRoleBinding = {
    apiVersion: 'rbac.authorization.k8s.io/v1',
    kind: 'ClusterRoleBinding',
    metadata: {
        name: 'cloudwatch-agent-role-binding',
    },
    subjects: [
        {
            kind: 'ServiceAccount',
            name: 'cloudwatch-agent',
            namespace: 'amazon-cloudwatch',
        },
    ],
    roleRef: {
        kind: 'ClusterRole',
        name: 'cloudwatch-agent-role',
        apiGroup: 'rbac.authorization.k8s.io',
    },
};
