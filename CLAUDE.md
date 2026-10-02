# Silicon Bits — 项目上下文

> 嵌入式 Linux 驱动 Bug 调试记录 + Wiki 知识库系统

## 技术栈

- **后端**: Go 1.22 / Gin + SQLite(FTS5)
- **前端**: SolidJS + Tailwind CSS（暗色终端风主题）
- **部署**: Docker 多阶段构建 + Draw.io 容器 + Caddy（HTTPS + Basic Auth）
- **存储**: SQLite + 文件系统（Bug 数据在 SQLite，图片在 `data/bugs/{id}/pic/`；Wiki 为 .md 文件驱动，图片在同级 `pic/` 目录）

## 项目结构

```
silicon-bits/
├── CLAUDE.md                    # 本文件，项目上下文（进此目录时自动加载）
├── README.md                    # 使用文档（部署、交叉编译、Docker）
├── Makefile                     # make build = 前端 + 后端一键构建
├── Dockerfile                   # 多阶段构建：前端 build → Go build → alpine 运行
├── docker-compose.yml           # app + caddy 一键部署
├── Caddyfile                    # HTTPS 反向代理配置模板
├── go.mod / go.sum              # Go 依赖管理
├── .gitignore
│
├── cmd/
│   └── server/
│       └── main.go              # 入口：加载配置 → 初始化数据库 → 扫描 wiki 目录 → 启动 Gin
│
├── internal/
│   ├── config/
│   │   └── config.go            # 环境变量配置（PORT, DB_PATH, AUTH_USERNAME, AUTH_PASSWORD, DATA_DIR, DRAWIO_URL）
│   │
│   ├── database/
│   │   ├── db.go                # SQLite 连接、Schema 迁移、FTS5 独立表（手动同步）、定时备份（6h/7天）
│   │   └── seed.go              # BSP 模块树预置数据（8 大类 30+ 子模块）
│   │
│   ├── model/
│   │   ├── bug.go               # Bug 数据模型：Bug/BugCreate/BugUpdate/BugFilter
│   │   ├── wiki.go              # Wiki 数据模型：Wiki/WikiCreate/WikiUpdate/WikiFilter（含 file_path）
│   │   └── bsp_module.go        # BSP 模块树模型：BSPModule（树形结构 + bug_count）
│   │
│   ├── handler/
│   │   ├── bug.go               # Bug CRUD + 导出 Markdown + 关联 Wiki/Bug + 列表筛选 + 删除清理图片
│   │   ├── wiki.go              # Wiki CRUD + 文件读写 + 扫描目录 + 导出 + 删除清理文件
│   │   ├── upload.go            # 图片上传（表单上传 + 服务器本地文件路径复制）+ Draw.io 文件保存
│   │   ├── search.go            # FTS5 全局搜索（Bug + Wiki 联合搜索 + snippet 高亮）
│   │   ├── bsp.go               # BSP 模块树 API（返回含 bug_count 的嵌套树）
│   │   └── stats.go             # 统计 API（Bug/Wiki 总数）+ Draw.io 配置 API
│   │
│   ├── middleware/
│   │   └── auth.go              # Basic Auth 中间件
│   │
│   ├── router/
│   │   └── router.go            # Gin 路由注册，静态文件服务 + API 路由
│   │
│   └── wiki/
│       └── scanner.go           # .md 文件扫描器：解析 frontmatter、同步到 SQLite、下载外部图片、写 .md 文件
│
├── web/                          # SolidJS 前端
│   ├── package.json
│   ├── vite.config.ts            # Vite 配置，开发模式代理 /api → localhost:8080
│   ├── tsconfig.json
│   ├── tailwind.config.js        # 暗色主题配色（bg:#0a0e17, accent:#00ff88, secondary:#38bdf8）
│   ├── postcss.config.js
│   ├── index.html                # 入口 HTML
│   └── src/
│       ├── index.tsx             # 渲染入口，注册所有 Route
│       ├── App.tsx               # 登录页 + Layout 包裹（authed → Layout, else → login form）
│       ├── api/
│       │   └── client.ts         # API 封装：Basic Auth、Bug/Wiki/Search/Stats 全部接口
│       ├── components/
│       │   ├── Layout.tsx        # 全局布局：顶栏（搜索+操作按钮）+ 侧边栏 + 内容区 + footer
│       │   ├── Sidebar.tsx       # 左侧导航：BSP 模块树（可展开）+ Wiki 分类
│       │   ├── MarkdownRenderer.tsx  # Markdown 渲染 + highlight.js 代码高亮
│       │   ├── ImageDropZone.tsx # 图片上传区域（粘贴/拖拽/文件选择按钮/本地路径粘贴）
│       │   ├── WikiTOC.tsx       # Wiki/Bug 详情页浮动目录（TOC）
│       │   └── TagInput.tsx      # 标签输入组件（Enter/逗号添加，点击删除）
│       ├── pages/
│       │   ├── BugsPage.tsx      # Bug 列表（BSP 模块筛选 + 分页 + FTS 搜索）
│       │   ├── BugDetailPage.tsx # Bug 详情（背景→调试过程→根因→方案，关联 Wiki/相似 Bug + 删除）
│       │   ├── NewBugPage.tsx    # 新建 Bug 表单（含图片上传，上传时自动创建草稿）
│       │   ├── EditBugPage.tsx   # 编辑 Bug 表单（含图片上传）
│       │   ├── WikisPage.tsx     # Wiki 列表 + 扫描 .md 文件按钮
│       │   ├── WikiDetailPage.tsx# Wiki 详情（Markdown 渲染 + 反向关联 Bug + 删除）
│       │   ├── NewWikiPage.tsx   # 新建 Wiki 表单（含图片上传）
│       │   ├── EditWikiPage.tsx  # 编辑 Wiki 表单（含图片上传）
│       │   └── SearchPage.tsx    # 全局搜索结果页
│       └── styles/
│           └── index.css         # Tailwind 入口 + 暗色主题自定义样式 + 代码高亮配色
│
├── data/                         # 运行时数据（.gitignore）
│   ├── silicon.db                # SQLite 数据库（WAL 模式）
│   ├── backups/                  # 自动备份（每 6 小时，保留 7 天）
│   ├── bugs/{id}/pic/            # Bug 图片（每个 Bug 一个目录）
│   └── wiki/{title}/             # Wiki .md 文件 + pic/ 图片目录
│
└── silicon-bits                  # 编译后的二进制文件
```

