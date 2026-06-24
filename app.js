(function () {
  const entries = window.ACCOUNTING_ENTRIES || [];
  const exercisesByEntry = window.PRACTICE_EXERCISES || {};
  const pptExercises = window.PPT_EXERCISES || [];
  const pptSlideImages = window.PPT_SLIDE_IMAGES || {};
  const review = window.EXAM_REVIEW || {};
  const conceptReview = window.CONCEPT_REVIEW || [];
  const calculationReview = window.CALCULATION_REVIEW || [];

  const ALL = "全部";
  const state = {
    search: "",
    chapter: ALL,
    stage: ALL,
    category: ALL,
    mustOnly: false,
    expanded: false,
  };

  const els = {
    search: document.querySelector("#searchInput"),
    chapter: document.querySelector("#chapterFilter"),
    stage: document.querySelector("#stageFilter"),
    category: document.querySelector("#categoryFilter"),
    must: document.querySelector("#mustFilter"),
    reset: document.querySelector("#resetButton"),
    expandAll: document.querySelector("#expandAllButton"),
    cards: document.querySelector("#cards"),
    empty: document.querySelector("#emptyState"),
    timeline: document.querySelector("#timeline"),
    entryCount: document.querySelector("#entryCount"),
    variantCount: document.querySelector("#variantCount"),
    resultTitle: document.querySelector("#resultTitle"),
    resultHint: document.querySelector("#resultHint"),
    choicePanel: document.querySelector("#choicePanel"),
    calculationPanel: document.querySelector("#calculationPanel"),
    journalPptExercises: document.querySelector("#journalPptExercises"),
    journalMainline: document.querySelector("#journalMainline"),
  };

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function unique(values) {
    return [ALL, ...Array.from(new Set(values)).filter(Boolean)];
  }

  function fillSelect(select, values) {
    select.innerHTML = values.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("");
  }

  function importanceClass(value) {
    if (value === "必背" || value === "must") return "must";
    if (value === "重点" || value === "key") return "key";
    return "stage";
  }

  function importanceLabel(entry) {
    if (entry.importance === "must") return "必背";
    if (entry.importance === "key") return "重点";
    return "了解";
  }

  function tagClass(entry) {
    return importanceClass(entry.importance);
  }

  function chapterNo(chapter) {
    const match = String(chapter).match(/^(\d+)/);
    return match ? Number(match[1]) : 999;
  }

  function entrySearchText(entry) {
    return [
      entry.chapter,
      entry.stage,
      entry.category,
      entry.scenario,
      entry.intro,
      entry.audience,
      entry.standard,
      entry.formula,
      ...(entry.tags || []),
      ...(exercisesByEntry[entry.id] || []).flatMap((exercise) => [
        exercise.title,
        exercise.prompt,
        exercise.source,
        ...(exercise.covers || []),
        ...(exercise.answer || []),
      ]),
      ...entry.decisions.flatMap((decision) => [
        decision.label,
        decision.when,
        decision.note,
        ...decision.entries.flatMap((line) => [line.side, line.account, line.amount]),
      ]),
    ]
      .join(" ")
      .toLowerCase();
  }

  function filteredEntries() {
    const term = state.search.trim().toLowerCase();
    return entries.filter((entry) => {
      if (state.chapter !== ALL && entry.chapter !== state.chapter) return false;
      if (state.stage !== ALL && entry.stage !== state.stage) return false;
      if (state.category !== ALL && entry.category !== state.category) return false;
      if (state.mustOnly && entry.importance !== "must") return false;
      if (term && !entrySearchText(entry).includes(term)) return false;
      return true;
    });
  }

  function renderJournal(lines) {
    return `<div class="journal">${lines
      .map(
        (line) => `<div class="journal-row">
          <span>${escapeHtml(line.side)}</span>
          <span>${escapeHtml(line.account)}</span>
          <span class="amount">${escapeHtml(line.amount)}</span>
        </div>`,
      )
      .join("")}</div>`;
  }

  function renderExercises(entry) {
    const exercises = exercisesByEntry[entry.id] || [];
    if (!exercises.length) {
      return `<section class="exercise-box muted-box">
        <div class="exercise-head">
          <span>相关习题</span>
          <strong>待补充</strong>
        </div>
        <p>后续导入更多课件或练习册后，可以在这里放覆盖整套业务流程的综合题。</p>
      </section>`;
    }

    return `<section class="exercise-box">
      <div class="exercise-head">
        <span>相关习题</span>
        <strong>${exercises.length} 题</strong>
      </div>
      ${exercises
        .map(
          (exercise) => `<details class="exercise" open>
            <summary>
              <span>${escapeHtml(exercise.title)}</span>
              <small>${escapeHtml(exercise.source)}</small>
            </summary>
            <p class="exercise-prompt">${escapeHtml(exercise.prompt)}</p>
            <div class="coverage">
              ${(exercise.covers || []).map((item) => `<span>${escapeHtml(item)}</span>`).join("")}
            </div>
            <ol class="answer-list">
              ${(exercise.answer || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
            </ol>
          </details>`,
        )
        .join("")}
    </section>`;
  }

  function pptTitle(item) {
    const text = String(item.text || "");
    const match = text.match(/【\s*(例题?\s*\d+-?\d*|习题\s*\d+-?\d*|例\s*\d+-?\d*)\s*(续)?\s*】/);
    if (match) return `${match[1].replace(/\s+/g, "")}${match[2] ? "续" : ""}`;
    const loose = text.match(/(例题?\s*\d+-?\d*|习题\s*\d+-?\d*|例\s*\d+-?\d*)/);
    if (loose) return loose[1].replace(/\s+/g, "");
    if (text.includes("思考")) return "思考";
    if (text.includes("案例")) return "案例";
    return item.type;
  }

  function normalizePptTitle(title) {
    return String(title).replace(/\s+/g, "").replace(/续/g, "").replace(/[：:]/g, "");
  }

  function groupPptRows(rows) {
    const groups = [];
    const byKey = new Map();
    rows
      .slice()
      .sort((a, b) => chapterNo(a.chapter) - chapterNo(b.chapter) || a.slide - b.slide)
      .forEach((item) => {
        const title = pptTitle(item);
        const titleKey = normalizePptTitle(title);
        const canGroup = /^(例|例题|习题)\d+-?\d*/.test(titleKey);
        const key = canGroup ? `${item.chapter}::${item.type}::${titleKey}` : `${item.chapter}::${item.type}::${item.slide}`;
        if (!byKey.has(key)) {
          const group = {
            chapter: item.chapter,
            type: item.type,
            importance: item.importance,
            title: title.replace(/续/g, ""),
            slides: [],
          };
          byKey.set(key, group);
          groups.push(group);
        }
        const group = byKey.get(key);
        group.slides.push(item.slide);
        if (item.importance === "必背") group.importance = "必背";
        if (item.importance === "重点" && group.importance !== "必背") group.importance = "重点";
      });
    return groups;
  }

  function slideRange(slides) {
    const nums = Array.from(new Set(slides)).sort((a, b) => a - b);
    if (nums.length === 1) return `第 ${nums[0]} 页`;
    return `第 ${nums[0]}-${nums[nums.length - 1]} 页`;
  }

  function renderSlideGallery(group) {
    const images = group.slides
      .map((slide) => ({
        slide,
        src: pptSlideImages[`${group.chapter}::${slide}`],
      }))
      .filter((item) => item.src);

    if (!images.length) return `<p class="source">未找到对应PPT原图。</p>`;

    return `<div class="slide-gallery">
      ${images
        .map(
          (image) => `<figure class="slide-shot">
            <img src="${escapeHtml(image.src)}" alt="${escapeHtml(group.chapter)} 第 ${escapeHtml(image.slide)} 页" loading="lazy" />
            <figcaption>${escapeHtml(group.chapter)} · 第 ${escapeHtml(image.slide)} 页</figcaption>
          </figure>`,
        )
        .join("")}
    </div>`;
  }

  function renderPptGroups(groups) {
    if (!groups.length) return `<p class="source">本章PPT未检索到对应题型原题。</p>`;
    return `<div class="exercise-index">
      ${groups
        .map(
          (group) => `<details class="exercise-row">
            <summary>
              <header>
                <span class="tag ${importanceClass(group.importance)}">${escapeHtml(group.importance)}</span>
                <span class="tag chapter">${escapeHtml(group.chapter)}</span>
                <span class="tag stage">${escapeHtml(slideRange(group.slides))}</span>
              </header>
              <strong>${escapeHtml(group.type)} · ${escapeHtml(group.title)}</strong>
            </summary>
            <div class="ppt-body">${renderSlideGallery(group)}</div>
          </details>`,
        )
        .join("")}
    </div>`;
  }

  function pptGroups(types, chapter) {
    const typeList = Array.isArray(types) ? types : [types];
    return groupPptRows(
      pptExercises.filter((item) => typeList.includes(item.type) && (!chapter || item.chapter === chapter)),
    );
  }

  function range(start, end) {
    return Array.from({ length: end - start + 1 }, (_, index) => start + index);
  }

  const entryPptMap = {
    "cash-basic-receipt-payment": [{ chapter: 5, slides: [8, 9, 11, 12, 13, 15, 16] }],
    "petty-cash-imprest-vs-nonimprest": [{ chapter: 5, slides: [20, 23, 24, 25, 26] }],
    "cash-inventory-surplus-shortage": [{ chapter: 5, slides: [34] }],
    "trading-financial-assets": [{ chapter: 5, slides: [42, 43, 44, 45, 47, 48] }],
    "receivables-sales-discounts": [{ chapter: 6, slides: [6, 7, 8, 14, 15, 18, 19] }],
    "notes-receivable-full-cycle": [{ chapter: 6, slides: [21, 22, 23, 28] }],
    "bad-debt-allowance": [{ chapter: 6, slides: [37, 38, 40, 42, 43, 45] }],
    "prepayments-procurement-cycle": [{ chapter: 6, slides: [49, 50, 51, 52] }],
    "inventory-purchase-issue-impairment": [{ chapter: 7, slides: [9, 11, 12, 14, 16, 18, 19, 22, 25, 26, 35, 36, 37, 38, 39, 41, 43, 44, 49, 50, 51, 52, 53, 54] }],
    "fixed-assets-full-cycle": [{ chapter: 8, slides: [7, 9, 14, 15, 16, 17, 24, 26, 29, 30, 32, 35, 37, 38, 43, 45, 49, 50, 51] }],
    "intangible-assets": [{ chapter: 9, slides: [36, 38, 39, 40, 41] }],
    "current-liabilities": [{ chapter: 10, slides: [7, 11, 13] }],
    "taxes-vat-income-tax": [{ chapter: 10, slides: [16, 17, 20, 24, 35, 36, 40] }],
    "noncurrent-liabilities": [{ chapter: 11, slides: [8, 9, 10, 11, 18, 19, 20, 21, 22, 23, 24, 25, 26] }],
    "owners-equity": [{ chapter: 12, slides: [3, 7, 12, 14, 28, 31, 35, 36, 38, 39, 41, 42, 43] }],
    "income-expense-profit": [{ chapter: 13, slides: [4, 11, 17, 23, 28, 34, 35, 53, 56, 57] }],
    "financial-statements-closing": [{ chapter: 13, slides: [61, 62, 63, 64] }],
    "manufacturing-cost-flow": [{ chapter: 7, slides: [18, 19, 22, 25, 26] }],
  };

  function rowKey(row) {
    return `${chapterNo(row.chapter)}::${row.slide}`;
  }

  function entryPptRows(entry) {
    const specs = entryPptMap[entry.id] || [];
    if (!specs.length) return [];
    const wanted = new Set(
      specs.flatMap((spec) => spec.slides.map((slide) => `${spec.chapter}::${slide}`)),
    );
    return pptExercises.filter((item) => item.type === "分录题" && wanted.has(rowKey(item)));
  }

  function assignedJournalPptKeys() {
    return new Set(
      entries.flatMap((entry) => entryPptRows(entry).map(rowKey)),
    );
  }

  function renderEntryPptExamples(entry) {
    const groups = groupPptRows(entryPptRows(entry));
    if (!groups.length) return "";
    return `<section class="entry-ppt-examples">
      <div class="exercise-head">
        <span>PPT对应例题</span>
        <strong>${groups.length} 组</strong>
      </div>
      ${renderPptGroups(groups)}
    </section>`;
  }

  function renderUnassignedJournalPptIndex() {
    const assigned = assignedJournalPptKeys();
    const rows = pptExercises.filter((item) => item.type === "分录题" && !assigned.has(rowKey(item)));
    const groups = groupPptRows(rows);
    if (!groups.length) return "";
    return `<section class="ppt-index">
      <div class="section-head">
        <div>
          <h2>暂未归入具体场景的PPT分录题</h2>
          <p>这些题暂时保留在兜底区，后续可以继续细分到更精确的业务场景。</p>
        </div>
      </div>
      ${renderPptGroups(groups)}
    </section>`;
  }

  function renderPptIndex(types, options = {}) {
    const groups = pptGroups(types, options.chapter);
    if (!groups.length) return "";
    const rows = pptExercises.filter((item) => (Array.isArray(types) ? types : [types]).includes(item.type) && (!options.chapter || item.chapter === options.chapter));
    return `<section class="ppt-index">
      <div class="section-head">
        <div>
          <h2>${escapeHtml(options.title || "PPT原题/例题索引")}</h2>
          <p>按例题/习题编号合并展示PPT原图；共 ${rows.length} 页，整理为 ${groups.length} 组。</p>
        </div>
      </div>
      ${renderPptGroups(groups)}
    </section>`;
  }

  function renderConceptPanel() {
    if (!els.choicePanel) return;
    els.choicePanel.innerHTML = `<div class="section-head">
      <div>
        <h2>选择题 + 判断题复习板块</h2>
        <p>按1-14章PPT顺序梳理基础概念、原则和简单计算。每一块尽量保持PPT中的完整知识组，不拆散同一组概念。</p>
      </div>
    </div>
    <div class="chapter-stack">
      ${conceptReview
        .map(
          (chapter) => `<section class="chapter-block">
            <header class="chapter-head">
              <div>
                <h3>${escapeHtml(chapter.chapter)}</h3>
                <p>${escapeHtml(chapter.focus)}</p>
              </div>
            </header>
            <div class="review-grid">
              ${chapter.sections
                .map(
                  (section) => `<article class="review-card">
                    <span class="tag ${importanceClass(section.importance)}">${escapeHtml(section.importance)}</span>
                    <h4>${escapeHtml(section.title)}</h4>
                    <p>${escapeHtml(section.logic)}</p>
                    <ul>${section.points.map((point) => `<li>${escapeHtml(point)}</li>`).join("")}</ul>
                    <p class="source">实例：${escapeHtml(section.example)}</p>
                  </article>`,
                )
                .join("")}
            </div>
          </section>`,
        )
        .join("")}
    </div>
    ${renderPptIndex(["选择/判断考点", "判断题"], { title: "选择题/判断题PPT原题" })}`;
  }

  function renderAuthoredExamples(examples) {
    if (!examples?.length) return "";
    return `<div class="authored-examples">
      ${examples
        .map(
          (example) => `<details class="exercise-row authored-example">
            <summary><strong>${escapeHtml(example.title)}</strong></summary>
            <div class="ppt-body">
              <section class="ppt-part"><strong>题目</strong><p>${escapeHtml(example.prompt)}</p></section>
              <section class="ppt-part answer-part">
                <strong>答案 / 解析</strong>
                <ol class="answer-list">${example.answer.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ol>
              </section>
            </div>
          </details>`,
        )
        .join("")}
    </div>`;
  }

  function renderCalculationPanel() {
    if (!els.calculationPanel) return;
    els.calculationPanel.innerHTML = `<div class="section-head">
      <div>
        <h2>计算分析题复习板块</h2>
        <p>按章节组织：先看本章公式，再看本章PPT例题；PPT没有覆盖的地方补充题目，并把题目和答案分开。</p>
      </div>
    </div>
    <div class="chapter-stack">
      ${calculationReview
        .map((chapter) => {
          const groups = pptGroups("计算分析题", chapter.chapter);
          return `<section class="chapter-block">
            <header class="chapter-head">
              <div>
                <h3>${escapeHtml(chapter.chapter)}</h3>
                <p>${escapeHtml(chapter.focus)}</p>
              </div>
            </header>
            <article class="review-card formula-card">
              <span class="tag key">公式</span>
              <ul>${chapter.formulas.map((formula) => `<li>${escapeHtml(formula)}</li>`).join("")}</ul>
            </article>
            <div class="subsection-title">本章例题</div>
            ${renderPptGroups(groups)}
            ${renderAuthoredExamples(chapter.examples)}
          </section>`;
        })
        .join("")}
    </div>`;
  }

  function renderCard(entry, index) {
    return `<details class="card" ${state.expanded || index === 0 ? "open" : ""}>
      <summary>
        <div class="card-head">
          <div class="meta">
            <span class="tag ${tagClass(entry)}">${importanceLabel(entry)}</span>
            <span class="tag chapter">${escapeHtml(entry.chapter)}</span>
            <span class="tag stage">${escapeHtml(entry.stage)}</span>
            <span class="tag">${escapeHtml(entry.category)}</span>
          </div>
          <h2 class="scenario-title">${escapeHtml(entry.scenario)}</h2>
          <p class="intro">${escapeHtml(entry.intro)}</p>
        </div>
      </summary>
      <div class="card-body">
        <div class="context-grid">
          <div><strong>处理对象</strong><p>${escapeHtml(entry.audience)}</p></div>
          <div><strong>准则逻辑</strong><p>${escapeHtml(entry.standard)}</p></div>
          <div><strong>关键词</strong><p>${(entry.tags || []).map(escapeHtml).join(" / ")}</p></div>
        </div>
        <div class="formula-box"><strong>费用/金额计算</strong><p>${escapeHtml(entry.formula)}</p></div>
        <div class="decision-grid">
          ${entry.decisions
            .map(
              (decision) => `<article class="decision">
                <h3>${escapeHtml(decision.label)}</h3>
                <p>${escapeHtml(decision.when)}</p>
                ${renderJournal(decision.entries)}
                <p class="note">${escapeHtml(decision.note)}</p>
              </article>`,
            )
            .join("")}
        </div>
        ${renderEntryPptExamples(entry)}
        ${renderExercises(entry)}
        <p class="source">来源定位：${escapeHtml(entry.source)}</p>
      </div>
    </details>`;
  }

  function renderTimeline() {
    els.timeline.innerHTML = entries
      .map(
        (entry, index) => `<li>
          <button type="button" data-entry-id="${escapeHtml(entry.id)}">
            ${index + 1}. ${escapeHtml(entry.scenario)}
          </button>
        </li>`,
      )
      .join("");
  }

  function renderJournalPanel() {
    const visible = filteredEntries();
    const variantTotal = entries.reduce((sum, entry) => sum + entry.decisions.length, 0);
    els.entryCount.textContent = `${entries.length} 个场景`;
    els.variantCount.textContent = `${variantTotal} 种处理`;
    els.resultTitle.textContent = visible.length === entries.length ? "全部场景" : `匹配 ${visible.length} 个场景`;
    els.resultHint.textContent = state.search ? `当前关键词：${state.search}` : "按时间顺序排列；同一场景下的不同决策并列展示。";
    els.cards.innerHTML = visible.map(renderCard).join("");
    els.empty.hidden = visible.length > 0;
    els.journalPptExercises.innerHTML = renderUnassignedJournalPptIndex();
  }

  function reset() {
    state.search = "";
    state.chapter = ALL;
    state.stage = ALL;
    state.category = ALL;
    state.mustOnly = false;
    state.expanded = false;
    els.search.value = "";
    els.chapter.value = ALL;
    els.stage.value = ALL;
    els.category.value = ALL;
    els.must.checked = false;
    els.expandAll.textContent = "全部展开";
    renderJournalPanel();
  }

  function bindEvents() {
    els.search.addEventListener("input", (event) => {
      state.search = event.target.value;
      renderJournalPanel();
    });
    els.chapter.addEventListener("change", (event) => {
      state.chapter = event.target.value;
      renderJournalPanel();
    });
    els.stage.addEventListener("change", (event) => {
      state.stage = event.target.value;
      renderJournalPanel();
    });
    els.category.addEventListener("change", (event) => {
      state.category = event.target.value;
      renderJournalPanel();
    });
    els.must.addEventListener("change", (event) => {
      state.mustOnly = event.target.checked;
      renderJournalPanel();
    });
    els.reset.addEventListener("click", reset);
    els.expandAll.addEventListener("click", () => {
      state.expanded = !state.expanded;
      els.expandAll.textContent = state.expanded ? "收起默认" : "全部展开";
      renderJournalPanel();
    });
    els.timeline.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-entry-id]");
      if (!button) return;
      reset();
      const target = entries.find((entry) => entry.id === button.dataset.entryId);
      if (!target) return;
      state.search = target.scenario;
      els.search.value = target.scenario;
      renderJournalPanel();
      document.querySelector(".content").scrollIntoView({ behavior: "smooth", block: "start" });
    });
    document.querySelectorAll(".mode-tab").forEach((button) => {
      button.addEventListener("click", () => {
        document.querySelectorAll(".mode-tab").forEach((item) => item.classList.remove("active"));
        document.querySelectorAll(".exam-panel").forEach((panel) => panel.classList.remove("active"));
        button.classList.add("active");
        document.querySelector(`#${button.dataset.panel}`).classList.add("active");
      });
    });
  }

  fillSelect(els.chapter, unique(entries.map((entry) => entry.chapter)));
  fillSelect(els.stage, unique(entries.map((entry) => entry.stage)));
  fillSelect(els.category, unique(entries.map((entry) => entry.category)));
  if (els.journalMainline && review.overview?.mainLine) {
    els.journalMainline.textContent = review.overview.mainLine;
  }

  renderTimeline();
  renderConceptPanel();
  renderCalculationPanel();
  bindEvents();
  renderJournalPanel();
})();
