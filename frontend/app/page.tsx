'use client'
import Link from 'next/link'
import { UserButton, SignUpButton, SignInButton, useUser } from '@clerk/nextjs'
 
export default function LandingPage() {
  const { isSignedIn } = useUser()
 
  return (
    <main style={{ background: '#f5f0e8', minHeight: '100vh', fontFamily: 'var(--font-sans, DM Sans, sans-serif)' }}>
 
      {/* ── NAV ── */}
      <nav style={{
        background: '#f5f0e8',
        padding: '16px 40px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '0.5px solid rgba(29,158,117,0.2)',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 500, color: '#1a2420' }}>
          <div style={{ width: 24, height: 24, background: '#1D9E75', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 1L13 12H1L7 1Z" fill="white" fillOpacity="0.9" />
            </svg>
          </div>
          LynqEstate
        </div>
 
        <div style={{ display: 'flex', gap: 24 }}>
          <Link href="/estimate" style={{ fontSize: 13, color: 'rgba(26,36,32,0.6)', textDecoration: 'none' }}>Estimate</Link>
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
              <Link href="/market" style={{ fontSize: 13, color: 'rgba(26,36,32,0.6)', textDecoration: 'none' }}>Market</Link>
              <UserButton />
            </>
          )}
        </div>
      </nav>
 
      {/* ── HERO ── */}
      <section style={{ maxWidth: 900, margin: '0 auto', padding: '100px 24px 80px', textAlign: 'center' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: 'rgba(29,158,117,0.08)', border: '0.5px solid rgba(29,158,117,0.25)',
          borderRadius: 99, padding: '6px 14px', marginBottom: 32,
        }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#1D9E75' }} />
          <span style={{ fontSize: 12, color: '#1D9E75', fontWeight: 500 }}>Based on 200,000+ real Greater Montréal transactions</span>
        </div>
 
        <h1 style={{
          fontFamily: "'Playfair Display', Georgia, serif",
          fontSize: 'clamp(40px, 6vw, 68px)',
          fontWeight: 500,
          color: '#1a2420',
          lineHeight: 1.1,
          letterSpacing: '-0.02em',
          marginBottom: 24,
        }}>
          Know exactly what<br />
          <span style={{ color: '#1D9E75' }}>your home is worth.</span>
        </h1>
 
        <p style={{
          fontSize: 18,
          color: 'rgba(26,36,32,0.6)',
          maxWidth: 520,
          margin: '0 auto 48px',
          lineHeight: 1.7,
        }}>
          LynqEstate gives you an instant, data-driven estimate of your property's market value — free, in seconds, with no agent required.
        </p>
 
        <Link href="/estimate" style={{
          display: 'inline-flex', alignItems: 'center', gap: 10,
          background: '#1D9E75', color: '#fff',
          fontSize: 16, fontWeight: 500,
          padding: '16px 36px', borderRadius: 12,
          textDecoration: 'none',
          boxShadow: '0 4px 24px rgba(29,158,117,0.25)',
        }}>
          Get my free estimate
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M3 8h10M9 4l4 4-4 4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </Link>
 
        <p style={{ fontSize: 12, color: 'rgba(26,36,32,0.4)', marginTop: 14 }}>
          No account required · Takes 2 minutes
        </p>
      </section>
 
      {/* ── STATS BAR ── */}
      <section style={{
        background: '#1a2420',
        padding: '28px 40px',
      }}>
        <div style={{
          maxWidth: 900, margin: '0 auto',
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 0,
        }}>
          {[
            { value: '200,000+', label: 'Transactions analyzed' },
            { value: 'High accuracy', label: 'ML-powered valuation' },
            { value: '72 cities', label: 'Across Greater Montréal' },
          ].map((stat, i) => (
            <div key={i} style={{
              textAlign: 'center',
              padding: '8px 24px',
              borderRight: i < 2 ? '0.5px solid rgba(255,255,255,0.1)' : 'none',
            }}>
              <div style={{ fontSize: 22, fontWeight: 600, color: '#1D9E75', marginBottom: 4 }}>{stat.value}</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>{stat.label}</div>
            </div>
          ))}
        </div>
      </section>
 
      {/* ── HOW IT WORKS ── */}
      <section style={{ maxWidth: 900, margin: '0 auto', padding: '96px 24px' }}>
        <p style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#1D9E75', fontWeight: 600, textAlign: 'center', marginBottom: 12 }}>
          How it works
        </p>
        <h2 style={{
          fontFamily: "'Playfair Display', Georgia, serif",
          fontSize: 'clamp(28px, 4vw, 40px)',
          fontWeight: 500, color: '#1a2420',
          textAlign: 'center', marginBottom: 64,
          letterSpacing: '-0.01em',
        }}>
          Three steps to your estimate
        </h2>
 
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 32 }}>
          {[
            {
              num: '01',
              title: 'Enter your address',
              body: 'Type your address and let Google Maps pinpoint your property automatically.',
            },
            {
              num: '02',
              title: 'Fill in your details',
              body: 'Provide your property type, size, and municipal assessment values — all found on your Rôle d\'évaluation foncière from the city.',
            },
            {
              num: '03',
              title: 'Get your estimate',
              body: 'Receive an instant market valuation with a price range, confidence level, comparable sales, and a downloadable PDF report.',
            },
          ].map((step, i) => (
            <div key={i} style={{
              background: '#faf7f2',
              border: '0.5px solid rgba(29,158,117,0.15)',
              borderRadius: 16,
              padding: '32px 28px',
            }}>
              <div style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: 40, fontWeight: 500,
                color: 'rgba(29,158,117,0.2)',
                marginBottom: 16, lineHeight: 1,
              }}>
                {step.num}
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: '#1a2420', marginBottom: 12 }}>
                {step.title}
              </h3>
              <p style={{ fontSize: 14, color: 'rgba(26,36,32,0.6)', lineHeight: 1.7 }}>
                {step.body}
              </p>
            </div>
          ))}
        </div>
 
        {/* Role d'évaluation callout */}
        <div style={{
          marginTop: 40,
          background: 'rgba(29,158,117,0.06)',
          border: '0.5px solid rgba(29,158,117,0.2)',
          borderRadius: 12,
          padding: '20px 28px',
          display: 'flex', alignItems: 'center', gap: 16,
        }}>
          <div style={{ fontSize: 24 }}>📄</div>
          <div>
            <p style={{ fontSize: 14, fontWeight: 500, color: '#1a2420', marginBottom: 4 }}>
              Where to find your assessment values
            </p>
            <p style={{ fontSize: 13, color: 'rgba(26,36,32,0.6)', lineHeight: 1.6 }}>
              Your current and previous assessed values are on your <strong>Rôle d'évaluation foncière</strong> — a document sent by your municipality every 3 years. You can also look it up online on your city's website using your property address.
            </p>
          </div>
        </div>
      </section>
 
      {/* ── FEATURES ── */}
      <section style={{ background: '#faf7f2', padding: '96px 24px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <p style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#1D9E75', fontWeight: 600, textAlign: 'center', marginBottom: 12 }}>
            What you get
          </p>
          <h2 style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: 'clamp(28px, 4vw, 40px)',
            fontWeight: 500, color: '#1a2420',
            textAlign: 'center', marginBottom: 64,
            letterSpacing: '-0.01em',
          }}>
            More than just a number
          </h2>
 
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 24 }}>
            {[
              {
                icon: '🏠',
                title: 'Instant Market Estimate',
                body: 'Get a precise valuation with a price range and confidence level — powered by a machine learning model trained on real Quebec transaction data.',
              },
              {
                icon: '📊',
                title: 'Comparable Sales',
                body: 'See real properties that sold nearby with similar characteristics — size, type, and year built — so you can benchmark your estimate.',
              },
              {
                icon: '📈',
                title: 'Market Intelligence Dashboard',
                body: 'Explore median prices, price trends, and city rankings across 72 cities in Greater Montréal — updated from real transaction data.',
              },
              {
                icon: '📄',
                title: 'Downloadable PDF Report',
                body: 'Download a branded valuation report including your estimate, comparables, and market context — ready to share with your agent or keep for reference.',
              },
            ].map((feature, i) => (
              <div key={i} style={{
                background: '#f5f0e8',
                border: '0.5px solid rgba(29,158,117,0.15)',
                borderRadius: 16,
                padding: '32px 28px',
                display: 'flex', gap: 20,
              }}>
                <div style={{ fontSize: 28, flexShrink: 0 }}>{feature.icon}</div>
                <div>
                  <h3 style={{ fontSize: 15, fontWeight: 600, color: '#1a2420', marginBottom: 10 }}>
                    {feature.title}
                  </h3>
                  <p style={{ fontSize: 13, color: 'rgba(26,36,32,0.6)', lineHeight: 1.7 }}>
                    {feature.body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
 
      {/* ── CTA BOTTOM ── */}
      <section style={{ padding: '100px 24px', textAlign: 'center' }}>
        <h2 style={{
          fontFamily: "'Playfair Display', Georgia, serif",
          fontSize: 'clamp(28px, 4vw, 44px)',
          fontWeight: 500, color: '#1a2420',
          marginBottom: 16, letterSpacing: '-0.01em',
        }}>
          Ready to find out what<br />
          <span style={{ color: '#1D9E75' }}>your home is worth?</span>
        </h2>
        <p style={{ fontSize: 16, color: 'rgba(26,36,32,0.55)', marginBottom: 40 }}>
          Free, instant, and based on 200,000+ real transactions.
        </p>
        <Link href="/estimate" style={{
          display: 'inline-flex', alignItems: 'center', gap: 10,
          background: '#1D9E75', color: '#fff',
          fontSize: 16, fontWeight: 500,
          padding: '16px 36px', borderRadius: 12,
          textDecoration: 'none',
          boxShadow: '0 4px 24px rgba(29,158,117,0.25)',
        }}>
          Get my free estimate
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M3 8h10M9 4l4 4-4 4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </Link>
      </section>
 
      {/* ── FOOTER ── */}
      <footer style={{
        borderTop: '0.5px solid rgba(26,36,32,0.08)',
        padding: '24px 40px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 500, color: '#1a2420' }}>
          <div style={{ width: 20, height: 20, background: '#1D9E75', borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
              <path d="M7 1L13 12H1L7 1Z" fill="white" fillOpacity="0.9" />
            </svg>
          </div>
          LynqEstate
        </div>
        <p style={{ fontSize: 12, color: 'rgba(26,36,32,0.4)' }}>
          © {new Date().getFullYear()} LynqEstate · Greater Montréal & Laval · For informational purposes only.
        </p>
        <div style={{ display: 'flex', gap: 20 }}>
          <Link href="/estimate" style={{ fontSize: 12, color: 'rgba(26,36,32,0.5)', textDecoration: 'none' }}>Estimate</Link>
          <Link href="/market"   style={{ fontSize: 12, color: 'rgba(26,36,32,0.5)', textDecoration: 'none' }}>Market</Link>
        </div>
      </footer>
    </main>
  )
}