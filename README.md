# 会计学分录复习站

这是一个本地静态复习网站，入口是 `index.html`。网站按考试结构分为选择题、判断题、分录题、计算分析题四个板块；分录题仍按“简要介绍业务场景 + 并列展示不同会计处理”的格式组织。

## 文件结构

- `index.html`：页面结构。
- `styles.css`：视觉样式和移动端适配。
- `app.js`：搜索、筛选、展开和渲染逻辑。
- `data/accountingEntries.js`：知识库数据，后续主要改这里。
- `data/practiceExercises.js`：流程型习题库，按分录场景 ID 关联到对应窗口。
- `data/examReview.js`：考试结构、选择/判断考点链、计算分析公式清单。
- `data/pptExercises.js`：从 14 个 PPT 自动检索出的例题/习题/分录题/计算题索引。
- `tools/extract_course_text.py`：从 `.pptx/.docx` 抽取文字，便于继续拟合课程材料。
- `tools/build_exam_assets.py`：从抽取结果中生成 PPT 习题索引和公式候选。
- `data/course-extract.json`：本次从你给的课程资料抽取出的原始文本。
- `data/course-ppt14-extract.json`：从 `课件` 目录 14 个 PPT 重新抽取出的全量文本。
- `data/formulaCandidates.json`：从 14 个 PPT 自动检索出的公式候选，供后续人工精炼。

## 追加新分录

在 `data/accountingEntries.js` 的数组里新增一个对象即可。推荐字段：

- `chapter`：章节，例如 `8 固定资产`。
- `stage`：业务阶段，例如 `取得--折旧--处置`。
- `category`：业务类别，例如 `固定资产`。
- `importance`：`must`、`key` 或 `info`。
- `scenario`：场景标题。
- `intro`：一句话说明业务场景。
- `audience`：这个处理主要给谁看、服务什么报表理解。
- `standard`：中国企业会计准则或课堂准则逻辑。
- `formula`：金额、费用或损益计算公式。
- `decisions`：同一场景下不同决策的并列分录。

每个 `decisions` 元素包含：

- `label`：决策或情况名称。
- `when`：适用条件。
- `entries`：分录行，含 `side`、`account`、`amount`。
- `note`：易错点或考试提示。
