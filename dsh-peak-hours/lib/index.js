// dsh-peak-hours —— DeepSeek 忙时（高峰时段）输入框橙色提醒插件
// 高峰时段：北京时间周一至周五 9:00–12:00、14:00–18:00；周末全天闲时。
// 来源：https://api-docs.deepseek.com/zh-cn/quick_start/pricing/
//
// 服务端只做两件事（结构同 dsh-whale-widget）：
//   1. 把 assets/peak-hours.js 作为静态路由下发；
//   2. tapIndex 往 Web UI 的 index.html 注入 <script defer> 标签。
// 时段判定在浏览器端完成（固定 UTC+8 偏移，与本机时区无关），本插件不存任何数据。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// 客户端脚本每次请求直接读盘，不做 mtime 缓存：mtime 秒级粒度下，同一秒内的连续
// 编辑会被误判为"未变更"而永远发旧代码（踩过：缓存住了两次编辑之间的半成品）。
// 文件只有几 KB、请求只在页面加载时发生，读盘开销可忽略。
function loadClientJs() {
  return fs.readFileSync(path.join(PACKAGE_ROOT, 'assets', 'peak-hours.js'))
}

export default {
  name: 'dsh-peak-hours',
  inject: ['webServer', 'connection'],
  apply(ctx) {
    // 浏览器信任栅栏（官方插件与 whale-widget 的统一约定）：自定义路由一律先过栅栏，
    // 拒绝 Host/Origin 伪造（DNS 重绑定）的请求。本路由目前只下发静态 JS（无数据），
    // 仍按约定走一遍，免得日后往路由里加数据时漏掉。栅栏不可用时 fail-open。
    function rejected(req, res) {
      try {
        const conn = ctx.get('connection') || ctx.connection
        if (!conn || typeof conn.requestRejection !== 'function') return false
        const code = conn.requestRejection(req)
        if (code === undefined || code === null || code === false) return false
        res.statusCode = typeof code === 'number' ? code : 403
        res.end()
        return true
      } catch (err) { return false }
    }

    const disposers = []
    disposers.push(ctx.webServer.register({
      kind: 'exact',
      path: '/dsh-peak-hours/peak-hours.js',
      handler(req, res) {
        if (rejected(req, res)) return
        res.writeHead(200, {
          'Content-Type': 'application/javascript; charset=utf-8',
          'Cache-Control': 'no-store',
        })
        res.end(loadClientJs())
      },
    }))

    disposers.push(ctx.webServer.tapIndex((html) => {
      if (html.indexOf('/dsh-peak-hours/peak-hours.js') !== -1) return html
      const tag = '<script defer src="/dsh-peak-hours/peak-hours.js"></script>'
      if (html.indexOf('</body>') !== -1) return html.replace('</body>', tag + '</body>')
      return html + tag
    }))

    ctx.effect(() => () => {
      for (const d of disposers) {
        try { d() } catch (err) {}
      }
    })
  },
}