## 数据库设计

### 核心表

| 表 | 用途 | 关键字段 |
|----|------|---------|
| `bsp_modules` | BSP 模块分类树 | id, parent_id, name, slug, icon |
| `bugs` | Bug 调试记录 | title, bsp_module_id, severity, kernel_version, soc, tags, background, debug_process, root_cause, solution, content |
| `wikis` | Wiki 知识文章 | title, category, tags, content, source, **file_path** |
| `bug_relations` | Bug ↔ Bug 相似关联 | bug_id, related_bug_id |
| `bug_wiki_relations` | Bug ↔ Wiki 双向链接 | bug_id, wiki_id |
| `bugs_fts` | Bug 全文索引（FTS5 独立表） | title, background, debug_process, root_cause, solution |
| `wikis_fts` | Wiki 全文索引（FTS5 独立表） | title, content |

### FTS5 索引策略

- 使用**独立 FTS5 表**（非 `content=` 模式），避免触发器导致的数据库损坏
- 手动同步：`SyncBugFTS` / `SyncWikiFTS` / `DeleteBugFTS` / `DeleteWikiFTS`
- 启动时通过 `RebuildFTS()` 从源表全量重建

### Bug 和 Wiki 完全独立

- Bug 存在 SQLite 中，图片存文件系统 `data/bugs/{id}/pic/`
- Wiki 以 .md 文件为源，SQLite 做搜索索引，图片在同目录 `pic/`
- 关联是可选的（通过 `bug_wiki_relations` 表）

## API 路由

```
GET    /api/stats                    # 统计（Bug/Wiki 总数）

GET    /api/bugs                     # 列表（?module=&severity=&soc=&q=&page=）
POST   /api/bugs                     # 创建
GET    /api/bugs/:id                 # 详情（含关联 Wiki + 相似 Bug）
PUT    /api/bugs/:id                 # 更新
DELETE /api/bugs/:id                 # 删除（同时删除图片目录）
GET    /api/bugs/:id/export          # 导出 Markdown
POST   /api/bugs/:id/links           # 关联 Wiki 或相似 Bug
DELETE /api/bugs/:id/links/:target_id # 取消关联

GET    /api/wikis                    # 列表（?category=&q=&page=）
POST   /api/wikis                    # 创建（同时写 .md 文件）
POST   /api/wikis/scan               # 扫描 data/wiki/ 目录导入新 .md（自动下载外部图片）
GET    /api/wikis/:id                # 详情
PUT    /api/wikis/:id                # 更新（同时更新 .md 文件）
DELETE /api/wikis/:id                # 删除（同时删除 .md 文件 + pic 目录）
GET    /api/wikis/:id/export         # 导出 Markdown

POST   /api/upload                   # 图片上传（FormData: file, type, id）
POST   /api/upload-local             # 服务器本地文件复制（JSON: path, type, id）

GET    /api/search?q=&type=all       # FTS5 全局搜索（bug|wiki|all）
GET    /api/bsp/tree                 # BSP 模块树（含 bug_count）
GET    /api/drawio/config            # Draw.io 服务地址（前端获取 embed URL）
PUT    /api/drawio/save              # 保存 Draw.io 图表 XML
```

