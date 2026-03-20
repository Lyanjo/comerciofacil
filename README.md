# ComércioFácil 🛍️

Sistema web de gestão para pequenos comércios (bombonieres, espetarias, mercadinhos locais).

## Módulos

- **Caixa** — Seleção de produtos, cálculo de total, troco e confirmação de venda
- **Estoque** — Cadastro e controle de produtos com alerta de estoque mínimo
- **Financeiro** — Lançamentos de receitas e despesas, saldo consolidado
- **Histórico** — Histórico completo de vendas

## Perfis de acesso

| Perfil | Descrição |
|--------|-----------|
| `admin` | Controle total do sistema, gestão de revendedores e licenças |
| `reseller` | Painel do revendedor: gestão de clientes e licenças |
| `commerce` | Tela do comércio: caixa, estoque, financeiro e histórico |

## Tecnologias

- **Frontend:** React + TypeScript + Vite + Tailwind CSS
- **Estado:** Zustand
- **Roteamento:** React Router DOM
- **Ícones:** Lucide React
- **HTTP:** Axios

## Hospedagem

- **Frontend:** GitHub Pages
- **Backend + Banco:** Railway (PostgreSQL em produção)
- **Dev local:** SQLite

## Instalação e execução local

```bash
npm install
npm run dev
```

O sistema estará disponível em `http://localhost:5173`

## Acessos de desenvolvimento (mock)

| Usuário | E-mail | Senha |
|---------|--------|-------|
| Admin Master | admin@comerciofacil.com | admin123 |
| Revendedor | joao@revendedor.com | rev123 |
| Comércio | maria@loja.com | loja123 |

## Build para produção

```bash
npm run build
```

Configure `VITE_API_URL` no arquivo `.env` apontando para o Railway antes do build.

## Deploy GitHub Pages

Ajuste o campo `base` no `vite.config.ts` para o nome do seu repositório:

```ts
base: '/nome-do-repositorio/',
```

---

© 2026 ComércioFácil
