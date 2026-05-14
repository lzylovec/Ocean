from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class TrashClassification:
    item_name: str
    professional_category: str
    category_code: str
    category_group: str


@dataclass(frozen=True)
class TrashTaxonomyEntry:
    item_name: str
    professional_category: str
    category_code: str
    category_group: str
    matched_categories: tuple[str, ...] = ()
    text_keywords: tuple[str, ...] = ()
    ocr_keywords: tuple[str, ...] = ()


TRASH_TAXONOMY_TABLE: tuple[TrashTaxonomyEntry, ...] = (
    # 渔业活动相关废弃物
    TrashTaxonomyEntry(
        item_name="废弃渔网",
        professional_category="渔业活动相关废弃物",
        category_code="FISHING_NET",
        category_group="渔业废弃物",
        matched_categories=("废弃渔网",),
        text_keywords=("渔网", "网片", "网衣"),
    ),
    TrashTaxonomyEntry(
        item_name="尼龙绳索",
        professional_category="渔业活动相关废弃物",
        category_code="FISHING_ROPE",
        category_group="渔业废弃物",
        matched_categories=("绳索碎段",),
        text_keywords=("绳索", "缆绳", "尼龙绳", "系泊绳", "绳头"),
        ocr_keywords=("NYLON",),
    ),
    TrashTaxonomyEntry(
        item_name="浮球/浮筒",
        professional_category="渔业活动相关废弃物",
        category_code="FISHING_FLOAT",
        category_group="渔业废弃物",
        text_keywords=("浮球", "浮筒", "浮漂", "漂浮球"),
    ),

    # 塑料类包装废弃物
    TrashTaxonomyEntry(
        item_name="塑料包装",
        professional_category="轻质塑料包装废弃物",
        category_code="PLASTIC_PACKAGING",
        category_group="塑料废弃物",
        matched_categories=("包装碎片", "塑料瓶"),
        text_keywords=("包装", "塑料袋", "包装袋", "薄膜袋", "购物袋"),
    ),
    TrashTaxonomyEntry(
        item_name="塑料软包装袋",
        professional_category="轻质塑料包装废弃物",
        category_code="SOFT_PLASTIC_BAG",
        category_group="塑料废弃物",
        text_keywords=("软包装", "包装袋", "零食袋", "复合袋", "薄膜"),
    ),
    TrashTaxonomyEntry(
        item_name="塑料包装碎片",
        professional_category="轻质塑料包装废弃物",
        category_code="PLASTIC_FRAGMENT",
        category_group="塑料废弃物",
        matched_categories=("包装碎片",),
    ),
    TrashTaxonomyEntry(
        item_name="饮料瓶（PET）",
        professional_category="塑料类包装废弃物",
        category_code="PET_BOTTLE",
        category_group="塑料废弃物",
        matched_categories=("塑料瓶",),
        text_keywords=("饮料", "瓶装", "矿泉水瓶", "可乐瓶"),
        ocr_keywords=("PET", "DRINK"),
    ),
    TrashTaxonomyEntry(
        item_name="日化瓶（HDPE）",
        professional_category="塑料类包装废弃物",
        category_code="HDPE_BOTTLE",
        category_group="塑料废弃物",
        matched_categories=("塑料瓶",),
        text_keywords=("洗发水瓶", "洗洁精瓶", "清洁剂瓶", "日化瓶"),
        ocr_keywords=("HDPE", "PE"),
    ),
    TrashTaxonomyEntry(
        item_name="塑料瓶",
        professional_category="塑料类包装废弃物",
        category_code="PLASTIC_BOTTLE",
        category_group="塑料废弃物",
        matched_categories=("塑料瓶",),
    ),

    # 塑料类容器与一次性消费制品
    TrashTaxonomyEntry(
        item_name="塑料杯",
        professional_category="一次性塑料制品废弃物",
        category_code="PLASTIC_CUP",
        category_group="塑料废弃物",
        matched_categories=("塑料杯",),
        text_keywords=("塑料杯", "饮水杯", "杯盖"),
    ),
    TrashTaxonomyEntry(
        item_name="塑料餐盒/容器",
        professional_category="塑料类容器废弃物",
        category_code="PLASTIC_CONTAINER",
        category_group="塑料废弃物",
        matched_categories=("塑料容器",),
        text_keywords=("餐盒", "饭盒", "塑料盒", "外卖盒", "容器"),
    ),
    TrashTaxonomyEntry(
        item_name="塑料瓶盖",
        professional_category="一次性塑料制品废弃物",
        category_code="BOTTLE_CAP",
        category_group="塑料废弃物",
        text_keywords=("瓶盖", "盖子"),
    ),

    # 金属包装与硬质容器
    TrashTaxonomyEntry(
        item_name="易拉罐",
        professional_category="金属包装废弃物",
        category_code="ALUMINUM_CAN",
        category_group="金属废弃物",
        matched_categories=("金属易拉罐",),
        text_keywords=("易拉罐", "饮料罐", "铝罐", "罐体"),
        ocr_keywords=("AL", "CAN", "TIN"),
    ),
    TrashTaxonomyEntry(
        item_name="金属食品罐",
        professional_category="金属包装废弃物",
        category_code="FOOD_CAN",
        category_group="金属废弃物",
        text_keywords=("食品罐", "罐头", "铁罐"),
    ),
    TrashTaxonomyEntry(
        item_name="玻璃瓶",
        professional_category="玻璃包装废弃物",
        category_code="GLASS_BOTTLE",
        category_group="玻璃废弃物",
        matched_categories=("玻璃容器",),
        text_keywords=("玻璃", "玻璃瓶", "酒瓶"),
    ),
    TrashTaxonomyEntry(
        item_name="玻璃碎片",
        professional_category="玻璃包装废弃物",
        category_code="GLASS_FRAGMENT",
        category_group="玻璃废弃物",
        text_keywords=("玻璃碎片", "碎玻璃"),
    ),

    # 电子与危险废弃物
    TrashTaxonomyEntry(
        item_name="废旧电池",
        professional_category="危险废弃物",
        category_code="WASTE_BATTERY",
        category_group="危险废弃物",
        text_keywords=("电池", "干电池", "锂电池", "纽扣电池"),
    ),
    TrashTaxonomyEntry(
        item_name="电子废弃物",
        professional_category="电子废弃物",
        category_code="E_WASTE",
        category_group="电子废弃物",
        matched_categories=("电子垃圾",),
        text_keywords=("手机", "电池", "电子", "电路板", "充电器", "耳机"),
    ),

    # 一次性消费制品与纸基废弃物
    TrashTaxonomyEntry(
        item_name="一次性餐具",
        professional_category="一次性消费制品废弃物",
        category_code="DISPOSABLE_CUTLERY",
        category_group="一次性消费制品",
        matched_categories=("一次性餐具",),
        text_keywords=("餐具", "勺", "叉", "碗", "吸管", "筷子"),
    ),
    TrashTaxonomyEntry(
        item_name="纸盒/纸包装",
        professional_category="纸基包装废弃物",
        category_code="PAPER_PACKAGING",
        category_group="纸类废弃物",
        matched_categories=("纸质垃圾",),
        text_keywords=("纸盒", "纸板", "纸包装", "纸杯"),
    ),
    TrashTaxonomyEntry(
        item_name="纸质碎片",
        professional_category="纸基包装废弃物",
        category_code="PAPER_FRAGMENT",
        category_group="纸类废弃物",
        matched_categories=("纸质垃圾",),
    ),

    # 纺织与橡胶制品
    TrashTaxonomyEntry(
        item_name="织物碎片",
        professional_category="纺织品废弃物",
        category_code="TEXTILE_FRAGMENT",
        category_group="纺织废弃物",
        matched_categories=("织物垃圾",),
        text_keywords=("织物", "布", "衣", "纺织", "手套", "布片"),
    ),
    TrashTaxonomyEntry(
        item_name="橡胶球类",
        professional_category="橡胶制品废弃物",
        category_code="RUBBER_ARTICLE",
        category_group="橡胶废弃物",
        matched_categories=("橡胶球类",),
        text_keywords=("球", "橡胶", "浮球"),
    ),

    # 板材与大件固废
    TrashTaxonomyEntry(
        item_name="泡沫板",
        professional_category="发泡塑料废弃物",
        category_code="FOAM_BOARD",
        category_group="塑料废弃物",
        matched_categories=("板类垃圾",),
        text_keywords=("泡沫", "泡沫板", "EPS"),
    ),
    TrashTaxonomyEntry(
        item_name="木板",
        professional_category="木质板材废弃物",
        category_code="WOOD_BOARD",
        category_group="木质废弃物",
        matched_categories=("板类垃圾",),
        text_keywords=("木板",),
    ),
    TrashTaxonomyEntry(
        item_name="硬质塑料板材",
        professional_category="硬质塑料制品废弃物",
        category_code="RIGID_PLASTIC_BOARD",
        category_group="塑料废弃物",
        matched_categories=("板类垃圾",),
        text_keywords=("塑料板", "板材"),
    ),
    TrashTaxonomyEntry(
        item_name="大型容器垃圾",
        professional_category="大型容器类废弃物",
        category_code="LARGE_CONTAINER",
        category_group="大件废弃物",
        matched_categories=("大型容器垃圾",),
        text_keywords=("箱体", "容器", "箱包"),
    ),
    TrashTaxonomyEntry(
        item_name="塑料日用品",
        professional_category="其他塑料制品废弃物",
        category_code="OTHER_PLASTIC_ARTICLE",
        category_group="塑料废弃物",
        matched_categories=("塑料制品",),
        text_keywords=("牙刷", "梳子", "塑料件"),
    ),
)


