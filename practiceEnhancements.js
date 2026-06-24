(function () {
  const entries = window.ACCOUNTING_ENTRIES || [];
  const practice = window.JOURNAL_FILL_PRACTICE || [];
  const panel = document.querySelector("#practicePanel");
  if (!panel) return;

  const state = {
    questionIndex: 0,
    rows: [],
    submitted: false,
  };

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function normalizeText(value) {
    return String(value ?? "")
      .replace(/\s+/g, "")
      .replace(/[：:（）()]/g, "")
      .replace(/[—－-]/g, "")
      .replace(/（/g, "")
      .replace(/）/g, "")
      .replace(/借方|贷方/g, "")
      .trim();
  }

  function normalizeAmount(value) {
    const cleaned = String(value ?? "").replace(/,/g, "").replace(/元/g, "").replace(/[^\d.]/g, "");
    if (!cleaned) return "";
    const number = Number(cleaned);
    if (Number.isNaN(number)) return cleaned;
    return String(Number(number.toFixed(2)));
  }

  function lineMatches(user, answer) {
    return (
      user.side === answer.side &&
      normalizeText(user.account) === normalizeText(answer.account) &&
      normalizeAmount(user.amount) === normalizeAmount(answer.amount)
    );
  }

  function collectAccountOccurrences() {
    const map = new Map();

    function add(account, payload) {
      const key = normalizeText(account);
      if (!key) return;
      if (!map.has(key)) map.set(key, { account, rows: [] });
      map.get(key).rows.push(payload);
    }

    entries.forEach((entry) => {
      (entry.decisions || []).forEach((decision) => {
        (decision.entries || []).forEach((line) => {
          add(line.account, {
            type: "主线分录",
            side: line.side,
            amount: line.amount,
            title: `${entry.scenario || ""} / ${decision.label || ""}`,
            chapter: entry.chapter || "",
          });
        });
      });
    });

    practice.forEach((question) => {
      question.answer.forEach((line) => {
        add(line.account, {
          type: "练习题库",
          side: line.side,
          amount: line.amount,
          title: question.title,
          chapter: question.chapter,
        });
      });
    });

    return map;
  }

  const accountMap = collectAccountOccurrences();

  function renderSearchResults(term) {
    const key = normalizeText(term);
    if (!key) {
      return `<p class="source">输入会计科目，可以查看它在分录题库中的常见借贷方向。比如：坏账准备、累计折旧、应交税费、库存商品。</p>`;
    }

    const results = Array.from(accountMap.values()).filter((item) => normalizeText(item.account).includes(key));
    if (!results.length) return `<p class="source">暂时没找到这个科目，换一个关键词试试~</p>`;

    return `<div class="account-results">
      ${results
        .map((item) => {
          const debit = item.rows.filter((row) => row.side === "借").length;
          const credit = item.rows.filter((row) => row.side === "贷").length;
          return `<article class="account-card">
            <h3>${escapeHtml(item.account)}</h3>
            <p><strong>出现：</strong>${item.rows.length} 次；借方 ${debit} 次，贷方 ${credit} 次。</p>
            <ul>
              ${item.rows
                .slice(0, 12)
                .map(
                  (row) => `<li>
                    <span class="tag ${row.side === "借" ? "key" : "stage"}">${escapeHtml(row.side)}</span>
                    ${escapeHtml(row.chapter)} · ${escapeHtml(row.title)}
                    <small>${escapeHtml(row.amount)}</small>
                  </li>`,
                )
                .join("")}
            </ul>
          </article>`;
        })
        .join("")}
    </div>`;
  }

  function currentQuestion() {
    return practice[state.questionIndex] || practice[0];
  }

  function addRow() {
    state.rows.push({ side: "借", account: "", amount: "" });
    state.submitted = false;
    renderPractice();
  }

  function removeRow(index) {
    state.rows.splice(index, 1);
    state.submitted = false;
    renderPractice();
  }

  function updateRow(index, field, value) {
    if (!state.rows[index]) return;
    state.rows[index][field] = value;
  }

  function grade() {
    state.submitted = true;
    renderPractice();
  }

  function resetRows() {
    state.rows = [];
    state.submitted = false;
    renderPractice();
  }

  function switchQuestion(index) {
    state.questionIndex = Number(index);
    resetRows();
  }

  function gradeDetail(row, answer) {
    if (!answer) return "这一行是多余分录，可以删掉~";
    const problems = [];
    if (row.side !== answer.side) problems.push("借贷方向");
    if (normalizeText(row.account) !== normalizeText(answer.account)) problems.push("会计科目");
    if (normalizeAmount(row.amount) !== normalizeAmount(answer.amount)) problems.push("金额");
    if (!problems.length) return "正确~";
    return `请重点检查：${problems.join("、")}。应为：${answer.side} ${answer.account} ${answer.amount}`;
  }

  function feedback() {
    const question = currentQuestion();
    const answer = question.answer;
    const correct = state.rows.filter((row, index) => answer[index] && lineMatches(row, answer[index])).length;
    const total = answer.length;
    const missing = Math.max(total - state.rows.length, 0);
    const extra = Math.max(state.rows.length - total, 0);
    const score = total ? Math.round((correct / total) * 100) : 0;

    let advice = "已经开始把业务拆成分录了，很好~";
    if (score === 100 && extra === 0) {
      advice = "很稳！科目、方向、金额都对上了，可以换下一题继续保持手感~";
    } else if (correct >= total * 0.7) {
      advice = "整体方向不错~ 接下来重点检查少填的分录行、借贷方向，以及计算题里的金额来源。";
    } else {
      advice = "先别急~ 建议回到业务场景：先判断谁增加谁减少，再定借贷方向，最后把金额计算补上。";
    }

    return `<section class="grading-summary">
      <strong>批改结果：${correct}/${total} 行正确，约 ${score}%</strong>
      <p>${extra ? `多填 ${extra} 行；` : ""}${missing ? `还少 ${missing} 行；` : ""}${advice}</p>
      <p>${escapeHtml(question.advice || "")}</p>
    </section>`;
  }

  function renderPracticeRows() {
    const question = currentQuestion();
    return `<div class="practice-rows">
      ${state.rows
        .map((row, index) => {
          const answer = question.answer[index];
          const ok = state.submitted && answer && lineMatches(row, answer);
          const bad = state.submitted && (!answer || !lineMatches(row, answer));
          return `<div class="practice-row ${ok ? "is-correct" : ""} ${bad ? "is-wrong" : ""}">
            <select data-row="${index}" data-field="side">
              <option value="借" ${row.side === "借" ? "selected" : ""}>借</option>
              <option value="贷" ${row.side === "贷" ? "selected" : ""}>贷</option>
            </select>
            <input data-row="${index}" data-field="account" value="${escapeHtml(row.account)}" placeholder="会计科目" />
            <input data-row="${index}" data-field="amount" value="${escapeHtml(row.amount)}" placeholder="金额" />
            <button type="button" data-remove="${index}">删除</button>
            ${state.submitted ? `<small>${escapeHtml(gradeDetail(row, answer))}</small>` : ""}
          </div>`;
        })
        .join("")}
    </div>`;
  }

  function renderAnswerAfterSubmit() {
    if (!state.submitted) return "";
    const question = currentQuestion();
    return `<details class="answer-reveal" open>
      <summary>标准答案与计算过程</summary>
      ${question.calculation ? `<p><strong>计算：</strong>${escapeHtml(question.calculation)}</p>` : ""}
      <p>${escapeHtml(question.explanation || "")}</p>
      <div class="journal">
        ${question.answer
          .map(
            (line) => `<div class="journal-row">
              <span>${escapeHtml(line.side)}</span>
              <span>${escapeHtml(line.account)}</span>
              <span class="amount">${escapeHtml(line.amount)}</span>
            </div>`,
          )
          .join("")}
      </div>
    </details>`;
  }

  function renderPractice() {
    const question = currentQuestion();
    const holder = panel.querySelector("#journalPracticeHolder");
    if (!holder || !question) return;

    holder.innerHTML = `<section class="practice-card">
      <div class="practice-head">
        <div>
          <h3>${escapeHtml(question.chapter)} · ${escapeHtml(question.title)}</h3>
          <p>${escapeHtml(question.prompt)}</p>
          <p class="source">${escapeHtml(question.source || "人工校准题库")} · ${question.type === "calculation" ? "含计算分析" : "分录练习"}</p>
        </div>
        <label class="field compact-field">
          <span>换题</span>
          <select id="practiceQuestionSelect">
            ${practice
              .map(
                (item, index) =>
                  `<option value="${index}" ${index === state.questionIndex ? "selected" : ""}>${index + 1}. ${escapeHtml(item.chapter)} · ${escapeHtml(item.title)}</option>`,
              )
              .join("")}
          </select>
        </label>
      </div>
      ${renderPracticeRows()}
      <div class="practice-actions">
        <button type="button" id="addJournalRow">添加分录</button>
        <button type="button" id="submitJournalPractice">提交</button>
        <button type="button" id="resetJournalPractice">清空</button>
      </div>
      ${state.submitted ? feedback() : ""}
      ${renderAnswerAfterSubmit()}
    </section>`;
  }

  function renderShell() {
    panel.innerHTML = `<div class="section-head">
      <div>
        <h2>科目检索 + 分录填空练习</h2>
        <p>这版题库已改为人工校准口径，覆盖常见业务流程，并加入坏账、存货、折旧、摊销、所得税、利润分配等计算分析内容。每一行分录都要点击“添加分录”后填写，再提交批改。</p>
      </div>
    </div>
    <section class="practice-layout">
      <article class="review-card">
        <h3>科目检索增强</h3>
        <label class="field">
          <span>搜索会计科目</span>
          <input id="accountSearchInput" type="search" placeholder="例如：应交税费 / 坏账准备 / 累计折旧" />
        </label>
        <div id="accountSearchResults">${renderSearchResults("")}</div>
      </article>
      <div id="journalPracticeHolder"></div>
    </section>`;
    renderPractice();
  }

  panel.addEventListener("input", (event) => {
    const target = event.target;
    if (target.id === "accountSearchInput") {
      panel.querySelector("#accountSearchResults").innerHTML = renderSearchResults(target.value);
      return;
    }
    if (target.dataset.row !== undefined) updateRow(Number(target.dataset.row), target.dataset.field, target.value);
  });

  panel.addEventListener("change", (event) => {
    const target = event.target;
    if (target.id === "practiceQuestionSelect") switchQuestion(target.value);
    if (target.dataset.row !== undefined) updateRow(Number(target.dataset.row), target.dataset.field, target.value);
  });

  panel.addEventListener("click", (event) => {
    const target = event.target.closest("button");
    if (!target) return;
    if (target.id === "addJournalRow") addRow();
    if (target.id === "submitJournalPractice") grade();
    if (target.id === "resetJournalPractice") resetRows();
    if (target.dataset.remove !== undefined) removeRow(Number(target.dataset.remove));
  });

  renderShell();
})();
