require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const mysql = require('mysql2/promise');
const path = require('path');

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static demo assets (CSS) from /static
app.use('/static', express.static(path.join(__dirname, 'public')));

const ADMIN_DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 3306,
  user: process.env.DB_ADMIN_USER || 'mhms_admin',
  password: process.env.DB_ADMIN_PASS || 'strong_admin_password',
  database: 'MHMS'
};

let adminPool;
(async function init() {
  adminPool = await mysql.createPool(ADMIN_DB_CONFIG);
  await adminPool.query(`
    CREATE TABLE IF NOT EXISTS Appointment (
      Appointment_id INT AUTO_INCREMENT PRIMARY KEY,
      Pat_id INT NOT NULL,
      doctor_staff_id INT NOT NULL,
      booked_by_staff_id INT NULL,
      Appointment_date DATETIME NOT NULL,
      Status VARCHAR(30) NOT NULL DEFAULT 'Booked',
      Purpose VARCHAR(255),
      Notes TEXT,
      FOREIGN KEY (Pat_id) REFERENCES Patient(Pat_id),
      FOREIGN KEY (doctor_staff_id) REFERENCES clinic_staff(staff_id),
      FOREIGN KEY (booked_by_staff_id) REFERENCES clinic_staff(staff_id)
    )
  `);

  await adminPool.query(`
    INSERT INTO Pharmaceuticals (Med_name, Price)
    SELECT * FROM (
      SELECT 'Paracetamol' AS Med_name, 10.00 AS Price
      UNION ALL SELECT 'Amoxicillin', 25.00
      UNION ALL SELECT 'Cetirizine', 12.50
    ) AS seed
    WHERE NOT EXISTS (SELECT 1 FROM Pharmaceuticals LIMIT 1)
  `);
})();

async function optionalQuery(sql, params = []) {
  try {
    const [rows] = await adminPool.query(sql, params);
    return rows;
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') return [];
    throw err;
  }
}

const allowedAppRoles = new Set(['receptionist', 'doctor', 'pharmacist', 'billing', 'admin']);

async function getStaffById(staffId) {
  const [rows] = await adminPool.query('SELECT * FROM clinic_staff WHERE staff_id = ?', [staffId]);
  return rows && rows[0] ? rows[0] : null;
}

