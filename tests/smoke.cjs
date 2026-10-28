const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const baseUrl = "http://127.0.0.1:4173";

function browserLaunchOptions() {
  const defaultPath = chromium.executablePath();
  if (fs.existsSync(defaultPath)) return { headless: true };

  const systemBrowsers = ["/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/google-chrome"];
  const systemBrowser = systemBrowsers.find((candidate) => fs.existsSync(candidate));
  if (systemBrowser) return { headless: true, executablePath: systemBrowser };

  const cacheRoot = "/home/agent/.cache/ms-playwright";
  if (!fs.existsSync(cacheRoot)) return { headless: true };
  const candidates = fs
    .readdirSync(cacheRoot)
    .filter((name) => name.startsWith("chromium-"))
    .flatMap((name) => [
      path.join(cacheRoot, name, "chrome-linux64", "chrome"),
      path.join(cacheRoot, name, "chrome-linux", "chrome")
    ]);
  const installedChrome = candidates.find((candidate) => fs.existsSync(candidate));
  return installedChrome ? { headless: true, executablePath: installedChrome } : { headless: true };
}

function startServer() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["tests/server.cjs"], {
      cwd: process.cwd(),
      env: { ...process.env, CTBC_PORT: "4173", CTBC_HOST: "127.0.0.1" },
      stdio: ["ignore", "pipe", "pipe"]
    });

    const timeout = setTimeout(() => reject(new Error("本機伺服器啟動逾時")), 10_000);
    child.stdout.on("data", (chunk) => {
      if (String(chunk).includes("CTBC server ready")) {
        clearTimeout(timeout);
        resolve(child);
      }
    });
    child.stderr.on("data", (chunk) => process.stderr.write(chunk));
    child.once("exit", (code) => {
      clearTimeout(timeout);
      if (code && code !== 0) reject(new Error(`本機伺服器異常結束：${code}`));
    });
  });
}

async function assertNoHorizontalOverflow(page, label) {
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth
  }));
  assert.ok(
    dimensions.content <= dimensions.viewport + 1,
    `${label} 不應出現水平捲軸：${JSON.stringify(dimensions)}`
  );
}

