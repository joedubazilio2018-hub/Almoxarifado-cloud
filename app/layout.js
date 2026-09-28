import './globals.css';
import RegisterSW from '../components/RegisterSW';

export const metadata = {
  title: 'Almoxarifado Cloud',
  description: 'Gestão de Estoque & Kanban Inteligente',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/icon-192.png',
    apple: '/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Almoxarifado Cloud',
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#0f172a',
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>
        <RegisterSW />
        {children}
      </body>
    </html>
  );
}
