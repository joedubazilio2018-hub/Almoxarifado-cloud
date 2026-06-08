import './globals.css';

export const metadata = {
  title: 'Almoxarifado Cloud',
  description: 'Gestão de Estoque & Kanban Inteligente',
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
