# チンチロアプリ

Next.js + Vercel 用のチンチロアプリです。

## 仕様

- サイコロ3個
- 出目表示
- 役判定表示
- BET / 所持金
- SEあり
- スマホ向けUI
- 役なしなら2回まで振り直し可能
- 3回振っても役が出なければ、そのラウンドはBET没収

## ローカル起動

```bash
npm install
npm run dev
```

## Vercel デプロイ

1. GitHub にこのファイル一式を push
2. Vercel でリポジトリを Import
3. Framework Preset は Next.js のままでOK
4. Deploy

