# Supabase 数据库迁移说明

## 1. 准备连接串

当前项目统一使用环境变量 `DATABASE_URL`。

如果你的密码里包含特殊字符，例如：

- `[` `]`
- `!`
- `@`
- `#`
- `%`

需要先做 URL 编码。

例如原始密码：

```text
[!Liutaotao0202]
```

编码后应写成：

```text
%5B%21Liutaotao0202%5D
```

示例：

```text
postgresql+psycopg://postgres:%5B%21Liutaotao0202%5D@db.xxx.supabase.co:5432/postgres
```

## 2. 安装依赖

```bash
.venv/bin/pip install -r services/api/requirements.txt
```

## 3. 创建 Supabase 表结构

不把凭证写进仓库文件时，可以直接临时带环境变量执行：

```bash
DATABASE_URL='postgresql+psycopg://USER:ENCODED_PASSWORD@HOST:5432/postgres' \
.venv/bin/alembic -c services/api/alembic.ini upgrade head
```

## 4. 导入本地 SQLite 数据

默认源库是本地：

```text
storage/ocean.db
```

执行导入：

```bash
SOURCE_DATABASE_URL='sqlite:////Users/liuzhenyu_macbookpro/Desktop/Project/Ocean/storage/ocean.db' \
TARGET_DATABASE_URL='postgresql+psycopg://USER:ENCODED_PASSWORD@HOST:5432/postgres' \
.venv/bin/python services/api/scripts/migrate_sqlite_to_database.py
```

当前脚本会迁移：

- `pipeline_jobs`
- `trash_identities`

并按业务唯一键跳过目标库中已存在的记录：

- 任务表按 `job_id`
- 垃圾身份证表按 `identity_id`

## 5. 切换本地后端到 Supabase

在 `services/api/.env` 中设置：

```env
DATABASE_URL=postgresql+psycopg://USER:ENCODED_PASSWORD@HOST:5432/postgres
```

然后启动后端：

```bash
.venv/bin/uvicorn services.api.app.main:app --reload --app-dir .
```

## 6. 验证

建议至少检查：

```bash
curl http://127.0.0.1:8000/api/v1/health
curl 'http://127.0.0.1:8000/api/v1/ai/pipeline-jobs?page=1&pageSize=5'
curl 'http://127.0.0.1:8000/api/v1/trash-identities?limit=5'
```

其中 `GET /api/v1/health` 还会返回 worker 队列监控摘要，可直接判断是否存在“有排队任务但没有在线 worker”的情况。

如果你已经启用了当前版本的独立 worker，还需要同时运行：

```bash
.venv/bin/python services/api/scripts/run_pipeline_worker.py
```

## 7. 当前边界

- 现在已经引入 `Alembic`，但应用启动仍保留 `create_all` 兜底逻辑，适合当前 MVP 过渡阶段。
- 目前只迁数据库，不迁 `storage/uploads` 和 `storage/enhanced` 图片文件。
- 任务与垃圾身份证数据可以先迁到 Supabase，图片仍保留本地或后续迁到对象存储。

## 8. 图片同步到 Supabase Storage

如果你希望把上传图和增强图同步到 Supabase Storage，再补下面这些环境变量。

### 方案 A：Storage API

```env
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
SUPABASE_STORAGE_BUCKET=ocean-media
SUPABASE_STORAGE_PUBLIC=true
```

### 方案 B：S3 协议

```env
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_S3_ENDPOINT=https://<project-ref>.storage.supabase.co/storage/v1/s3
SUPABASE_S3_REGION=<project-region>
SUPABASE_S3_ACCESS_KEY_ID=<access-key-id>
SUPABASE_S3_SECRET_ACCESS_KEY=<secret-access-key>
SUPABASE_STORAGE_BUCKET=ocean-media
SUPABASE_STORAGE_PUBLIC=true
```

注意：

- `SUPABASE_S3_ACCESS_KEY_ID` 不是 `Secret Access Key`，两者必须成对使用。
- 如果你走 S3 协议并且桶不是 public，把 `SUPABASE_STORAGE_PUBLIC=false`，当前后端会自动返回 `/api/v1/media/object/...` 代理 URL。
- 当前后端优先级是：`S3 协议 > Storage API > 本地文件`。

当前后端行为：

- 新上传图片会先落本地，再尝试同步到 Supabase Storage。
- 新生成的增强图也会自动同步到 Supabase Storage。
- 没有配置 `SUPABASE_SERVICE_ROLE_KEY` 时，会自动回退到本地文件 URL，不会阻断业务链路。

如果你要把历史图片也迁过去，执行：

```bash
.venv/bin/python services/api/scripts/migrate_local_media_to_storage.py
```
