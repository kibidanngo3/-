#!/usr/bin/env bash
# DynamoDBテーブルを作成する（既に存在する場合はスキップ）
set -euo pipefail
REGION="${AWS_REGION:-us-east-1}"

table_exists() {
  aws dynamodb describe-table --table-name "$1" --region "$REGION" >/dev/null 2>&1
}

if ! table_exists kobai-genres; then
  aws dynamodb create-table \
    --table-name kobai-genres \
    --attribute-definitions AttributeName=genre_id,AttributeType=N \
    --key-schema AttributeName=genre_id,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST \
    --region "$REGION" --no-cli-pager
fi

if ! table_exists kobai-products; then
  aws dynamodb create-table \
    --table-name kobai-products \
    --attribute-definitions AttributeName=product_code,AttributeType=N AttributeName=genre_id,AttributeType=N \
    --key-schema AttributeName=product_code,KeyType=HASH \
    --global-secondary-indexes '[{"IndexName":"genre-index","KeySchema":[{"AttributeName":"genre_id","KeyType":"HASH"}],"Projection":{"ProjectionType":"ALL"}}]' \
    --billing-mode PAY_PER_REQUEST \
    --region "$REGION" --no-cli-pager
fi

if ! table_exists kobai-price-revisions; then
  aws dynamodb create-table \
    --table-name kobai-price-revisions \
    --attribute-definitions AttributeName=product_code,AttributeType=N AttributeName=effective_date,AttributeType=S \
    --key-schema AttributeName=product_code,KeyType=HASH AttributeName=effective_date,KeyType=RANGE \
    --billing-mode PAY_PER_REQUEST \
    --region "$REGION" --no-cli-pager
fi

if ! table_exists kobai-purchase-history; then
  aws dynamodb create-table \
    --table-name kobai-purchase-history \
    --attribute-definitions AttributeName=product_code,AttributeType=N AttributeName=sort_key,AttributeType=S \
    --key-schema AttributeName=product_code,KeyType=HASH AttributeName=sort_key,KeyType=RANGE \
    --billing-mode PAY_PER_REQUEST \
    --region "$REGION" --no-cli-pager
fi

if ! table_exists kobai-stock-records; then
  aws dynamodb create-table \
    --table-name kobai-stock-records \
    --attribute-definitions AttributeName=product_code,AttributeType=N AttributeName=record_date,AttributeType=S \
    --key-schema AttributeName=product_code,KeyType=HASH AttributeName=record_date,KeyType=RANGE \
    --billing-mode PAY_PER_REQUEST \
    --region "$REGION" --no-cli-pager
fi

echo "DynamoDBテーブル確認・作成完了"
