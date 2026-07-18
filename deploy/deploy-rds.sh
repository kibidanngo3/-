#!/usr/bin/env bash
# kobai-bu-api を AWS (Lambda + API Gateway + RDS for PostgreSQL) にデプロイするスクリプト
# 前提: aws configure 済み、RDSは deploy/create-rds.sh で作成済み、
#       DB_HOST / DB_NAME / DB_USER / DB_PASSWORD が環境変数に設定済み
set -euo pipefail

REGION="${AWS_REGION:-us-east-1}"
FUNCTION_NAME="kobai-bu-api"
API_NAME="kobai-bu-api"
LAB_ROLE_ARN="arn:aws:iam::515909396935:role/LabRole"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

: "${DB_HOST:?DB_HOST を設定してください（deploy/create-rds.sh の出力を参照）}"
: "${DB_NAME:=kobaidb}"
: "${DB_USER:?DB_USER を設定してください}"
: "${DB_PASSWORD:?DB_PASSWORD を設定してください}"

VPC_ID=$(aws ec2 describe-vpcs --region "$REGION" --filters Name=is-default,Values=true --query "Vpcs[0].VpcId" --output text)
SUBNET_IDS=$(aws ec2 describe-subnets --region "$REGION" --filters Name=vpc-id,Values="$VPC_ID" --query "Subnets[0:3].SubnetId" --output text | tr '\t' ',')
DEFAULT_SG=$(aws ec2 describe-security-groups --region "$REGION" --filters Name=vpc-id,Values="$VPC_ID" Name=group-name,Values=default --query "SecurityGroups[0].GroupId" --output text)

echo "== 1. Lambda用ビルド =="
cd "$ROOT_DIR"
rm -rf build-rds function-rds.zip
mkdir -p build-rds/src/routes build-rds/public
cp src/*.js build-rds/src/
cp src/routes/*.js build-rds/src/routes/
cp -r public/. build-rds/public/ 2>/dev/null || true
cp package.json package-lock.json build-rds/
(cd build-rds && npm install --omit=dev --no-audit --no-fund)
(cd build-rds && powershell -NoProfile -Command "Compress-Archive -Path * -DestinationPath ../function-rds.zip -Force")

echo "== 2. Lambda関数を作成 or 更新（VPC内・RDS用環境変数） =="
ENV_VARS="Variables={DB_HOST=$DB_HOST,DB_PORT=5432,DB_NAME=$DB_NAME,DB_USER=$DB_USER,DB_PASSWORD=$DB_PASSWORD,DB_SSL=true,DB_POOL_MAX=5}"

if aws lambda get-function --function-name "$FUNCTION_NAME" --region "$REGION" >/dev/null 2>&1; then
  aws lambda update-function-code \
    --function-name "$FUNCTION_NAME" \
    --zip-file fileb://function-rds.zip \
    --region "$REGION" --no-cli-pager
  aws lambda wait function-updated --function-name "$FUNCTION_NAME" --region "$REGION"
  aws lambda update-function-configuration \
    --function-name "$FUNCTION_NAME" \
    --environment "$ENV_VARS" \
    --vpc-config "SubnetIds=$SUBNET_IDS,SecurityGroupIds=$DEFAULT_SG" \
    --region "$REGION" --no-cli-pager
else
  aws lambda create-function \
    --function-name "$FUNCTION_NAME" \
    --runtime nodejs20.x \
    --role "$LAB_ROLE_ARN" \
    --handler src/lambda.handler \
    --zip-file fileb://function-rds.zip \
    --timeout 15 \
    --memory-size 256 \
    --environment "$ENV_VARS" \
    --vpc-config "SubnetIds=$SUBNET_IDS,SecurityGroupIds=$DEFAULT_SG" \
    --region "$REGION" --no-cli-pager
fi

echo "== 3. API Gateway (HTTP API) を作成 or 取得 =="
LAMBDA_ARN=$(aws lambda get-function --function-name "$FUNCTION_NAME" --region "$REGION" --query "Configuration.FunctionArn" --output text)

API_ID=$(aws apigatewayv2 get-apis --region "$REGION" --query "Items[?Name=='$API_NAME'].ApiId" --output text)
if [ -z "$API_ID" ]; then
  API_ID=$(aws apigatewayv2 create-api \
    --name "$API_NAME" \
    --protocol-type HTTP \
    --target "$LAMBDA_ARN" \
    --region "$REGION" \
    --query "ApiId" --output text)

  aws lambda add-permission \
    --function-name "$FUNCTION_NAME" \
    --statement-id apigateway-invoke \
    --action lambda:InvokeFunction \
    --principal apigateway.amazonaws.com \
    --source-arn "arn:aws:execute-api:${REGION}:$(aws sts get-caller-identity --query Account --output text):${API_ID}/*/*" \
    --region "$REGION" --no-cli-pager || true
fi

ENDPOINT=$(aws apigatewayv2 get-api --api-id "$API_ID" --region "$REGION" --query "ApiEndpoint" --output text)

echo "== デプロイ完了 =="
echo "API endpoint: $ENDPOINT"
