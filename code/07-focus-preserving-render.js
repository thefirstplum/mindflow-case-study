/*
 * 발췌 7. 일기 입력 중 커서가 사라지는 문제
 * 원본: js/calendar.js
 * 커밋: fix(calendar): 감정일기 입력 중 포커스 소실 수정 (2026-08-04)
 *
 * 일기를 쓰다 보면 가끔 커서가 사라지고 입력이 끊겼다.
 *
 * 이 화면을 다시 그리는 경로가 세 개다. Drive 동기화 응답, Google Calendar 응답,
 * 일기 자동저장. 어느 쪽이든 renderCalendar()를 부르면 innerHTML이 교체되면서
 * textarea가 새로 만들어지고 포커스와 커서 위치가 날아간다.
 * 프레임워크를 썼으면 diff 렌더링이 막아줬을 문제다.
 *
 * "지금 일기를 입력 중인가"를 판단하는 함수를 하나 두고, 렌더 경로마다 그걸 확인해서
 * 입력 중이면 textarea를 건드리지 않게 했다. 조건을 렌더러마다 따로 두면
 * 렌더 경로가 늘 때 빠뜨리기 쉽다.
 */

// 일기 textarea에 포커스가 있는지. 렌더러들이 다시 그릴지 판단할 때 쓴다.
function _calJournalTyping() {
  const ae = document.activeElement;
  return !!(ae && ae.id === 'cal-journal-ta');
}

// 경로 1: 데스크톱 일기 패널. 입력 중이면 무드 버튼만 갱신한다.
function _renderDayJournal() {
  const host = document.getElementById('cal-day-journal');
  if (!host) return;
  const journal = _diaryParse(_diaryMemo(calSelectedKey));
  const moodHtml = _calMoodRowHtml();

  // innerHTML을 통째로 바꾸면 textarea가 새로 만들어져 커서가 날아간다
  if (_calJournalTyping()) {
    const row = host.querySelector('.cal-mood-row');
    if (row) row.innerHTML = moodHtml;
    return;
  }

  host.innerHTML = `
    <!-- ... 제목, 날짜 ... -->
    <div class="cal-mood-row">${moodHtml}</div>
    <textarea id="cal-journal-ta"
              oninput="calJournalInput()"
              onblur="calJournalBlur()">${_escapeHtml(journal.body || '')}</textarea>`;
}

// 경로 2: 모바일 하루 보기. textarea가 이 el 안에 같이 들어 있어서
// 입력 중에는 아예 다시 그리지 않고 blur(calJournalBlur) 때 반영한다.
function _renderMobileCal() {
  const el = document.getElementById('cal-mobile');
  if (!el) return;
  if (_calJournalTyping()) return;
  // ...
}

// 경로 3: 자동저장. 저장만 하고 렌더는 안 한다.
// 자동저장이 스스로 화면을 다시 그려 포커스를 날리는 경우가 제일 많았다.
function calJournalInput() {
  clearTimeout(_calJournalTimer);
  _calJournalTimer = setTimeout(_calJournalSave, 600);
}

function _calJournalSave() {
  const ta = document.getElementById('cal-journal-ta');
  if (!ta) return;
  _diaryWrite(calSelectedKey, _diaryParse(_diaryMemo(calSelectedKey)).mood, ta.value);
  // 화면 반영은 blur 때 calJournalBlur()에서
}

/* 같이 고친 것
 * - 무드 버튼에 onmousedown preventDefault를 걸었다. 버튼을 누르면 textarea blur,
 *   전체 재렌더, 버튼 교체 순으로 진행돼서 click 이벤트가 사라졌다. mousedown에서
 *   포커스 이동을 막으면 blur가 안 일어난다.
 * - 무드 버튼 마크업을 만드는 코드가 두 군데 있던 걸 _calMoodRowHtml()로 합쳤다.
 */
