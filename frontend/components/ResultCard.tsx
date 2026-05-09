'use client'
 
import { useEffect, useState } from 'react'
import { useUser, SignUpButton } from '@clerk/nextjs'
import ComparableCard from './ComparableCard'
 
interface PredictionResult {
  estimate: number
  range_low: number
  range_high: number
  confidence: 'high' | 'medium' | 'low'
  currency: string
  model_version: string
  renovation_bonus?: number
  plex_note?: string
  latitude?: number
  longitude?: number
  city?: string
  property_type?: string
  floor_area?: number
  year_built?: number
}
 
interface Comparable {
  street: string
  city: string
  sale_date: string
  sale_amount: number
  floor_area_sqft: number
  year_built: number
  physical_link: string
  distance_km: number
}
 
interface Props {
  result: PredictionResult
  onReset: () => void
}
 
function formatCAD(n: number): string {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    maximumFractionDigits: 0,
  }).format(n)
}
 
const CONFIDENCE_CONFIG = {
  high:   { label: 'High confidence',   fill: '85%', color: '#1D9E75' },
  medium: { label: 'Medium confidence', fill: '55%', color: '#f0a500' },
  low:    { label: 'Low confidence',    fill: '30%', color: '#e05c5c' },
}
 
const API = process.env.NEXT_PUBLIC_API_URL ?? ''
 
