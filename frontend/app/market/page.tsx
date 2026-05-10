'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts'

// ── Types ─────────────────────────────────────────────────────────────────────
interface Summary {
  median_price: number
  price_per_sqft: number | null
  total_transactions: number
  most_active_city: string | null
  most_active_pct: number | null
  yoy_change_pct: number | null
  market_trend: 'Rising' | 'Falling' | 'Stable'
  trend_change_pct: number
  consecutive_quarters: number
}

interface TrendPoint {
  year: number
  month: number
  label: string
  median: number
  count: number
}

interface CityRow {
  city: string
  median_price: number
  count: number
  yoy_change: number | null
  price_per_sqft: number | null
}

interface TypeRow {
  type: string
  median_price: number
  count: number
}

interface VolumeRow {
  month: number
  label: string
  count: number
}

const API = process.env.NEXT_PUBLIC_API_URL ?? ''

function capitalizeCity(city: string): string {
  return city
    .split(' ')
    .map(word =>
      word.split('-')
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join('-')
    )
    .join(' ')
}

function fmt(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `$${Math.round(n / 1000)}K`
  return `$${n}`
}

function fmtFull(n: number) {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(n)
}

function YoY({ val }: { val: number | null }) {
  if (val === null || val === undefined) return <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>—</span>
  const up = val >= 0
  return (
    <span style={{ fontSize: 11, color: up ? '#1D9E75' : '#e05c5c', fontWeight: 500 }}>
      {up ? '↑' : '↓'} {Math.abs(val).toFixed(1)}%
    </span>
  )
}

// ── Custom Tooltip ────────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null
  const d = payload[0].payload
  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const monthName = monthNames[(d.month - 1)] ?? ''
  return (
    <div style={{
      background: '#faf7f2',
      border: '0.5px solid rgba(29,158,117,0.25)',
      borderRadius: 10,
      padding: '10px 14px',
      boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
    }}>
      <p style={{ fontSize: 11, color: '#1D9E75', fontWeight: 500, marginBottom: 4, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
        {monthName} {d.year}
      </p>
      <p style={{ fontSize: 18, fontWeight: 500, color: '#1a2420', marginBottom: 2 }}>
        {fmtFull(d.median)}
      </p>
      <p style={{ fontSize: 11, color: 'rgba(26,36,32,0.5)' }}>
        {d.count.toLocaleString()} transactions
      </p>
    </div>
  )
}

// ── Volume bar chart (SVG) ────────────────────────────────────────────────────
function VolumeChart({ data }: { data: VolumeRow[] }) {
  if (!data.length) return null
  const maxCount = Math.max(...data.map(d => d.count))
  const W = 640, H = 100, PB = 20
  const barW = (W / data.length) * 0.55
  const gap = W / data.length

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }}>
      {data.map((d, i) => {
        const barH = ((d.count / maxCount) * (H - PB - 8))
        const x = i * gap + gap / 2 - barW / 2
        const y = H - PB - barH
        const peak = d.count === maxCount
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={barH} rx="3" fill={peak ? '#1D9E75' : 'rgba(29,158,117,0.2)'} />
            <text x={x + barW / 2} y={H - 4} fontSize="9" fill="rgba(26,36,32,0.45)" textAnchor="middle">{d.label}</text>
          </g>
        )
      })}
    </svg>
  )
}

