# Oligo Forms

Sistema de formulários para pedidos Oligo Basics.

## Início Rápido

### Requisitos
- Node.js 20+
- PostgreSQL (ou Docker)

### Desenvolvimento Local

1. Instalar dependências:
```bash
npm install
```

2. Configurar variáveis de ambiente:
```bash
cp .env.example .env
```

3. Subir banco de dados (via Docker):
```bash
docker compose up db -d
```

4. Executar migrations e seed:
```bash
npm run db:push
npm run db:seed
```

5. Iniciar o servidor:
```bash
npm run dev
```

### Docker Compose

Para rodar a aplicação completa com Docker:

```bash
docker compose up -d
```

## Usuários

Após o seed, os seguintes usuários estarão disponíveis:

| Email | Senha | Papel |
|-------|-------|-------|
| marco_damo@hotmail.com | oligo@2026 | ADMIN |
| r.groberio@oligobasics.com.br | oligo@2026 | ADMIN |

## Scripts

- `npm run dev` - Servidor de desenvolvimento
- `npm run build` - Build de produção
- `npm run start` - Iniciar em produção
- `npm run db:push` - Sincronizar schema do banco
- `npm run db:seed` - Popular banco com dados iniciais
- `npm run db:studio` - Abrir Prisma Studio
