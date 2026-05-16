# Ocean

> 水下垃圾识别与数据管理 MVP  
> From underwater image collection to AI analysis, review workflow, and governance dashboard.

Ocean 是一个面向海洋环保场景的端到端演示型项目，目标是把“水下图片采集、AI 分析、垃圾身份证入库、人工复核、治理看板”串成一条可运行的业务闭环。

它不是单纯的模型调用 Demo，而是一个带有异步任务、状态追踪、结果持久化和复核流程的最小可用系统。

## What It Does

- 上传水下图片，填写潜点信息和志愿者备注
- 自动执行图像增强、目标检测、OCR 和语义分析
- 返回异步 `jobId`，支持轮询、取消、重试和失败追踪
- 为每条识别结果生成“垃圾身份证”并写入 SQLite
- 在后台完成人工复核，在看板页查看真实聚合数据
- 支持 Web 端和微信小程序端联调

## Core Flow

```text
Image Upload
  -> Enhancement
  -> Detection
  -> OCR
  -> Semantic Analysis
  -> Trash Identity Persistence
  -> Admin Review
  -> Dashboard Overview
```

## Why This Project

水下垃圾治理的真实难点，不只是“识别出垃圾”，而是：

- 原始图片质量差，直接识别不稳定
- 通用检测模型对水下专用垃圾覆盖有限
- AI 处理链路长，现场难以判断任务卡在哪一步
- 结果若不结构化沉淀，就无法进入复核、统计和治理复盘

Ocean 的思路是先把最小闭环跑通，让一次识别结果能够持续服务于后续治理动作。

## Highlights

- **Asynchronous AI pipeline**  
  `POST /api/v1/ai/pipeline` 返回 `jobId`，独立 worker 后台消费任务，不阻塞前端交互。

- **Dedupe and cache reuse**  
  相同图片内容和相同业务输入会优先复用进行中任务，或直接命中已完成结果，减少重复推理成本。

- **Fallback-first engineering**  
  本地模型依赖缺失、推理失败或云端语义超时时，系统自动回退到规则/mock，保证业务链路不中断。

- **Trash Identity as a data abstraction**  
  把原图、增强图、检测结果、OCR、标签、风险等级、建议和审核状态统一写入“垃圾身份证”，而不是只返回一次性识别结果。

- **Real dashboard aggregation**  
  看板数据不是静态 mock，而是从真实入库记录中聚合潜点、风险和标签信息。

## Tech Stack

### Frontend

- Next.js
- React
- TypeScript
- Tailwind CSS
- shadcn-style UI
- TanStack Query

### Backend

- FastAPI
- SQLAlchemy
- SQLite

### AI / CV

- `iic/cv_nafnet_image-denoise_sidd` for enhancement
- `CVHub520/damo_yolo_t` for detection
- `damo/cv_resnet18_ocr-detection-db-line-level_damo` for OCR detection
- `iic/cv_convnextTiny_ocr-recognition-general_damo` for OCR recognition
- `Qwen/Qwen3.5-397B-A17B` for semantic analysis
- ONNX Runtime
- ModelScope SDK

### Storage

- Local file storage: `storage/uploads`, `storage/enhanced`
- SQLite: `storage/ocean.db`
- Optional Supabase Storage sync

## Current Scope

当前仓库已经包含：

- Web 端：首页、采集页、任务历史页、治理看板、后台核对页
- 微信小程序端：首页、采集页、任务历史页、治理看板、移动复核页
- FastAPI 服务：上传、异步任务、任务历史、垃圾身份证、看板接口
- 独立 worker：任务消费、阶段进度、超时与异常处理

当前项目仍然是 **MVP / demo prototype**，不是生产级系统。以下能力尚未完整实现：

- 水下垃圾专用检测模型
- 外部消息队列 / 可恢复任务系统
- 正式迁移体系和复杂权限控制
- 报告导出和更完整的数据运营功能

## Repository Structure

```text
.
├── docs/                       # 项目计划、PPT 说明、迁移文档
├── services/api/              # FastAPI 服务与 AI 流水线
├── src/app/                   # Next.js 页面
├── src/components/            # 前端组件
├── src/lib/                   # 前端数据与工具
├── wechat-miniprogram/        # 微信小程序端
├── scripts/                   # 启动与辅助脚本
└── storage/                   # 本地图片与 SQLite 数据库
```

## Key Pages

