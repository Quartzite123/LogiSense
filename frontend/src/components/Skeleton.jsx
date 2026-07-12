// Animated shimmer placeholder (UI_DESIGN_SPEC §10.5).
export default function Skeleton({ height = 80, width = '100%', className = '', style }) {
  return <div className={`skeleton ${className}`} style={{ height, width, ...style }} />
}
