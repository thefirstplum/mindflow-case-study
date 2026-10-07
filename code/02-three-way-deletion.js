/*
 * 발췌 2. 다른 기기에서 지운 메모가 되살아나는 문제
 * 원본: js/sync.js mergeMemos()
 * 커밋: 512f77e fix: 다른 기기 삭제가 모바일에서 부활하던 버그 (2026-05-08)
 *
 * 데스크톱에서 중복 메모를 지워도 모바일이 pull할 때 로컬 사본을 유지하고,
 * 다음 push에서 다시 Drive에 올려버렸다.
 *
 * 머지 규칙이 "로컬에만 있으면 보존"이었는데, 방금 새로 만든 메모와
 * 다른 기기에서 지운 옛 메모가 로컬/원격만 봐서는 구분이 안 된다.
 *
 * 그래서 지난 pull 때의 스냅샷(pullSnap)을 같이 본다. 로컬 메모가
 *   - 스냅샷에 있었고 (예전에 Drive에 있던 메모)
 *   - 지금 원격에 없고 (다른 기기에서 지움)
 *   - 로컬 mtime이 스냅샷 시점 이후로 안 바뀌었으면
 * 로컬에서도 지운다. 삭제된 뒤에 내가 편집한 메모는 남겨서 다시 올린다.
 */

function mergeMemos(remoteMemos, localMemos, opts) {
  opts = opts || {};
  const tombstones = opts.tombstones || {};
  const pullSnap = opts.pullSnap || {};          // 지난 pull 시점 스냅샷
  const editingMemoId = opts.editingMemoId == null ? null : opts.editingMemoId;

  const remoteIdSet = new Set(remoteMemos.map(m => m && m.id).filter(Boolean));
  const mtime = m => new Date(m.updatedAt || m.date || 0).getTime();

  // 이긴 쪽에 tags 필드가 없으면 진 쪽 tags를 쓴다.
  // 옛 클라이언트가 tags 없이 올린 파일 때문에 태그가 날아가는 걸 막으려는 것.
  const mergeWithTags = (winner, loser) => {
    if (!('tags' in winner) && loser && Array.isArray(loser.tags) && loser.tags.length > 0) {
      return { ...winner, tags: loser.tags };
    }
    return winner;
  };

  const merged = new Map();

  // 원격부터 넣는다. 로컬 tombstone이 원격 수정 시각보다 늦으면 건너뛴다.
  for (const m of remoteMemos) {
    if (!m) continue;
    const deletedAt = tombstones[m.id];
    if (deletedAt && new Date(deletedAt).getTime() >= mtime(m)) continue;
    merged.set(m.id, m);
  }

  for (const m of localMemos) {
    // 원격에서 지워진 메모인지 확인
    if (!remoteIdSet.has(m.id) && pullSnap.memos && (m.id in pullSnap.memos)) {
      const snapMtime = new Date(pullSnap.memos[m.id] || 0).getTime();
      if (mtime(m) <= snapMtime) continue;   // 그 뒤로 안 고쳤으면 로컬에서도 제거
      // 삭제 이후 로컬에서 고친 메모는 아래로 내려가서 보존
    }
    const r = merged.get(m.id);
    if (!r) merged.set(m.id, m);
    else if (mtime(m) > mtime(r)) merged.set(m.id, mergeWithTags(m, r));
    else merged.set(m.id, mergeWithTags(r, m));
  }

  const out = [...merged.values()];
  out.sort((a, b) => mtime(b) - mtime(a));

  // 편집 중인 메모는 타임스탬프와 상관없이 로컬 것을 쓴다.
  // 타이핑 중에 동기화가 본문을 바꾸면 안 되니까.
  if (editingMemoId != null) {
    const local = localMemos.find(m => m.id === editingMemoId);
    if (local) {
      const idx = out.findIndex(m => m.id === editingMemoId);
      if (idx >= 0) out[idx] = local;
      else out.unshift(local);
    }
  }
  return out;
}
