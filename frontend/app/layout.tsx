import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import { Analytics } from '@vercel/analytics/react'
import './globals.css'
 
export const metadata: Metadata = {
  title: 'LynqEstate — Estimate Your Home Value',
  description: 'ML-powered real estate price estimation for Greater Montréal, based on real transaction data.',
}
 
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body>
          {children}
          <Analytics />
        </body>
      </html>
    </ClerkProvider>
  )
}
 