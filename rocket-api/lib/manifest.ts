const appLabel = {
    app: 'hello-kubernetes',
};

export const deployment = {
    apiVersion: 'apps/v1',
    kind: 'Deployment',
    metadata: { name: 'hello-kubernetes' },
    spec: {
        replicas: 3,
        selector: { matchLabels: appLabel },
        template: {
            metadata: { labels: appLabel },
            spec: {
                containers: [
                    {
                        name: 'hello-kubernetes',
                        image: 'paulbouwer/hello-kubernetes:1.5',
                        ports: [{ containerPort: 8080 }],
                    },
                ],
            },
        },
    },
};

export const service = {
    apiVersion: 'v1',
    kind: 'Service',
    metadata: { name: 'hello-kubernetes' },
    spec: {
        type: 'LoadBalancer',
        ports: [{ port: 80, targetPort: 8080 }],
        selector: appLabel,
    },
};