// Login by staff_id (demo). In production use secure auth and passwords.
app.post('/login', async (req, res) => {
  try {
    const { staffId } = req.body;
    if (!staffId) return res.status(400).json({ error: 'staffId required' });

    const [rows] = await adminPool.query('SELECT * FROM clinic_staff WHERE staff_id = ?', [staffId]);
    if (!rows || rows.length === 0) return res.status(401).json({ error: 'Unknown staff id' });

    const staff = rows[0];
    const baseProfile = {
      staff_id: staff.staff_id,
      username: staff.username,
      staff_name: staff.staff_name,
      role: staff.role,
      designation: staff.designation
    };

    const roleDetails = { staffRecord: baseProfile };

    // For DB-level RBAC enforcement, connect as the staff DB user and call the restricted stored procedure.
    if (staff.role === 'doctor') {
      // connect using staff DB credentials
      const conn = await mysql.createConnection({
        host: ADMIN_DB_CONFIG.host,
        port: ADMIN_DB_CONFIG.port,
        user: staff.username,
        password: staff.db_password,
        database: 'MHMS'
      });

      try {
        const [resultSets] = await conn.query('CALL sp_get_my_patients()');
        // MySQL stored procedure returns results in first element
        const patients = resultSets[0] || resultSets;

        const [consultations] = await adminPool.query(
          `SELECT c.Consultation_id, c.Pat_id, p.Pat_name, c.Consultation_date, c.Notes
           FROM Consultation c
           JOIN Patient p ON p.Pat_id = c.Pat_id
           WHERE c.medical_staff_id = ?
           ORDER BY c.Consultation_date DESC`,
          [staff.staff_id]
        );

        const appointments = await optionalQuery(
          `SELECT a.Appointment_id, a.Appointment_date, a.Status, a.Purpose, a.Notes,
                  p.Pat_id, p.Pat_name, p.Age, p.Gender, p.Phone, p.Address, p.Blood_type
           FROM Appointment a
           JOIN Patient p ON p.Pat_id = a.Pat_id
           WHERE a.doctor_staff_id = ?
           ORDER BY a.Appointment_date DESC`,
          [staff.staff_id]
        );

        const prescriptions = await optionalQuery(
          `SELECT cp.Consultation_id, cp.Medic_id, ph.Med_name, cp.Quantity, cp.Dosage
           FROM Consultation_Prescription cp
           JOIN Consultation c ON c.Consultation_id = cp.Consultation_id
           JOIN Pharmaceuticals ph ON ph.Medic_id = cp.Medic_id
           WHERE c.medical_staff_id = ?
           ORDER BY cp.Consultation_id DESC`,
          [staff.staff_id]
        );

        roleDetails.patients = patients;
        roleDetails.consultations = consultations;
        roleDetails.appointments = appointments;
        roleDetails.prescriptions = prescriptions;
        roleDetails.permissions = ['view_assigned_patients', 'view_consultations'];
        await conn.end();
        return res.json({ ...baseProfile, details: roleDetails });
      } catch (err) {
        await conn.end();
        console.error('Procedure error:', err.message);
        return res.status(500).json({ error: 'Failed to fetch patients via DB procedure' });
      }
    }

    if (staff.role === 'receptionist') {
      const [recentPatients] = await adminPool.query(
        'SELECT Pat_id, Pat_name, Age, Gender, Phone FROM Patient ORDER BY Pat_id DESC LIMIT 10'
      );
      const appointments = await optionalQuery(
        `SELECT a.Appointment_id, a.Appointment_date, a.Status, a.Purpose, p.Pat_name, s.staff_name AS doctor_name
         FROM Appointment a
         JOIN Patient p ON p.Pat_id = a.Pat_id
         JOIN clinic_staff s ON s.staff_id = a.doctor_staff_id
         ORDER BY a.Appointment_date DESC LIMIT 10`
      );
      const [staffCountRows] = await adminPool.query('SELECT COUNT(*) AS totalStaff FROM clinic_staff');
      roleDetails.recentPatients = recentPatients;
      roleDetails.appointments = appointments;
      roleDetails.totalStaff = staffCountRows[0]?.totalStaff || 0;
      roleDetails.permissions = ['register_staff', 'view_patients'];
      return res.json({ ...baseProfile, details: roleDetails });
    }

    if (staff.role === 'pharmacist') {
      const [medications] = await adminPool.query(
        'SELECT Medic_id, Med_name, Price FROM Pharmaceuticals ORDER BY Med_name LIMIT 20'
      );
      const [patients] = await adminPool.query(
        'SELECT Pat_id, Pat_name, Age, Gender, Phone FROM Patient ORDER BY Pat_id DESC LIMIT 20'
      );
      roleDetails.medications = medications;
      roleDetails.patients = patients;
      roleDetails.permissions = ['view_medications', 'prepare_dispense'];
      return res.json({ ...baseProfile, details: roleDetails });
    }

    if (staff.role === 'billing') {
      const [bills] = await adminPool.query(
        `SELECT b.Bill_id, b.Pat_id, p.Pat_name, b.Bill_date, b.Total_charges, b.Net_amount, b.Status
         FROM Billing b
         JOIN Patient p ON p.Pat_id = b.Pat_id
         ORDER BY b.Bill_id DESC LIMIT 20`
      );
      const [billItems] = await adminPool.query(
        `SELECT bi.Item_id, bi.Bill_id, bi.Medic_id, ph.Med_name, bi.Description, bi.Quantity, bi.Unit_price, bi.Amount
         FROM Bill_Item bi
         LEFT JOIN Pharmaceuticals ph ON ph.Medic_id = bi.Medic_id
         ORDER BY bi.Item_id DESC LIMIT 40`
      );
      const [patients] = await adminPool.query(
        'SELECT Pat_id, Pat_name, Phone FROM Patient ORDER BY Pat_id DESC LIMIT 20'
      );
      const [consultations] = await adminPool.query(
        `SELECT c.Consultation_id, c.Pat_id, p.Pat_name, c.Consultation_date
         FROM Consultation c
         JOIN Patient p ON p.Pat_id = c.Pat_id
         ORDER BY c.Consultation_id DESC LIMIT 20`
      );
      roleDetails.bills = bills;
      roleDetails.billItems = billItems;
      roleDetails.patients = patients;
      roleDetails.consultations = consultations;
      roleDetails.permissions = ['view_billing', 'create_bill', 'add_bill_item', 'update_status'];
      return res.json({ ...baseProfile, details: roleDetails });
    }

    if (staff.role === 'admin') {
      const [[totals]] = await adminPool.query(
        `SELECT
          (SELECT COUNT(*) FROM clinic_staff) AS totalStaff,
          (SELECT COUNT(*) FROM Patient) AS totalPatients,
          (SELECT COUNT(*) FROM Consultation) AS totalConsultations,
          (SELECT COUNT(*) FROM Billing) AS totalBills,
          (SELECT COUNT(*) FROM Pharmaceuticals) AS totalMedicines`
      );
      const [staffList] = await adminPool.query(
        'SELECT staff_id, username, staff_name, role, designation FROM clinic_staff ORDER BY staff_id'
      );
      const [patients] = await adminPool.query(
        'SELECT Pat_id, Pat_name, Age, Gender, Phone, Address, Blood_type FROM Patient ORDER BY Pat_id DESC LIMIT 50'
      );
      const appointments = await optionalQuery(
        `SELECT a.Appointment_id, a.Appointment_date, a.Status, a.Purpose, p.Pat_name, s.staff_name AS doctor_name
         FROM Appointment a
         JOIN Patient p ON p.Pat_id = a.Pat_id
         JOIN clinic_staff s ON s.staff_id = a.doctor_staff_id
         ORDER BY a.Appointment_id DESC LIMIT 50`
      );
      const consultations = await optionalQuery(
        `SELECT c.Consultation_id, c.Consultation_date, c.Notes, p.Pat_name, s.staff_name AS doctor_name
         FROM Consultation c
         JOIN Patient p ON p.Pat_id = c.Pat_id
         JOIN clinic_staff s ON s.staff_id = c.medical_staff_id
         ORDER BY c.Consultation_id DESC LIMIT 50`
      );
      const bills = await optionalQuery(
        `SELECT b.Bill_id, b.Pat_id, b.Bill_date, b.Total_charges, b.Discount, b.Net_amount, b.Status, p.Pat_name
         FROM Billing b
         JOIN Patient p ON p.Pat_id = b.Pat_id
         ORDER BY b.Bill_id DESC LIMIT 50`
      );
      const billItems = await optionalQuery(
        `SELECT bi.Item_id, bi.Bill_id, bi.Description, bi.Quantity, bi.Unit_price, bi.Amount, ph.Med_name
         FROM Bill_Item bi
         LEFT JOIN Pharmaceuticals ph ON ph.Medic_id = bi.Medic_id
         ORDER BY bi.Item_id DESC LIMIT 50`
      );
      const medications = await optionalQuery(
        'SELECT Medic_id, Med_name, Price FROM Pharmaceuticals ORDER BY Med_name LIMIT 50'
      );
      roleDetails.dashboard = totals;
      roleDetails.staffList = staffList;
      roleDetails.patients = patients;
      roleDetails.appointments = appointments;
      roleDetails.consultations = consultations;
      roleDetails.bills = bills;
      roleDetails.billItems = billItems;
      roleDetails.medications = medications;
      roleDetails.permissions = ['manage_staff', 'manage_records', 'view_reports'];
      return res.json({ ...baseProfile, details: roleDetails });
    }

    // Default: return the base role info with whatever was available.
    return res.json({ ...baseProfile, details: roleDetails });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server error' });
  }
});

