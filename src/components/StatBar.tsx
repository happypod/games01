interface StatBarProps {
  label: string
  value: number
  maximum: number
  tone?: 'health' | 'xp' | 'enemy' | 'skill'
}

export function StatBar({ label, value, maximum, tone = 'health' }: StatBarProps) {
  const safeMaximum = Math.max(1, maximum)
  const percentage = Math.min(100, Math.max(0, (value / safeMaximum) * 100))
  return (
    <div className="stat-bar" aria-label={`${label} ${Math.round(percentage)}%`}>
      <div className="stat-bar__line">
        <span>{label}</span>
        <span>
          {Math.max(0, Math.ceil(value)).toLocaleString('ko-KR')} /{' '}
          {Math.ceil(maximum).toLocaleString('ko-KR')}
        </span>
      </div>
      <div className="stat-bar__track">
        <div
          className={`stat-bar__fill stat-bar__fill--${tone}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}
