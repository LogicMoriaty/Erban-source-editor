# 贰伴源代码编辑器改造设计

## 背景

贰伴是一个轻量 Manifest V3 浏览器扩展，用于在微信公众号文章编辑页查看、编辑和应用正文 HTML。当前仓库没有构建系统、没有测试和 `.gitignore`。用户提供了两份真实微信公众号正文片段作为临时研究素材：`USER-temp/example1.html` 和 `USER-temp/example2.html`。

当前问题集中在四个方面：

- 快捷键文案声明 `Ctrl+Shift+E` / `Cmd+Shift+E` 可打开或关闭编辑器，但实际使用不稳定。
- 实时预览没有模拟手机微信文章阅读态，排版与壹伴插件的预览效果差距明显。
- 没有从本地文件导入 HTML 源代码的功能。
- 仓库缺少 `.gitignore` 和自动化测试，后续维护风险高。

## 目标

实现一组小范围、可审查的改造：修复快捷键入口，新增本地 HTML 文件导入，重做实时预览为手机微信文章阅读态，并补上最小测试基建和 `.gitignore`。

## 非目标

- 不引入前端打包器、React、Vue 或复杂构建流水线。
- 不重写微信公众号编辑器桥接逻辑。
- 不追求 100% 还原微信客户端私有渲染，只做对真实正文片段足够接近的浏览器端预览。
- 不把 `USER-temp/` 作为正式源码目录提交。

## 路线

选择 A 路线：轻量重构现有 content script。

保留当前无构建扩展结构，在 `Erban-source-editor/` 下增加少量可测试工具模块；业务入口仍由 `manifest.json`、`background.js`、`content-isolated.js` 和 `content-main.js` 驱动。测试使用 Node 自带 `node:test`，避免引入第三方依赖。

## 视觉和交互方向

视觉 thesis：编辑器保持深色、克制的工具界面，预览区像一个真实手机微信正文阅读画布，重点让用户判断文章在手机上的排版结果。

内容计划：

- 主工作区：左侧 HTML textarea，右侧可开关的手机预览画布。
- 工具操作：格式化、导入 HTML、实时预览开关、关闭。
- 状态反馈：底部状态文本和 toast 只表达读取、导入、应用和错误结果。
- 预览细节：浅灰背景中放置白色手机正文宽度画布，正文默认宽度约 `390px`，内部容器模拟 `#js_content`。

交互 thesis：

- 弹窗打开保持现有短入口动效。
- 实时预览开关只做显隐和布局调整，不打断编辑。
- 导入成功后立即更新行号、脏状态和已开启的实时预览。

## 架构

### 文件职责

- `Erban-source-editor/content-isolated.js`：页面 UI、事件绑定、桥接请求、编辑器生命周期。
- `Erban-source-editor/editor.css`：弹窗、按钮、textarea、手机预览画布样式。
- `Erban-source-editor/lib/editor-utils.js`：可在浏览器和 Node 测试中复用的纯函数，包括快捷键判断、预览 HTML 准备、CSS 安全清理、文件类型判断。
- `Erban-source-editor/background.js`：保留 Manifest command 转发，必要时改善错误容忍。
- `tests/editor-utils.test.js`：Node 测试，覆盖工具函数和真实示例片段的预览准备行为。
- `tests/fixtures/example1.html`、`tests/fixtures/example2.html`：从 `USER-temp/` 复制来的受管测试夹具。
- `.gitignore`：忽略 `USER-temp/`、依赖、日志、构建输出和系统文件。

### 数据流

打开编辑器：

1. toolbar 按钮、popup、background command 或页面快捷键调用 `toggleEditor()`。
2. `openEditor()` 通过 `GET_CONTENT` 读取微信公众号编辑器正文。
3. 正文经过现有 `formatHTML()` 后填入 textarea。
4. 如果实时预览开启，调用 `preparePreviewHTML()` 生成预览片段并写入手机画布。

导入文件：