- `/` 项目首页
- `/collect` 采集与上传页
- `/jobs` 任务历史页
- `/dashboard` 治理看板
- `/admin/trash` 垃圾身份证后台核对页
- `/plan` 项目计划提示页

## API Overview

### Health and Media

- `GET /api/v1/health`
- `POST /api/v1/media/upload`

### AI Pipeline

- `POST /api/v1/ai/pipeline`
- `GET /api/v1/ai/pipeline/{job_id}`
- `POST /api/v1/ai/pipeline/{job_id}/retry`
- `POST /api/v1/ai/pipeline/{job_id}/cancel`
- `GET /api/v1/ai/pipeline-jobs`

### Data and Dashboard

- `GET /api/v1/dashboard/overview`
- `GET /api/v1/trash-identities`
- `PATCH /api/v1/trash-identities/{identity_id}`

## Quick Start

### 1. Install frontend dependencies

```bash
npm install
```

### 2. Install backend dependencies

```bash
python3 -m venv .venv
.venv/bin/pip install -r services/api/requirements.txt
```

如果你希望启用本地图像增强、检测和 OCR，再安装视觉依赖：

```bash
.venv/bin/pip install -r services/api/requirements-vision.txt
```

### 3. Configure environment variables

```bash
cp .env.local.example .env.local
cp services/api/.env.example services/api/.env
```

默认前端 API 地址：

```bash
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000
```

默认数据库位置：

```bash
storage/ocean.db
```

### 4. Start the API server

```bash
.venv/bin/uvicorn services.api.app.main:app --reload --app-dir .
```

### 5. Start the pipeline worker

```bash
.venv/bin/python services/api/scripts/run_pipeline_worker.py
```

### 6. Start the web app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 7. Open the WeChat Mini Program

用微信开发者工具导入 `wechat-miniprogram` 目录即可。

如果需要让手机实际访问本机后端，建议使用仓库中的辅助脚本：

```bash
scripts/run-wechat-api.sh
scripts/run-wechat-worker.sh
```

## Model Usage

### Enhancement

- Model: `iic/cv_nafnet_image-denoise_sidd`
- Role: 提升水下图像清晰度，改善后续检测和 OCR 输入质量
- Fallback: OpenCV underwater enhancement -> direct file copy

### Detection

- Model: `CVHub520/damo_yolo_t`
- Role: 输出垃圾位置、类别和置信度
- Runtime: ONNX Runtime with `auto / cpu / cuda / coreml`
- Fallback: rules and mock detections

### OCR

- Detection model: `damo/cv_resnet18_ocr-detection-db-line-level_damo`
- Recognition model: `iic/cv_convnextTiny_ocr-recognition-general_damo`
- Role: 提取品牌、材质和来源相关文字线索
- Fallback: crop-based OCR fallback -> mock OCR texts

### Semantic Analysis

- Model: `Qwen/Qwen3.5-397B-A17B`
- Role: 生成标签、摘要、风险等级和行动建议
- Fallback: rule-based semantic result

## Data Persistence

Ocean 默认会持久化两类核心数据：

- **Pipeline jobs**  
  用于记录任务状态、阶段、进度、错误原因、重试次数和复用次数

- **Trash identities**  
  用于记录原图、增强图、类别、OCR 文本、风险等级、建议和审核状态

这也是项目区别于普通视觉 demo 的关键：结果不是只返回一次，而是会继续参与复核、看板和治理复盘。

## Notes

- 上传接口仅支持 `JPG / PNG / WebP`
- 单张图片大小限制为 `10 MB`
- 语义分析默认超时为 `12s`，超时后快速回退规则分析
- 项目已支持 worker 心跳与在线状态检查，便于判断任务排队还是 worker 未启动
- X-AnyLabeling 平台本身具备更多能力，但当前 Ocean 仓库真正落地的是“单张图片识别 + 可配置执行后端”

## Roadmap

- 更贴近水下垃圾场景的专用检测模型
- 更稳定的外部任务队列
- 历史图片批量回迁到对象存储
- 报告导出与阶段汇报能力
- 更完整的移动端与多端协同

## Related Docs

- [docs/project-plan.md](docs/project-plan.md)
- [docs/ppt-generation-brief.md](docs/ppt-generation-brief.md)
- [docs/supabase-migration.md](docs/supabase-migration.md)

## License

当前仓库未单独声明开源许可证。如需公开发布到 GitHub，建议在发布前补充明确的 LICENSE 文件。
