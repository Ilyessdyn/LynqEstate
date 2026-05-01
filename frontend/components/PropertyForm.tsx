'use client'
 
import { useState } from 'react'
import AddressAutocomplete from './AddressAutocomplete'
import ResultCard from './ResultCard'
 
interface FormState {
  // Location
  address: string
  lat: number | ''
  lon: number | ''
  city: string
 
  // Property basics
  property_type: string
  building_type: string
  physical_link: string
  floor_count: number | ''
  floor_area: number | ''
  year_built: number | ''
  parcel_area: number | ''
  housing_count: number | ''
 
  // Assessment
  total_assessed_value: number | ''
  previous_assessed_value: number | ''
 
  // Renovations
  has_renovation: boolean
  renovation_type: string
  renovation_year: number | ''
}
 
interface PredictionResult {
  estimate: number
  range_low: number
  range_high: number
  confidence: 'high' | 'medium' | 'low'
  currency: string
  model_version: string
  renovation_bonus?: number
  plex_note?: string
}
 
const RENOVATION_MULTIPLIERS: Record<string, number> = {
  kitchen: 3,
  bathroom: 2,
  full: 7,
  roof: 1.5,
  other: 1,
}
 
const CURRENT_YEAR = new Date().getFullYear()
 
function getRenovationMultiplier(type: string, year: number | ''): number {
  if (!type || !year) return 0
  const age = CURRENT_YEAR - Number(year)
  if (type === 'kitchen' && age < 5) return RENOVATION_MULTIPLIERS.kitchen
  if (type === 'full' && age < 3) return RENOVATION_MULTIPLIERS.full
  return RENOVATION_MULTIPLIERS[type] ?? 0
}
 
const INITIAL_STATE: FormState = {
  address: '',
  lat: '',
  lon: '',
  city: '',
  property_type: '',
  building_type: '',
  physical_link: '',
  floor_count: '',
  floor_area: '',
  year_built: '',
  parcel_area: '',
  housing_count: 1,
  total_assessed_value: '',
  previous_assessed_value: '',
  has_renovation: false,
  renovation_type: '',
  renovation_year: '',
}
 
