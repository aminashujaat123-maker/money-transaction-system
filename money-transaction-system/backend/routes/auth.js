const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db');

const router = express.Router();

// Generate a unique-ish wallet number like WLT0234871
function generateWalletNumber() {
  const digits = Math.floor(1000000 + Math.random() * 8999999);
  return `WLT${digits}`;
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { full_name, phone_number, password, cnic, email } = req.body;

  if (!full_name || !phone_number || !password) {
    return res.status(400).json({ error: 'Name, phone number, and password are required.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }

  const conn = await pool.getConnection();
  try {
    const [existing] = await conn.query('SELECT id FROM users WHERE phone_number = ?', [phone_number]);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'An account with this phone number already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await conn.beginTransaction();

    const [userResult] = await conn.query(
      `INSERT INTO users (full_name, phone_number, cnic, email, password_hash, account_type, kyc_status, status)
       VALUES (?, ?, ?, ?, ?, 'customer', 'unverified', 'active')`,
      [full_name, phone_number, cnic || null, email || null, passwordHash]
    );

    const userId = userResult.insertId;
    let walletNumber = generateWalletNumber();

    // Ensure wallet number is unique (retry a few times on the rare collision)
    for (let attempt = 0; attempt < 5; attempt++) {
      const [dup] = await conn.query('SELECT id FROM wallets WHERE wallet_number = ?', [walletNumber]);
      if (dup.length === 0) break;
      walletNumber = generateWalletNumber();
    }

    await conn.query(
      `INSERT INTO wallets (user_id, wallet_number, currency, balance) VALUES (?, ?, 'PKR', 0.00)`,
      [userId, walletNumber]
    );

    await conn.commit();

    req.session.userId = userId;
    res.status(201).json({ message: 'Account created.', user: { id: userId, full_name, phone_number, wallet_number: walletNumber } });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: 'Could not create account. Please try again.' });
  } finally {
    conn.release();
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { phone_number, password } = req.body;
  if (!phone_number || !password) {
    return res.status(400).json({ error: 'Phone number and password are required.' });
  }

  try {
    const [rows] = await pool.query('SELECT * FROM users WHERE phone_number = ?', [phone_number]);
    if (rows.length === 0) {
      return res.status(401).json({ error: 'Incorrect phone number or password.' });
    }
    const user = rows[0];

    if (user.status !== 'active') {
      return res.status(403).json({ error: 'This account is not active.' });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Incorrect phone number or password.' });
    }

    req.session.userId = user.id;
    res.json({ message: 'Logged in.', user: { id: user.id, full_name: user.full_name, phone_number: user.phone_number } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.json({ message: 'Logged out.' });
  });
});

// GET /api/auth/me
router.get('/me', async (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Not logged in.' });
  }
  try {
    const [rows] = await pool.query(
      `SELECT u.id, u.full_name, u.phone_number, w.wallet_number, w.balance, w.currency
       FROM users u JOIN wallets w ON w.user_id = u.id
       WHERE u.id = ?`,
      [req.session.userId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Account not found.' });
    }
    res.json({ user: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

module.exports = router;
