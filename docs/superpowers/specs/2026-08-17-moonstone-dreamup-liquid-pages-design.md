# MoonStone DreamUP Liquid 独立 Pages 发布设计

## 目标

把当前完整的 MoonStone DreamUP 液态金属网站发布到新的公开仓库
`DCM-dc/moonstone-dreamup-liquid`，最终地址为
`https://dcm-dc.github.io/moonstone-dreamup-liquid/`。

新站保留现有完整页面、开场、导航、FAQ、主视觉素材和 2D 液态金属增强效果。
“立即报名”按钮继续显示但不执行操作。现有仓库
`DCM-dc/moonstone-dreamup` 及其 Pages 站点不作任何修改。

## 采用方案

新仓库保存完整源码和独立 GitHub Actions Pages 工作流，而不是只提交 `dist`
或发布离线单文件快照。构建仍从现有静态站点归档生成 `dist`，再叠加 MoonStone
视觉增强，因此后续可以正常维护和重新发布。

站点 base path 由构建参数控制：

- `buildSite({ siteBasePath })` 默认保持 `/moonstone-dreamup`，避免破坏原构建约定。
- 新仓库工作流设置 `SITE_BASE_PATH=/moonstone-dreamup-liquid`。
- 构建会把归档产物里的旧 base path 统一改写为新路径，包括 HTML、RSC、JavaScript、
  JSON、CSS 和 `_headers` 等文本产物。
- 注入的 `moonstone-metal.css` 与 `liquid-world.js` 使用同一个新 base path。

当前产物中旧路径分布在 8 个文件、共 77 处；只替换 HTML 不足以保留完整的
Vinext/Next 导航和动态加载，因此必须在构建层统一转换。

## 代码边界

站点路径转换与站点构建分开：

- `enhancement-src/site-base.mjs` 负责校验 base path，并在明确的文本文件类型中改写路径。
- `enhancement-src/build.mjs` 负责读取 `SITE_BASE_PATH`、调用路径改写、构建增强脚本并输出 `dist`。
- `.github/workflows/deploy-pages.yml` 只负责安装依赖、以新 base path 构建并部署 `dist`。
- `tests/site-base.test.js` 验证新路径完整替换、旧路径不残留、模块脚本仍存在，防止误生成离线快照。

缺少素材、base path 非法、文本产物无法读取或旧路径在关键输出中残留时，构建直接失败，
不部署部分可用的页面。

## 验证与发布

只运行与本次发布相关的检查，不执行 WebGL 或全量回归矩阵：

1. 先运行 `tests/site-base.test.js`，确认测试在实现前因缺少新能力而失败。
2. 实现后运行该测试及现有 build/flat-build 聚焦测试。
3. 使用 `SITE_BASE_PATH=/moonstone-dreamup-liquid npm run build` 生成正式产物。
4. 检查根页面、模块脚本、CSS、图片全部使用新路径，并确认“立即报名”仍无操作。
5. 创建公开仓库、推送 `main`，等待 Pages 工作流成功。
6. 打开最终 URL，检查首屏、主要章节、图片、样式和浏览器错误。

## 非目标

- 不生成或发布 `/offline/` 离线页面。
- 不改变当前视觉、文案或交互设计。
- 不恢复报名提交行为。
- 不向原仓库推送本次独立发布改动。
- 不使用聊天中曾出现的访问令牌；发布使用已登录的 GitHub 会话。
