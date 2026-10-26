# Money Manage

A fast, good-looking personal finance tracker for recording income, expenses and transfers. It's self-hosted and runs in a single Docker container.

## Features

- **Dashboard**: animated total balance, income/expense with period-over-period change, savings rate ring, cash-flow chart (flow or cumulative), category breakdown donut, budget progress and auto-generated insights
- **Transactions**: income, expense and transfer, grouped by day, with search, type/account/category filters, month/year/all-time ranges, CSV export, and delete with undo
- **Smart amount input**: understands math such as `25k/2 + 3.5` or `45*3`
- **Budgets**: monthly limits per category, with a daily allowance and over/near-limit warnings
- **Accounts**: cash, bank, e-wallet, credit, savings and investment, with live balances, net worth and debts
- **Categories**: custom names, colors and icons
- **Stocks (IDX)**: record buys and sells, auto-calculated lots, average price and realized/unrealized P/L, live prices (delayed ~15 min), allocation chart, 1-month sparklines, and portfolio value included in net worth
- **Market**: live IHSG and rupiah rates (USD, SGD, EUR, JPY, CNY to IDR) with intraday charts and a live/closed indicator
- **Notes**: pinned, color-coded notes with search and tickable checklists (`- [ ] item`)
- **Settings**: currency and number format, JSON backup and restore, reset
- **UX**: light, dark and system themes with a circular reveal transition, command palette (`Ctrl+K`), quick add (`N`), confetti on income, spring animations throughout, and a mobile layout with a bottom nav

## Tech stack

React 19, TypeScript, Tailwind CSS v4, Motion, Recharts and TanStack Query on the frontend. The API uses Hono running on Bun with the built-in `bun:sqlite`, so there are no native dependencies. Vite builds the frontend and `bun build` bundles the server into a single file.

## Run with Docker (recommended)

```bash
docker compose up -d --build
```

Open http://localhost:3000.

The container uses `restart: unless-stopped`, so it starts automatically whenever Docker Desktop starts. To launch Docker Desktop at login, enable **Settings → General → Start Docker Desktop when you sign in to your computer**.

Data is stored in the `money-data` Docker volume and survives rebuilds and updates.

Change the port with `APP_PORT`:

```bash
APP_PORT=8080 docker compose up -d
```

Update after pulling new code:

```bash
docker compose up -d --build
```

## Local development

Requires [Bun](https://bun.sh) 1.4+.

```bash
bun install
bun run dev
```

- Web: http://localhost:5173 (proxies `/api` to the API)
- API: http://localhost:3000

The SQLite database is created at `./data/money.db`.

## Scripts

| Script              | Description                                 |
| ------------------- | ------------------------------------------- |
| `bun run dev`       | API + Vite dev server with hot reload       |
| `bun run build`     | Typecheck, build client and bundle server   |
| `bun run start`     | Run the production build                    |
| `bun run typecheck` | TypeScript check only                       |