// Receptionist registers new staff (creates DB user via stored procedure sp_register_staff)
app.post('/register', async (req, res) => {
  try {
    const { receptionistId, in_username, in_password, in_name, in_role, in_designation } = req.body;
    if (!receptionistId) return res.status(400).json({ error: 'receptionistId required' });

    const [rows] = await adminPool.query('SELECT role FROM clinic_staff WHERE staff_id = ?', [receptionistId]);
    if (!rows || rows.length === 0) return res.status(401).json({ error: 'Unknown receptionist id' });
    if (rows[0].role !== 'receptionist') return res.status(403).json({ error: 'Only receptionists may register new staff' });

    // Call the admin DEFINER procedure to create DB user and insert staff row
    await adminPool.query('CALL sp_register_staff(?,?,?,?,?)', [in_username, in_password, in_name, in_role, in_designation]);
    return res.json({ ok: true });
  } catch (err) {
    console.error('register error', err.message);
    return res.status(500).json({ error: 'registration failed' });
  }
});

// Receptionist can add a patient
app.post('/patients', async (req, res) => {
  try {
    const { receptionistId, Pat_name, Age, Gender, Phone, Address, Blood_type } = req.body;
    if (!receptionistId) return res.status(400).json({ error: 'receptionistId required' });

    const [rows] = await adminPool.query('SELECT role FROM clinic_staff WHERE staff_id = ?', [receptionistId]);
    if (!rows || rows.length === 0) return res.status(401).json({ error: 'Unknown receptionist id' });
    if (rows[0].role !== 'receptionist') return res.status(403).json({ error: 'Only receptionists may add patients' });

    const [result] = await adminPool.query(
      'INSERT INTO Patient (Pat_name, Age, Gender, Phone, Address, Blood_type) VALUES (?,?,?,?,?,?)',
      [Pat_name, Age || null, Gender || null, Phone || null, Address || null, Blood_type || null]
    );

    return res.json({ ok: true, Pat_id: result.insertId });
  } catch (err) {
    console.error('patients error', err.message);
    return res.status(500).json({ error: 'failed to add patient' });
  }
});

