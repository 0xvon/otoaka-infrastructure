#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { RocketApiStack } from '../lib/rocket-api-stack';

const app = new cdk.App();
new RocketApiStack(app, 'RocketApiStack');
