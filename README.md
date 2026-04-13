# Ocean

水下垃圾识别与数据管理 MVP。

当前交付包含两部分：

- `Next.js` 网页端：项目首页、采集页、数据看板、垃圾身份证后台页。
- `FastAPI` 服务端：本地文件上传、NAFNet 增强、DAMO-YOLO 检测、OCR detection + recognition、志愿者反馈语义分析接入、看板数据接口。

## 目录结构

```text
.
├── docs/project-plan.md
├── services/api
├── src/app
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
垃圾身份证默认持久化到 `storage/ocean.db`。
`ONNX_EXECUTION_PROVIDER=auto` 时会优先尝试 CUDA，其次 CoreML，最后回退 CPU；也可以手动设为 `cpu`、`cuda` 或 `coreml`。
如果安装视觉依赖时遇到平台兼容问题，系统会自动回退到 `mock-copy` 或 `mock-fallback`，业务链路仍可继续联调。

需要注意：你列出的 GPU 加速、批量预测、视频处理、多标签格式导入导出、多任务标注等能力，主要来自这个模型仓库所属的 `X-AnyLabeling` 平台能力，不等于我们当前项目已经全部集成。现在这个项目里已经真正接入的是“单张图片检测 + 可配置执行后端”。

### 4. 启动后端

```bash
.venv/bin/uvicorn services.api.app.main:app --reload --app-dir .
```

### 5. 启动前端

```bash
npm run dev
```

打开 `http://localhost:3000`。

## 当前实现状态

- 已完成：项目首页、采集页、看板页、垃圾身份证后台页。
- 已完成：本地图片上传接口、NAFNet 增强接入结构、`CVHub520/damo_yolo_t` 检测接入结构、OCR 检测与识别接入结构、志愿者反馈语义分析接入结构、SQLite 持久化。
- 已完成：项目计划文档落盘为 `docs/project-plan.md`。
- 待接入：更贴近水下垃圾类别的检测模型、数据库持久化、正式报告导出、小程序端。

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

当前服务已经预留了：

- NAFNet 图像去噪增强入口
- `CVHub520/damo_yolo_t` ONNX 垃圾检测入口
- `damo/cv_resnet18_ocr-detection-db-line-level_damo` OCR 检测入口
- `iic/cv_convnextTiny_ocr-recognition-general_damo` OCR 识别入口
- `Qwen/Qwen3.5-397B-A17B` 志愿者反馈语义分析入口
- OCR 与来源推断的统一聚合返回结构
