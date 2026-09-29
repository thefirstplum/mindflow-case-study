# 코드 발췌

원본 앱에서 설명이 필요한 부분만 뽑았다. 파일 상단 주석에 원본 위치, 커밋, 배경을 적었다.
일부 함수는 줄였고(`// ...` 표시), 단독으로 실행되는 코드는 아니다. 전체 코드는 [앱 저장소](https://github.com/thefirstplum/mindflow)에 있다.

| # | 파일 | 원본 | 발단 |
|---|---|---|---|
| 1 | [01-elapsed-timer.js](01-elapsed-timer.js) | js/pomodoro.js | 아이폰 화면을 끄면 타이머가 멈춤 |
| 2 | [02-three-way-deletion.js](02-three-way-deletion.js) | js/sync.js | 데스크톱에서 지운 메모가 폰에서 다시 올라옴 |
| 3 | [03-crdt-lite-mindmap.js](03-crdt-lite-mindmap.js) | js/sync.js | 두 기기에서 같은 마인드맵을 고치면 한쪽이 사라짐 |
| 4 | [04-idb-primary-kv.js](04-idb-primary-kv.js) | js/utils.js | localStorage 5MB 초과 |
| 5 | [05-nfc-search.js](05-nfc-search.js) | js/memo.js | '까르보나라' 검색 0건 |
| 6 | [06-silent-token-refresh.js](06-silent-token-refresh.js) | js/drive-client.js, js/sync.js | 가끔 뜨는 "동기화 실패" |
| 7 | [07-focus-preserving-render.js](07-focus-preserving-render.js) | js/calendar.js | 일기 쓰다가 커서가 사라짐 |

2번과 6번이 짧고 동기화 쪽 문제를 잘 보여준다. 4번이 제일 조심해서 바꾼 부분이다.