// ── Colour tier for heatmap ───────────────────────────────────────────────────
function heatColour(rank: number, total: number): { bg: string; text: string } {
  const pct = rank / total
  if (pct < 0.15) return { bg: '#085041', text: '#fff' }
  if (pct < 0.30) return { bg: '#0F6E56', text: '#fff' }
  if (pct < 0.45) return { bg: '#1D9E75', text: '#fff' }
  if (pct < 0.60) return { bg: '#5DCAA5', text: '#085041' }
  if (pct < 0.75) return { bg: '#9FE1CB', text: '#085041' }
  if (pct < 0.88) return { bg: '#c8ede0', text: '#085041' }
  return { bg: '#e8f4f0', text: '#0F6E56' }
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function MarketPage() {
  const [summary,  setSummary]  = useState<Summary | null>(null)
  const [trends,   setTrends]   = useState<TrendPoint[]>([])
  const [cities,   setCities]   = useState<CityRow[]>([])
  const [types,    setTypes]    = useState<TypeRow[]>([])
  const [volume,   setVolume]   = useState<VolumeRow[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)
  const [citySort, setCitySort] = useState<'price' | 'count' | 'yoy'>('price')
  const [showAll,  setShowAll]  = useState(false)

  useEffect(() => {
    async function fetchAll() {
      try {
        const [s, t, c, ty, v] = await Promise.all([
          fetch(`${API}/market/summary`).then(r => r.json()),
          fetch(`${API}/market/trends`).then(r => r.json()),
          fetch(`${API}/market/by-city`).then(r => r.json()),
          fetch(`${API}/market/by-type`).then(r => r.json()),
          fetch(`${API}/market/volume`).then(r => r.json()),
        ])
        setSummary(s)
        setTrends(t.data ?? [])
        setCities(c.data ?? [])
        setTypes(ty.data ?? [])
        setVolume(v.data ?? [])
      } catch {
        setError('Could not load market data. Make sure the API is running.')
      } finally {
        setLoading(false)
      }
    }
    fetchAll()
  }, [])

  const sortedCities = [...cities].sort((a, b) => {
    if (citySort === 'price') return b.median_price - a.median_price
    if (citySort === 'count') return b.count - a.count
    if (citySort === 'yoy')   return (b.yoy_change ?? -999) - (a.yoy_change ?? -999)
    return 0
  })
  const displayedCities = showAll ? sortedCities : sortedCities.slice(0, 10)
  const top5    = [...cities].sort((a, b) => b.median_price - a.median_price).slice(0, 5)
  const bottom5 = [...cities].sort((a, b) => a.median_price - b.median_price).slice(0, 5)
  const maxTypePrice = Math.max(...types.map(t => t.median_price), 1)

  // Yearly tick labels for x-axis — one per year
  const yearlyTicks = trends
    .filter(d => d.month === 1)
    .map(d => d.label)

  if (loading) return (
    <div style={styles.loadWrap}>
      <div style={styles.spinner} />
      <p style={{ fontSize: 13, color: 'rgba(26,36,32,0.5)', marginTop: 16 }}>Loading market data…</p>
    </div>
  )

  if (error) return (
    <div style={styles.loadWrap}>
      <p style={{ fontSize: 14, color: '#e05c5c' }}>{error}</p>
    </div>
  )

  return (
    <div style={styles.page}>

      {/* ── NAV ── */}
      <nav style={styles.nav}>
        <Link href="/" style={styles.logo}>
          <span style={styles.logoIcon}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 1L13 12H1L7 1Z" fill="white" fillOpacity="0.9" />
            </svg>
          </span>
          LynqEstate
        </Link>
        <div style={styles.navLinks}>
          <Link href="/estimate"       style={styles.navLink}>Estimate</Link>
          <Link href="/market" style={{ ...styles.navLink, ...styles.navLinkActive }}>Market</Link>
        </div>
        <Link href="/" style={styles.navCta}>Get estimate →</Link>
      </nav>

      {/* ── HERO ── */}
      <div style={styles.hero}>
        <p style={styles.heroLabel}>Greater Montréal Market Intelligence</p>
        <h1 style={styles.heroTitle}>
          Real estate data,<br />
          <span style={{ color: '#1D9E75' }}>at a glance.</span>
        </h1>
        <p style={styles.heroSub}>
          Based on 200,000+ verified Greater Montréal transactions.
        </p>
      </div>

      {/* ── HERO STATS ── */}
      {summary && (
        <div style={styles.statsGrid}>
          <StatCard
            label="Median sale price"
            value={fmtFull(summary.median_price)}
            sub={summary.yoy_change_pct !== null
              ? `${summary.yoy_change_pct >= 0 ? '↑' : '↓'} ${Math.abs(summary.yoy_change_pct).toFixed(1)}% year-over-year`
              : undefined}
            subUp={summary.yoy_change_pct !== null ? summary.yoy_change_pct >= 0 : undefined}
          />
          {summary.price_per_sqft && (
            <StatCard
              label="Avg. price / sq ft"
              value={`$${Math.round(summary.price_per_sqft)}`}
              sub="Median across all types"
            />
          )}
          <StatCard
            label="Transactions"
            value={summary.total_transactions.toLocaleString() + '+'}
            sub="Greater Montréal area"
          />
          {summary.most_active_city && (
            <StatCard
              label="Most active city"
              value={capitalizeCity(summary.most_active_city)}
              sub={summary.most_active_pct ? `${summary.most_active_pct}% of sales` : undefined}
              smallValue
            />
          )}
          <StatCard
            label="Market trend"
            value={summary.market_trend}
            sub={summary.consecutive_quarters > 0
              ? `${summary.consecutive_quarters} consecutive quarter${summary.consecutive_quarters > 1 ? 's' : ''}`
              : `${Math.abs(summary.trend_change_pct).toFixed(1)}% vs prior period`}
            subUp={summary.market_trend === 'Rising'}
            trendColor={
              summary.market_trend === 'Rising' ? '#1D9E75'
              : summary.market_trend === 'Falling' ? '#e05c5c'
              : '#888'
            }
            smallValue
          />
        </div>
      )}

      <div style={styles.content}>

        {/* ── PRICE TREND — RECHARTS ── */}
        <div style={{ ...styles.card, ...styles.cardFull }}>
          <p style={styles.cardTitle}>Median sale price — monthly trend</p>
          {trends.length > 0 ? (
            <div style={{ width: '100%', height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trends} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="lineGlow" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#1D9E75" stopOpacity={0.15} />
                      <stop offset="100%" stopColor="#1D9E75" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="4 4"
                    stroke="rgba(26,36,32,0.07)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="label"
                    ticks={yearlyTicks}
                    tick={{ fontSize: 10, fill: 'rgba(26,36,32,0.4)', fontFamily: 'DM Sans, sans-serif' }}
                    axisLine={{ stroke: 'rgba(26,36,32,0.1)' }}
                    tickLine={false}
                    tickFormatter={(val) => val.split('-')[0]}
                  />
                  <YAxis
                    tickFormatter={(v) => fmt(v)}
                    tick={{ fontSize: 10, fill: 'rgba(26,36,32,0.4)', fontFamily: 'DM Sans, sans-serif' }}
                    axisLine={false}
                    tickLine={false}
                    width={52}
                  />
                  <Tooltip
                    content={<CustomTooltip />}
                    cursor={{ stroke: 'rgba(29,158,117,0.2)', strokeWidth: 1, strokeDasharray: '4 4' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="median"
                    stroke="#1D9E75"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 5, fill: '#1D9E75', stroke: '#faf7f2', strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p style={styles.empty}>Not enough data to display trend.</p>
          )}
        </div>

        {/* ── HEATMAP ── */}
        <div style={{ ...styles.card, ...styles.cardFull }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <p style={{ ...styles.cardTitle, marginBottom: 0 }}>Price by city</p>
            <div style={styles.legend}>
              <span style={styles.legendLabel}>Affordable</span>
              <div style={styles.legendBar} />
              <span style={styles.legendLabel}>Premium</span>
            </div>
          </div>
          <div style={styles.heatGrid}>
            {cities.slice(0, 24).map((c, i) => {
              const col = heatColour(i, Math.min(cities.length, 24))
              return (
                <div key={c.city} style={{ ...styles.heatCell, background: col.bg }}>
                  <div style={{ fontSize: 11, fontWeight: 500, color: col.text, marginBottom: 2, lineHeight: 1.3 }}>
                    {capitalizeCity(c.city)}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: col.text }}>
                    {fmt(c.median_price)}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── PROPERTY TYPE ── */}
        <div style={styles.card}>
          <p style={styles.cardTitle}>Median price by property type</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {types.map(t => (
              <div key={t.type} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 90, fontSize: 12, color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
                  {t.type}
                </div>
                <div style={{ flex: 1, height: 10, background: 'rgba(29,158,117,0.12)', borderRadius: 99 }}>
                  <div style={{ width: `${(t.median_price / maxTypePrice) * 100}%`, height: '100%', background: '#1D9E75', borderRadius: 99 }} />
                </div>
                <div style={{ width: 76, fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', textAlign: 'right' }}>
                  {fmt(t.median_price)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── VOLUME ── */}
        <div style={styles.card}>
          <p style={styles.cardTitle}>Sales volume by month</p>
          <VolumeChart data={volume} />
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8, textAlign: 'center' }}>
            Peak season highlighted in green
          </p>
        </div>

        {/* ── TOP / BOTTOM 5 ── */}
        <div style={styles.card}>
          <p style={styles.cardTitle}>Most expensive cities</p>
          <RankList rows={top5} />
        </div>
        <div style={styles.card}>
          <p style={styles.cardTitle}>Most affordable cities</p>
          <RankList rows={bottom5} reverse />
        </div>

        {/* ── FULL CITY TABLE ── */}
        <div style={{ ...styles.card, ...styles.cardFull }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
            <p style={{ ...styles.cardTitle, marginBottom: 0 }}>All cities</p>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['price', 'count', 'yoy'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setCitySort(s)}
                  style={{ ...styles.sortBtn, ...(citySort === s ? styles.sortBtnActive : {}) }}
                >
                  {s === 'price' ? 'By price' : s === 'count' ? 'By volume' : 'By YoY'}
                </button>
              ))}
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>#</th>
                  <th style={styles.th}>City</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Median price</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Transactions</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>YoY</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>$/sq ft</th>
                </tr>
              </thead>
              <tbody>
                {displayedCities.map((c, i) => (
                  <tr key={c.city} style={i % 2 === 0 ? styles.trEven : {}}>
                    <td style={styles.td}><span style={styles.rankNum}>{i + 1}</span></td>
                    <td style={{ ...styles.td, fontWeight: 500 }}>{capitalizeCity(c.city)}</td>
                    <td style={{ ...styles.td, textAlign: 'right' }}>{fmtFull(c.median_price)}</td>
                    <td style={{ ...styles.td, textAlign: 'right', color: 'var(--text-muted)' }}>{c.count.toLocaleString()}</td>
                    <td style={{ ...styles.td, textAlign: 'right' }}><YoY val={c.yoy_change} /></td>
                    <td style={{ ...styles.td, textAlign: 'right', color: 'var(--text-muted)' }}>
                      {c.price_per_sqft ? `$${Math.round(c.price_per_sqft)}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {sortedCities.length > 10 && (
            <button onClick={() => setShowAll(p => !p)} style={styles.showMore}>
              {showAll ? 'Show less ↑' : `Show all ${sortedCities.length} cities ↓`}
            </button>
          )}
        </div>

      </div>

      {/* ── FOOTER ── */}
      <footer style={styles.footer}>
        <p>© {new Date().getFullYear()} LynqEstate · Greater Montréal & Laval · Quebec, Canada</p>
        <p style={{ marginTop: 4 }}>For informational purposes only and does not constitute a formal appraisal.</p>
      </footer>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, subUp, trendColor, smallValue }: {
  label: string; value: string; sub?: string; subUp?: boolean; trendColor?: string; smallValue?: boolean
}) {
  return (
    <div style={styles.statCard}>
      <p style={styles.statLabel}>{label}</p>
      <p style={{ ...styles.statValue, ...(smallValue ? { fontSize: 16 } : {}), ...(trendColor ? { color: trendColor } : {}) }}>
        {value}
      </p>
      {sub && (
        <p style={{ ...styles.statSub, color: subUp === true ? '#1D9E75' : subUp === false ? '#e05c5c' : 'var(--text-muted)' }}>
          {sub}
        </p>
      )}
    </div>
  )
}

function RankList({ rows, reverse }: { rows: CityRow[]; reverse?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {rows.map((c, i) => (
        <div key={c.city} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 10px', borderRadius: 8,
          background: i % 2 === 0 ? 'rgba(29,158,117,0.06)' : 'transparent',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 11, color: '#1D9E75', fontWeight: 500, width: 16 }}>
              {reverse ? rows.length - i : i + 1}
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-primary)' }}>{capitalizeCity(c.city)}</span>
          </div>
          <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>
            {fmtFull(c.median_price)}
          </span>
        </div>
      ))}
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  page:        { background: '#f5f0e8', minHeight: '100vh', fontFamily: 'var(--font-sans, DM Sans, sans-serif)' },
  loadWrap:    { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' },
  spinner:     { width: 28, height: 28, border: '2px solid rgba(29,158,117,0.2)', borderTopColor: '#1D9E75', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
  nav:         { background: '#f5f0e8', padding: '16px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '0.5px solid rgba(29,158,117,0.2)' },
  logo:        { display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 500, color: '#1a2420', textDecoration: 'none' },
  logoIcon:    { width: 24, height: 24, background: '#1D9E75', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  navLinks:    { display: 'flex', gap: 24 },
  navLink:     { fontSize: 13, color: 'rgba(26,36,32,0.6)', textDecoration: 'none' },
  navLinkActive: { color: '#1D9E75', fontWeight: 500 },
  navCta:      { background: '#1D9E75', color: '#fff', fontSize: 13, padding: '8px 18px', borderRadius: 8, textDecoration: 'none' },
  hero:        { padding: '40px 40px 0' },
  heroLabel:   { fontSize: 11, letterSpacing: '0.08em', color: '#1D9E75', fontWeight: 500, textTransform: 'uppercase', marginBottom: 6 },
  heroTitle:   { fontFamily: "'Playfair Display', Georgia, serif", fontSize: 32, color: '#1a2420', fontWeight: 400, marginBottom: 8, lineHeight: 1.2 },
  heroSub:     { fontSize: 13, color: 'rgba(26,36,32,0.55)' },
  statsGrid:   { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, padding: '24px 40px' },
  statCard:    { background: '#faf7f2', border: '0.5px solid rgba(29,158,117,0.18)', borderRadius: 12, padding: '16px 18px' },
  statLabel:   { fontSize: 10, letterSpacing: '0.07em', color: 'rgba(26,36,32,0.5)', textTransform: 'uppercase', marginBottom: 6 },
  statValue:   { fontSize: 20, fontWeight: 500, color: '#1a2420' },
  statSub:     { fontSize: 11, marginTop: 4 },
  content:     { padding: '0 40px 40px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
  card:        { background: '#faf7f2', border: '0.5px solid rgba(29,158,117,0.18)', borderRadius: 14, padding: 20 },
  cardFull:    { gridColumn: '1 / -1' },
  cardTitle:   { fontSize: 11, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#1D9E75', fontWeight: 500, marginBottom: 16 },
  empty:       { fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' },
  heatGrid:    { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 8 },
  heatCell:    { borderRadius: 8, padding: '10px 12px' },
  legend:      { display: 'flex', alignItems: 'center', gap: 8 },
  legendLabel: { fontSize: 10, color: 'rgba(26,36,32,0.5)' },
  legendBar:   { width: 80, height: 6, borderRadius: 99, background: 'linear-gradient(to right, #e8f4f0, #1D9E75, #085041)' },
  table:       { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th:          { fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(26,36,32,0.45)', padding: '0 8px 10px', textAlign: 'left', fontWeight: 500, borderBottom: '0.5px solid rgba(26,36,32,0.1)' },
  td:          { padding: '10px 8px', fontSize: 13, color: 'var(--text-primary)', borderBottom: '0.5px solid rgba(26,36,32,0.06)' },
  trEven:      { background: 'rgba(29,158,117,0.04)' },
  rankNum:     { fontSize: 11, color: '#1D9E75', fontWeight: 500 },
  sortBtn:     { fontSize: 11, padding: '5px 12px', borderRadius: 6, border: '0.5px solid rgba(29,158,117,0.3)', background: 'transparent', color: 'rgba(26,36,32,0.6)', cursor: 'pointer' },
  sortBtnActive: { background: '#1D9E75', color: '#fff', border: '0.5px solid #1D9E75' },
  showMore:    { display: 'block', width: '100%', marginTop: 16, padding: '10px', fontSize: 13, color: '#1D9E75', background: 'transparent', border: '0.5px solid rgba(29,158,117,0.3)', borderRadius: 8, cursor: 'pointer', textAlign: 'center' },
  footer:      { padding: '24px 40px', textAlign: 'center', fontSize: 11, color: 'rgba(26,36,32,0.4)', borderTop: '0.5px solid rgba(26,36,32,0.08)' },
}
