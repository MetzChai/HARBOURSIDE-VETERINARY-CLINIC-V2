-- Harbourside Veterinary Clinic schema for Neon PostgreSQL

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ===== Enums =====
DO $$ BEGIN
  CREATE TYPE app_role AS ENUM ('admin','owner');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE pet_status AS ENUM ('available','deceased');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE appt_type AS ENUM ('scheduled','walk_in','request');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE appt_status AS ENUM ('Scheduled','Completed','Missed','Cancelled','Requested');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE txn_type AS ENUM ('in','out');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE item_category AS ENUM ('vaccine','medication','dewormer','supply');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ===== updated_at helper =====
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql;

-- ===== users (replaces Supabase auth.users) =====
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  password_hash text,
  full_name text,
  google_id text UNIQUE,
  email_verified boolean NOT NULL DEFAULT false,
  must_verify_gmail boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Migration for existing databases
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id text UNIQUE;
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified boolean NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_verify_gmail boolean NOT NULL DEFAULT false;

DROP TRIGGER IF EXISTS trg_users_updated ON users;
CREATE TRIGGER trg_users_updated BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===== profiles =====
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  full_name text,
  email text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url text;

DROP TRIGGER IF EXISTS trg_profiles_updated ON profiles;
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===== user_roles =====
CREATE TABLE IF NOT EXISTS user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- ===== owners =====
CREATE TABLE IF NOT EXISTS owners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  name text NOT NULL,
  contact text,
  email text,
  address text,
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_owners_updated ON owners;
CREATE TRIGGER trg_owners_updated BEFORE UPDATE ON owners FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===== pets =====
CREATE TABLE IF NOT EXISTS pets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
  name text NOT NULL,
  species text,
  breed text,
  gender text,
  dob date,
  image_url text,
  status pet_status NOT NULL DEFAULT 'available',
  cause_of_death text,
  deceased_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_pets_updated ON pets;
CREATE TRIGGER trg_pets_updated BEFORE UPDATE ON pets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===== appointments =====
CREATE TABLE IF NOT EXISTS appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id uuid REFERENCES pets(id) ON DELETE CASCADE,
  owner_id uuid REFERENCES owners(id) ON DELETE CASCADE,
  date date NOT NULL,
  time text NOT NULL,
  vet text,
  reason text,
  type appt_type NOT NULL DEFAULT 'scheduled',
  status appt_status NOT NULL DEFAULT 'Scheduled',
  care_type text NOT NULL DEFAULT 'checkup',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE appointments ADD COLUMN IF NOT EXISTS care_type text NOT NULL DEFAULT 'checkup';

DROP TRIGGER IF EXISTS trg_appts_updated ON appointments;
CREATE TRIGGER trg_appts_updated BEFORE UPDATE ON appointments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===== vaccinations =====
CREATE TABLE IF NOT EXISTS vaccinations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id uuid NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  appointment_id uuid UNIQUE REFERENCES appointments(id) ON DELETE SET NULL,
  vaccine_type text NOT NULL,
  date_given date,
  next_due date,
  vet text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE vaccinations ADD COLUMN IF NOT EXISTS appointment_id uuid UNIQUE REFERENCES appointments(id) ON DELETE SET NULL;

DROP TRIGGER IF EXISTS trg_vax_updated ON vaccinations;
CREATE TRIGGER trg_vax_updated BEFORE UPDATE ON vaccinations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===== dewormings =====
CREATE TABLE IF NOT EXISTS dewormings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id uuid NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  product text NOT NULL,
  date_given date,
  next_due date,
  vet text,
  notes text,
  status text NOT NULL DEFAULT 'Scheduled',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_deworm_updated ON dewormings;
CREATE TRIGGER trg_deworm_updated BEFORE UPDATE ON dewormings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===== care_records =====
CREATE TABLE IF NOT EXISTS care_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id uuid NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  appointment_id uuid UNIQUE REFERENCES appointments(id) ON DELETE SET NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  vet text,
  record_type text NOT NULL DEFAULT 'checkup',
  diagnosis text,
  treatment text,
  medication text,
  dosage text,
  outcome text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE care_records ADD COLUMN IF NOT EXISTS appointment_id uuid UNIQUE REFERENCES appointments(id) ON DELETE SET NULL;

DROP TRIGGER IF EXISTS trg_care_updated ON care_records;
CREATE TRIGGER trg_care_updated BEFORE UPDATE ON care_records FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===== inventory_items =====
CREATE TABLE IF NOT EXISTS inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  brand text,
  dosage text,
  category item_category NOT NULL DEFAULT 'supply',
  quantity integer NOT NULL DEFAULT 0,
  unit text DEFAULT 'unit',
  expiration_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_inv_updated ON inventory_items;
CREATE TRIGGER trg_inv_updated BEFORE UPDATE ON inventory_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===== inventory_transactions =====
CREATE TABLE IF NOT EXISTS inventory_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  type txn_type NOT NULL,
  quantity integer NOT NULL,
  batch_no text,
  expiration_date date,
  reason text,
  pet_id uuid REFERENCES pets(id) ON DELETE SET NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ===== lab_transactions =====
CREATE TABLE IF NOT EXISTS lab_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id uuid REFERENCES pets(id) ON DELETE SET NULL,
  owner_id uuid REFERENCES owners(id) ON DELETE SET NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  vet text,
  status text NOT NULL DEFAULT 'Unpaid',
  total numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_lab_updated ON lab_transactions;
CREATE TRIGGER trg_lab_updated BEFORE UPDATE ON lab_transactions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===== lab_transaction_items =====
CREATE TABLE IF NOT EXISTS lab_transaction_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES lab_transactions(id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  line_total numeric NOT NULL DEFAULT 0
);

-- ===== messages =====
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid REFERENCES owners(id) ON DELETE SET NULL,
  phone text,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'simulated',
  channel text NOT NULL DEFAULT 'sms',
  subject text,
  email text,
  sent_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ===== inventory transaction trigger =====
CREATE OR REPLACE FUNCTION apply_inventory_transaction()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.type = 'in' THEN
    UPDATE inventory_items
      SET quantity = quantity + NEW.quantity, updated_at = now()
      WHERE id = NEW.item_id;
  ELSIF NEW.type = 'out' THEN
    UPDATE inventory_items
      SET quantity = GREATEST(0, quantity - NEW.quantity), updated_at = now()
      WHERE id = NEW.item_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apply_inventory_transaction ON inventory_transactions;
CREATE TRIGGER trg_apply_inventory_transaction
  AFTER INSERT ON inventory_transactions
  FOR EACH ROW EXECUTE FUNCTION apply_inventory_transaction();

-- Walk-in owner placeholder
INSERT INTO owners (id, name, email)
VALUES ('00000000-0000-0000-0000-0000000000aa', 'Walk-in Clients', null)
ON CONFLICT (id) DO NOTHING;

-- Backfill verification for existing accounts
UPDATE users SET email_verified = true, must_verify_gmail = false WHERE google_id IS NOT NULL;
UPDATE users SET email_verified = true, must_verify_gmail = false
WHERE id IN (SELECT user_id FROM user_roles WHERE role = 'admin');
