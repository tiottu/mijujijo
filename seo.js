// 글 점검 규칙. AI 없이 글자 수·키워드·구조만 계산한다.
// 기준값은 블로그 글쓰기에서 흔히 쓰는 경험칙이며, 조회수가 오른다는 보장은 아니다.
var BSeo = (function () {
  var GOOD = "good", WARN = "warn", BAD = "bad", INFO = "info";

  // 조사·어미를 떼어 같은 단어로 세기 위한 간단한 규칙 (형태소 분석기가 아니라 완벽하지 않다)
  var PARTICLES = ["에서는", "으로는", "에게는", "에서", "으로", "에게", "까지", "부터", "처럼", "보다", "라고", "이라",
    "은", "는", "이", "가", "을", "를", "의", "에", "도", "로", "와", "과", "만", "랑"];
  var STOP = {};
  ("그리고 그래서 하지만 그런데 그러나 그렇게 이렇게 저렇게 이번 오늘 정말 진짜 너무 아주 매우 조금 많이 우리 제가 저는 " +
    "있는 없는 하는 되는 같은 어떤 모든 이런 그런 저런 때문 그리고 이것 그것 저것 여기 거기 저기 이후 이전 통해 대한 위해 " +
    "합니다 입니다 있습니다 했어요 해요 같아요 있어요 좋아요 하지 않 수도 정도 사실 생각 부분 경우 다음 처음 마지막").split(" ")
    .forEach(function (w) { STOP[w] = true; });

  function stripParticle(w) {
    if (w.length < 3) return w;
    for (var i = 0; i < PARTICLES.length; i++) {
      var p = PARTICLES[i];
      if (w.length - p.length >= 2 && w.slice(-p.length) === p) return w.slice(0, -p.length);
    }
    return w;
  }

  function isVerbLike(w) {
    return w.length >= 3 && /(다|요|죠|니다|네요|세요|어요|아요|했던|하는|하고|해서|하면)$/.test(w);
  }

  function topWords(text, limit) {
    var counts = {};
    var raw = text.match(/[가-힣A-Za-z0-9]+/g) || [];
    raw.forEach(function (w) {
      if (/^\d+$/.test(w)) return;
      w = stripParticle(w.toLowerCase());
      if (w.length < 2 || STOP[w] || isVerbLike(w)) return;
      counts[w] = (counts[w] || 0) + 1;
    });
    return Object.keys(counts)
      .filter(function (w) { return counts[w] >= 2; })
      .sort(function (a, b) { return counts[b] - counts[a] || b.length - a.length; })
      .slice(0, limit || 10)
      .map(function (w) { return { word: w, count: counts[w] }; });
  }

  function countOf(hay, needle) {
    if (!needle) return 0;
    var n = 0, at = 0;
    while ((at = hay.indexOf(needle, at)) >= 0) { n++; at += needle.length; }
    return n;
  }

  function item(label, status, msg) { return { label: label, status: status, msg: msg }; }

  function analyze(post, keyword) {
    var title = (post.title || "").trim();
    var paras = post.paragraphs || [];
    var text = paras.join("\n");
    var chars = text.replace(/\s/g, "").length;
    var items = [];

    // 글자 수
    if (chars < 800) items.push(item("글자 수", BAD, "공백 제외 " + chars.toLocaleString() + "자로 짧아요. 1,500자 이상을 권장해요."));
    else if (chars < 1500) items.push(item("글자 수", WARN, "공백 제외 " + chars.toLocaleString() + "자예요. 1,500자 이상이면 더 좋아요."));
    else if (chars <= 6000) items.push(item("글자 수", GOOD, "공백 제외 " + chars.toLocaleString() + "자로 충분해요."));
    else items.push(item("글자 수", WARN, "공백 제외 " + chars.toLocaleString() + "자로 아주 길어요. 글을 나누는 것도 방법이에요."));

    // 제목
    var tl = title.length;
    if (!tl) items.push(item("제목 길이", BAD, "제목을 찾지 못했어요."));
    else if (tl < 10) items.push(item("제목 길이", WARN, tl + "자로 짧아요. 검색어를 더 담아 보세요."));
    else if (tl <= 35) items.push(item("제목 길이", GOOD, tl + "자로 적당해요."));
    else items.push(item("제목 길이", WARN, tl + "자예요. 검색 결과에서 뒤가 잘릴 수 있어요. 35자 안쪽을 권장해요."));

    // 문단 구조
    if (paras.length < 5) items.push(item("문단 수", WARN, paras.length + "개뿐이에요. 문단을 나눠 읽기 쉽게 해 보세요."));
    else items.push(item("문단 수", GOOD, paras.length + "개 문단이에요."));

    // details: 눌렀을 때 보여 줄 해당 문단·문장 목록 ({ text, paragraph })
    var longParas = [];
    paras.forEach(function (p, i) { if (p.length > 300) longParas.push({ text: p, paragraph: i }); });
    if (longParas.length) {
      var lp = item("긴 문단", WARN, "300자가 넘는 문단이 " + longParas.length + "개 있어요. 중간에 줄바꿈을 넣어 보세요.");
      lp.details = longParas;
      items.push(lp);
    } else items.push(item("긴 문단", GOOD, "모든 문단이 300자 이하예요."));

    // 문장 길이 (문단 안에서 나눠야 어느 문단인지 알 수 있다)
    var longSent = [];
    paras.forEach(function (p, i) {
      p.split(/[.!?。…]+/).forEach(function (s) {
        s = s.trim();
        if (s.length > 80) longSent.push({ text: s, paragraph: i });
      });
    });
    if (longSent.length) {
      var ls = item("긴 문장", WARN, "80자가 넘는 문장이 " + longSent.length + "개 있어요. 나눠 쓰면 읽기 쉬워요.");
      ls.details = longSent;
      items.push(ls);
    } else items.push(item("긴 문장", GOOD, "너무 긴 문장이 없어요."));

    // 키워드
    var tops = topWords(text, 10);
    var kw = (keyword || "").trim().toLowerCase();
    var density = null;
    if (!kw) {
      items.push(item("대표 키워드", INFO, "대표 키워드를 입력하면 제목·첫 문단·밀도를 점검해요." +
        (tops.length ? " 추천: " + tops[0].word : "")));
    } else {
      var lowText = text.toLowerCase(), lowTitle = title.toLowerCase();
      var n = countOf(lowText, kw);
      density = chars ? (n * kw.replace(/\s/g, "").length / chars) * 100 : 0;

      var tAt = lowTitle.indexOf(kw);
      if (tAt < 0) items.push(item("제목에 키워드", BAD, "제목에 “" + keyword.trim() + "” 가 없어요. 제목에 넣어 보세요."));
      else if (tAt <= 15) items.push(item("제목에 키워드", GOOD, "제목 앞쪽에 들어 있어요."));
      else items.push(item("제목에 키워드", WARN, "제목에 있지만 뒤쪽이에요. 앞쪽으로 옮기면 더 좋아요."));

      var first = paras.slice(0, 2).join(" ").toLowerCase();
      items.push(first.indexOf(kw) >= 0
        ? item("첫 문단", GOOD, "도입부에 키워드가 있어요.")
        : item("첫 문단", WARN, "첫 두 문단에 키워드가 없어요. 도입부에 자연스럽게 넣어 보세요."));

      var last = (paras[paras.length - 1] || "").toLowerCase();
      items.push(last.indexOf(kw) >= 0
        ? item("마무리", GOOD, "마지막 문단에도 키워드가 있어요.")
        : item("마무리", INFO, "마지막 문단에는 키워드가 없어요. 마무리에도 한 번 넣으면 좋아요."));

      if (n === 0) items.push(item("키워드 횟수", BAD, "본문에 키워드가 한 번도 없어요."));
      else if (n < 3) items.push(item("키워드 횟수", WARN, "본문에 " + n + "번 나와요. 3~10번 정도를 권장해요."));
      else if (density > 4) items.push(item("키워드 밀도", BAD, "밀도 " + density.toFixed(1) + "% (" + n + "번). 너무 반복해서 스팸처럼 보일 수 있어요."));
      else if (density > 3) items.push(item("키워드 밀도", WARN, "밀도 " + density.toFixed(1) + "% (" + n + "번). 조금 많은 편이에요."));
      else if (density < 0.5) items.push(item("키워드 밀도", WARN, "밀도 " + density.toFixed(1) + "% (" + n + "번). 조금 더 넣어 보세요."));
      else items.push(item("키워드 밀도", GOOD, "밀도 " + density.toFixed(1) + "% (" + n + "번)로 적당해요."));

      // 앞·중간·뒤에 고르게 나오는지
      var third = Math.ceil(lowText.length / 3), spread = 0;
      for (var i = 0; i < 3; i++) if (lowText.slice(i * third, (i + 1) * third).indexOf(kw) >= 0) spread++;
      if (n >= 3) {
        items.push(spread === 3
          ? item("분포", GOOD, "글의 앞·중간·뒤에 고르게 나와요.")
          : item("분포", WARN, "키워드가 글의 일부에만 몰려 있어요. 앞·중간·뒤에 나눠 넣어 보세요."));
      }
    }

    // 이미지·태그 (서버가 meta 를 보내 줄 때만)
    var m = post.meta;
    if (!m) {
      items.push(item("이미지·태그", INFO, "서버 함수를 최신 코드로 Deploy 하면 이미지와 태그도 점검해요."));
    } else {
      if (m.images === 0) items.push(item("이미지", BAD, "사진이 한 장도 없어요. 3장 이상을 권장해요."));
      else if (m.images < 3) items.push(item("이미지", WARN, "사진이 " + m.images + "장이에요. 3장 이상이면 더 좋아요."));
      else if (m.images <= 20) items.push(item("이미지", GOOD, "사진 " + m.images + "장이 들어 있어요."));
      else items.push(item("이미지", WARN, "사진이 " + m.images + "장으로 많아요. 모바일에서 느리게 열릴 수 있어요."));

      if (m.images > 0) {
        if (m.imagesWithAlt === 0) items.push(item("사진 설명", WARN, "사진 설명(대체 텍스트)이 하나도 없어요. 사진을 눌러 설명을 적어 두면 검색에 도움이 돼요."));
        else if (m.imagesWithAlt < m.images) items.push(item("사진 설명", WARN, "사진 " + m.images + "장 중 " + m.imagesWithAlt + "장에만 설명이 있어요."));
        else items.push(item("사진 설명", GOOD, "모든 사진에 설명이 있어요."));
      }

      var tags = m.tags;
      if (tags === null || tags === undefined) {
        items.push(item("태그", INFO, "태그를 불러오지 못했어요."));
      } else if (tags.length === 0) {
        items.push(item("태그", BAD, "태그가 없어요. 5~10개를 권장해요."));
      } else if (tags.length < 3) {
        items.push(item("태그", WARN, "태그가 " + tags.length + "개예요 (" + tags.join(", ") + "). 5~10개를 권장해요."));
      } else if (tags.length <= 15) {
        items.push(item("태그", GOOD, "태그 " + tags.length + "개: " + tags.join(", ")));
      } else {
        items.push(item("태그", WARN, "태그가 " + tags.length + "개로 많아요. 글과 관련 있는 것만 남겨 보세요."));
      }

      if (kw && tags && tags.length) {
        var hit = tags.some(function (t) { return t.toLowerCase().indexOf(kw) >= 0; });
        items.push(hit
          ? item("태그에 키워드", GOOD, "태그에 대표 키워드가 들어 있어요.")
          : item("태그에 키워드", WARN, "태그에 “" + keyword.trim() + "” 가 없어요. 태그에 추가해 보세요."));
      }

      var extras = [];
      if (m.videos) extras.push("동영상 " + m.videos);
      if (m.maps) extras.push("지도 " + m.maps);
      if (m.links) extras.push("링크 카드 " + m.links);
      items.push(item("부가 요소", INFO, extras.length ? extras.join(", ") + "개가 들어 있어요." : "동영상·지도·링크 카드는 없어요."));
    }

    // 점수 (INFO 는 제외)
    var scored = items.filter(function (x) { return x.status !== INFO; });
    var pts = scored.reduce(function (s, x) { return s + (x.status === GOOD ? 1 : x.status === WARN ? 0.5 : 0); }, 0);
    var score = scored.length ? Math.round((pts / scored.length) * 100) : 0;

    return { chars: chars, density: density, topWords: tops, items: items, score: score };
  }

  return { analyze: analyze, topWords: topWords };
})();
if (typeof module !== "undefined") module.exports = BSeo;