> 语义补充（2026-10 bug 修复批次）：
> - 文章/分类撞已有名称 → **409**（不再放任重名或裸 SQL 500）
> - 改名/上传等文件操作失败 → **立即中止**，绝不让 DB file_path 与磁盘分裂
> - `wikis.file_path` 存 **wiki 根相对路径**（换机迁移 ID 不洗牌；旧绝对路径启动时自动迁移）
> - FTS 搜索输入自动短语转义，任意字符不会触发语法错误

### 静态文件服务

```
/bugs/*    → data/bugs/      # Bug 图片（无需认证）
/wiki/*    → data/wiki/      # Wiki 图片（无需认证）
/uploads/* → data/uploads/   # 上传文件（无需认证）
```

## Wiki .md 文件格式

```markdown
---
title: 文章标题
category: hardware        # driver-dev | kernel | hardware | tool | other
tags: [tag1, tag2, tag3]
---

# Markdown 正文

内容支持完整的 Markdown 语法和代码高亮。
```

- 没有 frontmatter 时，文件名作为标题，category 默认 `other`
- 拷贝 .md 文件到 `data/wiki/` 后，点 "Scan .md Files" 或重启服务自动导入
- **外部图片自动下载**：导入时自动检测 `![alt](https://...)` 格式的外部 URL，下载到本地 `pic/` 并替换路径

## 图片上传

支持四种方式（Bug 和 Wiki 编辑页面通用）：

1. **粘贴图片** — 在编辑区域 Ctrl+V 粘贴剪贴板中的图片
2. **拖拽文件** — 从文件管理器拖拽图片到编辑区域
3. **文件选择按钮** — 点击 "+ Image" 按钮选择本地文件
4. **本地路径粘贴** — 从 Nautilus 等文件管理器复制文件后 Ctrl+V，自动检测 `file://` 路径

- Bug 图片存储：`data/bugs/{bugID}/pic/{随机名}.{ext}`
- Wiki 图片存储：`data/wiki/{title}/pic/{随机名}.{ext}`
- 新建 Bug 时上传图片会自动创建 Bug 草稿（`onNeedId` 回调）

## 数据安全

- **自动备份**：每 6 小时自动备份数据库到 `data/backups/`，保留 7 天（至少保留 4 份）
- **WAL 模式**：SQLite 使用 WAL 日志模式，定期 checkpoint
- **手动备份**：直接复制 `data/silicon.db` 即可

## 构建命令

```bash
# 后端编译（FTS5 必须加 build tag）
CGO_ENABLED=1 go build -tags "fts5" -o silicon-bits ./cmd/server

# 前端构建
cd web && npm install && npm run build && cd ..

# Go 代理（国内环境）
go env -w GOPROXY=https://goproxy.cn,direct

# 运行
PORT=9090 ./silicon-bits
```

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `8080` | 服务端口 |
| `DATA_DIR` | `./data` | 数据目录（数据库 + wiki 文件夹 + bug 图片 + 备份） |
| `DB_PATH` | `${DATA_DIR}/silicon.db` | 数据库路径 |
| `AUTH_USERNAME` | `admin` | Basic Auth 用户名 |
| `AUTH_PASSWORD` | `silicon` | Basic Auth 密码 |
| `DRAWIO_URL` | （空） | Draw.io 服务地址，如 `http://drawio:8080`（Docker）或 `http://localhost:9091` |

## 前端架构

- SolidJS Router：`index.tsx` 定义所有 Route，`App.tsx` 作为 root layout（登录页 + `{props.children}`）
- 暗色配色：`tailwind.config.js` 定义 bg(#0a0e17), accent(#00ff88), secondary(#38bdf8), danger(#ef4444)
- 路由结构：`/` → BugsPage, `/bugs/:id` → BugDetailPage, `/bugs/:id/edit` → EditBugPage 等
- API 认证：登录时通过 `setCredentials()` 设置 Basic Auth header，所有后续请求自动携带
- 图片上传组件 `ImageDropZone` 同时用于 Bug 和 Wiki 编辑页，通过 `articleType` 和 `onNeedId` 区分
