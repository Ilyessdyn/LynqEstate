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
  // property details for comparables
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
  const [barWidth, setBarWidth]           = useState('0%')
  const [comparables, setComparables]     = useState<Comparable[]>([])
  const [compLoading, setCompLoading]     = useState(false)
  const [compError, setCompError]         = useState<string | null>(null)
  const [pdfLoading, setPdfLoading]       = useState(false)
 
  const conf = CONFIDENCE_CONFIG[result.confidence]
 
  useEffect(() => {
    const t = setTimeout(() => setBarWidth(conf.fill), 100)
    return () => clearTimeout(t)
  }, [conf.fill])
 
  // Fetch comparables when signed in
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
 
  // ── PDF Generation ────────────────────────────────────────────────────────
  async function handleDownloadPDF() {
    setPdfLoading(true)
    try {
      const { jsPDF } = await import('jspdf')
      const doc = new jsPDF({ unit: 'mm', format: 'a4' })
 
      // ── Palette ───────────────────────────────────────────────────────────
      const green     = [29, 158, 117]  as const
      const greenDark = [8,  80,  65]   as const
      const dark      = [26, 36,  32]   as const
      const muted     = [120,130, 125]  as const
      const bgWarm    = [245,240, 232]  as const
      const bgCard    = [250,247, 242]  as const
      const white     = [255,255, 255]  as const
 
      const PAGE_W = 210
      const PAGE_H = 297
      const MARGIN = 16
 
      // ── Full-page warm background ─────────────────────────────────────────
      doc.setFillColor(...bgWarm)
      doc.rect(0, 0, PAGE_W, PAGE_H, 'F')
 
      // ── Watermark triangle logo (large, very low opacity) ─────────────────
      // Draw 3 stacked triangles as the watermark
      const drawTriangle = (cx: number, cy: number, size: number, r: number, g: number, b: number, opacity: number) => {
        doc.setFillColor(r, g, b)
        doc.setGState(doc.GState({ opacity }))
        // Triangle using lines — jsPDF triangle via polygon points
        const pts = [
          { x: cx,          y: cy - size * 0.6 },
          { x: cx - size * 0.5, y: cy + size * 0.4 },
          { x: cx + size * 0.5, y: cy + size * 0.4 },
        ]
        doc.triangle(pts[0].x, pts[0].y, pts[1].x, pts[1].y, pts[2].x, pts[2].y, 'F')
        doc.setGState(doc.GState({ opacity: 1 }))
      }
 
      // Big watermark — center-right of page
      drawTriangle(155, 160, 120, 29, 158, 117, 0.04)
      drawTriangle(155, 160, 80,  29, 158, 117, 0.04)
      drawTriangle(155, 160, 42,  29, 158, 117, 0.05)
 
      // ── Left accent bar ───────────────────────────────────────────────────
      doc.setFillColor(...green)
      doc.rect(0, 0, 5, PAGE_H, 'F')
 
      // ── Header area ───────────────────────────────────────────────────────
      // Dark header band
      doc.setFillColor(...greenDark)
      doc.rect(0, 0, PAGE_W, 26, 'F')
 
      // Small logo triangle in header
      doc.setFillColor(255, 255, 255)
      doc.setGState(doc.GState({ opacity: 0.95 }))
      doc.triangle(18, 6, 13, 20, 23, 20, 'F')
      doc.setGState(doc.GState({ opacity: 1 }))
 
      // Brand name
      doc.setTextColor(...white)
      doc.setFontSize(16)
      doc.setFont('helvetica', 'bold')
      doc.text('LynqEstate', 28, 16)
 
      // Tagline right-aligned
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(200, 235, 220)
      doc.text('Real Estate Valuation Report', PAGE_W - MARGIN, 11, { align: 'right' })
      doc.text('Greater Montréal & Laval · Quebec, Canada', PAGE_W - MARGIN, 18, { align: 'right' })
 
      // ── Report title block ────────────────────────────────────────────────
      doc.setTextColor(...dark)
      doc.setFontSize(20)
      doc.setFont('helvetica', 'bold')
      doc.text('Property Valuation', MARGIN + 2, 42)
 
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...muted)
      const dateStr = new Date().toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' })
      doc.text(`Report generated on ${dateStr}`, MARGIN + 2, 50)
 
      // Thin green rule under title
      doc.setDrawColor(...green)
      doc.setLineWidth(0.4)
      doc.line(MARGIN + 2, 53, PAGE_W - MARGIN, 53)
 
      // ── Estimate hero card ────────────────────────────────────────────────
      const cardX = MARGIN + 2
      const cardY = 58
      const cardW = PAGE_W - MARGIN * 2 - 4
      const cardH = 50
 
      doc.setFillColor(...bgCard)
      doc.setDrawColor(...green)
      doc.setLineWidth(0.3)
      doc.roundedRect(cardX, cardY, cardW, cardH, 3, 3, 'FD')
 
      // Green left accent on card
      doc.setFillColor(...green)
      doc.roundedRect(cardX, cardY, 3, cardH, 1, 1, 'F')
 
      // Label
      doc.setTextColor(...green)
      doc.setFontSize(7.5)
      doc.setFont('helvetica', 'bold')
      doc.setCharSpace(1.5)
      doc.text('ESTIMATED MARKET VALUE', cardX + 8, cardY + 10)
      doc.setCharSpace(0)
 
      // Price
      doc.setTextColor(...dark)
      doc.setFontSize(30)
      doc.setFont('helvetica', 'bold')
      doc.text(formatCAD(result.estimate), cardX + 8, cardY + 28)
 
      // Range
      doc.setFontSize(9.5)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...muted)
      doc.setTextColor(...muted)
      doc.setFontSize(7)
      doc.setFont('helvetica', 'normal')
      doc.text('ESTIMATED RANGE', cardX + 8, cardY + 33)
      doc.setFontSize(9.5)
      doc.text(`${formatCAD(result.range_low)}  —  ${formatCAD(result.range_high)}`, cardX + 8, cardY + 40)
 
      // Confidence pill
      if (result.confidence === 'high') {
        doc.setFillColor(29, 158, 117)
      } else if (result.confidence === 'medium') {
        doc.setFillColor(240, 165, 0)
      } else {
        doc.setFillColor(224, 92, 92)
      }
      const pillX = cardX + cardW - 60
      const pillY = cardY + 8
      doc.roundedRect(pillX, pillY, 62, 9, 2, 2, 'F')
      doc.setTextColor(...white)
      doc.setFontSize(7)
      doc.setFont('helvetica', 'bold')
      doc.setCharSpace(0.8)
      doc.text(`${result.confidence.toUpperCase()} CONFIDENCE`, pillX + 31, pillY + 5.8, { align: 'center' })
      doc.setCharSpace(0)
 
      // Date on card bottom right
      doc.setTextColor(...muted)
      doc.setFontSize(7)
      doc.setFont('helvetica', 'normal')
      doc.text(dateStr, cardX + cardW - 4, cardY + cardH - 5, { align: 'right' })
 
      // ── Property details ──────────────────────────────────────────────────
      let y = cardY + cardH + 14
 
      doc.setTextColor(...green)
      doc.setFontSize(7.5)
      doc.setFont('helvetica', 'bold')
      doc.setCharSpace(1.5)
      doc.text('PROPERTY DETAILS', MARGIN + 2, y)
      doc.setCharSpace(0)
      y += 4
 
      doc.setDrawColor(...green)
      doc.setLineWidth(0.3)
      doc.line(MARGIN + 2, y, PAGE_W - MARGIN, y)
      y += 7
 
      const capitalize = (s: string) => s ? s.charAt(0).toUpperCase() + s.slice(1) : '—'
 
      const details = [
        ['City',          result.city ? result.city.charAt(0).toUpperCase() + result.city.slice(1) : '—'],
        ['Property type', capitalize(result.property_type ?? '—')],
        ['Year built',    String(result.year_built ?? '—')],
        ['Floor area', result.floor_area ? `${Math.round(result.floor_area)} sq ft` : '—'],
      ]
 
      details.forEach(([label, value], i) => {
        if (i % 2 === 0) {
          doc.setFillColor(242, 239, 233)
          doc.rect(MARGIN + 2, y - 4, cardW, 7.5, 'F')
        }
        doc.setTextColor(...muted)
        doc.setFontSize(8.5)
        doc.setFont('helvetica', 'normal')
        doc.text(label, MARGIN + 5, y + 1)
        doc.setTextColor(...dark)
        doc.setFont('helvetica', 'bold')
        doc.text(value, 90, y + 1)
        y += 8
      })
 
      // ── Comparable sales ──────────────────────────────────────────────────
      if (comparables.length > 0) {
        y += 8
 
        doc.setTextColor(...green)
        doc.setFontSize(7.5)
        doc.setFont('helvetica', 'bold')
        doc.setCharSpace(1.5)
        doc.text('COMPARABLE SALES', MARGIN + 2, y)
        doc.setCharSpace(0)
        y += 4
 
        doc.setDrawColor(...green)
        doc.setLineWidth(0.3)
        doc.line(MARGIN + 2, y, PAGE_W - MARGIN, y)
        y += 7
 
        // Table header
        doc.setFillColor(...green)
        doc.rect(MARGIN + 2, y - 4, cardW, 8, 'F')
        doc.setTextColor(...white)
        doc.setFontSize(7)
        doc.setFont('helvetica', 'bold')
        doc.setCharSpace(0.8)
        doc.text('ADDRESS', MARGIN + 5, y + 1)
        doc.text('SOLD', 108, y + 1)
        doc.text('PRICE', 135, y + 1)
        doc.text('SIZE', 163, y + 1)
        doc.text('DIST.', 187, y + 1)
        doc.setCharSpace(0)
        y += 10
 
        comparables.forEach((comp, i) => {
          if (y > 272) return
          if (i % 2 === 0) {
            doc.setFillColor(...bgCard)
            doc.rect(MARGIN + 2, y - 4, cardW, 8.5, 'F')
          }
          doc.setTextColor(...dark)
          doc.setFontSize(8)
          doc.setFont('helvetica', 'normal')
          const street = comp.street.length > 32 ? comp.street.substring(0, 30) + '…' : comp.street
          doc.text(street, MARGIN + 5, y + 1)
          doc.setTextColor(...muted)
          doc.text(comp.sale_date, 108, y + 1)
          doc.setTextColor(...dark)
          doc.setFont('helvetica', 'bold')
          doc.text(formatCAD(comp.sale_amount), 135, y + 1)
          doc.setFont('helvetica', 'normal')
          doc.setTextColor(...muted)
          doc.text(`${Math.round(comp.floor_area_sqft)} sf`, 163, y + 1)
          doc.text(`${comp.distance_km} km`, 187, y + 1)
          y += 9
        })
      }
 
      // ── Footer ────────────────────────────────────────────────────────────
      // Dark footer band
      doc.setFillColor(...greenDark)
      doc.rect(0, PAGE_H - 14, PAGE_W, 14, 'F')
 
      // Green left accent continues
      doc.setFillColor(...green)
      doc.rect(0, PAGE_H - 14, 5, 14, 'F')
 
      doc.setTextColor(200, 235, 220)
      doc.setFontSize(7)
      doc.setFont('helvetica', 'normal')
      doc.text('lynqestate.com', MARGIN, PAGE_H - 6)
      doc.setTextColor(160, 200, 180)
      doc.text('For informational purposes only. This report does not constitute a formal appraisal.', PAGE_W / 2, PAGE_H - 6, { align: 'center' })
      doc.setTextColor(200, 235, 220)
      doc.text(`© ${new Date().getFullYear()} LynqEstate`, PAGE_W - MARGIN, PAGE_H - 6, { align: 'right' })
 
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
 
        <div style={{ height: 1, background: 'var(--border-subtle)', marginBottom: 24 }} />
 
        
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
          /* Locked state for non-signed-in users */
          <div style={{
            background: '#faf7f2',
            border: '0.5px solid rgba(29,158,117,0.18)',
            borderRadius: 14,
            padding: '32px 24px',
            textAlign: 'center',
            position: 'relative',
            overflow: 'hidden',
          }}>
            {/* Blurred mock cards */}
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
 
            {/* Overlay */}
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
 