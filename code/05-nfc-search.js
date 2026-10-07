/*
 * 발췌 5. 한글 NFD 제목 검색
 * 원본: js/memo.js
 * 커밋: 51ea712 fix(search): 한글 NFD 제목이 검색에 안 걸리던 문제 (2026-07-31)
 *
 * '까르보나라'로 검색하면 목록에 있는 메모가 안 나왔다.
 *
 * 한글은 완성형(NFC, '한' = U+D55C)과 자모 분리형(NFD, U+1112 U+1161 U+11AB)으로
 * 저장될 수 있다. macOS 파일시스템을 거친 옛 메모 제목이 NFD로 남아 있었고,
 * 코드에 normalize()가 없어서 includes/=== 비교가 실패했다.
 * 메모 49개를 전부 확인해 보니 제목 19개(레시피 전부)가 NFD, 태그와 본문은 전부 NFC였다.
 *
 * 수정은 두 군데.
 *   코드: 비교하는 곳마다 _nfc()를 거치게 했다 (searchText, 검색어, 매칭 대상, tag: 필터,
 *         스니펫, 하이라이트). NFD가 다시 들어와도 검색은 된다.
 *   데이터: NFD 제목 19개를 NFC로 바꿨다.
 *
 * 검증: 앱의 parseSearchQuery/evalSearchQuery로 '까르보나라' 0건에서 2건,
 * '부타노가쿠니' 0건에서 5건, tag:레시피 19건. 백업과 비교해 본문 49개는 그대로,
 * 제목 19개만 바뀐 것 확인.
 *
 * 아직 남은 것: 해시태그 정규식의 [가-힣]은 완성형만 잡아서 본문이 NFD면 태그 추출이 실패한다.
 * 지금 본문은 전부 NFC라 당장 문제는 없다. 같이 고치면 검증 범위가 커져서 이번엔 기록만 했다.
 */

function _nfc(s) { return typeof s === 'string' ? s.normalize('NFC') : s; }

// 검색어 파싱: "인용구", -부정, key:value 지원
function parseSearchQuery(raw) {
  const tokens = [];
  if (!raw) return tokens;
  const re = /(-?)((?:tag|type|is):)?(?:"([^"]*)"|(\S+))/gi;
  let m;
  while ((m = re.exec(raw)) !== null) {
    const neg = m[1] === '-';
    const key = m[2] ? m[2].slice(0, -1).toLowerCase() : null;
    const val = _nfc(m[3] !== undefined ? m[3] : m[4] || '').toLowerCase();  // 검색어 정규화
    if (!val && !key) continue;
    tokens.push({ neg, key, val });
  }
  return tokens;
}

function evalSearchQuery(note, tokens) {
  if (!tokens.length) return true;
  // 검색 대상도 같은 형태로 정규화
  const text = (note.searchText
    || _nfc(((note.title || '') + ' ' + (note.content || ''))).toLowerCase());

  for (const t of tokens) {
    let pass;
    if (t.key === 'tag') {
      const tag = t.val.replace(/^#/, '');
      pass = (note.tags || []).some(x => {
        const lx = _nfc(x || '').toLowerCase();
        return lx === tag || lx.startsWith(tag + '/');   // 상위 태그로 하위 태그까지 매칭
      });
    } else if (t.key === 'type') {
      pass = note.type === t.val;
    } else if (t.key === 'is') {
      if (t.val === 'pinned')        pass = !!note.pinned;
      else if (t.val === 'untagged') pass = (note.tags || []).length === 0;
      else if (t.val === 'conflict') pass = (note.tags || []).includes('conflict')
                                         || ((note.title || note.name || '').includes('(충돌'));
      else pass = false;
    } else {
      pass = text.includes(t.val);
    }
    if (t.neg) pass = !pass;
    if (!pass) return false;      // AND 조건
  }
  return true;
}
