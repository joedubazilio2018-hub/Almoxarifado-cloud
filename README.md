# Almoxarifado Cloud 📦

Sistema de gestão de estoque com Kanban inteligente. Pronto para deploy no Vercel.

---

## 🚀 Deploy no Vercel (passo a passo)

### 1. Pré-requisitos
- Conta gratuita no [GitHub](https://github.com)
- Conta gratuita no [Vercel](https://vercel.com)
- [Node.js](https://nodejs.org) instalado (versão 18+)

### 2. Testar localmente (opcional)
```bash
npm install
npm run dev
# Abra http://localhost:3000
```

### 3. Publicar no GitHub
```bash
git init
git add .
git commit -m "Almoxarifado Cloud v1.0"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/almoxarifado-cloud.git
git push -u origin main
```

### 4. Deploy no Vercel
1. Acesse [vercel.com](https://vercel.com) e clique em **Add New > Project**
2. Selecione o repositório `almoxarifado-cloud`
3. Clique em **Deploy** — pronto! ✅

O Vercel detecta Next.js automaticamente, sem configuração extra.

---

## 📱 Funcionalidades

| Tela | Função |
|------|--------|
| Login | Autenticação simples com persistência por `localStorage` |
| Estoque Geral | Tabela com saldo em tempo real + status Kanban colorido |
| Alertas Kanban | Painel de itens críticos/atenção com barra de progresso |
| Cadastrar Item | Registra novos itens com mínimo/máximo para Kanban |
| Registrar Entrada | Entrada de material vinculada a SC (Solicitação de Compra) |
| Registrar Saída | Baixa de estoque com validação de saldo disponível |

## 🔧 Próximos passos sugeridos
- Conectar ao **Supabase** para sincronização em tempo real entre dispositivos
- Adicionar autenticação real com **Supabase Auth** ou **NextAuth.js**
- Exportar relatórios em CSV/PDF
