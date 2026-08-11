# Money Transaction System (Wallet Database)

Ek mobile wallet transaction system ka database design — EasyPaisa / JazzCash jaisa — jo user-to-user transfers, cash deposits, withdrawals, aur bill payments handle karta hai.

## Features

- User accounts with KYC status tracking
- Wallet-based balance management (race-condition safe)
- Transaction types: transfer, deposit, withdrawal, bill_payment, refund
- OTP verification for secure transactions
- Full audit logging
- Extensible design (agent/merchant accounts easily add ho sakte hain)

## Tech Stack

- **Database:** MySQL 8.0+

## Project Structure

```
money-transaction-system/
├── database/
│   └── wallet_transaction_system.sql   # Full schema + sample data
├── diagrams/
│   └── wallet_er_diagram.mermaid       # ER diagram
└── README.md
```

## Setup

1. MySQL Server install karein ([mysql.com/downloads](https://www.mysql.com/downloads/))
2. MySQL Workbench ya VS Code (SQLTools extension) se connect karein
3. `database/wallet_transaction_system.sql` file run karein
4. Database `wallet_transaction_system` ban jayega, sample data ke saath

## Database Tables

| Table | Purpose |
|---|---|
| `users` | Customer accounts, CNIC, KYC status |
| `wallets` | Balance tracking per user |
| `transactions` | Har money movement (transfer/deposit/withdrawal) |
| `otp_verifications` | Transaction confirmation OTPs |
| `audit_logs` | Security aur dispute resolution ke liye logs |

## Roadmap

- [ ] Agent accounts (cash-in/cash-out points)
- [ ] Backend API (Node.js/PHP)
- [ ] Frontend app

## License

MIT
