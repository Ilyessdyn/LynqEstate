'use client'
import { SignUp } from '@clerk/nextjs'
 
export default function SignUpPage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#f5f0e8',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 32,
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 8 }}>
          <div style={{ width: 24, height: 24, background: '#1D9E75', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 1L13 12H1L7 1Z" fill="white" fillOpacity="0.9" />
            </svg>
          </div>
          <span style={{ fontFamily: 'Playfair Display, serif', fontSize: 20, fontWeight: 600, color: '#1a2420' }}>
            LynqEstate
          </span>
        </div>
        <p style={{ fontSize: 13, color: 'rgba(26,36,32,0.5)' }}>Create your free account to unlock all features</p>
      </div>
      <SignUp />
    </div>
  )
}
 