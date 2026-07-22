export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return '0'
  const absolute = Math.abs(value)
  const units = [
    { threshold: 1e12, suffix: 'T' },
    { threshold: 1e9, suffix: 'B' },
    { threshold: 1e6, suffix: 'M' },
    { threshold: 1e3, suffix: 'K' },
  ]
  const unit = units.find(({ threshold }) => absolute >= threshold)
  if (!unit) return Math.floor(value).toLocaleString('ko-KR')
  return `${(value / unit.threshold).toFixed(value >= unit.threshold * 10 ? 1 : 2)}${unit.suffix}`
}

export function formatDuration(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1_000))
  const hours = Math.floor(totalSeconds / 3_600)
  const minutes = Math.floor((totalSeconds % 3_600) / 60)
  const seconds = totalSeconds % 60
  if (hours > 0) return `${hours}시간 ${minutes}분`
  if (minutes > 0) return `${minutes}분 ${seconds}초`
  return `${seconds}초`
}
