-- =====================================================================
-- MONEY TRANSACTION SYSTEM DATABASE (EasyPaisa / JazzCash type wallet)
-- Engine: MySQL 8.0+
-- =====================================================================

CREATE DATABASE IF NOT EXISTS wallet_transaction_system
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE wallet_transaction_system;

-- ---------------------------------------------------------------------
-- 1. USERS
-- Har user ka basic account (customer). account_type future-proof hai
-- taake baad mein 'agent' ya 'merchant' add karna aasan ho.
-- ---------------------------------------------------------------------
CREATE TABLE users (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    full_name           VARCHAR(150)        NOT NULL,
    phone_number        VARCHAR(15)         NOT NULL UNIQUE,   -- login identifier (jaise mobile number)
    cnic                VARCHAR(15)         NULL UNIQUE,       -- 12345-1234567-1
    email               VARCHAR(150)        NULL UNIQUE,
    password_hash       VARCHAR(255)        NOT NULL,
    pin_hash            VARCHAR(255)        NULL,              -- transaction PIN (4-6 digit, hashed)
    account_type        ENUM('customer','agent','merchant','admin') NOT NULL DEFAULT 'customer',
    kyc_status          ENUM('unverified','pending','verified','rejected') NOT NULL DEFAULT 'unverified',
    status              ENUM('active','suspended','blocked','closed') NOT NULL DEFAULT 'active',
    created_at          TIMESTAMP           NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP           NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_users_phone (phone_number),
    INDEX idx_users_status (status)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 2. WALLETS
-- Balance yahan rakhte hain, users table mein nahi — isse concurrent
-- transactions ke waqt locking aasan hoti hai aur history clean rehti hai.
-- Ek user ke multiple currency wallets bhi ho sakte hain (extensible).
-- ---------------------------------------------------------------------
CREATE TABLE wallets (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id             BIGINT UNSIGNED     NOT NULL,
    wallet_number       VARCHAR(20)         NOT NULL UNIQUE,   -- public wallet ID (jaise account number)
    currency             CHAR(3)             NOT NULL DEFAULT 'PKR',
    balance             DECIMAL(15,2)       NOT NULL DEFAULT 0.00,
    daily_limit         DECIMAL(15,2)       NOT NULL DEFAULT 50000.00,
    status              ENUM('active','frozen','closed') NOT NULL DEFAULT 'active',
    created_at          TIMESTAMP           NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP           NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_wallets_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT chk_balance_non_negative CHECK (balance >= 0),
    INDEX idx_wallets_user (user_id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 3. TRANSACTIONS
-- Har money movement yahan record hoti hai: transfer, cash-in (deposit),
-- cash-out (withdrawal), bill payment. sender/receiver null ho sakte hain
-- depending on type (e.g. cash-in mein sender external hota hai).
-- ---------------------------------------------------------------------
CREATE TABLE transactions (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    transaction_ref     VARCHAR(30)         NOT NULL UNIQUE,   -- e.g. TXN20260810XXXXXX
    type                ENUM('transfer','deposit','withdrawal','bill_payment','refund') NOT NULL,
    sender_wallet_id    BIGINT UNSIGNED     NULL,
    receiver_wallet_id  BIGINT UNSIGNED     NULL,
    amount              DECIMAL(15,2)       NOT NULL,
    fee                 DECIMAL(10,2)       NOT NULL DEFAULT 0.00,
    total_amount        DECIMAL(15,2)       GENERATED ALWAYS AS (amount + fee) STORED,
    status              ENUM('pending','completed','failed','reversed') NOT NULL DEFAULT 'pending',
    description         VARCHAR(255)        NULL,
    created_at          TIMESTAMP           NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at        TIMESTAMP           NULL,

    CONSTRAINT fk_txn_sender FOREIGN KEY (sender_wallet_id) REFERENCES wallets(id),
    CONSTRAINT fk_txn_receiver FOREIGN KEY (receiver_wallet_id) REFERENCES wallets(id),
    CONSTRAINT chk_amount_positive CHECK (amount > 0),
    INDEX idx_txn_sender (sender_wallet_id),
    INDEX idx_txn_receiver (receiver_wallet_id),
    INDEX idx_txn_status (status),
    INDEX idx_txn_created (created_at)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 4. OTP VERIFICATIONS
-- Transaction confirm karne ke liye OTP (SMS code) — security ke liye.
-- ---------------------------------------------------------------------
CREATE TABLE otp_verifications (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id             BIGINT UNSIGNED     NOT NULL,
    transaction_id      BIGINT UNSIGNED     NULL,
    otp_code            VARCHAR(6)          NOT NULL,
    purpose             ENUM('login','transaction','password_reset','registration') NOT NULL,
    is_used             BOOLEAN             NOT NULL DEFAULT FALSE,
    expires_at          TIMESTAMP           NOT NULL,
    created_at          TIMESTAMP           NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_otp_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_otp_txn FOREIGN KEY (transaction_id) REFERENCES transactions(id),
    INDEX idx_otp_user (user_id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 5. AUDIT LOGS
-- Security aur dispute resolution ke liye har sensitive action log hoti hai.
-- ---------------------------------------------------------------------
CREATE TABLE audit_logs (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id             BIGINT UNSIGNED     NULL,
    action               VARCHAR(100)        NOT NULL,          -- e.g. 'LOGIN', 'TXN_CREATED', 'PIN_CHANGED'
    reference_id        BIGINT UNSIGNED     NULL,               -- e.g. transaction_id
    ip_address           VARCHAR(45)          NULL,
    device_info          VARCHAR(255)         NULL,
    created_at          TIMESTAMP           NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_audit_user (user_id),
    INDEX idx_audit_created (created_at)
) ENGINE=InnoDB;

-- =====================================================================
-- TRIGGERS: balance update karna jab transaction 'completed' ho
-- =====================================================================
DELIMITER $$

CREATE TRIGGER trg_txn_after_update
AFTER UPDATE ON transactions
FOR EACH ROW
BEGIN
    IF NEW.status = 'completed' AND OLD.status <> 'completed' THEN
        IF NEW.sender_wallet_id IS NOT NULL THEN
            UPDATE wallets SET balance = balance - NEW.total_amount WHERE id = NEW.sender_wallet_id;
        END IF;
        IF NEW.receiver_wallet_id IS NOT NULL THEN
            UPDATE wallets SET balance = balance + NEW.amount WHERE id = NEW.receiver_wallet_id;
        END IF;
    END IF;
END$$

DELIMITER ;

-- =====================================================================
-- SAMPLE DATA
-- =====================================================================
INSERT INTO users (full_name, phone_number, cnic, email, password_hash, pin_hash, account_type, kyc_status)
VALUES
('Ali Raza',    '03001234567', '35201-1111111-1', 'ali@example.com',   'hashed_pw_1', 'hashed_pin_1', 'customer', 'verified'),
('Sara Khan',   '03007654321', '35201-2222222-2', 'sara@example.com',  'hashed_pw_2', 'hashed_pin_2', 'customer', 'verified'),
('Bilal Ahmed', '03211112233', '35201-3333333-3', 'bilal@example.com', 'hashed_pw_3', 'hashed_pin_3', 'customer', 'pending');

INSERT INTO wallets (user_id, wallet_number, balance)
VALUES
(1, 'WLT0000001', 5000.00),
(2, 'WLT0000002', 12000.00),
(3, 'WLT0000003', 0.00);

-- Ali sends 1000 to Sara
INSERT INTO transactions (transaction_ref, type, sender_wallet_id, receiver_wallet_id, amount, fee, status, description, completed_at)
VALUES
('TXN20260810000001', 'transfer', 1, 2, 1000.00, 10.00, 'completed', 'Dinner money', NOW());

-- Bilal cash-in (deposit) 3000 via agent (agent system baad mein aayega, filhal null)
INSERT INTO transactions (transaction_ref, type, sender_wallet_id, receiver_wallet_id, amount, fee, status, description, completed_at)
VALUES
('TXN20260810000002', 'deposit', NULL, 3, 3000.00, 0.00, 'completed', 'Cash deposit', NOW());
