// import {
//     App,
//     Chart,
// } from 'cdk8s';
// import {
//     Deployment,
//     Service,
//     Container,
//     ServiceType,
//     Secret,
// } from 'cdk8s-plus';
import environment from './environment.json';
import { SSMSecret } from '../typing';

interface Obj {
    [index: string]: string;
}
const stringData: Obj = {}
environment.Secrets.map(function(secret: SSMSecret) { stringData[secret.name]=secret.value });

interface KeyRef {
    name: string;
    key: string;
    optional?: boolean;
}
interface ValueFrom {
    secretKeyRef: KeyRef;
}

interface ContainerEnv {
    name: string;
    valueFrom: ValueFrom;
}

const containerEnvironments: ContainerEnv[] = environment.Secrets.map(function(secret: SSMSecret) {
    return {
        name: secret.name,
        valueFrom: {
            secretKeyRef: {
                name: 'api',
                key: secret.name,
            },
        },
    };
})

export const appLabel = {
    app: 'api',
};

// const app = new App();
// const chart = new Chart(app, 'chart');

// const appSecret = new Secret(chart, 'secret', {
//     stringData: {
        
//     },
// });

// const appContainer = new Container({
//     name: 'hello-kubernetes',
//     image: 'paulbouwer/hello-kubernetes:1.5',
//     port: 8080,
// });


// export const deployment = new Deployment(chart, 'app', {
//     metadata: {
//         name: 'hello-kubernetes',
//     },
//     spec: {
//         replicas: 3,
//         podMetadataTemplate: {
//             labels: appLabel,
//         },
//         podSpecTemplate: {
//             containers: [
//                 ,
//             ],
//         },
//     },
// });

export const deployment = {
    apiVersion: 'apps/v1',
    kind: 'Deployment',
    metadata: { name: 'api' },
    // stringData: stringData,
    spec: {
        replicas: 3,
        selector: { matchLabels: appLabel },
        template: {
            metadata: { labels: appLabel },
            spec: {
                containers: [
                    {
                        name: 'api',
                        image: '960722127407.dkr.ecr.ap-northeast-1.amazonaws.com/rocket-api-dev:418955a20484cef79a4349fc8ab4968da69e8cc8',
                        ports: [{ containerPort: 8080 }],
                        env: environment.Secrets,
                    },
                ],
                // env: containerEnvironments,
            },
        },
    },
};

// export const service = new Service(chart, 'load-balancer', {
//     spec: {
//         type: ServiceType.LOAD_BALANCER,
//         selector: appLabel,
//         ports: [
//             { port: 80, targetPort: 8080 },
//         ],
//     }
// });

export const service = {
    apiVersion: 'v1',
    kind: 'Service',
    metadata: { name: 'api' },
    spec: {
        type: 'LoadBalancer',
        ports: [{ port: 80, targetPort: 8080 }],
        selector: appLabel,
    },
};