def classify_trash_identity(
    *,
    primary_category: str | None,
    categories: list[str] | None,
    volunteer_note: str | None,
    volunteer_summary: str | None,
    source_hint: str | None,
    ocr_texts: list[str] | None,
    ocr_keywords: list[str] | None,
) -> TrashClassification:
    category_list = list(categories or [])
    category_set = set(category_list)
    text_blob = _build_text_blob(
        volunteer_note=volunteer_note,
        volunteer_summary=volunteer_summary,
        source_hint=source_hint,
        ocr_texts=ocr_texts,
        ocr_keywords=ocr_keywords,
    )
    ocr_keyword_set = {keyword.upper() for keyword in (ocr_keywords or [])}

    for entry in TRASH_TAXONOMY_TABLE:
        if not _matches_entry(
            entry,
            category_set=category_set,
            text_blob=text_blob,
            ocr_keyword_set=ocr_keyword_set,
        ):
            continue
        return TrashClassification(
            item_name=entry.item_name,
            professional_category=entry.professional_category,
            category_code=entry.category_code,
            category_group=entry.category_group,
        )

    if category_list:
        return TrashClassification(
            item_name=category_list[0],
            professional_category="混合固体废弃物",
            category_code="MIXED_SOLID_WASTE",
            category_group="混合废弃物",
        )

    return TrashClassification(
        item_name=primary_category or "待补充",
        professional_category="混合固体废弃物",
        category_code="MIXED_SOLID_WASTE",
        category_group="混合废弃物",
    )


def _build_text_blob(
    *,
    volunteer_note: str | None,
    volunteer_summary: str | None,
    source_hint: str | None,
    ocr_texts: list[str] | None,
    ocr_keywords: list[str] | None,
) -> str:
    return " ".join(
        part
        for part in [
            volunteer_note or "",
            volunteer_summary or "",
            source_hint or "",
            " ".join(ocr_texts or []),
            " ".join(ocr_keywords or []),
        ]
        if part
    ).lower()


def _matches_entry(
    entry: TrashTaxonomyEntry,
    *,
    category_set: set[str],
    text_blob: str,
    ocr_keyword_set: set[str],
) -> bool:
    category_match = (
        not entry.matched_categories
        or any(category in category_set for category in entry.matched_categories)
    )
    text_match = (
        not entry.text_keywords
        or any(keyword in text_blob for keyword in entry.text_keywords)
    )
    ocr_match = (
        not entry.ocr_keywords
        or any(keyword in ocr_keyword_set for keyword in entry.ocr_keywords)
    )

    if entry.text_keywords and entry.ocr_keywords:
        return category_match and (text_match or ocr_match)
    return category_match and text_match and ocr_match
