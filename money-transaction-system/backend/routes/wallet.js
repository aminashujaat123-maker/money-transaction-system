const express = require('express');
const pool = require('../db');
const requireAuth = require('../middleware/requireAuth');

const router = express.Router();

function generateTxnRef() {
  const now = new Date();
  const stamp = now.toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
  const rand = Math.floor(100 + Math.random() * 899);
  return `TXN${stamp}${rand}`;
}

async function getWalletByUserId(conn, userId) {
  const [rows] = await conn.query('SELECT * FROM wallets WHERE user_id = ?', [userId]);
  return rows[0] || null;
}

// POST /api/wallet/deposit  { amount }
router.post('/deposit', requireAuth, async (req, res) => {
  const amount = parseFloat(req.body.amount);
  if (!amount || amount <= 0) {
    return res.status(400).json({ error: 'Enter a valid amount greater than 0.' });
  }
  if (amount > 500000) {
    return res.status(400).json({ error: 'Single deposit cannot exceed PKR 500,000.' });
  }

  const conn = await pool.getConnection();
  try {
    const wallet = await getWalletByUserId(conn, req.session.userId);
    if (!wallet) return res.status(404).json({ error: 'Wallet not found.' });

    const ref = generateTxnRef();

    await conn.beginTransaction();

    const [insertResult] = await conn.query(
      `INSERT INTO transactions (transaction_ref, type, sender_wallet_id, receiver_wallet_id, amount, fee, status, description)
       VALUES (?, 'deposit', NULL, ?, ?, 0.00, 'pending', 'Cash-in via app')`,
      [ref, wallet.id, amount]
    );

    // Flipping status to completed fires the DB trigger that updates the wallet balance.
    await conn.query(
      `UPDATE transactions SET status = 'completed', completed_at = NOW() WHERE id = ?`,
      [insertResult.insertId]
    );

    await conn.commit();

    const updatedWallet = await getWalletByUserId(pool, req.session.userId);
    res.json({ message: 'Money added successfully.', balance: updatedWallet.balance, reference: ref });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: 'Could not complete deposit. Please try again.' });
  } finally {
    conn.release();
  }
});

// POST /api/wallet/transfer  { receiver_phone, amount, description }
router.post('/transfer', requireAuth, async (req, res) => {
  const amount = parseFloat(req.body.amount);
  const receiverPhone = (req.body.receiver_phone || '').trim();
  const description = (req.body.description || '').slice(0, 255);

  if (!receiverPhone) {
    return res.status(400).json({ error: "Enter the recipient's phone number." });
  }
  if (!amount || amount <= 0) {
    return res.status(400).json({ error: 'Enter a valid amount greater than 0.' });
  }

  const conn = await pool.getConnection();
  try {
    const [senderUserRows] = await conn.query('SELECT phone_number FROM users WHERE id = ?', [req.session.userId]);
    if (senderUserRows[0] && senderUserRows[0].phone_number === receiverPhone) {
      return res.status(400).json({ error: 'You cannot transfer money to yourself.' });
    }

    const senderWallet = await getWalletByUserId(conn, req.session.userId);
    if (!senderWallet) return res.status(404).json({ error: 'Your wallet was not found.' });

    if (parseFloat(senderWallet.balance) < amount) {
      return res.status(400).json({ error: 'Insufficient balance for this transfer.' });
    }

    const [receiverUserRows] = await conn.query('SELECT id FROM users WHERE phone_number = ?', [receiverPhone]);
    if (receiverUserRows.length === 0) {
      return res.status(404).json({ error: 'No account found with that phone number.' });
    }
    const receiverWallet = await getWalletByUserId(conn, receiverUserRows[0].id);
    if (!receiverWallet) return res.status(404).json({ error: "Recipient's wallet was not found." });

    const ref = generateTxnRef();

    await conn.beginTransaction();

    const [insertResult] = await conn.query(
      `INSERT INTO transactions (transaction_ref, type, sender_wallet_id, receiver_wallet_id, amount, fee, status, description)
       VALUES (?, 'transfer', ?, ?, ?, 0.00, 'pending', ?)`,
      [ref, senderWallet.id, receiverWallet.id, amount, description || 'Wallet transfer']
    );

    await conn.query(
      `UPDATE transactions SET status = 'completed', completed_at = NOW() WHERE id = ?`,
      [insertResult.insertId]
    );

    await conn.commit();

    const updatedWallet = await getWalletByUserId(pool, req.session.userId);
    res.json({ message: 'Transfer successful.', balance: updatedWallet.balance, reference: ref });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    if (err.message && err.message.includes('chk_balance_non_negative')) {
      return res.status(400).json({ error: 'Insufficient balance for this transfer.' });
    }
    res.status(500).json({ error: 'Could not complete transfer. Please try again.' });
  } finally {
    conn.release();
  }
});

// GET /api/wallet/transactions
router.get('/transactions', requireAuth, async (req, res) => {
  try {
    const wallet = await getWalletByUserId(pool, req.session.userId);
    if (!wallet) return res.status(404).json({ error: 'Wallet not found.' });

    const [rows] = await pool.query(
      `SELECT t.id, t.transaction_ref, t.type, t.amount, t.fee, t.status, t.description, t.created_at,
              t.sender_wallet_id, t.receiver_wallet_id,
              su.full_name AS sender_name, ru.full_name AS receiver_name
       FROM transactions t
       LEFT JOIN wallets sw ON sw.id = t.sender_wallet_id
       LEFT JOIN users su ON su.id = sw.user_id
       LEFT JOIN wallets rw ON rw.id = t.receiver_wallet_id
       LEFT JOIN users ru ON ru.id = rw.user_id
       WHERE t.sender_wallet_id = ? OR t.receiver_wallet_id = ?
       ORDER BY t.created_at DESC
       LIMIT 50`,
      [wallet.id, wallet.id]
    );

    const history = rows.map((t) => ({
      id: t.id,
      reference: t.transaction_ref,
      type: t.type,
      amount: t.amount,
      fee: t.fee,
      status: t.status,
      description: t.description,
      date: t.created_at,
      direction: t.sender_wallet_id === wallet.id ? 'out' : 'in',
      counterparty: t.sender_wallet_id === wallet.id ? t.receiver_name : t.sender_name
    }));

    res.json({ transactions: history });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load transaction history.' });
  }
});

module.exports = router;
