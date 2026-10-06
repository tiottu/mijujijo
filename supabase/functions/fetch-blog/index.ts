// 네이버 블로그 글 URL -> { title, paragraphs, text } 로 돌려주는 Edge Function.
// Supabase 대시보드 > Edge Functions > 새 함수 이름 "fetch-blog" 에 이 파일 전체를 붙여넣어 배포한다.
// 배포 시 "Verify JWT" 는 켜 둔 채로 두고, 앱에서 anon key 로 호출한다.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_CHARS = 30000;

// ---- 파싱 (Deno 에 의존하지 않는 순수 함수) ----

function parseBlogUrl(input) {
  let u;
  try {
    u = new URL(String(input).trim());
  } catch {
    return null;
  }
  const host = u.hostname.toLowerCase();
  if (host !== "blog.naver.com" && host !== "m.blog.naver.com") return null;

  const qId = u.searchParams.get("blogId");
  const qNo = u.searchParams.get("logNo");
  if (qId && qNo && /^\d+$/.test(qNo)) return { blogId: qId, logNo: qNo };

  const parts = u.pathname.split("/").filter(Boolean);
  if (parts.length >= 2 && /^\d+$/.test(parts[1])) return { blogId: parts[0], logNo: parts[1] };
  return null;
}

function decodeEntities(s) {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&amp;/g, "&");
}

function htmlToText(html) {
  return decodeEntities(
    html
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, "")
  )
    .replace(/[​‌‍﻿]/g, "")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function paragraphsOf(html) {
  const out = [];
  const re = /<p\b[^>]*class="[^"]*se-text-paragraph[^"]*"[^>]*>([\s\S]*?)<\/p>/g;
  let m;
  while ((m = re.exec(html))) {
    const t = htmlToText(m[1]);
    if (t) out.push(t);
  }
  return out;
}

function parsePost(html) {
  let title = "";
  const tIdx = html.indexOf("se-title-text");
  if (tIdx >= 0) {
    title = paragraphsOf(html.slice(tIdx, tIdx + 4000))[0] || "";
  }
  if (!title) {
    const og = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]*)"/);
    if (og) title = decodeEntities(og[1]).trim();
  }

  let paragraphs = [];
  const bIdx = html.indexOf("se-main-container");
  if (bIdx >= 0) {
    // 제목 영역은 본문이 아니므로 제외하고, 본문 컨테이너 이후만 본다.
    paragraphs = paragraphsOf(html.slice(bIdx));
  } else {
    // 구형 에디터
    const old = html.match(/id="postViewArea"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/);
    if (old) paragraphs = htmlToText(old[1]).split(/\n+/).map((s) => s.trim()).filter(Boolean);
  }
  return { title, paragraphs };
}

// ---- 서버 ----

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" },
  });
}

// @ts-ignore Deno 전용
if (typeof Deno !== "undefined") {
  // @ts-ignore
  Deno.serve(async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
    if (req.method !== "POST") return json({ error: "POST 로 호출하세요." }, 405);

    let url = "";
    try {
      url = (await req.json()).url;
    } catch {
      return json({ error: "요청 형식이 올바르지 않습니다." }, 400);
    }

    const ref = parseBlogUrl(url);
    if (!ref) {
      return json({ error: "네이버 블로그 글 주소가 아닙니다. 예: https://blog.naver.com/아이디/글번호" }, 400);
    }

    const target = `https://m.blog.naver.com/${encodeURIComponent(ref.blogId)}/${ref.logNo}`;
    let res;
    try {
      res = await fetch(target, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 Mobile Safari/604.1",
          "Accept-Language": "ko-KR,ko;q=0.9",
        },
      });
    } catch {
      return json({ error: "블로그에 접속하지 못했습니다." }, 502);
    }
    if (!res.ok) return json({ error: `블로그를 불러오지 못했습니다. (${res.status})` }, 502);

    const { title, paragraphs } = parsePost(await res.text());
    if (paragraphs.length === 0) {
      return json({ error: "본문을 찾지 못했습니다. 비공개 글이거나 지원하지 않는 형식일 수 있습니다." }, 422);
    }

    let text = paragraphs.join("\n");
    const truncated = text.length > MAX_CHARS;
    if (truncated) text = text.slice(0, MAX_CHARS);

    return json({ blogId: ref.blogId, logNo: ref.logNo, title, paragraphs, text, truncated, length: text.length });
  });
}