// Receptionist can book an appointment
app.post('/appointments', async (req, res) => {
  try {
    const { receptionistId, Pat_id, doctor_staff_id, Appointment_date, Purpose, Notes } = req.body;
    if (!receptionistId) return res.status(400).json({ error: 'receptionistId required' });

    const [rows] = await adminPool.query('SELECT role FROM clinic_staff WHERE staff_id = ?', [receptionistId]);
    if (!rows || rows.length === 0) return res.status(401).json({ error: 'Unknown receptionist id' });
    if (rows[0].role !== 'receptionist') return res.status(403).json({ error: 'Only receptionists may book appointments' });

    const [result] = await adminPool.query(
      'INSERT INTO Appointment (Pat_id, doctor_staff_id, booked_by_staff_id, Appointment_date, Status, Purpose, Notes) VALUES (?,?,?,?,?,?,?)',
      [Pat_id, doctor_staff_id, receptionistId, Appointment_date, 'Booked', Purpose || null, Notes || null]
    );

    return res.json({ ok: true, Appointment_id: result.insertId });
  } catch (err) {
    console.error('appointments error', err.message);
    return res.status(500).json({ error: 'failed to book appointment' });
  }
});

// Doctor can mark an appointment complete and create a consultation record.
app.patch('/appointments/:id/complete', async (req, res) => {
  try {
    const appointmentId = req.params.id;
    const { doctorId, Notes } = req.body;
    if (!doctorId) return res.status(400).json({ error: 'doctorId required' });

    const doctor = await getStaffById(doctorId);
    if (!doctor) return res.status(401).json({ error: 'Unknown doctor id' });
    if (doctor.role !== 'doctor') return res.status(403).json({ error: 'Only doctors may complete appointments' });

    const [appointmentRows] = await adminPool.query(
      'SELECT * FROM Appointment WHERE Appointment_id = ? AND doctor_staff_id = ?',
      [appointmentId, doctorId]
    );
    if (!appointmentRows || appointmentRows.length === 0) {
      return res.status(404).json({ error: 'Appointment not found for this doctor' });
    }

    const appointment = appointmentRows[0];
    await adminPool.query(
      'UPDATE Appointment SET Status = ?, Notes = COALESCE(?, Notes) WHERE Appointment_id = ?',
      ['Completed', Notes || null, appointmentId]
    );

    const [consultationResult] = await adminPool.query(
      'INSERT INTO Consultation (Pat_id, medical_staff_id, Consultation_date, Notes) VALUES (?,?,NOW(),?)',
      [appointment.Pat_id, doctorId, Notes || appointment.Notes || appointment.Purpose || null]
    );

    return res.json({ ok: true, Consultation_id: consultationResult.insertId, Appointment_id: Number(appointmentId) });
  } catch (err) {
    console.error('complete appointment error', err.message);
    return res.status(500).json({ error: 'failed to complete appointment' });
  }
});

