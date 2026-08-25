"use strict";
// 纯静态单文件站点校验（无第三方依赖，仅用 Node 内置模块）：
//   1) 内联 <script> 的 JS 语法（用 new Function 解析，捕获括号/拼写类语法错误——
//      这类错误正是手写大文件最容易踩、且浏览器静默失败最难受的坑）
//   2) 基础 HTML 结构完整性（doctype / html / head / body / title / 标签配平）
//   3) 残留占位符（如未替换的 (#) 断链）
// 用法：node scripts/validate.js   （从仓库根目录运行，校验同级的 index.html）

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const HTML = path.join(ROOT, "index.html");

let failed = false;
const errors = [];
const warnings = [];

function fail(msg) { failed = true; errors.push(msg); }
function warn(msg) { warnings.push(msg); }

if (!fs.existsSync(HTML)) {
  fail("找不到 index.html：" + HTML);
} else {
  const html = fs.readFileSync(HTML, "utf8");

  // 1) 内联脚本语法（排除带 src= 的外部 CDN 脚本）
  const re = /<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  let idx = 0;
  while ((m = re.exec(html))) {
    idx++;
    const code = m[1];
    if (!code.trim()) continue;
    try {
      // new Function 会把整段代码当作函数体解析，足以捕获语法错误（非运行时错误）
      new Function(code);
    } catch (e) {
      fail(`内联脚本 #${idx} 语法错误：${e.message}`);
    }
  }
  if (idx === 0) warn("未发现内联 <script>（结构可能异常）");

  // 2) 基础结构
  if (!/^<!doctype html>/i.test(html.trim())) fail("缺少 <!DOCTYPE html> 声明");
  for (const tag of ["html", "head", "body", "title"]) {
    if (!new RegExp("<" + tag + "[\\s>]", "i").test(html)) fail(`缺少 <${tag}> 标签`);
  }
  const pair = (open, close) => {
    const o = (html.match(new RegExp(open, "gi")) || []).length;
    const c = (html.match(new RegExp(close, "gi")) || []).length;
    if (o !== c) fail(`标签配平异常：${open} ×${o} vs ${close} ×${c}`);
  };
  pair("<script", "</script>");
  pair("<style", "</style>");

  // 3) 残留占位符（致命：断链）
  if (/\(#\)/.test(html)) fail("发现未替换的占位链接 (#)");
  // 轻量提醒（非致命）
  for (const p of ["TODO", "FIXME", "占位符", "XXX"]) {
    if (new RegExp(p, "i").test(html)) warn(`发现疑似占位标记：${p}`);
  }
}

console.log("== 静态站点校验 ==");
if (warnings.length) warnings.forEach((w) => console.log("  ⚠ " + w));
if (errors.length) errors.forEach((e) => console.log("  ✗ " + e));
if (!failed && !warnings.length) console.log("  ✓ 全部通过");
else if (!failed) console.log("  ✓ 通过（存在提醒项，可忽略）");

process.exit(failed ? 1 : 0);
