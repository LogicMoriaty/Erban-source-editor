# 开发说明

## 项目结构

贰伴是一个无构建步骤的 Manifest V3 浏览器扩展。扩展源码位于 `Erban-source-editor/`。

- `manifest.json`：扩展名称、版本、权限、命令和 content script 配置。
- `background.js`：处理浏览器扩展命令并转发给当前微信公众号编辑页。
- `content-main.js`：注入到页面主世界，访问微信公众号编辑器 API 或 fallback 编辑区。
- `content-isolated.js`：运行在隔离世界，负责弹窗 UI、快捷键、导入、查找替换、实时预览和写回。
- `lib/editor-utils.js`：浏览器和 Node 测试共用的纯函数工具。
- `editor.css`：插件按钮、源码编辑器、语法高亮、查找栏和手机式预览样式。
- `popup.html` / `popup.js`：扩展 popup。

## 关键行为

### 源码格式化

`formatSourceHTML()` 只做 HTML 源码换行和缩进，不使用 DOM 重新序列化，不改写文章标签、属性、`style`、`data-*` 或图片属性。

实时预览会在渲染前移除源码格式化产生的标签间换行空白，保证格式化前后得到同等预览结构。这个约束由 `tests/fixtures/example2.html` 的回归测试覆盖。

### 实时预览

预览以微信公众号手机阅读态为目标：

- 约 390px 宽白色正文画布。
- 保留微信正文中的 inline style、`display:flex`、横向滚动容器、`width:200%` / `width:300%` 等布局信息。
- 移除脚本类危险标签、事件处理属性和 `javascript:` URL。
- 对缺少 `src` 的图片从 `data-src` 补齐，便于预览真实图片。

### 查找替换

源码编辑区内：

- `Ctrl+F` / `Cmd+F` 打开查找。
- `Ctrl+H` / `Cmd+H` 打开替换。
- 上一个/下一个会选中命中结果，并根据文本 offset 计算滚动位置，让命中项进入可视区域。

## 测试

运行全部测试：

```bash
npm test
```

测试覆盖：

- 快捷键识别。
- 文件导入类型判断。
- 源码格式化不改写布局标记。
- 格式化前后的实时预览输出一致。
- HTML 语法高亮转义和 token 输出。
- 查找匹配和查找滚动位置计算。
- 真实微信公众号文章夹具的图片、链接和横滑布局保留。

脚本语法检查：

```bash
node --check Erban-source-editor/content-isolated.js
node --check Erban-source-editor/background.js
node --check Erban-source-editor/content-main.js
node --check Erban-source-editor/lib/editor-utils.js
```

## 发布前检查

1. 更新 `Erban-source-editor/manifest.json` 的 `version` 和 `description`。
2. 同步更新 `popup.html` footer 中展示的版本号。
3. 运行 `npm test`。
4. 运行上面的 `node --check` 命令。
5. 在浏览器扩展页重新加载 `Erban-source-editor/`，到微信公众号文章编辑页做一次人工冒烟测试。
