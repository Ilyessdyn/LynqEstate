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
 
      const green  = [29, 158, 117] as const
      const dark   = [26, 36, 32] as const
      const muted  = [120, 130, 125] as const
      const bgCard = [250, 247, 242] as const
 
      // ── Header ──
      doc.setFillColor(...green)
      doc.rect(0, 0, 210, 18, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(13)
      doc.setFont('helvetica', 'bold')
      doc.text('LynqEstate', 14, 12)
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.text('Real Estate Valuation Report', 210 - 14, 12, { align: 'right' })
 
      // ── Title ──
      doc.setTextColor(...dark)
      doc.setFontSize(22)
      doc.setFont('helvetica', 'bold')
      doc.text('Property Valuation Report', 14, 34)
 
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...muted)
      doc.text(`Generated on ${new Date().toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' })}`, 14, 41)
 
      // ── Estimate card ──
      doc.setFillColor(...bgCard)
      doc.roundedRect(14, 48, 182, 48, 3, 3, 'F')
 
      doc.setTextColor(...green)
      doc.setFontSize(9)
      doc.setFont('helvetica', 'bold')
      doc.text('ESTIMATED MARKET VALUE', 22, 58)
 
      doc.setTextColor(...dark)
      doc.setFontSize(28)
      doc.setFont('helvetica', 'bold')
      doc.text(formatCAD(result.estimate), 22, 72)
 
      doc.setFontSize(11)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...muted)
      doc.text(`Range: ${formatCAD(result.range_low)} — ${formatCAD(result.range_high)}`, 22, 82)
 
      // Confidence badge
      if (result.confidence === 'high') {
        doc.setFillColor(29, 158, 117)
    } else if (result.confidence === 'medium') {
        doc.setFillColor(240, 165, 0)
    } else {
        doc.setFillColor(224, 92, 92)
}
      doc.roundedRect(130, 54, 56, 10, 2, 2, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(8)
      doc.setFont('helvetica', 'bold')
      doc.text(`${result.confidence.toUpperCase()} CONFIDENCE`, 158, 60.5, { align: 'center' })
 
      // Meta row
      doc.setTextColor(...muted)
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.text(`Model: ${result.model_version}   |   Currency: ${result.currency}   |   Data: 200,000+ Greater Montréal transactions`, 22, 90)
 
      // ── Property details ──
      let y = 110
      doc.setTextColor(...green)
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.text('PROPERTY DETAILS', 14, y)
      y += 6
 
      doc.setDrawColor(29, 158, 117)
      doc.setLineWidth(0.3)
      doc.line(14, y, 196, y)
      y += 8
 
      const details = [
        ['City', result.city ?? '—'],
        ['Property type', result.property_type ?? '—'],
        ['Year built', String(result.year_built ?? '—')],
        ['Floor area', result.floor_area ? `${Math.round(result.floor_area)} sq ft` : '—'],
      ]
 
      doc.setFont('helvetica', 'normal')
      details.forEach(([label, value]) => {
        doc.setTextColor(...muted)
        doc.setFontSize(9)
        doc.text(label, 14, y)
        doc.setTextColor(...dark)
        doc.setFontSize(9)
        doc.text(value, 80, y)
        y += 7
      })
 
      // ── Comparables ──
      if (comparables.length > 0) {
        y += 6
        doc.setTextColor(...green)
        doc.setFontSize(10)
        doc.setFont('helvetica', 'bold')
        doc.text('COMPARABLE SALES', 14, y)
        y += 6
 
        doc.setDrawColor(29, 158, 117)
        doc.line(14, y, 196, y)
        y += 8
 
        // Table header
        doc.setFillColor(240, 248, 244)
        doc.rect(14, y - 4, 182, 8, 'F')
        doc.setTextColor(...muted)
        doc.setFontSize(8)
        doc.setFont('helvetica', 'bold')
        doc.text('ADDRESS', 16, y + 1)
        doc.text('SOLD', 100, y + 1)
        doc.text('PRICE', 135, y + 1)
        doc.text('SIZE', 163, y + 1)
        doc.text('DIST.', 185, y + 1)
        y += 10
 
        doc.setFont('helvetica', 'normal')
        comparables.forEach((comp, i) => {
          if (y > 270) return
          if (i % 2 === 0) {
            doc.setFillColor(...bgCard)
            doc.rect(14, y - 4, 182, 8, 'F')
          }
          doc.setTextColor(...dark)
          doc.setFontSize(8)
          const street = comp.street.length > 30 ? comp.street.substring(0, 28) + '…' : comp.street
          doc.text(street, 16, y + 1)
          doc.setTextColor(...muted)
          doc.text(comp.sale_date, 100, y + 1)
          doc.setTextColor(...dark)
          doc.text(formatCAD(comp.sale_amount), 135, y + 1)
          doc.setTextColor(...muted)
          doc.text(`${Math.round(comp.floor_area_sqft).toLocaleString()} sf`, 163, y + 1)
          doc.text(`${comp.distance_km} km`, 185, y + 1)
          y += 9
        })
      }
 
      // ── Footer ──
      doc.setFillColor(...green)
      doc.rect(0, 287, 210, 10, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(7)
      doc.setFont('helvetica', 'normal')
      doc.text('LynqEstate · lynqestate.com · For informational purposes only. Does not constitute a formal appraisal.', 105, 293, { align: 'center' })
 
      doc.save(`LynqEstate-Report-${result.city ?? 'Property'}-${new Date().toISOString().slice(0, 10)}.pdf`)
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
 
        {/* Meta */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 24, flexWrap: 'wrap' }}>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>Data source</p>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Real Greater Montreal transactions</p>
          </div>
          <div style={{ width: 1, background: 'var(--border-subtle)' }} />
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>Model</p>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{result.model_version}</p>
          </div>
          <div style={{ width: 1, background: 'var(--border-subtle)' }} />
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>Currency</p>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{result.currency}</p>
          </div>
        </div>
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
 