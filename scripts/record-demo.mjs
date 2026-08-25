// 录制 README 演示 GIF 的自动化脚本（30 秒流程）。
//
// 前置：
//   npm i playwright
//   npx playwright install chromium
//
// 运行（需提供临时 API 配置，key 仅供本地录制、不外传）：
//   DEMO_URL="https://hyhyhyyy.github.io/learn-your-project/" \
//   DEMO_API_KEY="sk-xxx" \
//   DEMO_BASE_URL="https://dashscope.aliyuncs.com/compatible-mode/v1" \
//   DEMO_MODEL="qwen-plus" \
//   DEMO_REPO="https://github.com/<owner>/<vibecoding-demo-repo>" \
//   node scripts/record-demo.mjs
//
// 产物：docs/<时间戳>.webm；再用 ffmpeg 转 GIF：
//   ffmpeg -i docs/*.webm -vf "fps=12,scale=720:-1" docs/demo.gif
//
// 说明：下方选择器均按 index.html 实际 DOM 编写（id 而非文本匹配），
// 与早期"示意版"不同，可直接运行；若页面元素 id 后续变动，请同步更新此处。

import { chromium } from "playwright";

const URL = process.env.DEMO_URL || "https://hyhyhyyy.github.io/learn-your-project/";
const API_KEY = process.env.DEMO_API_KEY || "";
const BASE_URL = process.env.DEMO_BASE_URL || "";
const MODEL = process.env.DEMO_MODEL || "";
const REPO = process.env.DEMO_REPO || "https://github.com/owner/vibecoding-demo-repo";

const MISSING = [];
if (!API_KEY) MISSING.push("DEMO_API_KEY");
if (!BASE_URL) MISSING.push("DEMO_BASE_URL");
if (!MODEL) MISSING.push("DEMO_MODEL");
if (MISSING.length) {
  console.error("缺少环境变量：" + MISSING.join(", ") + "（仅供本地录制，key 不外传）");
  process.exit(1);
}

const browser = await chromium.launch();
const context = await browser.newContext({
  recordVideo: { dir: "docs/", size: { width: 1280, height: 800 } },
});
const page = await context.newPage();
page.setDefaultTimeout(30000);

// 处理页面内的 alert（如问答需配置、限流等），避免脚本卡死
page.on("dialog", (d) => d.accept().catch(() => {}));

await page.goto(URL, { waitUntil: "networkidle" });

// ---- ① 模型配置 → 验证配置（验证成功后输入框/按钮才会启用）----
await page.fill("#apiKey", API_KEY);
await page.fill("#baseURL", BASE_URL);
await page.fill("#model", MODEL);
await page.click("#testBtn");
// 等待"✅ 配置可用"（验证走真实 LLM 调用，最多 25s）
await page.waitForFunction(() => {
  const s = document.getElementById("cfgStatus");
  return s && s.textContent.includes("✅ 配置可用");
}, { timeout: 40000 });

// ---- ② 粘贴仓库 + 勾选 VibeCoding 开关 ----
await page.fill("#repoUrl", REPO);
await page.check("#ownProject");

// ---- ③ 加载仓库（验证通过后 loadBtn 才启用）----
await page.click("#loadBtn");
// 等待加载完成（projectReady=true → 审计/问答按钮移除 disabled）
await page.waitForFunction(() => {
  const b = document.getElementById("btnAudit");
  return b && !b.disabled;
}, { timeout: 120000 });

// ---- ④ 查看「指挥 AI 的行动清单」（ownProject 概览顶部展示）----
await page.evaluate(() => { const el = document.getElementById("overviewBox"); if (el) el.scrollIntoView(); });
await page.waitForTimeout(2500);

// ---- ⑤ AI 变更审计（需 API 配置，已具备；审计弹窗会真实调 LLM）----
await page.click("#btnAudit");
await page.waitForSelector("#auditModal:not(.hidden)", { timeout: 5000 });
// 等待审计正文渲染（spinner 被替换为 Markdown 内容，约 120s 内）
await page.waitForFunction(() => {
  const b = document.getElementById("auditBody");
  return b && !b.querySelector(".spinner") && b.textContent.length > 20;
}, { timeout: 180000 });
await page.waitForTimeout(2000);

// ---- ⑥ 项目问答（输入框为 #chatInput，按钮 #btnAsk）----
await page.fill("#chatInput", "这个项目的入口文件是哪一个？");
await page.click("#btnAsk");
// 等待问答结果渲染：chatLog 至少 2 个子节点（用户气泡 + AI 气泡），且不再有检索 spinner（最迟 180s）
await page.waitForFunction(() => {
  const c = document.getElementById("chatLog");
  if (!c || c.children.length < 2) return false;
  return !c.querySelector(".spinner");
}, { timeout: 180000 });
await page.waitForTimeout(3000);

await context.close();
await browser.close();
console.log("录制完成：视频在 docs/ 目录（webm），可用 ffmpeg 转成 GIF。");
