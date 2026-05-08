'use client'
 
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
 
function fmtFull(n: number) {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    maximumFractionDigits: 0,
  }).format(n)
}
 
export default function ComparableCard({ comp }: { comp: Comparable }) {
  return (
    <div style={{
      background: '#fff',
      border: '0.5px solid rgba(29,158,117,0.18)',
      borderRadius: 12,
      padding: '16px 18px',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
    }}>
      {/* Price */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 18, fontWeight: 600, color: '#1a2420' }}>
          {fmtFull(comp.sale_amount)}
        </span>
        <span style={{
          fontSize: 10,
          background: 'rgba(29,158,117,0.1)',
          color: '#1D9E75',
          padding: '3px 8px',
          borderRadius: 99,
          fontWeight: 500,
          letterSpacing: '0.04em',
        }}>
          {comp.distance_km < 0.1 ? '< 0.1 km' : `${comp.distance_km} km away`}
        </span>
      </div>
 
      {/* Address */}
      <p style={{ fontSize: 13, fontWeight: 500, color: '#1a2420', lineHeight: 1.4 }}>
        {comp.street}
      </p>
      <p style={{ fontSize: 12, color: 'rgba(26,36,32,0.5)' }}>
        {comp.city}
      </p>
 
      {/* Details */}
      <div style={{
        display: 'flex',
        gap: 12,
        marginTop: 4,
        flexWrap: 'wrap',
      }}>
        <Detail label="Sold" value={comp.sale_date} />
        <Detail label="Size" value={`${Math.round(comp.floor_area_sqft).toLocaleString()} sq ft`} />
        <Detail label="Built" value={String(comp.year_built)} />
        <Detail label="Type" value={comp.physical_link.replace(/-/g, ' ')} />
      </div>
    </div>
  )
}
 
function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p style={{ fontSize: 9, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'rgba(26,36,32,0.4)', marginBottom: 2 }}>
        {label}
      </p>
      <p style={{ fontSize: 12, color: '#1a2420', fontWeight: 500, textTransform: 'capitalize' }}>
        {value}
      </p>
    </div>
  )
}
 