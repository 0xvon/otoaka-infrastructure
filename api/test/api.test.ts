import { expect as expectCDK, matchTemplate, MatchStyle } from '@aws-cdk/assert';
import * as cdk from '@aws-cdk/core';
import * as VPC from '../lib/vpc';
// import * as EKS from '../lib/eks';

test('Empty Stack', () => {
    const app = new cdk.App();

    const vpcStack = new VPC.VPCStack(app, 'MyTestVPCStack', {
        appName: 'sample',
    });
    expectCDK(vpcStack).to(matchTemplate({
        Resources: {},
    }, MatchStyle.EXACT));

    // const eksStack = new EKS.EKSStack(app, 'MyTestALBStack', {
    //     appName: 'sample',
    //     vpc: vpcStack.vpc,
    // });
    // expectCDK(eksStack).to(matchTemplate({
    //     Resources: {},
    // }, MatchStyle.EXACT));
});
