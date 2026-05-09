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
 
      // ── Layout constants ─────────────────────────────────────────────────
      const W     = 210
      const H     = 297
      const M     = 14
      const INNER = W - M * 2   // 182mm content width
      const CX    = W / 2       // horizontal center
 
      // ── Palette ──────────────────────────────────────────────────────────
      const G      = [29,  158, 117] as const
      const GD     = [15,  75,  55]  as const
      const DARK   = [26,  36,  32]  as const
      const MUTED  = [130, 140, 135] as const
      const WARM   = [245, 240, 232] as const
      const CARD   = [252, 249, 244] as const
      const WHITE  = [255, 255, 255] as const
      const STRIPE = [238, 234, 226] as const
 
      const cap = (s: string) => s ? s.charAt(0).toUpperCase() + s.slice(1) : '—'
      const dateStr = new Date().toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' })
 
      // ── 1. Warm background ────────────────────────────────────────────────
      doc.setFillColor(...WARM)
      doc.rect(0, 0, W, H, 'F')
 
      // ── 2. Watermark — 3 triangles centered on page ───────────────────────
      // Simulate low opacity by blending green with warm bg
      const blend = (g: number, b: number, a: number) =>
        Math.round(g + (b - g) * (1 - a))
      const triColor = (a: number) => [
        blend(29,  245, a),
        blend(158, 240, a),
        blend(117, 232, a),
      ] as const
 
      const drawTri = (cx: number, cy: number, s: number, color: readonly [number,number,number]) => {
        doc.setFillColor(...color)
        doc.triangle(cx, cy - s * 0.65, cx - s * 0.55, cy + s * 0.38, cx + s * 0.55, cy + s * 0.38, 'F')
      }
      drawTri(CX, H * 0.52, 105, triColor(0.09))
      drawTri(CX, H * 0.52,  68, triColor(0.09))
      drawTri(CX, H * 0.52,  34, triColor(0.10))
 
      // ── 3. Header — full width dark green ────────────────────────────────
      const HDR = 28
      doc.setFillColor(...GD)
      doc.rect(0, 0, W, HDR, 'F')
 
      // Logo triangle — vertically centered in header
      const LY = HDR / 2
      const LS = 6.5
      const LX = M + LS
      doc.setFillColor(...WHITE)
      doc.triangle(LX, LY - LS, LX - LS * 0.85, LY + LS * 0.6, LX + LS * 0.85, LY + LS * 0.6, 'F')
 
      // Brand name
      doc.setTextColor(...WHITE)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(13)
      doc.text('LynqEstate', LX + LS + 2.5, LY + 1.8)
 
      // Right — two lines vertically centered
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7.5)
      doc.setTextColor(185, 228, 210)
      doc.text('Real Estate Valuation Report', W - M, LY - 2.5, { align: 'right' })
      doc.setFontSize(6.5)
      doc.setTextColor(145, 200, 178)
      doc.text('Greater Montréal & Laval · Quebec, Canada', W - M, LY + 4, { align: 'right' })
 
      // ── 4. Page title ─────────────────────────────────────────────────────
      let y = HDR + 11
      doc.setTextColor(...DARK)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(17)
      doc.text('Property Valuation Report', M, y)
 
      y += 6
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(...MUTED)
      doc.text(`Generated on ${dateStr}`, M, y)
 
      y += 4
      doc.setDrawColor(...G)
      doc.setLineWidth(0.5)
      doc.line(M, y, W - M, y)
 
      // ── 5. Estimate card ─────────────────────────────────────────────────
      y += 5
      const CH = 52
      const STRIPE_H = 9
 
      // Card bg + border
      doc.setFillColor(...CARD)
      doc.setDrawColor(...G)
      doc.setLineWidth(0.25)
      doc.roundedRect(M, y, INNER, CH, 2, 2, 'FD')
 
      // Green top stripe — full width inside card
      doc.setFillColor(...G)
      doc.roundedRect(M, y, INNER, STRIPE_H, 2, 2, 'F')
      doc.rect(M, y + STRIPE_H - 4, INNER, 4, 'F') // fill rounded corners
 
      // "ESTIMATED MARKET VALUE" — centered in stripe
      doc.setTextColor(...WHITE)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(6.5)
      doc.setCharSpace(1.8)
      doc.text('ESTIMATED MARKET VALUE', CX, y + 6, { align: 'center' })
      doc.setCharSpace(0)
 
      // Price — centered
      doc.setTextColor(...DARK)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(26)
      doc.text(formatCAD(result.estimate), CX, y + 22, { align: 'center' })
 
      // Range label — centered
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(6.5)
      doc.setTextColor(...MUTED)
      doc.setCharSpace(1.2)
      doc.text('ESTIMATED RANGE', CX, y + 30, { align: 'center' })
      doc.setCharSpace(0)
 
      // Range values — centered
      doc.setFontSize(9)
      doc.text(`${formatCAD(result.range_low)}  —  ${formatCAD(result.range_high)}`, CX, y + 37, { align: 'center' })
 
      // Confidence pill — centered at bottom
      if (result.confidence === 'high') { doc.setFillColor(29, 158, 117) }
      else if (result.confidence === 'medium') { doc.setFillColor(225, 152, 0) }
      else { doc.setFillColor(208, 75, 75) }
      const PW = 54
      const PH = 8
      const PX = CX - PW / 2
      const PY = y + CH - PH - 3.5
      doc.roundedRect(PX, PY, PW, PH, 2, 2, 'F')
      doc.setTextColor(...WHITE)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(6)
      doc.setCharSpace(0.9)
      doc.text(`${result.confidence.toUpperCase()} CONFIDENCE`, CX, PY + PH * 0.65, { align: 'center' })
      doc.setCharSpace(0)
 
      // ── 6. Property details ───────────────────────────────────────────────
      y += CH + 10
 
      doc.setTextColor(...G)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(6.5)
      doc.setCharSpace(1.8)
      doc.text('PROPERTY DETAILS', M, y)
      doc.setCharSpace(0)
 
      y += 3
      doc.setDrawColor(...G)
      doc.setLineWidth(0.3)
      doc.line(M, y, W - M, y)
      y += 4
 
      const ROW = 8.5
      const details = [
        ['City',          cap(result.city ?? '—')],
        ['Property type', cap(result.property_type ?? '—')],
        ['Year built',    String(result.year_built ?? '—')],
        ['Floor area',    result.floor_area ? `${Math.round(result.floor_area)} sq ft` : '—'],
      ]
 
      details.forEach(([label, value], i) => {
        if (i % 2 === 0) {
          doc.setFillColor(...STRIPE)
          doc.rect(M, y, INNER, ROW, 'F')
        }
        doc.setTextColor(...MUTED)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        doc.text(label, M + 4, y + ROW * 0.65)
        doc.setTextColor(...DARK)
        doc.setFont('helvetica', 'bold')
        doc.text(value, CX, y + ROW * 0.65)
        y += ROW
      })
 
      // ── 7. Comparable sales ───────────────────────────────────────────────
      if (comparables.length > 0) {
        y += 9
 
        doc.setTextColor(...G)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(6.5)
        doc.setCharSpace(1.8)
        doc.text('COMPARABLE SALES', M, y)
        doc.setCharSpace(0)
 
        y += 3
        doc.setDrawColor(...G)
        doc.setLineWidth(0.3)
        doc.line(M, y, W - M, y)
        y += 4
 
        // Table header — full green band
        const TH = 8.5
        doc.setFillColor(...G)
        doc.rect(M, y, INNER, TH, 'F')
        doc.setTextColor(...WHITE)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(6)
        doc.setCharSpace(0.8)
        const HY = y + TH * 0.65
        doc.text('ADDRESS',  M + 4,  HY)
        doc.text('SOLD',     107,    HY)
        doc.text('PRICE',    137,    HY)
        doc.text('SIZE',     163,    HY)
        doc.text('DIST.',    187,    HY)
        doc.setCharSpace(0)
        y += TH
 
        comparables.forEach((comp, i) => {
          if (y > H - 20) return
          if (i % 2 === 0) {
            doc.setFillColor(...STRIPE)
            doc.rect(M, y, INNER, ROW, 'F')
          }
          const RY = y + ROW * 0.65
          const street = comp.street.length > 30 ? comp.street.substring(0, 28) + '…' : comp.street
          doc.setTextColor(...DARK)
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(7.5)
          doc.text(street,                    M + 4, RY)
          doc.setTextColor(...MUTED)
          doc.text(comp.sale_date,            107,   RY)
          doc.setTextColor(...DARK)
          doc.setFont('helvetica', 'bold')
          doc.text(formatCAD(comp.sale_amount), 137, RY)
          doc.setFont('helvetica', 'normal')
          doc.setTextColor(...MUTED)
          doc.text(`${Math.round(comp.floor_area_sqft)} sf`, 163, RY)
          doc.text(`${comp.distance_km} km`,  187,   RY)
          y += ROW
        })
      }
 
      // ── 8. Footer — full width dark green ────────────────────────────────
      const FH = 13
      doc.setFillColor(...GD)
      doc.rect(0, H - FH, W, FH, 'F')
      const FY = H - FH / 2 + 1.5
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(6.5)
      doc.setTextColor(185, 228, 210)
      doc.text('lynqestate.com', M, FY)
      doc.setTextColor(145, 200, 178)
      doc.text('For informational purposes only. Does not constitute a formal appraisal.', CX, FY, { align: 'center' })
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
 
      {/* ── Comparable Sales Section ── */}
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
 