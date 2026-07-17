# RDS移行手順

既存のNode.js + Express APIを、DynamoDBからAmazon RDS for PostgreSQLへ段階的に移行するための手順を記録する。

## 現在の移行範囲

- `GET /api/products`: RDSへ移行済み
- その他のAPI: DynamoDBを使用
- Python版の `purchasing-products-api`: RDS移行中の比較・検証用として残す

一度にすべてのAPIを変更せず、1つのAPIごとに実装・Lambda単体テスト・API Gateway経由の確認を完了してから次へ進む。

## 現在の構成

```text
ブラウザ / フロント
        ↓
API Gateway HTTP API
        ↓
Node.js Lambda（kobai-bu-api）
        ↓
Amazon RDS for PostgreSQL
```

## Lambdaデプロイパッケージ

`node_modules`を含むZIPファイルを作成する。`.env`は含めない。

```powershell
npm install
tar.exe -a -c -f function.zip src public node_modules package.json package-lock.json
```

ZIPには少なくとも次が含まれていることを確認する。

```text
src/lambda.js
src/postgres.js
node_modules/pg/
package.json
```

## Lambda設定

| 項目 | 設定 |
| --- | --- |
| 関数名 | `kobai-bu-api` |
| ランタイム | Node.js 24.x |
| アーキテクチャ | x86_64 |
| 実行ロール | AWS Academyで利用可能な既存実行ロール |
| ハンドラー | `src/lambda.handler` |
| メモリ | 256 MB |
| タイムアウト | 15秒 |

### VPC

- RDSへ接続できる既存Lambdaと同じVPC・サブネットを使用する
- LambdaにはRDS接続用セキュリティグループを設定する
- RDS側のセキュリティグループで、Lambda側セキュリティグループからのTCP 5432を許可する
- RDSをインターネットへ公開しない

### 環境変数

```text
DB_HOST=<RDSエンドポイント>
DB_PORT=5432
DB_NAME=<データベース名>
DB_USER=<データベースユーザー>
DB_PASSWORD=<データベースパスワード>
DB_SSL=true
DB_POOL_MAX=5
```

実際の値やパスワードをGitHub、README、スクリーンショットへ載せない。将来の本番運用ではAWS Secrets Managerの利用を検討する。

## API Gateway設定

| 項目 | 設定 |
| --- | --- |
| APIタイプ | HTTP API |
| ルート | `GET /api/products` |
| 統合先 | Lambda `kobai-bu-api` |
| ペイロード形式 | 2.0 |
| ステージ | `$default` |
| 自動デプロイ | 有効 |

検証中は`GET /api/products`だけを公開する。書き込みAPIや未移行APIは、動作確認と認証方針が決まるまで追加しない。

呼び出しURL:

```text
https://<API-ID>.execute-api.us-east-1.amazonaws.com/api/products
```

## 動作確認

### Lambda単体

API Gateway HTTP APIのペイロード形式2.0に相当するテストイベントで`GET /api/products`を実行する。

成功条件:

```json
{
  "statusCode": 200
}
```

### API Gateway経由

ブラウザまたはHTTPクライアントから`GET /api/products`を呼び出し、商品情報がJSON配列で返ることを確認する。

期待する主なフィールド:

```text
product_code
product_name
genre_id
genre_name
temp_zone
container
volume_ml
current_price
price_effective_date
current_stock
stock_recorded_at
```

## トラブルシューティング

### `Connection terminated due to connection timeout`

LambdaではなくローカルPCから非公開RDSへ接続した場合や、VPC・サブネット・セキュリティグループが正しくない場合に発生する。非公開RDSの動作確認は、同じVPCに接続したLambdaから行う。

### `no pg_hba.conf entry ... no encryption`

RDSがSSL接続を要求している。Lambdaの環境変数を次のように設定する。

```text
DB_SSL=true
```

### `{"error":"not found"}`

API GatewayからLambdaへは到達しているが、Expressのルートと受信パスが一致していない。HTTP APIでは`$default`ステージを使用し、`/api/products`がそのままExpressへ渡る構成にする。

### `{"message":"Not Found"}`

API Gateway側でルートが一致していない。`GET /api/products`のルート、ステージへのデプロイ、Lambda統合を確認する。

## 現時点の注意事項

- `deploy/deploy.sh`はDynamoDB版の構築手順であり、RDS版のVPC・環境変数・API Gateway設定を再現しない
- `deploy/deploy.sh`をRDS版へ対応させるまでは、RDS版デプロイに使用しない
- DynamoDB版とPython版Lambdaは、RDS移行が完了するまで削除しない
- 次のAPIへ進む前に、現在の変更をレビューしてGitへ記録する
