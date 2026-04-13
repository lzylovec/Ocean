export default function PlanPage() {
  return (
    <main className="page">
      <div className="shell">
        <header className="page-header">
          <p className="eyebrow">Project Plan</p>
          <h1>项目计划已落盘</h1>
          <p>Markdown 文件已生成在项目目录 `docs/project-plan.md`，后续可继续在这份文档上迭代需求、架构和里程碑。</p>
        </header>

        <section className="card">
          <h3>当前文件路径</h3>
          <p>`docs/project-plan.md`</p>
          <p>这份文档已经包含：一期范围、魔搭社区接入策略、接口规划、实施节奏和当前约束。</p>
        </section>
      </div>
    </main>
  );
}
