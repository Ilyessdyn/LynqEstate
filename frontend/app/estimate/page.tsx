'use client'
import Link from 'next/link'
import { UserButton, SignUpButton, SignInButton, useUser } from '@clerk/nextjs'
import PropertyForm from '../../components/PropertyForm'
 
export default function EstimatePage() {
  const { isSignedIn } = useUser()
 
  return (
    <main style={{
      minHeight: '100vh',
      padding: '0 0 100px',
      background: '#f5f0e8',
    }}>
 
      {/* ── NAV ── */}
      <nav style={{
        background: '#f5f0e8',
        padding: '16px 40px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '0.5px solid rgba(29,158,117,0.2)',
        marginBottom: 60,
      }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 500, color: '#1a2420', textDecoration: 'none' }}>
          <div style={{ width: 24, height: 24, background: '#1D9E75', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 1L13 12H1L7 1Z" fill="white" fillOpacity="0.9" />
            </svg>
          </div>
          LynqEstate
        </Link>
 
        <div style={{ display: 'flex', gap: 24 }}>
          <Link href="/estimate" style={{ fontSize: 13, color: '#1D9E75', fontWeight: 500, textDecoration: 'none' }}>Estimate</Link>
          <Link href="/market"   style={{ fontSize: 13, color: 'rgba(26,36,32,0.6)', textDecoration: 'none' }}>Market</Link>
        </div>
 
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {!isSignedIn ? (
            <>
              <SignInButton mode="modal">
                <button style={{ fontSize: 13, color: 'rgba(26,36,32,0.6)', background: 'none', border: 'none', cursor: 'pointer' }}>
                  Sign in
                </button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button style={{ background: '#1D9E75', color: '#fff', fontSize: 13, padding: '8px 18px', borderRadius: 8, border: 'none', cursor: 'pointer' }}>
                  Sign up free
                </button>
              </SignUpButton>
            </>
          ) : (
            <>
              <Link href="/market" style={{ background: '#1D9E75', color: '#fff', fontSize: 13, padding: '8px 18px', borderRadius: 8, textDecoration: 'none' }}>
                Market data →
              </Link>
              <UserButton />
            </>
          )}
        </div>
      </nav>
 
      {/* Header */}
      <header style={{ textAlign: 'center', marginBottom: 56, padding: '0 24px' }}>
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
          Instant price estimate powered by 200,000+ real Greater Montreal transactions.
        </p>
      </header>
 
      {/* Form card */}
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '0 24px' }}>
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