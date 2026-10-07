/*
 * 발췌 3. 마인드맵 노드 단위 머지
 * 원본: js/sync.js _mergeMindmapPair()
 * 커밋: 62c1e84 feat(5b/4): 마인드맵 노드 단위 머지 (CRDT-lite, add-wins + tombstone) (2026-05-28)
 *
 * 마인드맵 전체를 last-write-wins로 머지하면 두 기기에서 서로 다른 노드를 고쳐도
 * 한쪽 편집이 통째로 사라진다. 충돌 사본을 만드는 식으로 바꿨더니 사본만 쌓였다.
 *
 * 그래서 머지 단위를 노드로 내렸다. CRDT 라이브러리는 번들러가 필요해서 안 쓰고
 * 필드별로 규칙을 정했다.
 *
 *   노드       id 합집합, 같은 id면 node.updatedAt이 늦은 쪽
 *   노드 삭제  deletedNodes[id]가 노드 수정보다 늦으면 삭제 유지
 *   엣지       'from-to' 키로 합집합, 양 끝 노드가 둘 다 살아 있을 때만
 *   맵 메타    name/tags/pinned는 updatedAt이 늦은 쪽
 *   pan/zoom   로컬 값 유지 (기기마다 다른 게 정상)
 *   idCounter  둘 중 큰 값 (새 노드 id 충돌 방지)
 *
 * 순수 add-wins면 지운 노드가 되살아나는 게 정상인데 사용자 입장에선 버그라서
 * tombstone이 더 최신이면 삭제를 유지하도록 했다.
 */

function _mergeMindmapPair(remote, local) {
  const remoteAt = new Date(remote.updatedAt || 0).getTime();
  const localAt  = new Date(local.updatedAt || 0).getTime();

  // 맵 메타(name/tags/pinned)는 최신 쪽
  const winner = remoteAt >= localAt ? remote : local;

  const result = {
    ...winner,
    // 화면 위치는 기기별 상태라 원격 값을 받지 않는다
    pan:  local.pan || winner.pan,
    zoom: local.zoom != null ? local.zoom : winner.zoom,
    idCounter: Math.max(remote.idCounter || 1, local.idCounter || 1, 1),
    deletedNodes: _unionTombstones(remote.deletedNodes, local.deletedNodes),
  };

  const loser = winner === remote ? local : remote;
  if (!('tags' in winner) && loser && Array.isArray(loser.tags) && loser.tags.length > 0) {
    result.tags = loser.tags;
  }

  // 노드: id 합집합, 같은 id는 updatedAt 비교, tombstone이면 제외
  const tombs = result.deletedNodes;
  const nodeMap = new Map();

  const consider = (n, fallbackAt) => {
    if (!n || n.id == null) return;
    const tombAt = tombs[n.id] ? new Date(tombs[n.id]).getTime() : 0;
    // updatedAt 없는 옛 노드는 맵의 updatedAt으로 대신한다
    const nAt = new Date(n.updatedAt || 0).getTime() || fallbackAt;
    if (tombAt && tombAt >= nAt) return;          // 삭제가 더 최신
    const prev = nodeMap.get(n.id);
    if (!prev) { nodeMap.set(n.id, n); return; }
    const prevAt = new Date(prev.updatedAt || 0).getTime()
                 || (prev._side === 'r' ? remoteAt : localAt);
    if (nAt >= prevAt) nodeMap.set(n.id, n);
  };

  for (const n of (local.nodes  || [])) { n._side = 'l'; consider(n, localAt);  }
  for (const n of (remote.nodes || [])) { n._side = 'r'; consider(n, remoteAt); }

  // 비교용 _side 필드는 저장 전에 뺀다
  result.nodes = [...nodeMap.values()].map(n => { const { _side, ...rest } = n; return rest; });

  // 엣지: 양 끝 노드가 남아 있는 것만. 안 그러면 없는 노드로 선이 그어진다.
  const liveIds = new Set(result.nodes.map(n => n.id));
  const edgeKey = e => `${e.from}-${e.to}`;
  const edgeMap = new Map();
  for (const e of (local.edges  || [])) if (liveIds.has(e.from) && liveIds.has(e.to)) edgeMap.set(edgeKey(e), e);
  for (const e of (remote.edges || [])) if (liveIds.has(e.from) && liveIds.has(e.to)) edgeMap.set(edgeKey(e), e);
  result.edges = [...edgeMap.values()];

  return result;
}

// tombstone 합치기. 같은 id면 더 늦은 삭제 시각을 남긴다.
function _unionTombstones(a, b) {
  const out = { ...(a || {}) };
  for (const [k, v] of Object.entries(b || {})) {
    if (!out[k] || new Date(v).getTime() > new Date(out[k]).getTime()) out[k] = v;
  }
  return out;
}
