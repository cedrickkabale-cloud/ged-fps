import type { Metadata } from 'next';
import { Fraunces, Manrope } from 'next/font/google';
import { Toaster } from 'react-hot-toast';
import Footer from '../components/Footer';
import { AuthProvider } from '../contexts/AuthContext';
import { SidebarProvider } from '../contexts/SidebarContext';
import './globals.css';

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
});

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'GED FPS - Gestion Électronique des Documents',
  description: 'Système de gestion des courriers du Fonds de Promotion de la Santé',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className={`${manrope.variable} ${fraunces.variable} antialiased`}>
        <AuthProvider>
          <SidebarProvider>
            {children}
            <Footer />
            <Toaster
              position="top-right"
              toastOptions={{
                duration: 4000,
                style: { fontSize: '14px' },
                success: { iconTheme: { primary: '#16a34a', secondary: '#fff' } },
                error: { iconTheme: { primary: '#dc2626', secondary: '#fff' } },
              }}
            />
          </SidebarProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
