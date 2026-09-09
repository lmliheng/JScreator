# JScreator JMeter 压测方案

## 文件结构

```
jmeter/
├── README.md                  # 本文件
├── single-endpoint.jmx        # 方案一：单接口压测
└── concurrent.jmx             # 方案二：混合并发场景压测
```

## 运行前提

1. 安装 JDK 17+ 和 JMeter 5.5+（推荐使用 [Apache JMeter](https://jmeter.apache.org/download_jmeter.cgi)）
2. 确保后端服务已启动：`http://localhost:7000/` 可访问
3. 确保有可用的测试账号（默认使用 `auth_username` / `auth_password` 登录）

## 方案一：单接口压测

对特定 API 端点施压，测量吞吐量、响应时间、错误率。

```bash
# CLI 模式运行（推荐）
jmeter -n -t jmeter/single-endpoint.jmx -l results/single-result.csv \
  -Jthreads=20 -Jloops=50 -Jtarget=/article/list -Jhost=localhost -Jport=7000 \
  -Jauth_username=admin -Jauth_password=yourpassword

# GUI 模式（调试用）
jmeter -t jmeter/single-endpoint.jmx
```

### 参数说明

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `host` | localhost | 目标主机 |
| `port` | 7000 | 目标端口 |
| `protocol` | http | 协议 |
| `threads` | 10 | 并发线程数 |
| `rampup` | 5 | 爬坡时间（秒） |
| `loops` | 100 | 每线程循环次数（0=永远） |
| `duration` | (空) | 压测持续秒数（非空时覆盖 loops） |
| `target` | /article/list | 目标接口路径 |
| `auth_username` | admin | 登录用用户名 |
| `auth_password` | password | 登录用密码 |

### 推荐压测场景

```bash
# 1. 首页健康检查压测（无 DB）
jmeter -n -t jmeter/single-endpoint.jmx -l results/root.csv -Jthreads=50 -Jloops=200 -Jtarget=/

# 2. 文章列表页（有 DB 查询）
jmeter -n -t jmeter/single-endpoint.jmx -l results/article-list.csv -Jthreads=20 -Jloops=100 -Jtarget=/article/list

# 3. 博客动态页
jmeter -n -t jmeter/single-endpoint.jmx -l results/blog-feed.csv -Jthreads=30 -Jloops=100 -Jtarget=/blog/feed

# 4. 登录接口压测（POST）
jmeter -n -t jmeter/single-endpoint.jmx -l results/login.csv -Jthreads=5 -Jloops=50 -Jtarget=/sys/login -Jmethod=POST -Jauth_username= -Jauth_password= -Jlogin_mode=loop
```

## 方案二：混合并发场景压测

模拟多用户多行为混合并发，更贴近生产负载。

```bash
# CLI 模式运行
jmeter -n -t jmeter/concurrent.jmx -l results/concurrent-result.csv \
  -Jhost=localhost -Jport=7000 \
  -Jtg1_threads=20 -Jtg2_threads=10 -Jtg3_threads=6 -Jtg4_threads=4 \
  -Jduration=120

# GUI 模式（调试用）
jmeter -t jmeter/concurrent.jmx
```

### 参数说明

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `host` / `port` / `protocol` | localhost:7000/http | 目标服务 |
| `tg1_threads` | 20 | 匿名浏览线程数 |
| `tg2_threads` | 10 | 查看文章线程数 |
| `tg3_threads` | 6 | 已登录用户线程数 |
| `tg4_threads` | 4 | 社交互动线程数 |
| `rampup` | 10 | 所有 TG 的爬坡秒数 |
| `duration` | 120 | 压测持续秒数 |
| `loops` | (使用 duration) | 循环次数 |
| `auth_username` / `auth_password` | admin/password | 登录凭据 |

### 场景说明

| 线程组 | 模拟行为 | 占比 |
|--------|----------|------|
| TG1 - 匿名浏览 | 首页 → 文章列表 → 博客动态 → 博客用户列表 → 最新公告 | ~50% |
| TG2 - 查看文章 | 文章详情(随机ID) → 博客文章列表 → 评论列表 | ~25% |
| TG3 - 已登录用户 | 登录 → 个人资料 → 社交状态 | ~15% |
| TG4 - 社交互动 | 登录 → 点赞文章 → 收藏文章 | ~10% |

## 结果分析

### CLI 模式结果文件
- `results/*.csv`：原始采样数据，可在 JMeter GUI 中用"聚合报告"或"表格查看结果"打开
- 运行后 JMeter 会在终端输出摘要：`summary + xx in yy = zzz/s, Avg: aa Min: bb Max: cc Err: dd (ee%)`

### 关键指标
- **吞吐量** (Throughput)：每秒请求数（越高越好）
- **平均响应时间** (Avg)：所有请求的平均耗时
- **P90/P99**：90%/99% 请求在此时间内完成
- **错误率** (Error%)：失败请求占比（应 < 1%）

### 用 JMeter CLI 生成 HTML 报告
```bash
jmeter -n -t jmeter/single-endpoint.jmx -l results/report.csv -e -o results/report \
  -Jthreads=20 -Jloops=100 -Jtarget=/article/list
```

会在 `results/report/` 下生成完整的 HTML 仪表盘报告。

## 注意事项

1. **先预热**：正式压测前先跑少量请求（如 loops=10）确认接口正常
2. **避免压垮数据库**：压测中留意 DB CPU/连接数，单人测试建议线程 ≤ 50
3. **登录 token 可能过期**：JWT 默认有效期内可复用；长时间压测需在脚本中处理 token 刷新
4. **Windows 路径**：CLI 运行时路径可用相对路径或绝对路径