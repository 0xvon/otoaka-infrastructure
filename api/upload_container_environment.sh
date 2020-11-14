#!bin/sh

APP_NAME=$1
KEY=$2
VALUE=$3

aws ssm put-parameter \
    --name "/${APP_NAME}/${KEY}" \
    --value "${VALUE}" \
    --type "SecureString" --overwrite