export default function ResultCard({ result, onReset }: Props) {
  const { isSignedIn } = useUser()
  const [barWidth, setBarWidth]       = useState('0%')
  const [comparables, setComparables] = useState<Comparable[]>([])
  const [compLoading, setCompLoading] = useState(false)
  const [compError, setCompError]     = useState<string | null>(null)
  const [pdfLoading, setPdfLoading]   = useState(false)
 
  const conf = CONFIDENCE_CONFIG[result.confidence]
 
  useEffect(() => {
    const t = setTimeout(() => setBarWidth(conf.fill), 100)
    return () => clearTimeout(t)
  }, [conf.fill])
 
  useEffect(() => {
    if (!isSignedIn) return
    if (!result.latitude || !result.city) return
 
    async function fetchComparables() {
      setCompLoading(true)
      setCompError(null)
      try {
        const res = await fetch(`${API}/comparable`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            latitude:      result.latitude,
            longitude:     result.longitude,
            city:          result.city,
            property_type: result.property_type,
            floor_area:    result.floor_area,
            year_built:    result.year_built,
          }),
        })
        if (!res.ok) throw new Error('Could not load comparables')
        const data = await res.json()
        setComparables(data.comparables ?? [])
      } catch {
        setCompError('Could not load comparable sales.')
      } finally {
        setCompLoading(false)
      }
    }
 
    fetchComparables()
  }, [isSignedIn, result.latitude, result.city])
 
  const hasRenovation = result.renovation_bonus && result.renovation_bonus > 0
  const baseEstimate  = hasRenovation
    ? Math.round(result.estimate / (1 + result.renovation_bonus! / 100) / 1000) * 1000
    : null
 
  // ── PDF Generation ──────────────────────────────────────────────────────
  async function handleDownloadPDF() {
    setPdfLoading(true)
    try {
      const { jsPDF } = await import('jspdf')
      const doc = new jsPDF({ unit: 'mm', format: 'a4' })
 
      // ── Page constants ──────────────────────────────────────────────────
      const W   = 210
      const H   = 297
      const M   = 14
      const CW  = W - 2 * M   // 182mm
      const CX  = W / 2       // 105mm — true horizontal center
 
      // ── Helper: center text precisely using measured width ───────────────
      // RULE: always call setCharSpace(0) before this, and before getTextWidth
      const cx = (text: string, y: number) => {
        doc.setCharSpace(0)
        const tw = doc.getTextWidth(text)
        doc.text(text, CX - tw / 2, y)
      }
 
      // ── Colours ─────────────────────────────────────────────────────────
      const GD     = [15,  70,  50]  as const
      const G      = [29, 158, 117]  as const
      const DARK   = [26,  36,  32]  as const
      const MUTED  = [138,148, 143]  as const
      const WARM   = [245,240, 232]  as const
      const CARD   = [250,247, 242]  as const
      const WHITE  = [255,255, 255]  as const
      const STRIPE = [237,233, 224]  as const
 
      const cap = (s: string) => s ? s.charAt(0).toUpperCase() + s.slice(1) : '—'
      const dateStr = new Date().toLocaleDateString('en-CA', {
        year: 'numeric', month: 'long', day: 'numeric'
      })
      const ROW = 8.5
 
      // ── 1. Warm background ───────────────────────────────────────────────
      doc.setFillColor(...WARM)
      doc.rect(0, 0, W, H, 'F')
 
      // ── 2. Watermark ─────────────────────────────────────────────────────
      const bc = (g: number, bg: number, a: number) => Math.round(bg + (g - bg) * a)
      const wt = (cx2: number, cy: number, s: number, a: number) => {
        doc.setFillColor(bc(29,245,a), bc(158,240,a), bc(117,232,a))
        doc.triangle(cx2, cy - s*0.65, cx2 - s*0.55, cy + s*0.38, cx2 + s*0.55, cy + s*0.38, 'F')
      }
      wt(CX, H*0.50, 100, 0.08)
      wt(CX, H*0.50,  65, 0.09)
      wt(CX, H*0.50,  32, 0.10)
 
      // ── 3. Header ────────────────────────────────────────────────────────
      const HDR = 26
      doc.setFillColor(...GD)
      doc.rect(0, 0, W, HDR, 'F')
 
      // Logo triangle
      const LY = HDR / 2
      const LS = 6
      const LX = M + LS
      doc.setFillColor(...WHITE)
      doc.triangle(LX, LY - LS, LX - LS*0.85, LY + LS*0.62, LX + LS*0.85, LY + LS*0.62, 'F')
 
      // Brand name
      doc.setTextColor(...WHITE)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(13)
      doc.setCharSpace(0)
      doc.text('LynqEstate', LX + LS + 2, LY + 1.6)
 
      // Right taglines
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7.5)
      doc.setTextColor(185, 228, 210)
      doc.setCharSpace(0)
      doc.text('Real Estate Valuation Report', W - M, LY - 2.5, { align: 'right' })
      doc.setFontSize(6.5)
      doc.setTextColor(148, 198, 175)
      doc.text('Greater Montréal & Laval · Quebec, Canada', W - M, LY + 4, { align: 'right' })
 
      // ── 4. Content background ────────────────────────────────────────────
      const FH = 12
      doc.setFillColor(...CARD)
      doc.rect(0, HDR, W, H - HDR - FH, 'F')
 
      // ── 5. Title ─────────────────────────────────────────────────────────
      let y = HDR + 10
      doc.setTextColor(...DARK)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(16)
      doc.setCharSpace(0)
      doc.text('Property Valuation Report', M, y)
 
      y += 5.5
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(...MUTED)
      doc.setCharSpace(0)
      doc.text(`Generated on ${dateStr}`, M, y)
 
      y += 4
      doc.setDrawColor(...G)
      doc.setLineWidth(0.4)
      doc.line(M, y, W - M, y)
 
      // ── 6. Estimate card ─────────────────────────────────────────────────
      y += 5
      const CH    = 56
      const CSTH  = 9   // stripe height
 
      // Card white background + green border
      doc.setFillColor(...WHITE)
      doc.setDrawColor(...G)
      doc.setLineWidth(0.4)
      doc.roundedRect(M, y, CW, CH, 2, 2, 'FD')
 
      // Green top stripe: rounded top corners, square bottom
      doc.setFillColor(...G)
      doc.roundedRect(M, y, CW, CSTH, 2, 2, 'F')
      doc.rect(M, y + CSTH - 3, CW, 3, 'F')
 
      // "ESTIMATED MARKET VALUE" — NO charSpace, measured centering
      doc.setTextColor(...WHITE)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(7)
      cx('ESTIMATED MARKET VALUE', y + CSTH * 0.7)
 
      // Price
      doc.setTextColor(...DARK)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(28)
      cx(formatCAD(result.estimate), y + CSTH + 14)
 
      // Divider line inside card
      const divY = y + CSTH + 18
      doc.setDrawColor(220, 216, 208)
      doc.setLineWidth(0.3)
      doc.line(M + 20, divY, W - M - 20, divY)
 
      // "ESTIMATED RANGE" label
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(6.5)
      doc.setTextColor(...MUTED)
      cx('ESTIMATED RANGE', divY + 6)
 
      // Range values
      doc.setFontSize(9.5)
      doc.setTextColor(100, 110, 106)
      cx(`${formatCAD(result.range_low)}  —  ${formatCAD(result.range_high)}`, divY + 13)
 
      // Confidence pill — color
      if (result.confidence === 'high')        doc.setFillColor(29,  158, 117)
      else if (result.confidence === 'medium') doc.setFillColor(224, 152,   0)
      else                                     doc.setFillColor(208,  75,  75)
 
      // Pill: measure text first, then size pill around it
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(6.5)
      doc.setCharSpace(0)
      const pillText = `${result.confidence.toUpperCase()} CONFIDENCE`
      const pillTW   = doc.getTextWidth(pillText)
      const PH       = 7
      const PW       = pillTW + 10   // 5mm padding each side
      const PX       = CX - PW / 2
      const PY       = y + CH - PH - 4
      doc.roundedRect(PX, PY, PW, PH, PH / 2, PH / 2, 'F')
      doc.setTextColor(...WHITE)
      // Text: same charSpace(0) already set, measure = accurate
      doc.text(pillText, CX - pillTW / 2, PY + PH * 0.67)
 
      // ── 7. Property details ───────────────────────────────────────────────
      y += CH + 10
 
      doc.setTextColor(...G)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(7)
      doc.setCharSpace(0)
      doc.text('PROPERTY DETAILS', M, y)
 
      y += 3
      doc.setDrawColor(...G)
      doc.setLineWidth(0.25)
      doc.line(M, y, W - M, y)
      y += 3
 
      const details = [
        ['City',          cap(result.city ?? '—')],
        ['Property type', cap(result.property_type ?? '—')],
        ['Year built',    String(result.year_built ?? '—')],
        ['Floor area',    result.floor_area ? `${Math.round(result.floor_area)} sq ft` : '—'],
      ]
 
      details.forEach(([label, value], i) => {
        if (i % 2 === 0) {
          doc.setFillColor(...STRIPE)
          doc.rect(M, y, CW, ROW, 'F')
        }
        const RY = y + ROW * 0.68
        doc.setTextColor(...MUTED)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        doc.setCharSpace(0)
        doc.text(label, M + 4, RY)
        doc.setTextColor(...DARK)
        doc.setFont('helvetica', 'bold')
        doc.text(value, CX, RY)
        y += ROW
      })
 
      // ── 8. Comparable sales ───────────────────────────────────────────────
      if (comparables.length > 0) {
        y += 9
 
        doc.setTextColor(...G)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(7)
        doc.setCharSpace(0)
        doc.text('COMPARABLE SALES', M, y)
 
        y += 3
        doc.setDrawColor(...G)
        doc.setLineWidth(0.25)
        doc.line(M, y, W - M, y)
        y += 3
 
        // Table header
        const TH = 8.5
        doc.setFillColor(...G)
        doc.rect(M, y, CW, TH, 'F')
        doc.setTextColor(...WHITE)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(6.5)
        doc.setCharSpace(0)
        const HY = y + TH * 0.68
        doc.text('ADDRESS', M + 4, HY)
        doc.text('SOLD',    86,    HY)
        doc.text('PRICE',   108,   HY)
        doc.text('SIZE',    132,   HY)
        doc.text('DIST.',   152,   HY)
        y += TH
 
        comparables.forEach((comp, i) => {
          if (y > H - FH - 6) return
          if (i % 2 === 0) {
            doc.setFillColor(...STRIPE)
            doc.rect(M, y, CW, ROW, 'F')
          }
          const RY = y + ROW * 0.68
          const street = comp.street.length > 28
            ? comp.street.substring(0, 26) + '…'
            : comp.street
 
          doc.setCharSpace(0)
          doc.setTextColor(...DARK)
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(7.5)
          doc.text(street, M + 4, RY)
 
          doc.setTextColor(...MUTED)
          doc.text(comp.sale_date, 86, RY)
 
          doc.setTextColor(...DARK)
          doc.setFont('helvetica', 'bold')
          doc.text(formatCAD(comp.sale_amount), 108, RY)
 
          doc.setFont('helvetica', 'normal')
          doc.setTextColor(...MUTED)
          doc.text(`${Math.round(comp.floor_area_sqft)} sf`, 132, RY)
          doc.text(`${comp.distance_km} km`, 152, RY)
 
          y += ROW
        })
      }
 
      // ── 9. Footer ─────────────────────────────────────────────────────────
      doc.setFillColor(...GD)
      doc.rect(0, H - FH, W, FH, 'F')
      const FY = H - FH / 2 + 1.5
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(6.5)
      doc.setCharSpace(0)
      doc.setTextColor(185, 228, 210)
      doc.text('lynqestate.com', M, FY)
      doc.setTextColor(148, 198, 175)
      doc.text(
        'For informational purposes only. Does not constitute a formal appraisal.',
        CX, FY, { align: 'center' }
      )
      doc.setTextColor(185, 228, 210)
      doc.text(`© ${new Date().getFullYear()} LynqEstate`, W - M, FY, { align: 'right' })
 
      doc.save(`LynqEstate-${result.city ?? 'Report'}-${new Date().toISOString().slice(0, 10)}.pdf`)
    } catch (e) {
      console.error('PDF generation failed:', e)
    } finally {
      setPdfLoading(false)
    }
  }
 
  return (
    <div className="animate-fade-up" style={{ width: '100%', maxWidth: 560, margin: '0 auto' }}>
 
      {/* ── Main estimate card ── */}
      <div className="card-elevated" style={{ padding: '40px 36px', textAlign: 'center', marginBottom: 16 }}>
        <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--green)', marginBottom: 20 }}>
          Estimated Market Value
        </p>
 
        <p className="font-display" style={{ fontSize: 52, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1, marginBottom: 8 }}>
          {formatCAD(result.estimate)}
        </p>
 
        <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 32 }}>
          {formatCAD(result.range_low)} — {formatCAD(result.range_high)}
        </p>
 
        {/* Confidence bar */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>Confidence</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: conf.color }}>{conf.label}</span>
          </div>
          <div className="confidence-bar">
            <div className="confidence-fill" style={{ width: barWidth, background: conf.color }} />
          </div>
        </div>
 
        {/* Renovation badge */}
        {hasRenovation && baseEstimate && (
          <div style={{
            background: 'rgba(29,158,117,0.1)',
            border: '1px solid rgba(29,158,117,0.25)',
            borderRadius: 8,
            padding: '10px 16px',
            marginBottom: 24,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Base estimate</span>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{formatCAD(baseEstimate)}</span>
          </div>
        )}
 
        {/* Plex note */}
        {result.plex_note && (
          <div style={{
            background: 'rgba(255,193,7,0.08)',
            border: '1px solid rgba(255,193,7,0.25)',
            borderRadius: 8,
            padding: '10px 14px',
            marginBottom: 24,
            fontSize: 12,
            color: 'var(--text-secondary)',
            lineHeight: 1.6,
            textAlign: 'left',
          }}>
            ⚠️ {result.plex_note}
          </div>
        )}
      </div>
 
      {/* ── Comparable Sales ── */}
      <div style={{ marginBottom: 16 }}>
        {isSignedIn ? (
          <div style={{
            background: '#faf7f2',
            border: '0.5px solid rgba(29,158,117,0.18)',
            borderRadius: 14,
            padding: '24px',
          }}>
            <p style={{ fontSize: 11, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#1D9E75', fontWeight: 500, marginBottom: 16 }}>
              Comparable Sales
            </p>
 
            {compLoading && (
              <div style={{ textAlign: 'center', padding: '20px 0', color: 'rgba(26,36,32,0.4)', fontSize: 13 }}>
                Loading comparable sales…
              </div>
            )}
 
            {compError && (
              <p style={{ fontSize: 13, color: '#e05c5c', textAlign: 'center' }}>{compError}</p>
            )}
 
            {!compLoading && !compError && comparables.length === 0 && (
              <p style={{ fontSize: 13, color: 'rgba(26,36,32,0.4)', textAlign: 'center', padding: '12px 0' }}>
                No comparable sales found for this property.
              </p>
            )}
 
            {!compLoading && comparables.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {comparables.map((comp, i) => (
                  <ComparableCard key={i} comp={comp} />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div style={{
            background: '#faf7f2',
            border: '0.5px solid rgba(29,158,117,0.18)',
            borderRadius: 14,
            padding: '32px 24px',
            textAlign: 'center',
            position: 'relative',
            overflow: 'hidden',
          }}>
            <div style={{ filter: 'blur(4px)', pointerEvents: 'none', marginBottom: 16 }}>
              {[1,2,3].map(i => (
                <div key={i} style={{
                  background: '#fff',
                  border: '0.5px solid rgba(29,158,117,0.18)',
                  borderRadius: 12,
                  padding: '16px 18px',
                  marginBottom: 8,
                  height: 80,
                }} />
              ))}
            </div>
            <div style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              background: 'rgba(245,240,232,0.7)',
            }}>
              <div style={{ fontSize: 24 }}>🔒</div>
              <p style={{ fontSize: 14, fontWeight: 500, color: '#1a2420' }}>
                Comparable sales are unlocked for members
              </p>
              <p style={{ fontSize: 12, color: 'rgba(26,36,32,0.5)', maxWidth: 260 }}>
                See real properties that sold nearby with similar characteristics.
              </p>
              <SignUpButton mode="modal">
                <button style={{
                  background: '#1D9E75',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  padding: '10px 24px',
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: 'pointer',
                  marginTop: 4,
                }}>
                  Sign up free to unlock
                </button>
              </SignUpButton>
            </div>
          </div>
        )}
      </div>
 
      {/* ── Disclaimer ── */}
      <div style={{ padding: '14px 20px', textAlign: 'center', marginBottom: 20 }}>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
          This estimate is for informational purposes only and does not constitute a formal appraisal.
          {hasRenovation && ' Renovation adjustments are rule-based estimates, not ML predictions.'}
        </p>
      </div>
 
      {/* ── Action buttons ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {isSignedIn && (
          <button
            onClick={handleDownloadPDF}
            disabled={pdfLoading}
            style={{
              width: '100%',
              padding: '14px',
              background: 'transparent',
              border: '1.5px solid #1D9E75',
              borderRadius: 10,
              color: '#1D9E75',
              fontSize: 14,
              fontWeight: 500,
              cursor: pdfLoading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            {pdfLoading ? 'Generating PDF…' : '⬇ Download Report (PDF)'}
          </button>
        )}
 
        <button className="btn-primary" onClick={onReset}>
          New Estimate
        </button>
      </div>
    </div>
  )
}