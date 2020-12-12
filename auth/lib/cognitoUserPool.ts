import * as sns from '@aws-cdk/aws-sns';
import * as subs from '@aws-cdk/aws-sns-subscriptions';
import * as sqs from '@aws-cdk/aws-sqs';
import * as cdk from '@aws-cdk/core';

interface CognitoUserPoolStackProps extends cdk.StackProps {
    appName: string,
}

export class CognitoUserPoolStack extends cdk.Stack {
    constructor(scope: cdk.App, id: string, props?: CognitoUserPoolStackProps) {
        super(scope, id, props);

        const queue = new sqs.Queue(this, 'AuthQueue', {
            visibilityTimeout: cdk.Duration.seconds(300)
        });

        const topic = new sns.Topic(this, 'AuthTopic');

        topic.addSubscription(new subs.SqsSubscription(queue));
    }
}
