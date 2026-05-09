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
 
      // ── Constants ─────────────────────────────────────────────────────────
      const W     = 210
      const H     = 297
      const M     = 14          // outer margin
      const IP    = 4           // inner padding inside content area
      const CX    = W / 2       // horizontal center
 
      // Column positions for comparable table (mm from left)
      const COL_ADDR  = M + IP
      const COL_SOLD  = 86
      const COL_PRICE = 108
      const COL_SIZE  = 132
      const COL_DIST  = 152
 
      // ── Palette ───────────────────────────────────────────────────────────
      const GD     = [15,  70,  50]  as const   // dark green (header/footer)
      const G      = [29,  158, 117] as const   // brand green
      const DARK   = [26,  36,  32]  as const
      const MUTED  = [138, 148, 143] as const
      const WARM   = [245, 240, 232] as const   // page bg
      const CARD   = [250, 247, 242] as const   // main content bg
      const WHITE  = [255, 255, 255] as const
      const STRIPE = [237, 233, 224] as const   // alternating row
 
      const cap = (s: string) => s ? s.charAt(0).toUpperCase() + s.slice(1) : '—'
      const dateStr = new Date().toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' })
      const ROW = 8.5   // standard row height
 
      // ── 1. Warm page background ───────────────────────────────────────────
      doc.setFillColor(...WARM)
      doc.rect(0, 0, W, H, 'F')
 
      // ── 2. Centered watermark — 3 nested triangles ────────────────────────
      // Blend green into warm bg at low opacity
      const blendC = (g: number, bg: number, a: number) => Math.round(bg + (g - bg) * a)
      const wc1 = [blendC(29,245,0.08), blendC(158,240,0.08), blendC(117,232,0.08)] as const
      const wc2 = [blendC(29,245,0.09), blendC(158,240,0.09), blendC(117,232,0.09)] as const
      const wc3 = [blendC(29,245,0.10), blendC(158,240,0.10), blendC(117,232,0.10)] as const
      const wtri = (cx: number, cy: number, s: number, c: readonly [number,number,number]) => {
        doc.setFillColor(...c)
        doc.triangle(cx, cy - s * 0.65, cx - s * 0.55, cy + s * 0.38, cx + s * 0.55, cy + s * 0.38, 'F')
      }
      wtri(CX, H * 0.50, 100, wc1)
      wtri(CX, H * 0.50,  65, wc2)
      wtri(CX, H * 0.50,  32, wc3)
 
      // ── 3. HEADER — full-width dark green ────────────────────────────────
      const HDR = 26
      doc.setFillColor(...GD)
      doc.rect(0, 0, W, HDR, 'F')
 
      // Logo triangle — vertically centered
      const LY = HDR / 2
      const LS = 6
      const LX = M + LS
      doc.setFillColor(...WHITE)
      doc.triangle(LX, LY - LS, LX - LS * 0.85, LY + LS * 0.62, LX + LS * 0.85, LY + LS * 0.62, 'F')
 
      // Brand name — vertically centered next to triangle
      doc.setTextColor(...WHITE)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(13)
      doc.text('LynqEstate', LX + LS + 2, LY + 1.6)
 
      // Right taglines — two lines centered in header height
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7.5)
      doc.setTextColor(185, 228, 210)
      doc.text('Real Estate Valuation Report', W - M, LY - 2.5, { align: 'right' })
      doc.setFontSize(6.5)
      doc.setTextColor(148, 198, 175)
      doc.text('Greater Montréal & Laval · Quebec, Canada', W - M, LY + 4, { align: 'right' })
 
      // ── 4. White content card (between header and footer) ─────────────────
      const FH    = 12        // footer height
      const CONT_Y = HDR      // content starts right after header
      const CONT_H = H - HDR - FH
      doc.setFillColor(...CARD)
      doc.rect(0, CONT_Y, W, CONT_H, 'F')
 
      // ── 5. Title block ────────────────────────────────────────────────────
      let y = CONT_Y + 10
      doc.setTextColor(...DARK)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(16)
      doc.text('Property Valuation Report', M, y)
 
      y += 5.5
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(...MUTED)
      doc.text(`Generated on ${dateStr}`, M, y)
 
      // Thin green rule
      y += 4
      doc.setDrawColor(...G)
      doc.setLineWidth(0.4)
      doc.line(M, y, W - M, y)
 
      // ── 6. Estimate card ─────────────────────────────────────────────────
      y += 5
      const CH     = 54        // card total height
      const CSTX   = M         // card start x
      const CW     = W - M * 2 // card width = INNER = 182
      const CSTRY  = 9         // green stripe height
 
      // Card border
      doc.setDrawColor(...G)
      doc.setLineWidth(0.3)
      doc.setFillColor(...WHITE)
      doc.roundedRect(CSTX, y, CW, CH, 2, 2, 'FD')
 
      // Green top stripe — draw AFTER card so it clips inside border
      // Use rect for stripe body + roundedRect for top corners
      doc.setFillColor(...G)
      doc.roundedRect(CSTX, y, CW, CSTRY, 2, 2, 'F')
      // Fill bottom part of rounded top to make it square at the bottom
      doc.rect(CSTX, y + CSTRY - 3, CW, 3, 'F')
 
      // "ESTIMATED MARKET VALUE" — perfectly centered in stripe
      doc.setTextColor(...WHITE)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(6.5)
      doc.setCharSpace(1.8)
      doc.text('ESTIMATED MARKET VALUE', CX, y + CSTRY * 0.67, { align: 'center' })
      doc.setCharSpace(0)
 
      // Price — centered
      doc.setTextColor(...DARK)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(26)
      doc.text(formatCAD(result.estimate), CX, y + CSTRY + 13, { align: 'center' })
 
      // Range label — centered, spaced letters
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(6.5)
      doc.setTextColor(...MUTED)
      doc.setCharSpace(1.4)
      doc.text('ESTIMATED RANGE', CX, y + CSTRY + 20, { align: 'center' })
      doc.setCharSpace(0)
 
      // Range values — centered
      doc.setFontSize(9)
      doc.text(
        `${formatCAD(result.range_low)}  —  ${formatCAD(result.range_high)}`,
        CX, y + CSTRY + 27, { align: 'center' }
      )
 
      // Confidence pill — fully rounded, centered, compact
      if (result.confidence === 'high')        doc.setFillColor(29,  158, 117)
      else if (result.confidence === 'medium') doc.setFillColor(224, 152, 0)
      else                                     doc.setFillColor(208, 75,  75)
 
      const PW = 52, PH = 7
      const PX  = CX - PW / 2
      const PY  = y + CH - PH - 4
      doc.roundedRect(PX, PY, PW, PH, PH / 2, PH / 2, 'F')  // fully rounded pill
      doc.setTextColor(...WHITE)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(5.8)
      doc.setCharSpace(0.5)
      doc.text(`${result.confidence.toUpperCase()} CONFIDENCE`, CX, PY + PH * 0.67, { align: 'center' })
      doc.setCharSpace(0)
 
      // ── 7. Property details ───────────────────────────────────────────────
      y += CH + 10
 
      // Section header row
      doc.setTextColor(...G)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(6.5)
      doc.setCharSpace(2.0)
      doc.text('PROPERTY DETAILS', M, y)
      doc.setCharSpace(0)
 
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
        const RY = y + ROW * 0.65
        doc.setTextColor(...MUTED)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        doc.text(label, M + IP, RY)
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
        doc.setFontSize(6.5)
        doc.setCharSpace(2.0)
        doc.text('COMPARABLE SALES', M, y)
        doc.setCharSpace(0)
 
        y += 3
        doc.setDrawColor(...G)
        doc.setLineWidth(0.25)
        doc.line(M, y, W - M, y)
        y += 3
 
        // Table header — full green band, no rounded corners
        const TH = 8.5
        doc.setFillColor(...G)
        doc.rect(M, y, CW, TH, 'F')
 
        doc.setTextColor(...WHITE)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(6)
        doc.setCharSpace(0.8)
        const HY = y + TH * 0.67
        doc.text('ADDRESS', COL_ADDR,  HY)
        doc.text('SOLD',    COL_SOLD,  HY)
        doc.text('PRICE',   COL_PRICE, HY)
        doc.text('SIZE',    COL_SIZE,  HY)
        doc.text('DIST.',   COL_DIST,  HY)
        doc.setCharSpace(0)
        y += TH
 
        comparables.forEach((comp, i) => {
          if (y > H - FH - 6) return
          if (i % 2 === 0) {
            doc.setFillColor(...STRIPE)
            doc.rect(M, y, CW, ROW, 'F')
          }
          const RY = y + ROW * 0.65
          const street = comp.street.length > 28 ? comp.street.substring(0, 26) + '…' : comp.street
 
          doc.setTextColor(...DARK)
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(7.5)
          doc.text(street, COL_ADDR, RY)
 
          doc.setTextColor(...MUTED)
          doc.text(comp.sale_date, COL_SOLD, RY)
 
          doc.setTextColor(...DARK)
          doc.setFont('helvetica', 'bold')
          doc.text(formatCAD(comp.sale_amount), COL_PRICE, RY)
 
          doc.setFont('helvetica', 'normal')
          doc.setTextColor(...MUTED)
          doc.text(`${Math.round(comp.floor_area_sqft)} sf`, COL_SIZE, RY)
          doc.text(`${comp.distance_km} km`, COL_DIST, RY)
 
          y += ROW
        })
      }
 
      // ── 9. FOOTER — full-width dark green ────────────────────────────────
      doc.setFillColor(...GD)
      doc.rect(0, H - FH, W, FH, 'F')
      const FY = H - FH / 2 + 1.5
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(6.5)
      doc.setTextColor(185, 228, 210)
      doc.text('lynqestate.com', M, FY)
      doc.setTextColor(148, 198, 175)
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