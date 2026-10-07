/*
 * 발췌 1. 경과시간 기반 집중 타이머
 * 원본: js/pomodoro.js
 * 커밋: 8a428f8 feat(pomodoro): 집중 타이머 1단계 (2026-08-16)
 *
 * iOS PWA는 화면이 꺼지면 JS가 멈춘다. `남은시간--` 방식이면 주머니에 45분
 * 넣어뒀다 꺼냈을 때 타이머가 3분에 멈춰 있다.
 *
 * 그래서 상태로는 시작 시각만 저장하고, 화면 숫자는 틱마다 (지금 - 시작 시각)으로
 * 다시 계산한다. 앱을 껐다 켜거나 배포 후 자동 새로고침이 끼어도 값이 맞다.
 * 일시정지는 멈춰 있던 시간의 합계를 따로 들고 있다가 빼는 식이고,
 * 목표 시간(기본 45분)을 넘겨도 멈추지 않고 계속 센다.
 */

// 경과 시간 계산은 여기 한 곳에서만 한다.
function _pomoElapsedMs() {
  if (!pomoState) return 0;
  const end = pomoState.pausedAt || Date.now();
  return Math.max(0, end - pomoState.startedAt - (pomoState.pausedTotalMs || 0));
}

function _pomoTargetMs() {
  return (pomoState ? pomoState.targetMin : pomoSettings.targetMin) * 60000;
}

// 매초 도는 함수라 innerHTML을 쓰지 않는다. 쓰면 1초마다 DOM이 새로 만들어져서
// 발췌 7 같은 포커스 문제가 생긴다. textContent, style, classList만 건드린다.
function _pomoTick() {
  if (!pomoState) { _pomoStopTicker(); return; }
  const ms = _pomoElapsedMs();
  const target = _pomoTargetMs();

  const timeEl = document.getElementById('pomo-time');
  if (timeEl) timeEl.textContent = _pomoFmt(ms);

  const fill = document.getElementById('pomo-fill');
  if (fill) fill.style.width = Math.min(100, (ms / target) * 100) + '%';

  const bar = document.getElementById('pomo-bar');
  const over = ms >= target;
  if (bar) bar.classList.toggle('over', over);

  if (over && !pomoState.pausedAt && !pomoState.alarmedAt) _pomoAlarm();
}

// 시작 시각, 일시정지 여부, 목표가 바뀔 때만 바 HTML을 다시 만든다.
// 나머지는 _pomoTick이 텍스트만 갱신한다.
function renderPomodoroBar() {
  const host = document.getElementById('pomo-bar-host');
  if (!host) return;
  if (!pomoState) { host.innerHTML = ''; _pomoBarKey = ''; return; }

  const key = `${pomoState.startedAt}|${pomoState.pausedAt ? 1 : 0}|${pomoState.targetMin}`;
  if (key === _pomoBarKey) return;
  _pomoBarKey = key;

  host.innerHTML = /* ... 바 구조 ... */ '';
  _pomoTick();
}

// save()가 내부에서 scheduleDriveSave()를 부르기 때문에 매초 호출하면 Drive 동기화도 매초 돈다.
// 시작/정지/재개/종료 때만 부른다.
function _pomoSaveState() {
  save('pomo_state', pomoState);
}
