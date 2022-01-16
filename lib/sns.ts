import * as cdk from '@aws-cdk/core';

interface SNSStackProps extends cdk.StackProps {
    appName: string
}

export class SNSStack extends cdk.Stack {
    constructor(scope: cdk.Construct, id: string, props: SNSStackProps) {
        super(scope, id, props);

        // TODO: someday
    };
};
