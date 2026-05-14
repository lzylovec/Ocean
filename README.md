# Ocean

水下垃圾识别与数据管理 MVP。

当前交付包含两部分：

- `Next.js` 网页端：项目首页、采集页、任务历史页、数据看板、垃圾身份证后台页。
- `微信小程序` 移动端：首页、采集页、任务历史页、治理看板、移动复核页。
- `FastAPI` 服务端：本地文件上传、异步 AI 流水线、NAFNet 增强、DAMO-YOLO 检测、OCR detection + recognition、志愿者反馈语义分析接入、看板与任务接口。

## 目录结构

```text
.
├── docs/project-plan.md
├── services/api
├── src/app
├── wechat-miniprogram
├── src/components
├── src/lib
└── storage
```

## 本地启动

### 1. 安装前端依赖

```bash
npm install
```

### 2. 安装后端依赖

```bash
python3 -m venv .venv
.venv/bin/pip install -r services/api/requirements.txt
```

如果你要启用当前已经固定好的魔搭增强模型 `iic/cv_nafnet_image-denoise_sidd`，再安装一次视觉依赖：

```bash
.venv/bin/pip install -r services/api/requirements-vision.txt
```

### 3. 配置环境变量

```bash
cp .env.local.example .env.local
cp services/api/.env.example services/api/.env
```

当前增强模型走本地 ModelScope SDK，不依赖 key；检测模型 `CVHub520/damo_yolo_t` 走本地 ONNX Runtime；OCR 走 `damo/cv_resnet18_ocr-detection-db-line-level_damo` + `iic/cv_convnextTiny_ocr-recognition-general_damo` 两阶段本地 ModelScope SDK；志愿者文本语义分析走 ModelScope OpenAI 兼容接口。
垃圾身份证和异步任务状态默认持久化到 `storage/ocean.db`。
如果你希望把图片同步到 Supabase Storage，可以配置 `SUPABASE_SERVICE_ROLE_KEY`，或者改走 Supabase S3 协议（`SUPABASE_S3_ENDPOINT`、`SUPABASE_S3_ACCESS_KEY_ID`、`SUPABASE_S3_SECRET_ACCESS_KEY`）；后端会优先把上传图和增强图写入 `SUPABASE_STORAGE_BUCKET`，拿不到配置时自动回退到本地 `storage/uploads`、`storage/enhanced`。如果 `SUPABASE_STORAGE_PUBLIC=false`，图片将通过后端 `/api/v1/media/object/...` 代理返回，不依赖 public bucket。
当前默认把语义分析云端超时收紧到 `12s`、尝试次数收紧到 `1`，超时后会快速回退到规则分析，避免任务长时间卡在 `analyzing`。
后台核对页现在已经提供“回迁历史图片到对象存储”按钮，对应接口是 `POST /api/v1/media/migrate-storage`。
`ONNX_EXECUTION_PROVIDER=auto` 时会优先尝试 CUDA，其次 CoreML，最后回退 CPU；也可以手动设为 `cpu`、`cuda` 或 `coreml`。
如果安装视觉依赖时遇到平台兼容问题，系统会自动回退到 `mock-copy` 或 `mock-fallback`，业务链路仍可继续联调。
上传接口默认只接受 `JPG/PNG/WebP`，单张不超过 `10 MB`。
`POST /api/v1/ai/pipeline` 现在会返回异步 `jobId`，前端通过轮询任务状态获取最终垃圾身份证结果。
重复提交同一图片内容与相同业务输入时，系统会优先复用进行中任务或直接命中已完成结果缓存，避免重复跑模型。

需要注意：你列出的 GPU 加速、批量预测、视频处理、多标签格式导入导出、多任务标注等能力，主要来自这个模型仓库所属的 `X-AnyLabeling` 平台能力，不等于我们当前项目已经全部集成。现在这个项目里已经真正接入的是“单张图片检测 + 可配置执行后端”。

