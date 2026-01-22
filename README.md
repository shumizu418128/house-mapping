# 住所マッピング - House Mapping

OpenStreetMap上に複数の住所をマッピングするWebアプリケーションです。

## 機能

- 🔍 **複数住所検索**: 任意の住所を複数追加可能
- 🗺️ **インタラクティブマップ**: Leafletを使用した高機能地図表示
- 🎨 **カラーコード**: 各マーカーに異なる色を自動割り当て
- 📍 **座標表示**: 緯度・経度を正確に表示
- 🕒 **検索履歴**: 検索した住所を自動保存（最大20件）
- 📱 **レスポンシブ**: モバイル対応デザイン

## 使用技術

- **フロントエンド**: HTML5, CSS3, JavaScript (ES6+)
- **地図ライブラリ**: [Leaflet](https://leafletjs.com/)
- **地図タイル**: OpenStreetMap
- **ジオコーディング**: Nominatim API (OpenStreetMap)

## クイックスタート

### ローカル開発

```bash
# 依存関係をインストール
npm install

# 開発サーバーを起動
npm run dev
```

ブラウザで `http://localhost:8000` にアクセスします。

### 本番サーバーの起動

```bash
npm run serve
```

`http://localhost:3000` でアクセス可能になります。

## ファイル構成

```
house-mapping/
├── index.html          # HTMLテンプレート
├── style.css          # スタイルシート
├── script.js          # メインスクリプト
├── package.json       # プロジェクト設定
├── .gitignore         # Git除外設定
└── README.md          # このファイル
```

## 使用方法

1. 住所を入力フィールドに入力
2. 「追加」ボタンをクリック（またはEnterキー）
3. マップにマーカーが表示されます
4. マッピング済み住所リストで住所を選択してマップを操作
5. 削除ボタンで個別削除、「すべてクリア」で一括削除

## デプロイ

### Vercel（推奨）

```bash
# Vercelにデプロイ（vercel CLIが必要）
vercel
```

### GitHub Pages

```bash
# リポジトリにpushするだけで自動デプロイ
git push origin main
```

設定: リポジトリの Settings > Pages で、デプロイソースを `main branch` に設定してください。

### Netlify

```bash
# Netlify CLIをインストール
npm install -g netlify-cli

# デプロイ
netlify deploy --prod --dir .
```

### 静的ホスティング（AWS S3、Google Cloud Storage等）

すべてのファイルをホスティングサービスにアップロード：

```
- index.html
- style.css
- script.js
```

## API仕様

### Nominatim API（ジオコーディング）

- **エンドポイント**: `https://nominatim.openstreetmap.org/search`
- **レート制限**: 1秒に1リクエスト
- **使用条件**: [ODbL ライセンス](https://opendatacommons.org/licenses/odbl/)

## トラブルシューティング

### マーカーが表示されない
- インターネット接続を確認
- ブラウザのコンソール（F12）でエラーを確認
- 住所の入力形式を確認

### ジオコーディングが遅い
- Nominatim APIのレート制限に達した可能性があります
- 数秒待機してから再度検索してください

## ブラウザサポート

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## ライセンス

MIT License

## 貢献

プルリクエストを歓迎します。大きな変更の場合は、まずissueを開いて変更内容を議論してください。

## 関連リンク

- [Leaflet ドキュメント](https://leafletjs.com/reference.html)
- [OpenStreetMap](https://www.openstreetmap.org/)
- [Nominatim API](https://nominatim.org/release-docs/latest/api/Search/)
