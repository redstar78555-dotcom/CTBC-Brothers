# 部署成公開網址

這個網站沒有後端，最簡單且免費的方式是 GitHub Pages。

## 讓網址使用 CTBC-Brothers

目前 repository 名稱是 `Rayna88`，直接部署時網址會是：

`https://redstar78555-dotcom.github.io/Rayna88/`

若要網址包含指定的 `CTBC-Brothers`，請先到 GitHub：

1. 進入 repository 的 **Settings**。
2. 在 **General → Repository name** 將名稱改為 `CTBC-Brothers`。
3. 在本機更新遠端網址：

   ```bash
   git remote set-url origin https://github.com/redstar78555-dotcom/CTBC-Brothers.git
   ```

完成後，預期公開網址為：

`https://redstar78555-dotcom.github.io/CTBC-Brothers/`

## 上傳程式碼

確認網站後先查看目前分支：

```bash
git add .
git commit -m "建立 CTBC Brothers 應援曲網站"
git branch --show-current
```

- 如果顯示 `main`，執行 `git push origin main`。
- 如果顯示其他分支（例如 `work`），先用 `git push -u origin <目前分支名稱>` 上傳，再到 GitHub 建立 Pull Request 並合併到 `main`。

不要在尚未確認差異前使用強制推送。

## 開啟 GitHub Pages

1. 到 repository 的 **Settings → Pages**。
2. 在 **Build and deployment** 的 **Source** 選擇 **Deploy from a branch**。
3. Branch 選 `main`，資料夾選 `/ (root)`。
4. 按 **Save**。
5. 等待數分鐘，再回到同一頁查看 GitHub 顯示的 HTTPS 公開網址。

本專案使用相對路徑，因此放在 `/CTBC-Brothers/` 子路徑也能正常載入 CSS 與 JavaScript。

## 發布後檢查

- 用無痕視窗開啟公開網址。
- 分別用手機和電腦測試搜尋、分類及「聽歌曲」。
- YouTube 影片需要網路，且影片擁有者必須允許嵌入。
- 如果影片日後被移除或禁止嵌入，請在 `js/data.js` 更新該筆 `youtubeId` 與來源連結。
