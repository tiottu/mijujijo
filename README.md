# B

네이버 블로그 글 주소를 넣으면 오탈자 검수와 검색어 기반 개선 가이드를 주는 모바일 웹앱(PWA).

## 진행 단계

1. 글 불러오기 - URL 입력 -> 제목/본문 표시
2. 오탈자·문장 검수 (Claude API) - 본문에 표시하고 수정안을 카드로 보여 줌
3. **글 점검** (현재, AI 없이 규칙으로) - 글자 수·키워드·구조 점검과 점수 (`seo.js`)
4. 검색량 API 연동

## 구성

- `index.html`, `app.js`, `style.css`, `manifest.webmanifest` - 앱 화면
- `config.js` - Supabase 주소와 anon key (공개 가능한 값만)
- `supabase/functions/fetch-blog/index.ts` - 글을 가져와 파싱하는 Edge Function

## Edge Function 배포

Supabase 대시보드 > Edge Functions > `hyper-service` (슬러그는 만든 뒤 못 바꿔서 앱이 이 이름을 부른다) 편집기에 `index.ts` 전체를 붙여넣고 Deploy.
검수 기능은 Edge Functions > Secrets 에 `ANTHROPIC_API_KEY` 가 있어야 한다. (선택) `CLAUDE_MODEL` 로 모델 변경.

사이트: https://tiottu.github.io/mijujijo/