// Doctor can prescribe medicines against a consultation.
app.post('/prescriptions', async (req, res) => {
  try {
    const { doctorId, Consultation_id, Medic_id, Quantity, Dosage } = req.body;
    if (!doctorId) return res.status(400).json({ error: 'doctorId required' });

    const doctor = await getStaffById(doctorId);
    if (!doctor) return res.status(401).json({ error: 'Unknown doctor id' });
    if (doctor.role !== 'doctor') return res.status(403).json({ error: 'Only doctors may prescribe medicines' });

    const [consultationRows] = await adminPool.query(
      'SELECT * FROM Consultation WHERE Consultation_id = ? AND medical_staff_id = ?',
      [Consultation_id, doctorId]
    );
    if (!consultationRows || consultationRows.length === 0) {
      return res.status(404).json({ error: 'Consultation not found for this doctor' });
    }

    const [result] = await adminPool.query(
      'INSERT INTO Consultation_Prescription (Consultation_id, Medic_id, Quantity, Dosage) VALUES (?,?,?,?)',
      [Consultation_id, Medic_id, Quantity || 1, Dosage || null]
    );

    return res.json({ ok: true, Consultation_id: Number(Consultation_id), Medic_id: Number(Medic_id), rowCount: result.affectedRows });
  } catch (err) {
    console.error('prescription error', err.message);
    return res.status(500).json({ error: 'failed to prescribe medicine' });
  }
});

// Pharmacist can look up all prescriptions for a patient id.
app.get('/pharmacist/prescriptions', async (req, res) => {
  try {
    const { pharmacistId, Pat_id } = req.query;
    if (!pharmacistId) return res.status(400).json({ error: 'pharmacistId required' });
    if (!Pat_id) return res.status(400).json({ error: 'Pat_id required' });

    const pharmacist = await getStaffById(pharmacistId);
    if (!pharmacist) return res.status(401).json({ error: 'Unknown pharmacist id' });
    if (pharmacist.role !== 'pharmacist') return res.status(403).json({ error: 'Only pharmacists may view prescriptions' });

    const [patientRows] = await adminPool.query('SELECT * FROM Patient WHERE Pat_id = ?', [Pat_id]);
    if (!patientRows || patientRows.length === 0) return res.status(404).json({ error: 'Unknown patient id' });

    const prescriptions = await optionalQuery(
      `SELECT c.Consultation_id, c.Consultation_date, c.Notes, cp.Medic_id, ph.Med_name, ph.Price, cp.Quantity, cp.Dosage,
              (ph.Price * cp.Quantity) AS lineTotal
       FROM Consultation c
       JOIN Consultation_Prescription cp ON cp.Consultation_id = c.Consultation_id
       JOIN Pharmaceuticals ph ON ph.Medic_id = cp.Medic_id
       WHERE c.Pat_id = ?
       ORDER BY c.Consultation_date DESC, cp.Consultation_id DESC`,
      [Pat_id]
    );

    const totalMedicineCost = prescriptions.reduce((sum, row) => sum + Number(row.lineTotal || 0), 0);
    return res.json({ ok: true, patient: patientRows[0], prescriptions, totalMedicineCost });
  } catch (err) {
    console.error('pharmacist lookup error', err.message);
    return res.status(500).json({ error: 'failed to load prescriptions' });
  }
});

// Billing staff can load a bill and its items by bill id.
app.get('/bills/:id/details', async (req, res) => {
  try {
    const { billerId } = req.query;
    if (!billerId) return res.status(400).json({ error: 'billerId required' });

    const biller = await getStaffById(billerId);
    if (!biller) return res.status(401).json({ error: 'Unknown biller id' });
    if (biller.role !== 'billing') return res.status(403).json({ error: 'Only billing staff may view bill details' });

    const billId = req.params.id;
    const [billRows] = await adminPool.query(
      `SELECT b.Bill_id, b.Pat_id, p.Pat_name, b.Consultation_id, b.Bill_date, b.Total_charges, b.Discount, b.Net_amount, b.Status
       FROM Billing b
       JOIN Patient p ON p.Pat_id = b.Pat_id
       WHERE b.Bill_id = ?`,
      [billId]
    );
    if (!billRows || billRows.length === 0) return res.status(404).json({ error: 'Bill not found' });

    const items = await optionalQuery(
      `SELECT bi.Item_id, bi.Bill_id, bi.Medic_id, ph.Med_name, bi.Description, bi.Quantity, bi.Unit_price, bi.Amount
       FROM Bill_Item bi
       LEFT JOIN Pharmaceuticals ph ON ph.Medic_id = bi.Medic_id
       WHERE bi.Bill_id = ?
       ORDER BY bi.Item_id`,
      [billId]
    );
    const itemTotal = items.reduce((sum, item) => sum + Number(item.Amount || 0), 0);
    return res.json({ ok: true, bill: billRows[0], items, itemTotal });
  } catch (err) {
    console.error('bill details error', err.message);
    return res.status(500).json({ error: 'failed to load bill details' });
  }
});

