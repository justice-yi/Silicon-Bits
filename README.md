# Silicon Bits 使用文档

## 目录

- [快速开始](#快速开始)
- [开发模式运行](#开发模式运行)
- [交叉编译](#交叉编译)
- [Docker 部署](#docker-部署)
- [公网部署（HTTPS）](#公网部署https)
- [给别人快速部署](#给别人快速部署)
- [Wiki 文件管理](#wiki-文件管理)
- [图片上传](#图片上传)
- [环境变量](#环境变量)
- [数据备份与迁移](#数据备份与迁移)
- [常见问题](#常见问题)

---

## 快速开始

### 前置条件

- Go 1.22+（含 CGO 支持）
- Node.js 18+（仅前端构建需要）
- GCC（CGO 编译 SQLite 需要）

### 三步启动

```bash
# 1. 克隆项目
git clone <repo-url> && cd silicon-bits

# 2. 一键构建（后端 + 前端）
make build          # 或者手动执行：
# GOPROXY=https://goproxy.cn,direct  # 国内环境需要
# cd web && npm install && npm run build && cd ..
# CGO_ENABLED=1 go build -tags "fts5" -o silicon-bits ./cmd/server

# 3. 启动
./silicon-bits
# 默认监听 http://localhost:8080
# 默认账号: admin / silicon
```

---

## 开发模式运行

前后端分离开发，支持热重载：

```bash
# 终端 1：启动后端
go run -tags "fts5" ./cmd/server

# 终端 2：启动前端开发服务器（自动代理 API 到 8080）
cd web && npm run dev
# 前端访问 http://localhost:5173
```

---

## 交叉编译

Silicon Bits 使用 CGO（SQLite 依赖），交叉编译需要对应平台的 C 交叉编译工具链。

### 编译为 ARM64（如 RK3588 开发板、树莓派）

```bash
# 安装 ARM64 交叉编译工具链
# Ubuntu/Debian:
sudo apt install gcc-aarch64-linux-gnu

# 交叉编译
CGO_ENABLED=1 \
GOOS=linux \
GOARCH=arm64 \
CC=aarch64-linux-gnu-gcc \
go build -tags "fts5" -ldflags="-s -w" -o silicon-bits-arm64 ./cmd/server

# 部署到开发板
scp silicon-bits-arm64 root@192.168.1.100:/opt/silicon-bits/
scp -r web/dist root@192.168.1.100:/opt/silicon-bits/web/dist/
```

### 在开发板上运行

```bash
ssh root@192.168.1.100
cd /opt/silicon-bits
mkdir -p data/wiki
PORT=8080 ./silicon-bits-arm64
```

### 编译为其他平台

| 目标平台 | GOOS | GOARCH | CC |
|---------|------|--------|-----|
| Linux AMD64 | linux | amd64 | gcc |
| Linux ARM64 | linux | arm64 | aarch64-linux-gnu-gcc |
| macOS ARM64 | darwin | arm64 | clang |
| macOS AMD64 | darwin | amd64 | clang |

---

## Docker 部署

### 构建并启动

```bash
cd silicon-bits

# 构建镜像（前端 + 后端一体化）
docker compose up -d --build

# 查看日志
docker compose logs -f app

# 停止
docker compose down
```

服务启动后访问 `http://localhost:8080`

### Dockerfile 说明

多阶段构建，最终镜像极小：

```
Stage 1: node:20-alpine     → 构建前端 (npm run build)
Stage 2: golang:1.22-alpine → 编译后端 (CGO_ENABLED=1, go build -tags fts5)
Stage 3: alpine:3.19        → 最终运行镜像 (~30MB)
```

### 自定义配置

修改 `docker-compose.yml` 中的环境变量：

```yaml
services:
  app:
    environment:
      - PORT=8080
      - AUTH_USERNAME=your_user       # 改用户名
      - AUTH_PASSWORD=your_password   # 改密码
    volumes:
      - ./data:/data                  # 数据持久化
```

### 查看 Wiki 文件

Wiki .md 文件挂载在 `./data/wiki/` 目录：

```bash
# 直接拷贝 .md 文件
cp my-article.md ./data/wiki/

# 重启或调用 API 扫描
curl -u your_user:your_password -X POST http://localhost:8080/api/wikis/scan
```

---

## 公网部署（HTTPS）

### 方式一：Docker + Caddy（推荐）

1. 准备一个域名，解析到服务器 IP

2. 修改 `docker-compose.yml`，取消 caddy 部分注释：

```yaml
services:
  app:
    build: .
    volumes:
      - ./data:/data
    environment:
      - AUTH_USERNAME=admin
      - AUTH_PASSWORD=改为强密码
    restart: unless-stopped
    # 不再暴露端口给宿主机，由 caddy 代理

  caddy:
    image: caddy:2
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data
      - caddy_config:/config
    restart: unless-stopped

volumes:
  caddy_data:
  caddy_config:
```

3. 修改 `Caddyfile`：

```
your-domain.com {
    reverse_proxy app:8080
}
```

4. 启动：

```bash
docker compose up -d
```

Caddy 会自动申请 Let's Encrypt 证书。访问 `https://your-domain.com`。

### 方式二：FRP 内网穿透（无公网 IP）

```ini
# frpc.toml
serverAddr = "your-frp-server.com"
serverPort = 7000

[[proxies]]
name = "silicon-bits"
type = "http"
localPort = 8080
customDomains = ["bits.your-domain.com"]
```

### 方式三：Cloudflare Tunnel（免费）

```bash
# 安装 cloudflared
# 一键创建隧道
cloudflared tunnel --url http://localhost:8080
```

---

## 给别人快速部署

### 方法一：Docker Compose（最简单）

把以下文件打包给别人：

```
silicon-bits/
├── Dockerfile
├── docker-compose.yml
└── web/dist/            # 预编译的前端
```

对方只需要：

```bash
# 1. 安装 Docker
curl -fsSL https://get.docker.com | sh

# 2. 进入项目目录
cd silicon-bits

# 3. 一键启动
docker compose up -d

# 4. 访问
# http://服务器IP:8080
# 账号: admin / silicon（记得改密码）
```

### 方法二：预编译二进制（无需 Docker）

```bash
# 1. 下载二进制 + 前端
# 从 Release 页面下载 silicon-bits-linux-amd64.tar.gz
tar xzf silicon-bits-linux-amd64.tar.gz
cd silicon-bits

# 2. 启动
mkdir -p data/wiki
AUTH_USERNAME=myuser AUTH_PASSWORD=mypassword ./silicon-bits

# 3. 后台运行（systemd）
cat > /etc/systemd/system/silicon-bits.service << 'EOF'
[Unit]
Description=Silicon Bits
After=network.target

[Service]
WorkingDirectory=/opt/silicon-bits
Environment=PORT=8080
Environment=AUTH_USERNAME=admin
Environment=AUTH_PASSWORD=silicon
ExecStart=/opt/silicon-bits/silicon-bits
Restart=always

[Install]
WantedBy=multi-user.target
EOF

systemctl enable --now silicon-bits
```

### 方法三：一键脚本

创建 `install.sh`：

```bash
#!/bin/bash
set -e

echo "=== Silicon Bits Installer ==="

# 检查 Docker
if ! command -v docker &> /dev/null; then
    echo "Installing Docker..."
    curl -fsSL https://get.docker.com | sh
fi

# 检查 docker compose
if ! docker compose version &> /dev/null; then
    echo "Error: docker compose not found"
    exit 1
fi

# 下载项目
echo "Downloading Silicon Bits..."
git clone https://github.com/your-repo/silicon-bits.git
cd silicon-bits

# 配置
read -p "Username [admin]: " USERNAME
read -p "Password [silicon]: " PASSWORD
USERNAME=${USERNAME:-admin}
PASSWORD=${PASSWORD:-silicon}

# 修改配置
sed -i "s/AUTH_USERNAME=admin/AUTH_USERNAME=$USERNAME/" docker-compose.yml
sed -i "s/AUTH_PASSWORD=silicon/AUTH_PASSWORD=$PASSWORD/" docker-compose.yml

# 启动
docker compose up -d --build

echo ""
echo "=== Done ==="
echo "URL: http://$(hostname -I | awk '{print $1}'):8080"
echo "Account: $USERNAME / $PASSWORD"
echo "Wiki files: $(pwd)/data/wiki/"
echo ""
echo "To stop:  docker compose down"
echo "To update: git pull && docker compose up -d --build"
```

---

## Wiki 文件管理

### .md 文件格式

每篇 Wiki 对应 `data/wiki/` 下的一个 .md 文件：

```markdown
---
title: RK3588 HDMI 调试指南
category: driver-dev
tags: [hdmi, display, rk3588]
---

# 正文标题

Markdown 正文内容...

## 代码示例

\```c
// C 代码会自动语法高亮
\```
```

### Frontmatter 字段

| 字段 | 必填 | 说明 |
|------|------|------|
| `title` | 否 | 标题，缺省取文件名或首个 `# ` 标题 |
| `category` | 否 | 分类：`driver-dev`/`kernel`/`hardware`/`tool`/`other` |
| `tags` | 否 | 标签数组 |

### 操作方式

```bash
# 拷贝 .md 文件到 wiki 目录
cp my-article.md data/wiki/

# 方法1：重启服务（自动扫描）
./silicon-bits

# 方法2：不重启，调用扫描 API
curl -u admin:silicon -X POST http://localhost:8080/api/wikis/scan

# 方法3：前端 Wiki 页面点 "Scan .md Files" 按钮
```

### 从 Notion 迁移

1. 在 Notion 中导出页面为 Markdown
2. 手动添加 frontmatter（可选）
3. 拷贝到 `data/wiki/` 目录
4. 扫描导入

**注意**：导入时系统会自动检测 `.md` 中的外部图片 URL（如 Notion/S3 链接 `![alt](https://...)`），下载到本地 `pic/` 目录并替换为本地路径。如果外部 URL 不可达（网络问题），会保留原始 URL 不做修改。

批量转换脚本示例：

```bash
#!/bin/bash
# notion2wiki.sh — 批量给 Notion 导出的 .md 文件添加 frontmatter
for f in *.md; do
    title=$(head -1 "$f" | sed 's/^# //')
    tmp=$(mktemp)
    cat > "$tmp" << EOF
---
title: $title
category: other
tags: [notion-import]
---

EOF
    cat "$f" >> "$tmp"
    mv "$tmp" "$f"
done
echo "Done. Copy these files to data/wiki/"
```

---

## 图片上传

Bug 和 Wiki 编辑页面均支持四种图片上传方式：

### 1. 粘贴图片

在编辑区域按 `Ctrl+V`，直接粘贴剪贴板中的截图或复制的图片。

### 2. 拖拽文件

从文件管理器拖拽图片文件到编辑区域。

### 3. 文件选择按钮

点击编辑区域右上角的 **"+ Image"** 按钮，弹出系统文件选择对话框。

### 4. 本地文件路径粘贴（服务器环境）

在 Linux 桌面（Nautilus 等文件管理器）中复制图片文件后，在编辑区域 `Ctrl+V`。
系统会自动检测 `file://` 路径，通过 `/api/upload-local` 接口将服务器本地文件复制到 uploads 目录。

### 图片存储位置

| 类型 | 存储路径 | 访问 URL |
|------|---------|----------|
| Bug 图片 | `data/bugs/{bugID}/pic/` | `/bugs/{bugID}/pic/{filename}` |
| Wiki 图片 | `data/wiki/{title}/pic/` | `pic/{filename}`（相对路径） |

### 删除

删除 Bug 或 Wiki 时，对应的图片目录会一同删除。

---

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `8080` | HTTP 监听端口 |
| `DATA_DIR` | `./data` | 数据根目录 |
| `DB_PATH` | `${DATA_DIR}/silicon.db` | SQLite 数据库路径 |
| `AUTH_USERNAME` | `admin` | Basic Auth 用户名 |
| `AUTH_PASSWORD` | `silicon` | Basic Auth 密码 |

---

## 数据备份与迁移

### 自动备份（内置）

服务运行后会自动备份数据库：

- **频率**：每 6 小时一次（启动 5 分钟后首次备份）
- **位置**：`data/backups/silicon-{timestamp}.db`
- **保留**：7 天内的备份，至少保留 4 份最新
- **机制**：先 WAL checkpoint，再复制 .db 文件

```bash
# 查看自动备份
ls -lh data/backups/
```

### 手动备份

```bash
# SQLite 数据库备份（Bug 数据 + Wiki 索引）
cp data/silicon.db ~/backup/silicon-$(date +%Y%m%d).db

# Wiki .md 文件备份
tar czf ~/backup/wiki-$(date +%Y%m%d).tar.gz data/wiki/

# 完整备份（推荐）
tar czf silicon-bits-full-$(date +%Y%m%d).tar.gz data/
```

### 迁移到新机器

```bash
# 1. 打包数据（包含数据库、wiki 文件、bug 图片、备份）
tar czf silicon-bits-data.tar.gz data/

# 2. 传输
scp silicon-bits-data.tar.gz user@new-server:/opt/silicon-bits/

# 3. 在新机器解压
cd /opt/silicon-bits && tar xzf silicon-bits-data.tar.gz

# 4. 启动
./silicon-bits
```

---

## 常见问题

### Q: 启动报 `no such module: fts5`

编译时缺少 FTS5 build tag：
```bash
CGO_ENABLED=1 go build -tags "fts5" -o silicon-bits ./cmd/server
```

### Q: 端口被占用

```bash
PORT=9090 ./silicon-bits
```

### Q: Go 依赖下载失败（国内）

```bash
go env -w GOPROXY=https://goproxy.cn,direct
```

### Q: SQLite 数据库损坏

```bash
# 方法1：从自动备份恢复（推荐）
ls data/backups/  # 查看可用备份
cp data/backups/silicon-最新时间戳.db data/silicon.db

# 方法2：从手动备份恢复
cp ~/backup/silicon-20260516.db data/silicon.db

# 方法3：没有备份但 .md 文件还在
rm data/silicon.db
./silicon-bits  # 会重建数据库，Bug 数据丢失但 Wiki 可重新扫描
```

### Q: 如何修改密码

```bash
AUTH_USERNAME=newuser AUTH_PASSWORD=newpass ./silicon-bits
```

或修改 `docker-compose.yml` 中的环境变量后 `docker compose up -d`。