async function runViewport(browser, profile) {
  const context = await browser.newContext({
    viewport: profile.viewport,
    deviceScaleFactor: profile.deviceScaleFactor || 1,
    isMobile: Boolean(profile.isMobile),
    hasTouch: Boolean(profile.isMobile),
    reducedMotion: "reduce"
  });

  // 測試播放器控制時不連向外部網路；外部影片可用性必須另行查證。
  await context.route(/https:\/\/www\.youtube-nocookie\.com\/.*/, (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/html; charset=utf-8",
      body: "<!doctype html><title>Mock YouTube player</title>"
    })
  );

  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.locator(".cheer-card").first().waitFor();

  assert.equal(await page.locator("html").getAttribute("lang"), "zh-Hant");
  assert.equal(await page.title(), "CTBC Brothers 應援曲庫");
  await assertNoHorizontalOverflow(page, profile.name);

  const runtimeStats = await page.evaluate(() => ({ ...window.__CTBC_APP__ }));
  const renderedCount = await page.locator(".cheer-card").count();
  assert.equal(renderedCount, runtimeStats.itemCount, `${profile.name} 應渲染全部曲目`);
  assert.ok(runtimeStats.itemCount >= 10, `${profile.name} 至少應有 10 筆曲目`);

  const playButtons = page.locator(".play-button:not([disabled])");
  assert.equal(await playButtons.count(), runtimeStats.playableCount);
  assert.equal(runtimeStats.playableCount, runtimeStats.itemCount, "每首曲目都應有已查證播放連結");

  const dataProblems = await page.evaluate(() =>
    window.CTBC_CHEERS.flatMap((item) => {
      const expectedWatch = `https://www.youtube.com/watch?v=${item.youtubeId}`;
      const problems = [];
      if (!/^[A-Za-z0-9_-]{11}$/.test(item.youtubeId || "")) problems.push(`${item.title}: youtubeId`);
      if (item.sourceUrl !== expectedWatch) problems.push(`${item.title}: sourceUrl`);
      if (!/^https:\/\/www\.youtube\.com\/watch\?v=[A-Za-z0-9_-]{11}$/.test(item.danceUrl || "")) {
        problems.push(`${item.title}: danceUrl`);
      }
      if (item.verifiedAt !== "2026-10-28") problems.push(`${item.title}: verifiedAt`);
      return problems;
    })
  );
  assert.deepEqual(dataProblems, [], `${profile.name} 的曲目直連資料必須完整`);

  for (let index = 0; index < runtimeStats.playableCount; index += 1) {
    const button = playButtons.nth(index);
    const youtubeId = await button.getAttribute("data-youtube-id");
    const expectedTitle = await button.locator("xpath=ancestor::article").locator(".card-title").textContent();
    assert.match(youtubeId, /^[A-Za-z0-9_-]{11}$/);
    await button.click();

    const panel = page.locator("#player-panel");
    assert.equal(await panel.isVisible(), true, `${profile.name} 點播放後應顯示播放器`);
    const iframeSrc = await page.locator("#youtube-player").getAttribute("src");
    assert.ok(iframeSrc.includes(`/embed/${youtubeId}`), `iframe 應載入 ${youtubeId}`);
    assert.ok(iframeSrc.includes("autoplay=1"), "播放器應要求自動播放");
    assert.equal(await page.locator("#now-playing-title").textContent(), expectedTitle);
    assert.ok((await page.locator("#live-status").textContent()).includes("已載入"));

    await page.locator("#stop-player").click();
    assert.equal(await panel.isHidden(), true, `${profile.name} 停止後應隱藏播放器`);
    assert.equal(await page.locator("#youtube-player").getAttribute("src"), "about:blank");
  }

  const search = page.locator("#search-input");
  await search.fill("江坤宇");
  assert.equal(await page.locator(".cheer-card").count(), 1, `${profile.name} 搜尋應縮小結果`);
  assert.equal(await page.locator(".card-title").textContent(), "江坤宇應援曲");
  assert.equal(await page.locator("#clear-search").isVisible(), true);
  await page.locator("#clear-search").click();
  assert.equal(await page.locator(".cheer-card").count(), runtimeStats.itemCount);

  await page.locator('[data-filter="team"]').click();
  const teamCards = page.locator('.cheer-card[data-category="team"]');
  assert.ok((await teamCards.count()) >= 2, `${profile.name} 應有團隊應援曲`);
  assert.equal(await page.locator(".cheer-card").count(), await teamCards.count());
  assert.equal(await page.locator('[data-filter="team"]').getAttribute("aria-pressed"), "true");

  await search.fill("完全找不到的曲目關鍵字");
  assert.equal(await page.locator("#empty-state").isVisible(), true);
  await page.locator("#reset-filters").click();
  assert.equal(await page.locator(".cheer-card").count(), runtimeStats.itemCount);

  const details = page.locator(".chant-details").first();
  await details.locator("summary").click();
  assert.equal(await details.getAttribute("open"), "");
  assert.ok((await details.locator(".chant-content").textContent()).includes("完整歌詞"));

  const externalLinks = page.locator('a[target="_blank"][href^="https://"]');
  assert.ok((await externalLinks.count()) > 0, `${profile.name} 應提供外部來源連結`);
  for (let index = 0; index < (await externalLinks.count()); index += 1) {
    const link = externalLinks.nth(index);
    const href = await link.getAttribute("href");
    assert.doesNotThrow(() => new URL(href));
    const rel = await link.getAttribute("rel");
    assert.ok(rel.includes("noopener") && rel.includes("noreferrer"));
  }

  const tooSmallControls = await page.locator("button:not([disabled]), .hero-cta").evaluateAll((nodes) =>
    nodes
      .filter((node) => node.getClientRects().length > 0)
      .map((node) => ({
        label: node.getAttribute("aria-label") || node.textContent.trim(),
        width: node.getBoundingClientRect().width,
        height: node.getBoundingClientRect().height
      }))
      .filter((box) => box.width < 40 || box.height < 40)
  );
  assert.deepEqual(tooSmallControls, [], `${profile.name} 的主要控制項尺寸不可過小`);
  assert.deepEqual(pageErrors, [], `${profile.name} 不應有頁面例外`);
  assert.deepEqual(consoleErrors, [], `${profile.name} 不應有 console error`);

  await context.close();
  console.log(`✓ ${profile.name}：版面、搜尋、分類、播放器與連結測試通過`);
}

(async () => {
  let server;
  let browser;
  try {
    server = await startServer();
    browser = await chromium.launch(browserLaunchOptions());

    await runViewport(browser, {
      name: "桌機 1440×1000",
      viewport: { width: 1440, height: 1000 }
    });
    await runViewport(browser, {
      name: "手機 390×844",
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true
    });

    const productionContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const productionPage = await productionContext.newPage();
    await productionPage.goto(baseUrl, { waitUntil: "networkidle" });
    const productionStats = await productionPage.evaluate(() => ({ ...window.__CTBC_APP__ }));
    assert.equal(productionStats.playableCount, 19, "正式頁面應啟用 19 首已查證曲目");
    assert.equal(
      await productionPage.locator(".play-button:not([disabled])").count(),
      productionStats.itemCount,
      "正式頁面的每首曲目都應可播放"
    );
    await productionContext.close();

    console.log("✓ 正式資料：19 首已查證曲目全數啟用播放");
    console.log("\n全部自動化測試通過。\n");
  } catch (error) {
    console.error("\n測試失敗：", error);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    if (server && !server.killed) server.kill("SIGTERM");
  }
})();
