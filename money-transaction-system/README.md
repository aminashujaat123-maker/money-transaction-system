# PakWallet — Web App

A simple EasyPaisa/JazzCash-style wallet UI built on top of the `wallet_transaction_system` MySQL database. Users can register, log in, add money to their own wallet, and send money to another registered user by phone number.

## What's included

- `backend/` — Node.js + Express API (login, register, deposit, transfer, transaction history)
- `public/` — plain HTML/CSS/JS frontend (no build step needed)

## Setup

1. Make sure your `wallet_transaction_system` database already exists (from `database/wallet_transaction_system.sql`).
2. Open a terminal in the `backend` folder and install dependencies:
   ```
   npm install
   ```
3. Copy `.env.example` to `.env` and fill in your MySQL password:
   ```
   copy .env.example .env
   ```
4. Start the server:
   ```
   npm start
   ```
5. Open your browser at **http://localhost:3000**

## How it works

- Registering creates a row in `users` and a matching row in `wallets` with a balance of 0.
- "Add Money" inserts a `deposit` transaction and flips it to `completed`, which fires the database trigger that credits your wallet.
- "Send Money" looks up the recipient by phone number and creates a `transfer` transaction between the two wallets, using the same trigger to move the balance.
- All amounts are in PKR.

## Try it with two accounts

Register two different accounts (use two different phone numbers), log in as the first, add money to it, then send some to the second account's phone number to see the transfer in action.
