/*
 * 발췌 6. 가끔 뜨는 "동기화 실패"
 * 원본: js/drive-client.js, js/sync.js
 * 커밋: ebc7f99 fix(sync): 가끔 뜨던 "동기화 실패" (2026-07-31)
 *
 * 재현 조건도 로그도 없는 제보였다. 실패 표시를 켜는 코드 경로를 거꾸로 따라가 보니
 * 세 가지가 겹쳐 있었다.
 *
 *  1. _scheduleProactiveRefresh는 만료 5분 전에 갱신 타이머를 거는데, delay <= 0이면
 *     그냥 return해서 타이머가 안 걸렸다. 이후로는 아무도 갱신을 안 한다.
 *  2. iOS PWA는 백그라운드에서 setTimeout이 안 돈다. 기기가 잠들었다 깨면 대부분 1번 상태가 된다.
 *  3. 15초마다 도는 drivePoll이 토큰이 없으면 갱신을 시도하지 않고 바로 setDriveStatus('error').
 *     refresh_token이 있으니 조용히 새로 받으면 되는 상황이었다.
 *
 * 동기화 자체는 문제가 없었고 헤더 표시만 빨갛게 바뀌던 것이다.
 * 토큰이 만료된 것과 재인증이 필요한 것을 구분해서, 먼저 갱신을 시도하고
 * 그것도 실패하면 error로 표시하게 바꿨다.
 */

// drive-client.js
class DriveClient {
  // ...

  // 만료 5분 전쯤 미리 갱신해서 요청 중에 만료된 토큰을 쓰는 일이 없게 한다.
  _scheduleProactiveRefresh() {
    if (this._refreshTimer) clearTimeout(this._refreshTimer);
    const lead = 5 * 60 * 1000;
    const delay = this.tokenExpires - Date.now() - lead;

    // 이미 만료됐거나 5분 안쪽이면 예전엔 여기서 그냥 return했다.
    // 기기가 자다 깬 직후가 이 경우라 바로 한 번 갱신한다.
    if (delay <= 0) {
      this.refreshAccessToken().catch(e => console.warn('Immediate refresh failed:', e));
      return;
    }

    this._refreshTimer = setTimeout(() => {
      // 여기서 실패해도 다음 요청 때 ensureToken이 다시 시도한다
      this.refreshAccessToken().catch(e => console.warn('Proactive refresh failed:', e));
    }, delay);
  }
}

// sync.js
// 팝업/리다이렉트 없이 토큰만 새로 받아본다. 성공하면 true.
// refresh_token이 없거나 폐기돼서 재인증이 필요할 때만 false.
async function _driveTrySilentRefresh() {
  if (typeof driveClient === 'undefined') return false;
  try {
    await driveClient.ensureToken({ silent: true });
    return driveClient.hasValidToken();
  } catch {
    return false;
  }
}

async function drivePoll(force = false) {
  if (!driveFolderId || isLoadingFromDrive || isPushingToDrive) return;

  // 토큰이 없는 건 대부분 일시적이다(갱신 타이머가 아직 안 돌았거나, iOS에서 setTimeout이
  // 멈췄거나, 네트워크가 잠깐 끊겼거나). 예전엔 여기서 바로 error를 찍어서 폴링 때마다
  // "동기화 실패"가 깜빡였다. 이제는 조용히 갱신부터 해본다.
  if (!hasValidDriveToken()) {
    if (!(await _driveTrySilentRefresh())) setDriveStatus('error');
    return;   // 갱신됐어도 이번 틱은 건너뛰고 다음 폴링에서 정상 처리
  }

  if (!force && driveDirty) return;                        // 아직 안 올린 로컬 변경이 있으면 pull하지 않음
  if (!force && document.hidden) return;
  if (!force && Date.now() - driveLastPushAt < 4000) return;
  // ...
}

/* 결과
 *   토큰 만료 + refresh_token 있음: 조용히 갱신, 화면 변화 없음
 *   refresh_token 폐기: 이때만 "동기화 실패"
 *
 * 같은 커밋에서 하나 더 고쳤다. 재시도 타이머가 만료될 때 driveRetryAttempt를 0으로
 * 돌리면서 재시도를 멈춰버려서, 밀린 변경이 영영 안 올라가는 경우가 있었다.
 */
