#!/usr/bin/env bash
# kobai-bu-api を AWS (Lambda + API Gateway + DynamoDB) にデプロイするスクリプト
# 前提: aws configure 済み（AWS Academy Learner Labの一時認証情報など）
set -euo pipefail

REGION="${AWS_REGION:-us-east-1}"
FUNCTION_NAME="kobai-bu-api"
API_NAME="kobai-bu-api"
LAB_ROLE_ARN="arn:aws:iam::515909396935:role/LabRole"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "== 1. DynamoDBテーブル作成（存在すればスキップ） =="
"$ROOT_DIR/deploy/create-tables.sh"

echo "== 2. Lambda用ビルド =="
cd "$ROOT_DIR"
rm -rf build function.zip
mkdir -p build/src/routes
cp src/*.js build/src/
cp src/routes/*.js build/src/routes/
cp package.json package-lock.json build/
(cd build && npm install --omit=dev --no-audit --no-fund)
(cd build && powershell -NoProfile -Command "Compress-Archive -Path * -DestinationPath ../function.zip -Force")

echo "== 3. Lambda関数を作成 or 更新 =="
if aws lambda get-function --function-name "$FUNCTION_NAME" --region "$REGION" >/dev/null 2>&1; then
  aws lambda update-function-code \
    --function-name "$FUNCTION_NAME" \
    --zip-file fileb://function.zip \
    --region "$REGION" --no-cli-pager
else
  aws lambda create-function \
    --function-name "$FUNCTION_NAME" \
    --runtime nodejs20.x \
    --role "$LAB_ROLE_ARN" \
    --handler src/lambda.handler \
    --zip-file fileb://function.zip \
    --timeout 15 \
    --memory-size 256 \
    --environment "Variables={GENRES_TABLE=kobai-genres,PRODUCTS_TABLE=kobai-products,PRICE_REVISIONS_TABLE=kobai-price-revisions,PURCHASE_HISTORY_TABLE=kobai-purchase-history,STOCK_RECORDS_TABLE=kobai-stock-records}" \
    --region "$REGION" --no-cli-pager
fi

echo "== 4. API Gateway (HTTP API) を作成 or 取得 =="
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
