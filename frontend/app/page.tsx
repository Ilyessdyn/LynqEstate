import PropertyForm from '../components/PropertyForm'

export default function Home() {
  return (
    <main style={{
      minHeight: '100vh',
      padding: '60px 24px 100px',
      position: 'relative',
      zIndex: 1,
    }}>
      {/* Header */}
      <header style={{ textAlign: 'center', marginBottom: 56 }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 28,
        }}>
          {/* Logo mark */}
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <rect width="28" height="28" rx="7" fill="#1D9E75" fillOpacity="0.15"/>
            <path d="M8 18L14 10L20 18" stroke="#1D9E75" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M11 18L14 14L17 18" stroke="#1D9E75" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fillOpacity="0.5"/>
          </svg>
          <span style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 18,
            fontWeight: 600,
            color: 'var(--text-primary)',
            letterSpacing: '0.01em',
          }}>
            LynqEstate
          </span>
        </div>

        <h1 style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: 'clamp(32px, 5vw, 48px)',
          fontWeight: 500,
          color: 'var(--text-primary)',
          lineHeight: 1.15,
          marginBottom: 16,
          letterSpacing: '-0.02em',
        }}>
          What is your home<br />
          <span style={{ color: 'var(--green)' }}>worth today?</span>
        </h1>

        <p style={{
          fontSize: 16,
          color: 'var(--text-secondary)',
          maxWidth: 420,
          margin: '0 auto',
          lineHeight: 1.65,
        }}>
          Instant price estimate powered by 200,000+ real Montréal/Laval transactions.
          
        </p>
      </header>

      {/* Form card */}
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        <div className="card" style={{ padding: '36px 32px' }}>
          <PropertyForm />
        </div>
      </div>

      {/* Footer */}
      <footer style={{ textAlign: 'center', marginTop: 48 }}>
        <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          © {new Date().getFullYear()} LynqEstate · Greater Montréal & Laval
        </p>
      </footer>
    </main>
  )
}
