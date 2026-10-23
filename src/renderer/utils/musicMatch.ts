/**
 * 曲目匹配打分：用于把本地曲目匹配成平台曲目 id。
 * 歌名权重高于歌手，阈值 MATCH_THRESHOLD 之下视为未匹配。
 */
export const MATCH_THRESHOLD = 1.8

export const normalize = (value: string): string => (value ?? '').toLowerCase().replace(/[\s\-_()（）[\]【】.,，。·'"!！?？/\\]/g, '')

/** 歌名完全一致 2，互相包含 1.2，其余 0 */
export const nameScore = (a: string, b: string): number => {
  const left = normalize(a)
  const right = normalize(b)
  if (!left || !right) return 0
  if (left === right) return 2
  if (left.includes(right) || right.includes(left)) return 1.2
  return 0
}

/** 歌手完全一致 1，互相包含 0.6，其余 0 */
export const singerScore = (a: string, b: string): number => {
  const left = normalize(a)
  const right = normalize(b)
  if (!left || !right) return 0
  if (left === right) return 1
  if (left.includes(right) || right.includes(left)) return 0.6
  return 0
}

export interface MatchCandidate {
  id: string
  name: string
  singer: string
}

/** 从候选里挑最匹配的一条，低于阈值返回 null */
export const pickBestMatch = (
  target: { name: string, singer: string },
  candidates: MatchCandidate[],
  threshold = MATCH_THRESHOLD,
): MatchCandidate | null => {
  let best: MatchCandidate | null = null
  let bestScore = threshold
  for (const candidate of candidates) {
    const score = nameScore(target.name, candidate.name) + singerScore(target.singer, candidate.singer)
    if (score > bestScore) {
      best = candidate
      bestScore = score
    }
  }
  return best
}
