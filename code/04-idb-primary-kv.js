/*
 * 발췌 4. localStorage에서 IndexedDB로 이전
 * 원본: js/utils.js
 * 커밋: feat: localStorage → IDB primary 전환 (용량 5MB → 디스크의 ~60%) (2026-05-28)
 *
 * localStorage 5MB 한도에 걸렸다. IndexedDB는 비동기인데 앱 전체가 동기 함수인
 * load()/save()를 쓰고 있었다. 시그니처를 async로 바꾸면 sync.js, memo.js,
 * mindmap.js를 전부 고쳐야 해서 동기 인터페이스를 그대로 두기로 했다.
 *
 *   메모리 캐시(_kvCache)  load()는 여기서만 읽는다
 *   IndexedDB             실제 저장소. save()가 80ms 모아서 쓴다
 *   localStorage          부팅 직후 캐시 채우기 + 백업 사본
 *
 * utils.js가 평가되는 시점에 localStorage의 mindflow_* 키를 동기로 캐시에 넣는다.
 * 다른 모듈이 load()를 부를 때는 이미 캐시가 차 있다. IDB 값은 그 뒤에 비동기로 덮어쓴다.
 * 호출하는 쪽 코드는 한 줄도 안 바꿨다.
 */

const _kvCache = new Map();

// 1) 동기 시드. 파일 로드 시 바로 실행된다.
(function _seedFromLocalStorage() {
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k || !k.startsWith('mindflow_')) continue;
    const raw = localStorage.getItem(k);
    try { _kvCache.set(k.slice('mindflow_'.length), JSON.parse(raw)); }
    catch { _kvCache.set(k.slice('mindflow_'.length), raw); }
  }
})();

// 2) IDB 부팅. IDB 값을 캐시에 덮어쓰고, localStorage에만 있는 키는 IDB로 복사한다.
// 실패하면 localStorage만으로 계속 동작한다.
async function _kvBoot() {
  try {
    // ... IDB 열기, 커서로 전체 순회하며 _kvCache.set(cursor.key, cursor.value)
    // ... LS의 mindflow_* 키를 캐시 값으로 store.put() (여러 번 돌아도 결과가 같다)
  } catch (e) {
    console.warn('[kv] IDB boot failed — localStorage mode 유지:', e);
  }
}

// 3) save / load
// IDB 쓰기는 _kvPendingWrites에 모았다가 80ms 뒤 _kvFlush()가 한 트랜잭션으로 쓴다.
function save(key, data) {
  _kvCache.set(key, data);          // 다음 load()가 바로 새 값을 보도록
  _kvPendingWrites.set(key, data);
  clearTimeout(_kvFlushTimer);
  _kvFlushTimer = setTimeout(_kvFlush, 80);
  try {
    localStorage.setItem('mindflow_' + key, JSON.stringify(data));
  } catch {
    // 용량 초과. IDB에는 들어갔으니 경고만 남긴다.
    console.warn('[save] LS mirror failed (IDB OK):', key);
  }
  scheduleDriveSave();
  // ... 용량 체크
}

function load(key, def) {
  if (_kvCache.has(key)) return _kvCache.get(key);
  // 캐시에 없으면 localStorage에서 한 번 더 (부팅 극초기 호출 대비)
  try {
    const v = localStorage.getItem('mindflow_' + key);
    if (v != null) {
      try { return JSON.parse(v); } catch { return v; }
    }
  } catch {}
  return def;
}

/* 4) Storage.prototype 패치
 * sync.js 등에서 localStorage.setItem('mindflow_xxx', ...)를 직접 부르는 곳이 52군데 있었다.
 * 하나씩 고치다 빠뜨릴 바에야 setItem/removeItem을 감싸서 캐시와 IDB에도 반영되게 했다.
 * mindflow_ 접두 키만 건드리고 나머지는 원래대로 통과시킨다.
 */
(function _patchStorageForKv() {
  const origSet = Storage.prototype.setItem;
  const origRm  = Storage.prototype.removeItem;

  Storage.prototype.setItem = function (key, value) {
    if (this === localStorage && typeof key === 'string' && key.startsWith('mindflow_')) {
      const subKey = key.slice('mindflow_'.length);
      let parsed; try { parsed = JSON.parse(value); } catch { parsed = value; }
      _kvCache.set(subKey, parsed);
      _kvPendingWrites.set(subKey, parsed);
      clearTimeout(_kvFlushTimer);
      _kvFlushTimer = setTimeout(_kvFlush, 80);
    }
    return origSet.call(this, key, value);
  };

  Storage.prototype.removeItem = function (key) {
    if (this === localStorage && typeof key === 'string' && key.startsWith('mindflow_')) {
      const subKey = key.slice('mindflow_'.length);
      _kvCache.delete(subKey);
      _kvPendingWrites.set(subKey, undefined);   // undefined는 flush 때 delete
      clearTimeout(_kvFlushTimer);
      _kvFlushTimer = setTimeout(_kvFlush, 80);
    }
    return origRm.call(this, key);
  };
})();

// 5) 탭이 닫힐 때 IDB 쓰기 큐에 남은 걸 flush
window.addEventListener('pagehide', _kvFlush);
window.addEventListener('beforeunload', _kvFlush);
