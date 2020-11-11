import { expect as expectCDK, matchTemplate, MatchStyle } from '@aws-cdk/assert';
import * as cdk from '@aws-cdk/core';
import * as RocketApi from '../lib/rocket-api-stack';

test('Empty Stack', () => {
    const app = new cdk.App();
    // WHEN
    const stack = new RocketApi.RocketApiStack(app, 'MyTestStack');
    // THEN
    expectCDK(stack).to(matchTemplate({
        Resources: {},
    }, MatchStyle.EXACT));
});
