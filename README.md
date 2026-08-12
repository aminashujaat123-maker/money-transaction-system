markdown
# PakWallet — Money Transaction System

A mobile-wallet style money transaction system, inspired by EasyPaisa and JazzCash. Includes a full MySQL database design plus a working web app for registering, logging in, adding money, and sending money between users.

## Features

- 🔐 User registration & login (secure password hashing)
- 💰 Wallet balance tracking per user
- ➕ Add money (cash-in) to your own wallet
- ↗️ Send money to any other registered user by phone number
- 📜 Full transaction history
- 🗄️ Relational MySQL schema with audit logs and OTP support (extensible)

## Tech Stack

- **Database:** MySQL 8.0
- **Backend:** Node.js, Express
- **Frontend:** HTML, CSS, JavaScript (no framework, no build step)

## Project Structure

money-transaction-system/
├── database/ # SQL schema + sample data
├── diagrams/ # ER diagram
├── backend/ # Node.js + Express API
├── public/ # Frontend (login, register, dashboard)
└── README.md


## Getting Started

1. **Set up the database** — run `database/wallet_transaction_system.sql` in MySQL to create the schema.
2. **Install backend dependencies:**

cd backend
npm install

3. **Configure environment** — copy `.env.example` to `.env` and add your MySQL password.
4. **Start the server:**

npm start

5. Open **http://localhost:3000** in your browser.

## How It Works

Registering creates a `users` row and a matching `wallets` row with a starting balance of 0. Adding money or sending money creates a row in the `transactions` table — a database trigger automatically updates wallet balances whenever a transaction is marked `completed`.

## Try It Out

Register two accounts with different phone numbers, log in as the first, add some money, then send a transfer to the second account to see the balance move in real time.
