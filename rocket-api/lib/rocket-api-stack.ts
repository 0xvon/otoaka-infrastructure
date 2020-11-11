import * as cdk from '@aws-cdk/core';

require('dotenv').config();

const appName = process.env.APP_NAME;

export class RocketApiStack extends cdk.Stack {
    constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        console.log('hello');
    }
}
