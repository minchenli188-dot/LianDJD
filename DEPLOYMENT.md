# 阿莲读经典 - 部署与维护文档

> 最后更新：2026年1月15日

---

## 📋 项目概览

| 项目 | 信息 |
|------|------|
| 项目名称 | 阿莲读经典 - 智慧家长学堂 |
| 域名 | https://liandjd.com |
| GitHub | https://github.com/minchenli188-dot/LianDJD |
| 技术栈 | Node.js (原生 HTTP 服务器) |
| AI 模型 | Google Gemini (gemini-3-flash-preview) |

---

## 🖥️ 服务器信息

| 项目 | 信息 |
|------|------|
| 云服务商 | AWS Lightsail |
| 区域 | Singapore (ap-southeast-1a) |
| 公网 IP | 18.139.165.168 |
| 用户名 | ubuntu |
| 操作系统 | Ubuntu |

### SSH 登录方式

**方式一：AWS 控制台**
- 登录 AWS Lightsail → 选择实例 → 点击 "Connect using SSH"

**方式二：本地终端**
```bash
ssh -i your-key.pem ubuntu@18.139.165.168
```

---

## 📁 服务器目录结构

```
/home/ubuntu/
├── LianDJD/                    # 阿莲读经典
│   ├── server.js               # 后端服务器
│   ├── app.js                  # 前端逻辑
│   ├── index.html              # 主页面
│   ├── styles.css              # 样式文件
│   ├── data.json               # 《大学》内容数据
│   ├── analytics.json          # 分析数据（运行时生成）
│   ├── .env                    # 环境变量（API Key）
│   └── .gitignore              # Git 忽略配置
│
├── [其他应用目录]/              # MBTI 等其他应用
└── ...
```

---

## 🔧 端口分配

| 端口 | 应用 | 说明 |
|------|------|------|
| 80 | Nginx | 反向代理入口 |
| 22 | SSH | 远程登录 |
| 3000 | mbti-frontend | MBTI 前端 |
| 8000 | mbti-backend | MBTI 后端 |
| **8080** | **liandjd** | **阿莲读经典** |

---

## 常用维护命令

### PM2 进程管理

```bash
# 查看所有应用状态
pm2 list

# 查看阿莲读经典日志
pm2 logs liandjd

# 重启阿莲读经典
pm2 restart liandjd

# 停止阿莲读经典
pm2 stop liandjd

# 启动阿莲读经典
pm2 start liandjd

# 删除应用（谨慎）
pm2 delete liandjd

# 保存 PM2 配置
pm2 save
```

### Nginx 管理

```bash
# 测试配置语法
sudo nginx -t

# 重新加载配置（不中断服务）
sudo systemctl reload nginx

# 重启 Nginx
sudo systemctl restart nginx

# 查看 Nginx 状态
sudo systemctl status nginx

# 查看 Nginx 错误日志
sudo tail -f /var/log/nginx/error.log

# 查看 Nginx 访问日志
sudo tail -f /var/log/nginx/access.log
```

### 代码更新

```bash
# 进入项目目录
cd /home/ubuntu/LianDJD

# 拉取最新代码
git pull origin main

# 重启应用
pm2 restart liandjd
```

---

## ⚙️ 配置文件位置

### 环境变量 (.env)

```bash
# 路径
/home/ubuntu/LianDJD/.env

# 内容
GEMINI_API_KEY=你的API密钥
GEMINI_MODEL=gemini-3-flash-preview

# 编辑
nano /home/ubuntu/LianDJD/.env
```

### Nginx 配置

```bash
# 配置文件路径
/etc/nginx/sites-available/liandjd

# 软链接
/etc/nginx/sites-enabled/liandjd

# 编辑配置
sudo nano /etc/nginx/sites-available/liandjd

# 修改后重新加载
sudo nginx -t && sudo systemctl reload nginx
```

### Nginx 配置内容

```nginx
server {
    server_name liandjd.com www.liandjd.com;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    listen 443 ssl; # managed by Certbot
    ssl_certificate /etc/letsencrypt/live/liandjd.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/liandjd.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
}

server {
    if ($host = www.liandjd.com) {
        return 301 https://$host$request_uri;
    }
    if ($host = liandjd.com) {
        return 301 https://$host$request_uri;
    }

    listen 80;
    listen [::]:80;
    server_name liandjd.com www.liandjd.com;
    return 404;
}
```

---

## ☁️ Cloudflare 配置

### DNS 记录

| Type | Name | Content | Proxy |
|------|------|---------|-------|
| A | @ | 18.139.165.168 | Proxied (橙色) |
| A | www | 18.139.165.168 | Proxied (橙色) |

### SSL/TLS 设置

- **加密模式**: Full（全程加密）
- **Always Use HTTPS**: 开启
- **Auto Minify**: 可选开启

### Let's Encrypt 证书

| 项目 | 信息 |
|------|------|
| 证书路径 | `/etc/letsencrypt/live/liandjd.com/fullchain.pem` |
| 私钥路径 | `/etc/letsencrypt/live/liandjd.com/privkey.pem` |
| 过期时间 | 2026-04-15（自动续期） |

```bash
# 手动续期证书（通常不需要，Certbot 会自动续期）
sudo certbot renew

# 检查证书状态
sudo certbot certificates
```

### Cloudflare 管理地址

https://dash.cloudflare.com → 选择 liandjd.com

---

## 数据分析面板

访问地址：https://liandjd.com/api/analytics/dashboard

### API 端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/analytics/dashboard` | GET | HTML 数据面板 |
| `/api/analytics/summary` | GET | JSON 数据摘要 |
| `/api/analytics/pageview` | POST | 记录页面访问 |
| `/api/analytics/ai` | POST | 记录 AI 使用 |

---

## 🚨 故障排查

### 网站无法访问

```bash
# 1. 检查应用是否运行
pm2 list

# 2. 检查端口是否监听
sudo ss -tlnp | grep 8080

# 3. 检查 Nginx 状态
sudo systemctl status nginx

# 4. 查看应用日志
pm2 logs liandjd --lines 50

# 5. 查看 Nginx 错误日志
sudo tail -50 /var/log/nginx/error.log
```

### AI 功能不工作

```bash
# 1. 检查 .env 文件
cat /home/ubuntu/LianDJD/.env

# 2. 确认 API Key 正确
# 3. 查看错误日志
pm2 logs liandjd --lines 50
```

### 更新代码后不生效

```bash
# 确保重启应用
cd /home/ubuntu/LianDJD
git pull origin main
pm2 restart liandjd
```

---

## 🔐 安全注意事项

1. **`.env` 文件**：包含 API Key，绝不要提交到 Git
2. **`analytics.json`**：包含用户数据，不要公开
3. **SSH Key**：妥善保管，不要泄露
4. **定期更新**：保持系统和依赖更新

---

## 📝 更新日志

### 2026-01-15
- 配置 Let's Encrypt SSL 证书（全程 HTTPS 加密）
- Cloudflare SSL 模式从 Flexible 升级为 Full
- 更新 Nginx 配置支持 443 端口

### 2026-01-09
- 初始部署到 AWS Lightsail
- 配置 Cloudflare DNS 和 SSL
- PM2 进程管理
- Nginx 反向代理配置

---

## 🆘 紧急联系

如遇紧急问题，可以：
1. 查看本文档的故障排查部分
2. 检查 PM2 和 Nginx 日志
3. 重启应用：`pm2 restart liandjd`
4. 重启 Nginx：`sudo systemctl restart nginx`
