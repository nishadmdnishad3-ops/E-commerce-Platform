export default function StatCard({ label, value, tone = 'default' }) {
  return (
    <div className={`stat-card tone-${tone}`}>
      <div>
        <p>{label}</p>
        <h3>{value}</h3>
      </div>
    </div>
  )
}
