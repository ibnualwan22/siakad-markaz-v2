-- =============================================
-- RADIUS Tables untuk FreeRADIUS + PostgreSQL
-- Jalankan di database siakad
-- =============================================

-- Tabel utama: radcheck (autentikasi user)
CREATE TABLE IF NOT EXISTS radcheck (
    id SERIAL PRIMARY KEY,
    username VARCHAR(64) NOT NULL,
    attribute VARCHAR(64) NOT NULL DEFAULT 'Cleartext-Password',
    op VARCHAR(2) NOT NULL DEFAULT ':=',
    value VARCHAR(253) NOT NULL
);

-- Tabel reply attributes
CREATE TABLE IF NOT EXISTS radreply (
    id SERIAL PRIMARY KEY,
    username VARCHAR(64) NOT NULL,
    attribute VARCHAR(64) NOT NULL,
    op VARCHAR(2) NOT NULL DEFAULT ':=',
    value VARCHAR(253) NOT NULL
);

-- Tabel group check
CREATE TABLE IF NOT EXISTS radgroupcheck (
    id SERIAL PRIMARY KEY,
    groupname VARCHAR(64) NOT NULL,
    attribute VARCHAR(64) NOT NULL,
    op VARCHAR(2) NOT NULL DEFAULT ':=',
    value VARCHAR(253) NOT NULL
);

-- Tabel group reply
CREATE TABLE IF NOT EXISTS radgroupreply (
    id SERIAL PRIMARY KEY,
    groupname VARCHAR(64) NOT NULL,
    attribute VARCHAR(64) NOT NULL,
    op VARCHAR(2) NOT NULL DEFAULT ':=',
    value VARCHAR(253) NOT NULL
);

-- Tabel user-group mapping
CREATE TABLE IF NOT EXISTS radusergroup (
    id SERIAL PRIMARY KEY,
    username VARCHAR(64) NOT NULL,
    groupname VARCHAR(64) NOT NULL,
    priority INT NOT NULL DEFAULT 1
);

-- Tabel accounting (log koneksi WiFi)
CREATE TABLE IF NOT EXISTS radacct (
    radacctid BIGSERIAL PRIMARY KEY,
    acctsessionid VARCHAR(64) NOT NULL DEFAULT '',
    acctuniqueid VARCHAR(32) NOT NULL DEFAULT '',
    username VARCHAR(253),
    groupname VARCHAR(253),
    realm VARCHAR(64),
    nasipaddress INET NOT NULL,
    nasportid VARCHAR(15),
    nasporttype VARCHAR(32),
    acctstarttime TIMESTAMP WITH TIME ZONE,
    acctupdatetime TIMESTAMP WITH TIME ZONE,
    acctstoptime TIMESTAMP WITH TIME ZONE,
    acctinterval BIGINT,
    acctsessiontime BIGINT,
    acctauthentic VARCHAR(32),
    connectinfo_start VARCHAR(50),
    connectinfo_stop VARCHAR(50),
    acctinputoctets BIGINT,
    acctoutputoctets BIGINT,
    calledstationid VARCHAR(50),
    callingstationid VARCHAR(50),
    acctterminatecause VARCHAR(32),
    servicetype VARCHAR(32),
    framedprotocol VARCHAR(32),
    framedipaddress INET,
    framedipv6address INET,
    framedipv6prefix INET,
    framedinterfaceid VARCHAR(44),
    delegatedipv6prefix INET
);

-- =============================================
-- INDEXES
-- =============================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_radcheck_username_attr
    ON radcheck(username, attribute);
CREATE INDEX IF NOT EXISTS idx_radcheck_username
    ON radcheck(username);
CREATE INDEX IF NOT EXISTS idx_radreply_username
    ON radreply(username);
CREATE INDEX IF NOT EXISTS idx_radusergroup_username
    ON radusergroup(username);
CREATE INDEX IF NOT EXISTS idx_radacct_username
    ON radacct(username);
CREATE INDEX IF NOT EXISTS idx_radacct_acctsessionid
    ON radacct(acctsessionid);
CREATE UNIQUE INDEX IF NOT EXISTS idx_radacct_acctuniqueid
    ON radacct(acctuniqueid);

-- =============================================
-- Default group untuk santri
-- =============================================
INSERT INTO radgroupcheck (groupname, attribute, op, value)
VALUES ('santri', 'Simultaneous-Use', ':=', '1')
ON CONFLICT DO NOTHING;
-- ^ Batasi 1 device per akun (opsional, bisa dihapus)

-- =============================================
-- POPULASI AWAL: Sync semua santri aktif
-- Password default = NIS masing-masing
-- =============================================
INSERT INTO radcheck (username, attribute, op, value)
SELECT id, 'Cleartext-Password', ':=', id
FROM "SantriInternal"
WHERE "isAktif" = true
ON CONFLICT (username, attribute)
DO UPDATE SET value = EXCLUDED.value;

-- Masukkan semua santri aktif ke group "santri"
INSERT INTO radusergroup (username, groupname, priority)
SELECT id, 'santri', 1
FROM "SantriInternal"
WHERE "isAktif" = true
ON CONFLICT DO NOTHING;

-- =============================================
-- SELESAI!
-- Jalankan: psql -h localhost -U postgres -d siakad -f setup-radius-tables.sql
-- =============================================
