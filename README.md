# fx-dsh

我个人的 [DSH](https://deepseek.com)（DeepSeek Harness）小插件合集。

每个插件是仓库顶层的一个自包含子文件夹，互不依赖、可独立安装。本仓库目前包含：

| 插件 | 说明 |
| --- | --- |
| [dsh-peak-hours](./dsh-peak-hours) | DSH Web 输入框忙时着色提醒：DeepSeek 峰时定价时段（北京时间周一至周五 9:00–12:00、14:00–18:00，周末全天闲时）把聊天输入框背景染成半透明橙色，闲时恢复原样 |

## 安装

进入对应插件目录，按其 README 操作。以 dsh-peak-hours 为例：

```sh
dsh plugin --profile web add link:<插件目录绝对路径>
```

卸载：

```sh
dsh plugin --profile web remove dsh-peak-hours
```

## 新增插件

往本仓库添加新插件时，遵守以下约定：

1. **一个插件 = 一个顶层子文件夹**，命名用 `dsh-` 前缀 + 小写 kebab-case（如 `dsh-peak-hours`、`dsh-foo-bar`）。
2. **插件完全自包含**：自带 `README.md`（功能说明、安装卸载、验证方式、已知限制）、`package.json`（含 `dsh.bundle` 字段）以及各自的 `lib/`、`assets/` 等资源；插件之间不相互依赖，均可独立安装。
3. **登记索引**：新插件就绪后，在上面的插件索引表里加一行（名称 + 一句话说明）。
4. **仓库级公共文件只放根目录**（LICENSE、.gitignore 与本 README），插件目录内不重复放置。

## License

[MIT](./LICENSE)
