const assert = require("node:assert/strict");
const { execFile } = require("node:child_process");
const fs = require("node:fs");
const { promisify } = require("node:util");
const vm = require("node:vm");

const execFileAsync = promisify(execFile);

const source = fs.readFileSync("js/data.js", "utf8");
const sandbox = { window: {} };
vm.runInNewContext(source, sandbox, { filename: "js/data.js" });

const items = sandbox.window.CTBC_CHEERS;
const watchPattern = /^https:\/\/www\.youtube\.com\/watch\?v=([A-Za-z0-9_-]{11})$/;
const videos = new Map();

for (const item of items) {
  assert.match(item.youtubeId, /^[A-Za-z0-9_-]{11}$/, `${item.title} 的 YouTube ID 格式錯誤`);
  assert.equal(
    item.sourceUrl,
    `https://www.youtube.com/watch?v=${item.youtubeId}`,
    `${item.title} 的來源連結與播放 ID 不一致`
  );
  videos.set(item.youtubeId, `${item.title}（歌曲）`);

  const danceMatch = item.danceUrl.match(watchPattern);
  assert.ok(danceMatch, `${item.title} 應援舞必須是 YouTube 直連`);
  videos.set(danceMatch[1], `${item.title}（應援舞）`);
}

async function verifyEmbed([id, label]) {
  const { stdout: body } = await execFileAsync(
    "curl",
    [
      "--fail",
      "--silent",
      "--show-error",
      "--location",
      "--compressed",
      "--max-time",
      "15",
      "--user-agent",
      "Mozilla/5.0 CTBC-Brothers-link-check/1.0",
      "--referer",
      "https://redstar78555-dotcom.github.io/CTBC-Brothers/",
      `https://www.youtube-nocookie.com/embed/${id}`
    ],
    { encoding: "utf8", maxBuffer: 2 * 1024 * 1024 }
  );
  const playable = /\\?"status\\?":\\?"OK/.test(body);
  assert.ok(playable, `${label} (${id}) 目前不允許 YouTube 內嵌播放`);
  console.log(`✓ ${label} ${id}`);
}

async function runPool(entries, concurrency) {
  let next = 0;
  async function worker() {
    while (next < entries.length) {
      const current = entries[next];
      next += 1;
      await verifyEmbed(current);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
}

(async () => {
  const entries = [...videos.entries()];
  await runPool(entries, 5);
  console.log(`\nYouTube 外部連結驗證通過：${items.length} 首曲目、${entries.length} 支不重複影片。\n`);
})().catch((error) => {
  console.error("\nYouTube 外部連結驗證失敗：", error.message);
  process.exitCode = 1;
});
