// dsh-peak-hours 浏览器端：DeepSeek 忙时给聊天输入框加橙色底色，闲时（含周末）保持原样。
// 高峰时段：北京时间周一至周五 9:00–12:00、14:00–18:00；周末全天闲时。
// 来源：https://api-docs.deepseek.com/zh-cn/quick_start/pricing/
(function () {
  'use strict'
  if (window.__dshPeakHours) return
  window.__dshPeakHours = true

  var STYLE_ID = 'dsh-peak-hours-style'
  var MARK = 'dsh-peak-hours-on'

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

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return
    var style = document.createElement('style')
    style.id = STYLE_ID
    // 半透明橙：浅色/深色主题下都不影响文字可读性
    style.textContent = '.' + MARK + '{background-color:rgba(255,138,20,.22)!important;}'
    document.head.appendChild(style)
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

  // 输入框识别刻意不依赖布局尺寸：后台/被遮挡的标签页里渲染被冻结，
  // offsetWidth 是陈旧值（document.hidden 还可能是 false），尺寸门槛会间歇性误杀。
  // 判定全部基于 DOM 结构：
  //   1. 限定 #root（SPA 主界面；插件市场等 portal 到 body 的页面不碰）；
  //   2. 输入框为 contenteditable div（新版）或 textarea（旧版），判定同 whale-widget；
  //   3. 排除弹窗（dialog/[role=dialog]）和 whale 挂件面板（dshwv 前缀）里的输入控件；
  //   4. 优先取祖先链带 composer 语义类名的（dsh-web-app 的输入区容器）；
  //      没有命名命中且只有一个候选时，退化为唯一候选（兜住改版/中间态）。
  function candidates() {
    var nodes = document.querySelectorAll('#root textarea, #root [contenteditable="true"]')
    var out = []
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i]
      if (n.closest('dialog, [role="dialog"]')) continue
      if (n.closest('[class*="dshwv"]')) continue
      out.push(n)
    }
    var named = []
    for (var j = 0; j < out.length; j++) {
      if (out[j].closest('[class*="composer"]')) named.push(out[j])
    }
    if (named.length) return named
    return out.length === 1 ? out : []
  }

  var applied = [] // 当前已着色的节点

  // 轻量调试面：控制台看 window.__dshPeakHoursDebug；applyLog 保留前 12 次
  // （[相对加载毫秒, 状态, 候选数]）用于时序排查
  var t0 = Date.now()
  var applyCount = 0
  var applyLog = []
  function dbg(state, count) {
    applyCount++
    if (applyLog.length < 12) applyLog.push([Date.now() - t0, state, count])
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
      var targets = isPeakNow() ? candidates() : []
      // 撤掉不再着色的（节点消失/换成别的/转为闲时）
      for (var i = applied.length - 1; i >= 0; i--) {
        if (targets.indexOf(applied[i]) === -1) {
          applied[i].classList.remove(MARK)
          applied.splice(i, 1)
        }
      }
      // React 管理 composer 的 className，重渲染会抹掉外加 class：每轮重申，
      // 不能因"节点没变"就跳过。
      var added = false
      for (var j = 0; j < targets.length; j++) {
        if (!targets[j].classList.contains(MARK)) {
          targets[j].classList.add(MARK)
          added = true
        }
      }
      if (targets.length) dbg(added ? 'marked' : 'held', targets.length)
      else dbg(applied.length ? 'cleared' : 'idle', 0)
    } catch (err) {
      dbg('error: ' + (err && err.message), 0)
    }
  }

  function start() {
    injectStyle()
    apply()
    // 真输入框可能异步换上，慢启动可超一分钟：前 3 分钟指数退避补涂兜底
    var ramps = [500, 1000, 2000, 4000, 8000, 16000, 30000, 45000, 60000, 90000, 120000, 180000]
    for (var i = 0; i < ramps.length; i++) setTimeout(apply, ramps[i])
    // 标签页重新可见、窗口尺寸变化时立即重涂（顺带覆盖切走期间跨过的时段边界）
    window.addEventListener('resize', apply)
    document.addEventListener('visibilitychange', apply)
    // 30s 轮询：跨过时段边界最多晚 30 秒变色/恢复
    setInterval(apply, 30 * 1000)
    // React 重渲染会重建输入框节点、抹掉外加 class：观察子树变化（含 class 属性），
    // 300ms 去抖后重涂；自己 add/remove class 的属性变化在下一轮 apply 收敛。
    // ⚠️ 观察器必须持引用：无引用的 MutationObserver 可能被 GC，观察会静默失效。
    if (window.MutationObserver) {
      var pending = null
      observer = new MutationObserver(function () {
        if (pending) return
        pending = setTimeout(function () { pending = null; apply() }, 300)
      })
      observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] })
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start)
  } else {
    start()
  }
})()