// Admin can assign role/designation to staff and sync DB grants.
app.patch('/staffs/:id/assignment', async (req, res) => {
  try {
    const staffId = req.params.id;
    const { adminId, role, designation } = req.body;
    if (!adminId) return res.status(400).json({ error: 'adminId required' });
    if (!allowedAppRoles.has(role)) return res.status(400).json({ error: 'invalid role' });

    const admin = await getStaffById(adminId);
    if (!admin) return res.status(401).json({ error: 'Unknown admin id' });
    if (admin.role !== 'admin') return res.status(403).json({ error: 'Only admins may assign work' });

    const [staffRows] = await adminPool.query('SELECT * FROM clinic_staff WHERE staff_id = ?', [staffId]);
    if (!staffRows || staffRows.length === 0) return res.status(404).json({ error: 'Staff member not found' });

    const target = staffRows[0];
    if (target.role !== role) {
      const oldRole = `${target.role}_role`;
      const newRole = `${role}_role`;
      const revokeStmt = `REVOKE ${oldRole} FROM ${mysql.escape(target.username)}@'%'`;
      const grantStmt = `GRANT ${newRole} TO ${mysql.escape(target.username)}@'%'`;
      const setDefaultStmt = `SET DEFAULT ROLE ${newRole} TO ${mysql.escape(target.username)}@'%'`;
      await adminPool.query(revokeStmt).catch(() => null);
      await adminPool.query(grantStmt);
      await adminPool.query(setDefaultStmt);
    }

    await adminPool.query(
      'UPDATE clinic_staff SET role = ?, designation = COALESCE(?, designation) WHERE staff_id = ?',
      [role, designation || null, staffId]
    );

    return res.json({ ok: true });
  } catch (err) {
    console.error('assignment error', err.message);
    return res.status(500).json({ error: 'failed to assign work' });
  }
});

// Billing staff can create or update a bill header
app.post('/bills', async (req, res) => {
  try {
    const { billerId, Pat_id, Consultation_id, Bill_date, Total_charges, Discount, Net_amount, Status } = req.body;
    if (!billerId) return res.status(400).json({ error: 'billerId required' });

    const [rows] = await adminPool.query('SELECT role FROM clinic_staff WHERE staff_id = ?', [billerId]);
    if (!rows || rows.length === 0) return res.status(401).json({ error: 'Unknown biller id' });
    if (rows[0].role !== 'billing') return res.status(403).json({ error: 'Only billing staff may manage bills' });

    const [result] = await adminPool.query(
      `INSERT INTO Billing (Pat_id, Consultation_id, Bill_date, Total_charges, Discount, Net_amount, Status)
       VALUES (?,?,?,?,?,?,?)`,
      [Pat_id, Consultation_id || null, Bill_date || new Date(), Total_charges || 0, Discount || 0, Net_amount || 0, Status || 'Pending']
    );

    return res.json({ ok: true, Bill_id: result.insertId });
  } catch (err) {
    console.error('bills error', err.message);
    return res.status(500).json({ error: 'failed to create bill' });
  }
});

// Billing staff can add bill items
app.post('/bill-items', async (req, res) => {
  try {
    const { billerId, Bill_id, Medic_id, Description, Quantity, Unit_price, Amount } = req.body;
    if (!billerId) return res.status(400).json({ error: 'billerId required' });

    const [rows] = await adminPool.query('SELECT role FROM clinic_staff WHERE staff_id = ?', [billerId]);
    if (!rows || rows.length === 0) return res.status(401).json({ error: 'Unknown biller id' });
    if (rows[0].role !== 'billing') return res.status(403).json({ error: 'Only billing staff may manage bill items' });

    const [result] = await adminPool.query(
      `INSERT INTO Bill_Item (Bill_id, Medic_id, Description, Quantity, Unit_price, Amount)
       VALUES (?,?,?,?,?,?)`,
      [Bill_id, Medic_id || null, Description || null, Quantity || 1, Unit_price || 0, Amount || 0]
    );

    return res.json({ ok: true, Item_id: result.insertId });
  } catch (err) {
    console.error('bill-items error', err.message);
    return res.status(500).json({ error: 'failed to add bill item' });
  }
});

