(function () {
  var cfg = window.B_CONFIG || {};
  var $ = function (id) { return document.getElementById(id); };
  var form = $("form"), urlInput = $("url"), btn = $("submit"), statusEl = $("status");
  var result = $("result");

  function setStatus(msg, isError) {
    statusEl.textContent = msg || "";
    statusEl.className = "status" + (isError ? " error" : "");
  }

  function show(post) {
    $("title").textContent = post.title || "(제목 없음)";
    $("meta").textContent = post.blogId + " · " + post.paragraphs.length + "문단 · " +
      post.length.toLocaleString() + "자" + (post.truncated ? " (일부만 불러옴)" : "");
    var body = $("body");
    body.textContent = "";
    post.paragraphs.forEach(function (t) {
      var p = document.createElement("p");
      p.textContent = t;
      body.appendChild(p);
    });
    result.hidden = false;
    result.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) {
      setStatus("config.js 에 Supabase 주소와 키를 먼저 넣어 주세요.", true);
      return;
    }
    result.hidden = true;
    btn.disabled = true;
    setStatus("글을 불러오는 중...");

    fetch(cfg.SUPABASE_URL + "/functions/v1/hyper-service", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + cfg.SUPABASE_ANON_KEY,
        "apikey": cfg.SUPABASE_ANON_KEY
      },
      body: JSON.stringify({ url: urlInput.value.trim() })
    })
      .then(function (res) {
        return res.json().then(function (data) { return { ok: res.ok, data: data }; });
      })
      .then(function (r) {
        if (!r.ok) throw new Error(r.data.error || "불러오지 못했습니다.");
        setStatus("");
        show(r.data);
      })
      .catch(function (err) {
        setStatus(err.message || "네트워크 오류가 발생했습니다.", true);
      })
      .then(function () { btn.disabled = false; });
  });
})();
