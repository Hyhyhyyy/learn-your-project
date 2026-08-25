// 可选 · 自动驱动页面并录屏，用于生成 README 演示 GIF（30 秒流程）。
//
// 用法：
//   npm i playwright
//   npx playwright install chromium
//   DEMO_URL="https://hyhyhyyy.github.io/learn-your-project/" \
//   DEMO_REPO="https://github.com/<owner>/<vibecoding-demo-repo>" \
//   node scripts/record-demo.mjs
// 录制产物为 docs/*.webm，再用 ffmpeg 转 GIF：
//   ffmpeg -i docs/video.webm -vf "fps=12,scale=720:-1" docs/demo.gif
//
// 注意：下方选择器为「示意」，需按页面实际 DOM 调整（class/id/text）。
// 页面文案/结构若已变动，请以浏览器开发者工具核对后再跑。

import { chromium } from "playwright";

const URL = process.env.DEMO_URL || "https://hyhyhyyy.github.io/learn-your-project/";
const REPO = process.env.DEMO_REPO || "https://github.com/owner/vibecoding-demo-repo";

const browser = await chromium.launch();
const context = await browser.newContext({
  recordVideo: { dir: "docs/", size: { width: 1280, height: 800 } },
});
const page = await context.newPage();
page.setDefaultTimeout(20000);

await page.goto(URL, { waitUntil: "networkidle" });

// ① 粘贴一个 VibeCoding 项目仓库
await page.fill('input[placeholder*="github.com"]', REPO); // 按实际占位符调整
// ② 勾选「这是我自己的 VibeCoding 项目」
await page.check("text=这是我自己的 VibeCoding 项目"); // 按实际文案调整
// ③ 加载仓库
await page.click("text=加载仓库");
await page.waitForTimeout(9000); // 等目录树/概览渲染

// ④ 看「指挥 AI 的行动清单」
await page.click("text=指挥 AI 的行动清单");
await page.waitForTimeout(2500);

// ⑤ 点「AI 变更审计」
await page.click("text=AI 变更审计");
await page.waitForTimeout(6000);

// ⑥ 在「项目问答」追问
await page.fill("textarea", "这个项目的入口文件是哪一个？"); // 按实际选择器调整
await page.click("text=发送");
await page.waitForTimeout(6000);

await context.close();
await browser.close();
console.log("录制完成：视频在 docs/ 目录（webm），可用 ffmpeg 转成 GIF。");
