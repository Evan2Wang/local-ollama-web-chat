from sqlalchemy import select

from app.database import SessionLocal
from app.models import PromptTemplate


BUILTIN_TEMPLATES = [
    (
        "builtin_file_summary",
        "文件总结",
        "请总结当前上传的文件，输出：\n1. 核心结论\n2. 关键事实\n3. 重要数据\n4. 风险与问题\n5. 后续建议\n\n要求：优先基于文件内容，不要编造文件中没有的信息。",
    ),
    (
        "builtin_image_text",
        "图片转文字",
        "请识别图片中的文字，并尽量保持原始排版结构。\n如果图片中有表格，请尽量转换为 Markdown 表格。\n如果有无法识别的内容，请明确标注“无法识别”。",
    ),
    (
        "builtin_extract_table",
        "提取表格",
        "请从当前文件或图片中提取表格信息，并转换为 Markdown 表格。\n如果原文没有明确表格，请根据内容整理成结构化表格。",
    ),
    (
        "builtin_ppt_outline",
        "生成PPT大纲",
        "请将当前内容整理成适合领导汇报的 PPT 大纲，要求：\n1. 结论先行\n2. 每页一个明确标题\n3. 每页 3-5 个要点\n4. 风格务实，不要空话\n5. 尽量使用“结论 + 支撑事实 + 下一步动作”的结构",
    ),
    (
        "builtin_leader_brief",
        "压缩成领导汇报版",
        "请将当前内容压缩成领导汇报版，要求：\n1. 先给一句话结论\n2. 保留关键事实和数据\n3. 删除过程性、重复性、口语化表达\n4. 语气正式、简洁、务实\n5. 如有风险或待决策事项，请单独列出",
    ),
    (
        "builtin_translate_cn",
        "翻译成中文",
        "请将当前内容翻译成中文，要求：\n1. 准确表达原意\n2. 保留专业术语\n3. 语气自然，适合商务或技术场景\n4. 如有歧义，请在译文后说明",
    ),
    (
        "builtin_todos",
        "提取待办事项",
        "请从当前内容中提取待办事项，输出表格：\n| 序号 | 待办事项 | 责任方 | 截止时间 | 优先级 | 备注 |\n\n如果内容中没有明确责任方或时间，请填“待确认”。",
    ),
    (
        "builtin_logic_review",
        "检查逻辑问题",
        "请检查当前内容的逻辑问题，重点关注：\n1. 结论是否清晰\n2. 论据是否支撑结论\n3. 是否有表达重复\n4. 是否有事实不完整或需要确认的地方\n5. 是否适合给领导或客户阅读",
    ),
]


def seed_builtin_templates() -> None:
    with SessionLocal() as db:
        existing = set(db.scalars(select(PromptTemplate.id).where(PromptTemplate.is_builtin.is_(True))))
        changed = False
        for sort_order, (template_id, name, content) in enumerate(BUILTIN_TEMPLATES, start=1):
            if template_id in existing:
                continue
            db.add(
                PromptTemplate(
                    id=template_id,
                    name=name,
                    content=content,
                    category="内置",
                    sort_order=sort_order,
                    enabled=True,
                    is_builtin=True,
                )
            )
            changed = True
        if changed:
            db.commit()
