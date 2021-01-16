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

export const deployment = (imageUrl: string, containerEnvironments: ContainerEnv[]) => {
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
                    containers: [
                        {
                            name: appLabel.app,
                            image: `${imageUrl}:latest`,
                            ports: [{ containerPort: 8080 }],
                            env: containerEnvironments,
                        },
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
                'kubernetes.io/ingress.class': 'alb',
                "service.beta.kubernetes.io/aws-load-balancer-type": "alb",
            },
        },
        spec: {
            type: 'LoadBalancer',
            ports: [{ port: 443, targetPort: 8080 }],
            selector: appLabel,
        },
    };
};
