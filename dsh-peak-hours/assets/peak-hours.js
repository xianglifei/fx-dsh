// dsh-peak-hours 浏览器端：DeepSeek 忙时给聊天输入区整卡淡橙状态染，闲时（含周末）保持原样。
// 高峰时段：北京时间周一至周五 9:00–12:00、14:00–18:00；周末全天闲时。
// 来源：https://api-docs.deepseek.com/zh-cn/quick_start/pricing/
//
// 机制：状态类只挂在 <html> 上（React 永远不会碰它），配色全部走结构化 CSS——
// 时段翻转时切一次类，任何时刻挂载的 composer 自动命中规则。
// 无需观察 React 重渲染、无需逐节点补涂，脚本因此非常薄。
(function () {
  'use strict'
  if (window.__dshPeakHours) return
  window.__dshPeakHours = true

  var STATE_CLASS = 'dsh-peak'
  var STYLE_ID = 'dsh-peak-hours-style'

  // 临时验证开关：URL 带 ?dsh-peak-demo 或 #dsh-peak-demo 强制视为忙时，=0 强制视为闲时。
  // hash 比查询串可靠：dsh web 会把 ?token=... 连同整个查询串重定向清掉，hash 能留下来。
  // 检测到即闩存；每次 apply 都重新解析，页面加载后再补 hash 也有效（最多等下一轮轮询）。
  var demoLatch = null
  function demoState() {
    if (demoLatch !== null) return demoLatch
    var tokens
    try {
      tokens = (location.search + '&' + location.hash).split(/[?&#=]/)
    } catch (err) { return null }
    var i = tokens.indexOf('dsh-peak-demo')
    if (i === -1) return null
    demoLatch = tokens[i + 1] !== '0'
    return demoLatch
  }

  // 固定加 UTC+8 偏移后按 UTC 读，得到北京日历的星期/小时，与本机时区无关
  function isPeakNow(nowMs) {
    var demo = demoState()
    if (demo !== null) return demo
    var bj = new Date((nowMs || Date.now()) + 8 * 3600 * 1000)
    var dow = bj.getUTCDay() // 0=周日 6=周六：周末全天闲时
    if (dow === 0 || dow === 6) return false
    var h = bj.getUTCHours()
    return (h >= 9 && h < 12) || (h >= 14 && h < 18)
  }

  // 视觉：染整张 composer 卡片（输入区+工具栏一体），刻意不碰 box-shadow——
  // 保留原生卡片投影；描边用 outline（不占布局、不挤掉投影），常驻 1px 透明、
  // 忙时只变 outline-color，配合 transition 双向都能 0.5s 渐变；
  // 顶边 2px 橙条用 background-image + size/position 画成一条，不影响布局。
  // 透明度按浅色/深色主题通吃取值（同旧版约束：单套配色两主题都可读）。
  //
  // 识别：结构选择器限定 #root，取「最外层」带 composer 语义类名的容器
  // （:not([class*="composer"] *) 排掉嵌套同名内层，避免叠染），
  // 输入区（textarea/contenteditable）自带的底色同步转透明，整卡色调才统一。
  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return
    var style = document.createElement('style')
    style.id = STYLE_ID
    var card = '#root [class*="composer"]:not([class*="composer"] *)'
    style.textContent =
      card + '{outline:1px solid transparent;transition:background-color .5s ease,outline-color .5s ease}' +
      'html.dsh-peak ' + card + '{' +
      'background-color:rgba(255,138,20,.13)!important;' +
      'background-image:linear-gradient(rgba(255,138,20,.8),rgba(255,138,20,.8))!important;' +
      'background-size:100% 2px!important;' +
      'background-repeat:no-repeat!important;' +
      'background-position:top!important;' +
      'outline-color:rgba(255,138,20,.55)!important}' +
      'html.dsh-peak #root [class*="composer"] textarea,' +
      'html.dsh-peak #root [class*="composer"] [contenteditable="true"]{background-color:transparent!important}'
    document.head.appendChild(style)
  }

  // 轻量调试面：控制台看 window.__dshPeakHoursDebug；applyLog 保留前 12 次
  // （[相对加载毫秒, 状态]）用于时序排查。状态：peak-on/peak-off=翻转，held/idle=维持
  var t0 = Date.now()
  var applyCount = 0
  var applyLog = []
  function dbg(state) {
    applyCount++
    if (applyLog.length < 12) applyLog.push([Date.now() - t0, state])
    try {
      window.__dshPeakHoursDebug = {
        at: new Date().toISOString(),
        state: state,
        applyCount: applyCount,
        applyLog: applyLog,
        peak: isPeakNow(),
        hash: location.hash,
        search: location.search,
      }
    } catch (err) {}
  }

  function apply() {
    try {
      var on = isPeakNow()
      var cls = document.documentElement.classList
      if (cls.contains(STATE_CLASS) !== on) {
        cls.toggle(STATE_CLASS, on)
        dbg(on ? 'peak-on' : 'peak-off')
      } else {
        dbg(on ? 'held' : 'idle')
      }
    } catch (err) {
      dbg('error: ' + (err && err.message))
    }
  }

  function start() {
    injectStyle()
    apply()
    // 状态类在 <html> 上，CSS 结构选择器自动命中后挂载的 composer：
    // 无需慢启动补涂、无需 MutationObserver。轮询只为跨过时段边界
    // （最多晚 30 秒变色/恢复）；visibilitychange 覆盖切走期间跨过的边界。
    setInterval(apply, 30 * 1000)
    document.addEventListener('visibilitychange', apply)
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start)
  } else {
    start()
  }
})()
