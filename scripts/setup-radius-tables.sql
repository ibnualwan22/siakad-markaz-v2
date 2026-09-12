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
-- Default group policies & bandwidth
-- FreeRADIUS uses WISPr-Bandwidth-Max-Down/Up for speed limits (bits/sec)
-- =============================================
INSERT INTO radgroupcheck (groupname, attribute, op, value)
VALUES 
  ('wifi-santri', 'Simultaneous-Use', ':=', '1'),
  ('wifi-civitas', 'Simultaneous-Use', ':=', '3'),
  ('wifi-tamu', 'Simultaneous-Use', ':=', '1')
ON CONFLICT DO NOTHING;

INSERT INTO radgroupreply (groupname, attribute, op, value)
VALUES 
  ('wifi-santri', 'WISPr-Bandwidth-Max-Down', ':=', '2048000'),
  ('wifi-santri', 'WISPr-Bandwidth-Max-Up', ':=', '1024000'),
  ('wifi-civitas', 'WISPr-Bandwidth-Max-Down', ':=', '10240000'),
  ('wifi-civitas', 'WISPr-Bandwidth-Max-Up', ':=', '10240000'),
  ('wifi-tamu', 'WISPr-Bandwidth-Max-Down', ':=', '1024000'),
  ('wifi-tamu', 'WISPr-Bandwidth-Max-Up', ':=', '512000')
ON CONFLICT DO NOTHING;

-- Catatan: Sinkronisasi santri/civitas/voucher dilakukan otomatis melalui Siakad API.
-- Jalankan: psql -h localhost -U postgres -d siakad -f setup-radius-tables.sql
