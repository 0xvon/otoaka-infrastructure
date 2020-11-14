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
$ sh upload_container_environment.sh <APP_NAME> <KEY> <VALUE>
例: sh upload_container_environment.sh sample-api-dev hogehoge fugafuga
```

↓の形式のレスポンスが返ってきたらOK

```
{
    "Version": 20, 
    "Tier": "Standard"
}
```