`GET /api/v1/health` 现在除了基础存活状态，也会返回 worker 心跳、排队任务数和运行任务数，便于判断“任务在排队”还是“worker 没启动”。

### 4. 启动后端

```bash
.venv/bin/uvicorn services.api.app.main:app --reload --app-dir .
```

### 5. 启动异步 worker

```bash
.venv/bin/python services/api/scripts/run_pipeline_worker.py
```

现在 AI 任务由独立 worker 消费，API 只负责入队和查询状态。

### 6. 启动前端

```bash
npm run dev
```

打开 `http://localhost:3000`。

### 7. 打开微信小程序端

用微信开发者工具导入 `wechat-miniprogram` 目录即可。小程序现在会按运行环境自动选择地址：开发者工具默认请求 `127.0.0.1:8000`，真机调试默认请求当前机器的局域网地址，手机预览则必须改成 HTTPS 公网域名；如果电脑 IP 变化，可执行 `scripts/sync-wechat-api-base.sh` 重新同步真机调试地址。

如果要让手机实际连到你的本机后端，启动 FastAPI 时也要监听局域网地址，而不是默认只监听本机回环地址：

```bash
scripts/run-wechat-api.sh
```

worker 也建议改用：

```bash
scripts/run-wechat-worker.sh
```

如果是真机或正式发布，请把小程序请求域名改成微信后台已配置的 `HTTPS` 合法域名，并同步设置后端 `PUBLIC_BASE_URL`，避免图片 `publicUrl` 仍指向本地地址。

## 当前实现状态

- 已完成：项目首页、采集页、任务历史页、看板页、垃圾身份证后台页。
- 已完成：微信小程序端首页、采集页、任务历史页、治理看板、移动复核页。
- 已完成：本地图片上传校验、异步 AI 流水线、独立 worker 消费、任务轮询、任务取消/重试、任务分页与保留策略、重复提交去重与结果缓存复用。
- 已完成：NAFNet 增强接入结构、`CVHub520/damo_yolo_t` 检测接入结构、OCR 检测与识别接入结构、志愿者反馈语义分析接入结构、数据库持久化、Supabase Storage 可选同步。
- 已完成：真实看板聚合、后台筛选、垃圾身份证状态回写。
- 待接入：更贴近水下垃圾类别的检测模型、独立任务队列、历史图片批量回迁到对象存储、报告导出。

## 魔搭社区接入点

当前增强模型接入点：

- `services/api/app/services/enhancement.py`

当前检测模型接入点：

- `services/api/app/services/detection.py`

当前 OCR 模型接入点：

- `services/api/app/services/ocr.py`

当前语义分析接入点：

- `services/api/app/services/semantic.py`

统一 AI 编排入口：

- `services/api/app/services/pipeline.py`

垃圾身份证查询入口：

- `GET /api/v1/trash-identities`

异步任务入口：

- `POST /api/v1/ai/pipeline`
- `GET /api/v1/ai/pipeline/{job_id}`
- `POST /api/v1/ai/pipeline/{job_id}/retry`
- `POST /api/v1/ai/pipeline/{job_id}/cancel`
- `GET /api/v1/ai/pipeline-jobs`

当前服务已经预留了：

- NAFNet 图像去噪增强入口
- `CVHub520/damo_yolo_t` ONNX 垃圾检测入口
- `damo/cv_resnet18_ocr-detection-db-line-level_damo` OCR 检测入口
- `iic/cv_convnextTiny_ocr-recognition-general_damo` OCR 识别入口
- `Qwen/Qwen3.5-397B-A17B` 志愿者反馈语义分析入口
- OCR 与来源推断的统一聚合返回结构

## Supabase 迁移

如果你准备把数据库迁移到 Supabase，参考：

- `docs/supabase-migration.md`

当前仓库已经包含：

- `Alembic` 迁移骨架
- 初始表结构 migration
- `SQLite -> 目标数据库` 导入脚本
