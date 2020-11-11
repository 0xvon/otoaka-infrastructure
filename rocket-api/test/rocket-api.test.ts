import { expect as expectCDK, matchTemplate, MatchStyle } from '@aws-cdk/assert';
import * as cdk from '@aws-cdk/core';
import * as VPC from '../lib/vpc';
import * as ALB from '../lib/alb';

test('Empty Stack', () => {
    const app = new cdk.App();

    const vpcStack = new VPC.VPCStack(app, 'MyTestVPCStack', {
        appName: 'sample',
    });
    expectCDK(vpcStack).to(matchTemplate({
        Resources: {},
    }, MatchStyle.EXACT));

    const albStack = new ALB.ALBStack(app, 'MyTestALBStack', {
        appName: 'sample',
        vpc: vpcStack.vpc,
    });
    expectCDK(albStack).to(matchTemplate({
        Resources: {},
    }, MatchStyle.EXACT));
});
