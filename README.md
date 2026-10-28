# CTBC Brothers 應援曲庫

一個以繁體中文製作、支援手機與電腦的中信兄弟應援曲整理網站。網站為純 HTML、CSS、JavaScript，不需後端或建置流程，可直接部署到 GitHub Pages。

## 本機開啟

```bash
npm install
npm run dev
```

瀏覽器開啟 `http://127.0.0.1:4173`。

## 測試

```bash
npm test
npm run verify:youtube
```

`npm test` 會以桌機及手機尺寸逐一點擊所有可播放曲目的「聽歌曲」，並檢查搜尋、分類、播放器停止、外部連結與版面寬度。`npm run verify:youtube` 會實際連線檢查每支 YouTube 影片是否仍允許嵌入，需要網路。

## 公開部署

完整步驟請看 [DEPLOY.md](./DEPLOY.md)。若希望公開網址包含 `CTBC-Brothers`，GitHub repository 也需要命名為 `CTBC-Brothers`。

## 內容說明

這是非官方球迷整理網站。影片會透過 YouTube 隱私加強模式內嵌，不下載或重新散布影音。未取得授權的完整歌詞不會複製到網站；頁面只提供簡短應援提示，完整內容請以官方影片及球場版本為準。
