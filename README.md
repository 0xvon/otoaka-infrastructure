# Rocket Infrastructure

## Environment

- AWS
- EKS Fargate
- RDS Aurora for MySQL
- CloudFront S3 Origin

## Setup

```
$ npm i -g cdk
```

## コンテナの環境変数をアップロードしたい時

```
$ cd api
$ aws ssm put-parameter \
    --name "/<APP_NAME>/<KEY>" \
    --value "<VALUE>" \
    --type "SecureString" --overwrite

例)
$ aws ssm put-parameter \
    --name "/sample-api-dev/hogehoge" \
    --value "fugafuga" \
    --type "SecureString" --overwrite
```

↓の形式のレスポンスが返ってきたらOK

```
{
    "Version": 20, 
    "Tier": "Standard"
}
```