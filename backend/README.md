# MHMS Backend

This demo shows how to use the MySQL RBAC/stored-procedure approach described in `mhms_schema.sql`.

## Setup

1. Create the MHMS schema and objects in your MySQL server. Run `mhms_schema.sql` as an admin user with `CREATE ROLE` and `CREATE USER` privileges.
2. Create an admin DB user (example in the SQL file) and set its credentials in `.env`:

```env
DB_HOST=localhost
DB_PORT=3306
DB_ADMIN_USER=mhms_admin
DB_ADMIN_PASS=strong_admin_password
PORT=4000
```

3. Install dependencies:

```bash
cd backend
npm install
npm start
```

## Endpoints

- `POST /login`
  - Body: `{ "staffId": 1 }`
  - Behavior: if staff is a doctor, backend will connect as that DB user and call `sp_get_my_patients()` to fetch only patients visible to that doctor.
- `POST /register`
  - Body: `{ "receptionistId": 2, "in_username": "newuser", "in_password": "pwd", "in_name": "Name", "in_role": "doctor", "in_designation": "MD" }`
  - Behavior: only a staff with role `receptionist` may perform registration. The backend uses the admin DB connection to call `sp_register_staff`, which creates the DB user and inserts into `clinic_staff`.

## Security Notes

- This is a demonstration. Do not store plain passwords in production. Use password hashing, a secrets manager, and TLS.
- Grant minimal privileges and review DEFINER accounts for stored procedures that perform privileged actions.

## Normalization Notes and Recommendations

1. The core transactional tables are in 3NF: `Patient`, `clinic_staff`, `Consultation`, `Appointment`, `Billing`, `Bill_Item`, `Pharmaceuticals`, and `Consultation_Prescription` each represent one concept and store only attributes that depend on the key.
2. `Bill_Item` and `Consultation_Prescription` are proper junction/line-item tables. They avoid repeating medicine data inside billing or consultation rows.
3. `Appointment` should remain separate from `Consultation` because an appointment is a scheduled event, while a consultation is the clinical outcome of that event.
4. `clinic_staff` is a unified staff table with a `role` attribute. That is acceptable for this demo, but if role-specific attributes grow, consider subtype tables such as `doctor_profile`, `pharmacist_profile`, and `billing_profile`.
5. Passwords are currently stored only for the demo workflow. In production, replace `db_password` with a hashed application password or external identity mapping.
6. Add indexes on foreign keys used for lookups, especially `Consultation.Pat_id`, `Consultation.medical_staff_id`, `Appointment.Pat_id`, `Appointment.doctor_staff_id`, `Billing.Pat_id`, and `Bill_Item.Bill_id`.
7. If reporting becomes heavy, create read-only summary views instead of duplicating data into new tables.