export default function PropertyForm() {
  const [form, setForm] = useState<FormState>(INITIAL_STATE)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<PredictionResult | null>(null)
 
  function set(key: keyof FormState, value: any) {
    setForm(prev => ({ ...prev, [key]: value }))
  }
 
  function handleAddressSelect(res: { address: string; lat: number; lon: number; city: string }) {
    setForm(prev => ({
      ...prev,
      address: res.address,
      lat: res.lat,
      lon: res.lon,
      city: res.city,
    }))
  }
 
  function numField(key: keyof FormState) {
    return {
      value: form[key] as string | number,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
        const v = e.target.value
        set(key, v === '' ? '' : Number(v))
      },
    }
  }
 
  async function handleSubmit() {
    setError(null)
 
    // Validate required fields
    const required: [keyof FormState, string][] = [
      ['lat', 'address'],
      ['property_type', 'property type'],
      ['building_type', 'building type'],
      ['physical_link', 'physical link'],
      ['floor_count', 'floor count'],
      ['floor_area', 'floor area'],
      ['year_built', 'year built'],
      ['total_assessed_value', 'total assessed value'],
      ['previous_assessed_value', 'previous assessed value'],
    ]
 
    for (const [field, label] of required) {
      if (form[field] === '' || form[field] === null || form[field] === undefined) {
        setError(`Please fill in: ${label}`)
        return
      }
    }
 
    setLoading(true)
 
    try {
      const payload = {
        longitude: Number(form.lon),
        latitude: Number(form.lat),
        city: form.city || 'montreal',
        floor_count: Number(form.floor_count),
        floor_area: Number(form.floor_area),
        housing_count: Number(form.housing_count) || 1,
        parcel_area: Number(form.parcel_area) || Number(form.floor_area),
        year_built: Number(form.year_built),
        previous_assessed_value: Number(form.previous_assessed_value),
        total_assessed_value: Number(form.total_assessed_value),
        sale_year: CURRENT_YEAR,
        sale_month: new Date().getMonth() + 1,
        physical_link: form.physical_link,
        building_type: form.building_type,
        property_type: form.property_type,
      }
 
      const response = await fetch('http://127.0.0.1:8000/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
 
      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err.detail || `API error ${response.status}`)
      }
 
      const data = await response.json()
 
      // Apply renovation multiplier
      let finalEstimate = data.estimate
      let renovationBonus = 0
 
      if (form.has_renovation && form.renovation_type) {
        renovationBonus = getRenovationMultiplier(form.renovation_type, form.renovation_year)
        if (renovationBonus > 0) {
          finalEstimate = Math.round(finalEstimate * (1 + renovationBonus / 100))
        }
      }
 
      setResult({
        estimate: finalEstimate,
        range_low: Math.round(finalEstimate * 0.9),
        range_high: Math.round(finalEstimate * 1.1),
        confidence: data.confidence,
        currency: data.currency,
        model_version: data.model_version,
        renovation_bonus: renovationBonus > 0 ? renovationBonus : undefined,
        plex_note: data.plex_note || undefined,
      })
    } catch (e: any) {
      setError(e.message || 'Could not reach the estimation API. Make sure it is running.')
    } finally {
      setLoading(false)
    }
  }
 
  if (result) {
    return <ResultCard result={result} onReset={() => { setResult(null); setForm(INITIAL_STATE) }} />
  }
 
  return (
    <div style={{ width: '100%', maxWidth: 560, margin: '0 auto' }}>
      {/* ── LOCATION ── */}
      <section style={{ marginBottom: 36 }}>
        <p className="section-title">Location</p>
        <AddressAutocomplete
          value={form.address}
          onChange={(v) => set('address', v)}
          onSelect={handleAddressSelect}
        />
        {form.lat !== '' && (
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, letterSpacing: '0.04em' }}>
            📍 {Number(form.lat).toFixed(5)}, {Number(form.lon).toFixed(5)} · {form.city || 'city unknown'}
          </p>
        )}
      </section>
 
      {/* ── PROPERTY BASICS ── */}
      <section style={{ marginBottom: 36 }}>
        <p className="section-title">Property Details</p>
 
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div>
            <label className="field-label">Property Type</label>
            <select
              className="field-input"
              value={form.property_type}
              onChange={e => set('property_type', e.target.value)}
            >
              <option value="">Select…</option>
              <option value="unifamilial">Unifamilial</option>
              <option value="condo">Condo</option>
              <option value="plex">Plex (2–6 units)</option>
            </select>
          </div>
 
          <div>
            <label className="field-label">Building Type</label>
            <select
              className="field-input"
              value={form.building_type}
              onChange={e => set('building_type', e.target.value)}
            >
              <option value="">Select…</option>
              <option value="single-story">Single story</option>
              <option value="full-story">Full storey</option>
              <option value="split-level">Split level</option>
              <option value="mansard">Mansard</option>
            </select>
          </div>
        </div>
 
        {/* Plex disclaimer — shown inline as soon as plex is selected */}
        {form.property_type === 'plex' && (
          <div style={{
            background: 'rgba(255, 193, 7, 0.08)',
            border: '1px solid rgba(255, 193, 7, 0.25)',
            borderRadius: 8,
            padding: '10px 14px',
            marginBottom: 16,
            fontSize: 13,
            color: 'var(--text-secondary)',
            lineHeight: 1.6,
          }}>
            ⚠️ Plex estimates are less precise than other property types. Rental income, lease terms, and vacancy rates significantly affect market value and are not captured in this model. Expect a wider margin of error (±15%).
          </div>
        )}
 
        <div style={{ marginBottom: 16 }}>
          <label className="field-label">Physical Link</label>
          <select
            className="field-input"
            value={form.physical_link}
            onChange={e => set('physical_link', e.target.value)}
          >
            <option value="">Select…</option>
            <option value="detached">Detached</option>
            <option value="semi-detached">Semi-detached</option>
            <option value="rowhouse-1-side">Row house (1 side)</option>
            <option value="rowhouse-more-than-1-side">Row house (2+ sides)</option>
            <option value="integrated">Integrated</option>
          </select>
        </div>
 
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div>
            <label className="field-label">Floor Count</label>
            <input
              type="number"
              className="field-input"
              placeholder="e.g. 2"
              min={1}
              max={10}
              {...numField('floor_count')}
            />
          </div>
          <div>
            <label className="field-label">Floor Area (sq ft)</label>
            <input
              type="number"
              className="field-input"
              placeholder="e.g. 1400"
              min={200}
              {...numField('floor_area')}
            />
          </div>
        </div>
 
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <label className="field-label">Year Built</label>
            <input
              type="number"
              className="field-input"
              placeholder="e.g. 1992"
              min={1800}
              max={CURRENT_YEAR}
              {...numField('year_built')}
            />
          </div>
          <div>
            <label className="field-label">Parcel Area (sq ft)</label>
            <input
              type="number"
              className="field-input"
              placeholder="e.g. 4000"
              min={0}
              {...numField('parcel_area')}
            />
          </div>
        </div>
      </section>
 
      {/* ── ASSESSMENT ── */}
      <section style={{ marginBottom: 36 }}>
        <p className="section-title">Municipal Assessment</p>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.6 }}>
          Found on your <em>avis d'évaluation foncière</em> from the city.
        </p>
 
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <label className="field-label">Current Assessed Value ($)</label>
            <input
              type="number"
              className="field-input"
              placeholder="e.g. 520000"
              min={0}
              {...numField('total_assessed_value')}
            />
          </div>
          <div>
            <label className="field-label">Previous Assessed Value ($)</label>
            <input
              type="number"
              className="field-input"
              placeholder="e.g. 480000"
              min={0}
              {...numField('previous_assessed_value')}
            />
          </div>
        </div>
      </section>
 
      {/* ── RENOVATIONS ── */}
      <section style={{ marginBottom: 40 }}>
        <p className="section-title">Renovations</p>
 
        <label className="toggle-wrapper" style={{ marginBottom: 24 }}>
          <span className="toggle">
            <input
              type="checkbox"
              checked={form.has_renovation}
              onChange={e => set('has_renovation', e.target.checked)}
            />
            <span className="toggle-track">
              <span className="toggle-thumb" />
            </span>
          </span>
          <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
            Any major renovations?
          </span>
        </label>
 
        {form.has_renovation && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, paddingLeft: 4 }}>
            <div>
              <label className="field-label">Renovation Type</label>
              <select
                className="field-input"
                value={form.renovation_type}
                onChange={e => set('renovation_type', e.target.value)}
              >
                <option value="">Select…</option>
                <option value="kitchen">Kitchen</option>
                <option value="bathroom">Bathroom</option>
                <option value="full">Full renovation</option>
                <option value="roof">Roof</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="field-label">Year Completed</label>
              <input
                type="number"
                className="field-input"
                placeholder={`e.g. ${CURRENT_YEAR - 2}`}
                min={1980}
                max={CURRENT_YEAR}
                {...numField('renovation_year')}
              />
            </div>
          </div>
        )}
      </section>
 
      {/* ── ERROR ── */}
      {error && (
        <div style={{
          background: 'rgba(224, 92, 92, 0.1)',
          border: '1px solid rgba(224, 92, 92, 0.25)',
          borderRadius: 8,
          padding: '12px 16px',
          marginBottom: 20,
          fontSize: 14,
          color: '#e05c5c',
        }}>
          {error}
        </div>
      )}
 
      {/* ── SUBMIT ── */}
      <button
        className="btn-primary"
        onClick={handleSubmit}
        disabled={loading}
      >
        {loading ? (
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <span className="spinner" />
            Estimating…
          </span>
        ) : (
          'Get My Estimate'
        )}
      </button>
    </div>
  )
}