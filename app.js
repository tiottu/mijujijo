(function () {
  var cfg = window.B_CONFIG || {};
  var $ = function (id) { return document.getElementById(id); };
  var form = $("form"), urlInput = $("url"), btn = $("submit"), statusEl = $("status");
  var result = $("result"), checkBtn = $("check"), spellBtn = $("spell"), checkStatus = $("check-status");
  var issuesEl = $("issues"), bodyEl = $("body");
  var current = null; // { url, post }

  function setStatus(msg, isError) {
    statusEl.textContent = msg || "";
    statusEl.className = "status" + (isError ? " error" : "");
  }
  function setCheckStatus(msg, isError) {
    checkStatus.textContent = msg || "";
    checkStatus.className = "status" + (isError ? " error" : "");
  }

  function call(action, url) {
    return fetch(cfg.SUPABASE_URL + "/functions/v1/hyper-service", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + cfg.SUPABASE_ANON_KEY,
        "apikey": cfg.SUPABASE_ANON_KEY
      },
      body: JSON.stringify({ action: action, url: url })
    })
      .then(function (res) {
        return res.json().then(function (data) { return { ok: res.ok, data: data }; });
      })
      .then(function (r) {
        if (!r.ok) throw new Error(r.data.error || "요청에 실패했습니다.");
        return r.data;
      });
  }

  // 문단 안에서 틀린 부분에 표시를 한다. 같은 위치가 겹치면 먼저 나온 것만 쓴다.
  function renderParagraph(text, issues) {
    var p = document.createElement("p");
    var marks = [];
    issues.forEach(function (it) {
      var at = text.indexOf(it.original);
      if (at >= 0) marks.push({ at: at, end: at + it.original.length, id: it.id });
    });
    marks.sort(function (a, b) { return a.at - b.at; });
    var pos = 0;
    marks.forEach(function (m) {
      if (m.at < pos) return;
      p.appendChild(document.createTextNode(text.slice(pos, m.at)));
      var mk = document.createElement("mark");
      mk.id = "mark-" + m.id;
      mk.textContent = text.slice(m.at, m.end);
      p.appendChild(mk);
      pos = m.end;
    });
    p.appendChild(document.createTextNode(text.slice(pos)));
    return p;
  }

  function renderBody(post, issues) {
    var byPara = {};
    issues.forEach(function (it) { (byPara[it.paragraph] = byPara[it.paragraph] || []).push(it); });
    bodyEl.textContent = "";
    post.paragraphs.forEach(function (t, i) {
      var p = renderParagraph(t, byPara[i] || []);
      p.id = "para-" + i;
      bodyEl.appendChild(p);
    });
  }

  // 점검 목록에서 누른 문단으로 이동해 잠깐 표시한다.
  function flashParagraph(i) {
    var p = $("para-" + i);
    if (!p) return;
    p.scrollIntoView({ behavior: "smooth", block: "center" });
    p.classList.remove("flash");
    void p.offsetWidth; // 같은 문단을 다시 눌러도 효과가 다시 나오게
    p.classList.add("flash");
  }

  function renderIssues(issues) {
    issuesEl.textContent = "";
    var head = document.createElement("h3");
    head.textContent = issues.length ? "고칠 곳 " + issues.length + "개" : "고칠 곳을 찾지 못했습니다 👍";
    issuesEl.appendChild(head);
    issues.forEach(function (it) {
      var card = document.createElement("a");
      card.className = "issue";
      card.href = "#mark-" + it.id;

      var chip = document.createElement("span");
      chip.className = "chip";
      chip.textContent = it.type;

      var fix = document.createElement("div");
      fix.className = "fix";
      var del = document.createElement("del");
      del.textContent = it.original;
      var ins = document.createElement("ins");
      ins.textContent = it.suggestion;
      fix.appendChild(del);
      fix.appendChild(document.createTextNode(" → "));
      fix.appendChild(ins);

      var why = document.createElement("div");
      why.className = "why";
      why.textContent = it.reason;

      card.appendChild(chip);
      card.appendChild(fix);
      card.appendChild(why);
      issuesEl.appendChild(card);
    });
    issuesEl.hidden = false;
  }

  var ICON = { good: "✅", warn: "⚠️", bad: "❌", info: "💡" };
  var kwInput = $("kw");

  function renderSeo() {
    if (!current) return;
    var r = BSeo.analyze(current.post, kwInput.value);
    $("score").textContent = r.score;
    $("score").className = "score " + (r.score >= 80 ? "good" : r.score >= 55 ? "warn" : "bad");

    var chips = $("top-words");
    chips.textContent = "";
    if (!r.topWords.length) chips.textContent = "반복된 단어가 없어요.";
    r.topWords.forEach(function (w) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "chip-btn";
      b.textContent = w.word + " " + w.count;
      b.addEventListener("click", function () { kwInput.value = w.word; renderSeo(); });
      chips.appendChild(b);
    });

    var list = $("seo-items");
    list.textContent = "";
    r.items.forEach(function (it) {
      var li = document.createElement("li");
      li.className = "seo-item " + it.status;
      var name = document.createElement("strong");
      name.textContent = ICON[it.status] + " " + it.label;
      var msg = document.createElement("span");
      msg.textContent = it.msg;

      if (it.details && it.details.length) {
        // 눌러서 펼치면 해당 문장이 나오고, 문장을 누르면 본문 위치로 이동한다.
        var box = document.createElement("details");
        var sum = document.createElement("summary");
        sum.appendChild(name);
        sum.appendChild(msg);
        box.appendChild(sum);
        it.details.forEach(function (d) {
          var b = document.createElement("button");
          b.type = "button";
          b.className = "detail";
          var len = document.createElement("small");
          len.textContent = (d.paragraph + 1) + "번째 문단 · " + d.text.length + "자";
          var tx = document.createElement("span");
          tx.textContent = d.text;
          b.appendChild(len);
          b.appendChild(tx);
          b.addEventListener("click", function () { flashParagraph(d.paragraph); });
          box.appendChild(b);
        });
        li.appendChild(box);
      } else {
        li.appendChild(name);
        li.appendChild(msg);
      }
      list.appendChild(li);
    });
  }
  kwInput.addEventListener("input", renderSeo);

  function show(post) {
    $("title").textContent = post.title || "(제목 없음)";
    $("meta").textContent = post.blogId + " · " + post.paragraphs.length + "문단 · " +
      post.length.toLocaleString() + "자" + (post.truncated ? " (앞부분만 불러옴)" : "");
    renderBody(post, []);
    kwInput.value = "";
    renderSeo();
    issuesEl.hidden = true;
    issuesEl.textContent = "";
    setCheckStatus("");
    result.hidden = false;
    result.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) {
      setStatus("config.js 에 Supabase 주소와 키를 먼저 넣어 주세요.", true);
      return;
    }
    var url = urlInput.value.trim();
    result.hidden = true;
    current = null;
    btn.disabled = true;
    setStatus("글을 불러오는 중...");

    call("fetch", url)
      .then(function (post) {
        current = { url: url, post: post };
        setStatus("");
        show(post);
      })
      .catch(function (err) {
        setStatus(err.message || "네트워크 오류가 발생했습니다.", true);
      })
      .then(function () { btn.disabled = false; });
  });

  // 맞춤법 검사(spell)와 AI 검수(check)는 같은 화면 형식으로 결과를 보여 준다.
  function runCheck(action, waitMsg) {
    if (!current) return;
    var snapshot = current;
    checkBtn.disabled = spellBtn.disabled = true;
    issuesEl.hidden = true;
    setCheckStatus(waitMsg);

    call(action, snapshot.url)
      .then(function (data) {
        if (current !== snapshot) return; // 그 사이 다른 글을 불러왔다
        if (!Array.isArray(data.issues)) throw new Error("서버 함수가 예전 버전입니다. 최신 코드로 다시 Deploy 해 주세요.");
        // 서버가 다시 가져온 본문으로 그려야 문단 번호가 맞는다.
        renderBody(data, data.issues.map(function (it, i) { it.id = i; return it; }));
        renderIssues(data.issues);
        setCheckStatus("");
      })
      .catch(function (err) {
        setCheckStatus(err.message || "네트워크 오류가 발생했습니다.", true);
      })
      .then(function () { checkBtn.disabled = spellBtn.disabled = false; });
  }

  spellBtn.addEventListener("click", function () { runCheck("spell", "맞춤법을 검사하는 중입니다..."); });
  checkBtn.addEventListener("click", function () { runCheck("check", "AI 가 글을 읽는 중입니다. 길면 30초쯤 걸려요..."); });
})();