// Billing staff can update the bill header and status
app.patch('/bills/:id', async (req, res) => {
  try {
    const billId = req.params.id;
    const { billerId, Total_charges, Discount, Net_amount, Status, Bill_date } = req.body;
    if (!billerId) return res.status(400).json({ error: 'billerId required' });

    const [rows] = await adminPool.query('SELECT role FROM clinic_staff WHERE staff_id = ?', [billerId]);
    if (!rows || rows.length === 0) return res.status(401).json({ error: 'Unknown biller id' });
    if (rows[0].role !== 'billing') return res.status(403).json({ error: 'Only billing staff may update bills' });

    await adminPool.query(
      `UPDATE Billing
       SET Total_charges = COALESCE(?, Total_charges),
           Discount = COALESCE(?, Discount),
           Net_amount = COALESCE(?, Net_amount),
           Status = COALESCE(?, Status),
           Bill_date = COALESCE(?, Bill_date)
       WHERE Bill_id = ?`,
      [Total_charges ?? null, Discount ?? null, Net_amount ?? null, Status ?? null, Bill_date ?? null, billId]
    );

    return res.json({ ok: true });
  } catch (err) {
    console.error('bill update error', err.message);
    return res.status(500).json({ error: 'failed to update bill' });
  }
});

// Simple status page
app.get('/', (req, res) => {
  res.send(`<!doctype html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>MHMS Backend</title>
    <link rel="stylesheet" href="/static/styles.css">
  </head>
  <body>
    <main class="container">
      <h1>MHMS Backend (Demo)</h1>
      <p class="muted">API endpoints for demo</p>
      <ul>
        <li>POST <code>/login</code> - JSON {"staffId": 1}</li>
        <li>POST <code>/register</code> - receptionist registration (see docs)</li>
      </ul>
      <p><a class="btn" href="/login">Open login form</a></p>
      <p><a class="link" href="/staffs">View clinic staff</a></p>
    </main>
  </body>
  </html>`);
});

// Simple HTML login form for quick browser testing (posts to POST /login)
app.get('/login', (req, res) => {
  res.send(`<!doctype html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>MHMS Login</title>
    <link rel="stylesheet" href="/static/styles.css">
  </head>
  <body>
    <main class="page">
      <section class="hero card">
        <div class="eyebrow">MHMS Demo Portal</div>
        <h1>Sign in and see your role dashboard</h1>
        <p class="muted">Enter the numeric staff ID to load the matching ER role details.</p>
        <form id="loginForm" class="form login-form">
          <label>Staff ID
            <input name="staffId" type="number" placeholder="Enter numeric staff id" required />
          </label>
          <div class="actions">
            <button type="submit" class="btn">Login</button>
            <a class="link btn-secondary" href="/staffs">View staff</a>
          </div>
        </form>
      </section>

      <section id="resultPanel" class="card result-panel empty">
        <div class="result-empty">
          <h2>Login result</h2>
          <p class="muted">Your role details will appear here after login.</p>
        </div>
      </section>
    </main>
    <script src="/static/login.js" defer></script>
  </body>
  </html>`);
});

app.post('/login-result', async (req, res) => {
  try {
    const { staffId } = req.body;
    const [rows] = await adminPool.query('SELECT * FROM clinic_staff WHERE staff_id = ?', [staffId]);
    if (!rows.length) return res.status(404).send('Unknown staff id');
    const staff = rows[0];
    res.redirect(`/login?staffId=${staff.staff_id}`);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Failed');
  }
});

// Quick helper: list clinic staff (for local testing only)
app.get('/staffs', async (req, res) => {
  try {
    const [rows] = await adminPool.query('SELECT staff_id, username, staff_name, role FROM clinic_staff ORDER BY staff_id LIMIT 200');
    return res.json(rows);
  } catch (err) {
    console.error('staffs error', err.message);
    return res.status(500).json({ error: 'failed to list staff' });
  }
});

const PORT = process.env.PORT || 4001;
app.listen(PORT, () => {
  console.log(`MHMS backend running on ${PORT}`);
  console.log(`Open login page: http://localhost:${PORT}/login`);
  console.log(`Open dashboard: http://localhost:${PORT}/`);
});
