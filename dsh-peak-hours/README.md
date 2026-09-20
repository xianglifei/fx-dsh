# dsh-peak-hours

DSH Web 输入框忙时着色提醒插件。

DeepSeek API 自 2026-08-17 起实行峰谷定价（闲时价格为高峰的一半）：

- **高峰（忙时）**：北京时间周一至周五 9:00–12:00、14:00–18:00
- **闲时**：其余全部时段；周末（周六、周日）全天闲时（2026-08-23 起）

来源：[DeepSeek 官方「模型 & 价格」](https://api-docs.deepseek.com/zh-cn/quick_start/pricing/)

本插件在 Web UI 的聊天输入区做状态提醒：忙时把**整张输入卡片**染成淡橙状态色——细橙描边 + 顶部 2px 橙条，颜色变化带 0.5s 渐变过渡，圆角与原生投影完整保留；闲时恢复原样。时段判定在浏览器端完成（固定 UTC+8 偏移，与本机时区无关），每 30 秒检查一次；忙时状态挂在页面根元素（`<html class="dsh-peak">`）上，配色全部走结构化 CSS，React 重渲染不影响着色。

![忙时效果（v0.1 旧版截图：输入区平涂橙色；v0.2 起改为整卡淡橙状态染——细描边 + 顶边条 + 渐变过渡，可在 DSH Web 地址后加 `#dsh-peak-demo` 查看新版）](./screenshot-peak.png)

## 安装（本地开发）

```sh
dsh plugin --profile web add link:<本目录绝对路径>
```

装完后刷新 DSH Web 页面即可（profile 开着 `patchReload: live` 时无需重启 DSH）。

## 卸载

```sh
dsh plugin --profile web remove dsh-peak-hours
```

## 验证

不用等到工作日早上：在 DSH Web 页面 URL 后加 `#dsh-peak-demo` 强制视为忙时（看橙色效果），加 `#dsh-peak-demo=0` 强制视为闲时。用 hash 形式最可靠——`?token=...` 这类查询串会被 dsh web 重定向清掉，hash 能留下来。

控制台里还有个调试面 `window.__dshPeakHoursDebug`，能看到最近一次判定状态和前 12 次 apply 的时间线。

## 已知限制

- 输入卡片靠结构选择器识别：`#root` 下**最外层**带 `composer` 语义类名的容器（`[class*="composer"]:not([class*="composer"] *)`）。DSH 前端改版改掉类名时会直接失去效果（旧版的"唯一候选兜底"在纯 CSS 里表达不了），届时同步调整 `assets/peak-hours.js` 里 `injectStyle()` 的选择器即可。
- 染色接管卡片的 `background-color`、`background-image` 与 `outline`：若原生卡片使用渐变背景会被覆盖；`box-shadow` 刻意未动，原生投影保留。
- 时段表硬编码在 `assets/peak-hours.js` 的 `isPeakNow()`，官方调整时段时改这一处即可。
- 时段边界切换最多延迟一个轮询周期（30 秒）；标签页切走再切回时通过 `visibilitychange` 立即恢复。
