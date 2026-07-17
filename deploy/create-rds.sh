#!/usr/bin/env bash
# RDS for PostgreSQL・関連ネットワークリソースを作成する（既に存在すればスキップ）
# 前提: DB_MASTER_PASSWORD 環境変数（新規作成時のみ必須）
set -euo pipefail
REGION="${AWS_REGION:-us-east-1}"
DB_INSTANCE_ID="kobai-bu-rds"
SUBNET_GROUP="kobai-rds-subnet-group"
SG_NAME="kobai-rds-sg"

VPC_ID=$(aws ec2 describe-vpcs --region "$REGION" --filters Name=is-default,Values=true --query "Vpcs[0].VpcId" --output text)
SUBNET_IDS=$(aws ec2 describe-subnets --region "$REGION" --filters Name=vpc-id,Values="$VPC_ID" --query "Subnets[0:3].SubnetId" --output text | tr '\t' ' ')
DEFAULT_SG=$(aws ec2 describe-security-groups --region "$REGION" --filters Name=vpc-id,Values="$VPC_ID" Name=group-name,Values=default --query "SecurityGroups[0].GroupId" --output text)

if ! aws rds describe-db-subnet-groups --db-subnet-group-name "$SUBNET_GROUP" --region "$REGION" >/dev/null 2>&1; then
  echo "== DBサブネットグループ作成 =="
  aws rds create-db-subnet-group \
    --db-subnet-group-name "$SUBNET_GROUP" \
    --db-subnet-group-description "kobai-bu-api RDS subnet group" \
    --subnet-ids $SUBNET_IDS \
    --region "$REGION" --no-cli-pager
fi

SG_ID=$(aws ec2 describe-security-groups --region "$REGION" --filters Name=vpc-id,Values="$VPC_ID" Name=group-name,Values="$SG_NAME" --query "SecurityGroups[0].GroupId" --output text 2>/dev/null || echo "None")
if [ "$SG_ID" = "None" ] || [ -z "$SG_ID" ]; then
  echo "== RDS用セキュリティグループ作成 =="
  SG_ID=$(aws ec2 create-security-group \
    --group-name "$SG_NAME" \
    --description "kobai-bu-api RDS access" \
    --vpc-id "$VPC_ID" \
    --region "$REGION" \
    --query "GroupId" --output text)
  # LambdaはVPCのdefaultセキュリティグループにアタッチする前提
  aws ec2 authorize-security-group-ingress \
    --group-id "$SG_ID" --protocol tcp --port 5432 --source-group "$DEFAULT_SG" \
    --region "$REGION" --no-cli-pager || true
fi
echo "RDS_SG_ID=$SG_ID"
echo "DEFAULT_SG_ID=$DEFAULT_SG"

if ! aws rds describe-db-instances --db-instance-identifier "$DB_INSTANCE_ID" --region "$REGION" >/dev/null 2>&1; then
  echo "== RDSインスタンス作成（起動に数分かかります） =="
  : "${DB_MASTER_PASSWORD:?DB_MASTER_PASSWORD を設定してください}"
  aws rds create-db-instance \
    --db-instance-identifier "$DB_INSTANCE_ID" \
    --db-instance-class db.t3.micro \
    --engine postgres \
    --engine-version 16.9 \
    --master-username kobaiadmin \
    --master-user-password "$DB_MASTER_PASSWORD" \
    --allocated-storage 20 \
    --db-name kobaidb \
    --vpc-security-group-ids "$SG_ID" \
    --db-subnet-group-name "$SUBNET_GROUP" \
    --publicly-accessible \
    --backup-retention-period 0 \
    --no-multi-az \
    --region "$REGION" --no-cli-pager
  echo "起動を待機中..."
  aws rds wait db-instance-available --db-instance-identifier "$DB_INSTANCE_ID" --region "$REGION"
fi

ENDPOINT=$(aws rds describe-db-instances --db-instance-identifier "$DB_INSTANCE_ID" --region "$REGION" --query "DBInstances[0].Endpoint.Address" --output text)
echo "DB_HOST=$ENDPOINT"