1. 用户点击“导入 HTML”。
2. 隐藏 file input 接收 `.html`、`.htm` 或 `.txt`。
3. `FileReader.readAsText(file, 'utf-8')` 读取内容。
4. 成功后替换 textarea 内容，更新行号、脏状态、状态栏和预览。
5. 失败或文件类型不支持时，不覆盖原内容，显示错误状态。

实时预览：

1. textarea input 事件在预览开启时调用 `preparePreviewHTML(rawHtml)`。
2. 预览准备逻辑移除脚本类危险标签和事件处理属性。
3. `img` 缺少 `src` 但有 `data-src` 时补齐 `src`，让真实微信公众号图片更容易显示。
4. 保留微信正文片段里的 `display:flex`、滚动容器、宽度、高度、背景图、transform 等 inline style，因为这些正是示例排版依赖。
5. 通过预览容器 CSS 控制图片最大宽度、正文默认字体、行高、换行、横向滚动和手机画布宽度。

快捷键：

1. 保留 `manifest.json` 中 `commands.toggle-source-editor`。
2. `background.js` 收到 command 后继续向当前微信公众号标签页发送 `TOGGLE_EDITOR`。
3. `content-isolated.js` 继续监听 `TOGGLE_EDITOR`。
4. 增加页面级 `keydown` 捕获兜底：当命中 `Ctrl+Shift+E` 或 `Meta+Shift+E`，并且焦点不在插件自己的 textarea 内时，阻止默认行为并调用 `toggleEditor()`。
5. 若弹窗已打开，快捷键关闭；若未打开，快捷键打开。

## 错误处理

- 文件类型不支持：状态栏显示“请选择 HTML 或文本文件”，原 textarea 不变。
- 文件读取失败：状态栏显示读取失败，原 textarea 不变。
- 预览准备出错：回退到简单文本错误提示，不影响 textarea 内容。
- background command 找不到可用 content script：静默容忍，维持当前行为。
- 页面快捷键发生在插件 textarea 内：不抢占用户编辑输入。

## 测试策略

使用 Node 内置测试，不引入依赖。

覆盖范围：

- `isToggleShortcut()` 识别 Windows/Linux 的 `Ctrl+Shift+E` 和 macOS 的 `Meta+Shift+E`。
- `isToggleShortcut()` 不识别缺少 Shift、使用其他按键、或在 textarea 内输入的事件。
- `preparePreviewHTML()` 移除 `<script>`、内联事件属性和 `javascript:` URL。
- `preparePreviewHTML()` 将 `data-src` 补到图片 `src`。
- `preparePreviewHTML()` 保留示例依赖的 `display:flex`、`overflow-x:auto`、`width:200%` 等 inline style。
- 两份真实夹具经过 `preparePreviewHTML()` 后仍包含关键正文、图片和布局样式。
- `isSupportedImportFile()` 接受 `.html`、`.htm`、`.txt`，拒绝明显不相关的文件名。

验收命令：

- `npm test`
- `node --check Erban-source-editor/content-isolated.js`
- `node --check Erban-source-editor/background.js`
- `node --check Erban-source-editor/lib/editor-utils.js`

人工验收：

- 在微信公众号文章编辑页加载扩展。
- 点击“贰伴 · 源代码”可打开编辑器。
- `Ctrl+Shift+E` 或 `Cmd+Shift+E` 可打开和关闭编辑器。
- 勾选实时预览后，右侧显示约 `390px` 宽的手机正文画布。
- 用 `example1.html` 和 `example2.html` 导入后，预览保持微信公众号正文常见排版、图片和滚动区域，不出现大面积错位。
- 点击“应用”仍能把当前 HTML 写回编辑器。

## 提交边界

建议分为小提交：

1. `docs: add editor improvement design`
2. `chore: add test harness and fixtures`
3. `fix: support editor toggle shortcut`
4. `feat: add mobile-style preview rendering`
5. `feat: import html into source editor`

## 自检

- 规格范围聚焦在一个 PR 内可完成的轻量改造。
- 不包含未定义的未来功能。
- 测试策略覆盖用户报告的行为和真实示例片段。
- `USER-temp/` 只作为输入来源，不作为长期源码目录。
