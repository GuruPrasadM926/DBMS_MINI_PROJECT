-- MHMS MySQL schema with RBAC examples
-- Database: MHMS
-- WARNING: This is a demo setup. Review privileged procedures and passwords before use.

CREATE DATABASE IF NOT EXISTS MHMS;
USE MHMS;

-- Clinic staff: unified table for all employees with a role attribute
CREATE TABLE IF NOT EXISTS clinic_staff (
  staff_id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(100) NOT NULL UNIQUE,
  staff_name VARCHAR(200) NOT NULL,
  role ENUM('receptionist','doctor','pharmacist','billing','admin') NOT NULL,
  designation VARCHAR(100),
  db_password VARCHAR(255) NOT NULL
);

-- Patient table
CREATE TABLE IF NOT EXISTS Patient (
  Pat_id INT AUTO_INCREMENT PRIMARY KEY,
  Pat_name VARCHAR(200) NOT NULL,
  Age INT,
  Gender VARCHAR(20),
  Phone VARCHAR(50),
  Address VARCHAR(500),
  Blood_type VARCHAR(10)
);

-- Consultation: link to clinic_staff (medical staff who conducted the consultation)
CREATE TABLE IF NOT EXISTS Consultation (
  Consultation_id INT AUTO_INCREMENT PRIMARY KEY,
  Pat_id INT NOT NULL,
  medical_staff_id INT NULL,
  Consultation_date DATETIME,
  Notes TEXT,
  FOREIGN KEY (Pat_id) REFERENCES Patient(Pat_id),
  FOREIGN KEY (medical_staff_id) REFERENCES clinic_staff(staff_id)
);

-- Appointment schedule booked by reception for a patient and doctor
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
);

-- Pharmaceuticals
CREATE TABLE IF NOT EXISTS Pharmaceuticals (
  Medic_id INT AUTO_INCREMENT PRIMARY KEY,
  Med_name VARCHAR(200) NOT NULL,
  Price DECIMAL(10,2) NOT NULL
);

-- Billing and Bill items
CREATE TABLE IF NOT EXISTS Billing (
  Bill_id INT AUTO_INCREMENT PRIMARY KEY,
  Pat_id INT NOT NULL,
  Consultation_id INT,
  Bill_date DATETIME,
  Total_charges DECIMAL(12,2),
  Discount DECIMAL(12,2),
  Net_amount DECIMAL(12,2),
  Status VARCHAR(50),
  FOREIGN KEY (Pat_id) REFERENCES Patient(Pat_id),
  FOREIGN KEY (Consultation_id) REFERENCES Consultation(Consultation_id)
);

CREATE TABLE IF NOT EXISTS Bill_Item (
  Item_id INT AUTO_INCREMENT PRIMARY KEY,
  Bill_id INT NOT NULL,
  Medic_id INT NULL,
  Description VARCHAR(300),
  Quantity INT,
  Unit_price DECIMAL(12,2),
  Amount DECIMAL(12,2),
  FOREIGN KEY (Bill_id) REFERENCES Billing(Bill_id),
  FOREIGN KEY (Medic_id) REFERENCES Pharmaceuticals(Medic_id)
);

-- Junction table for prescriptions
CREATE TABLE IF NOT EXISTS Consultation_Prescription (
  Consultation_id INT NOT NULL,
  Medic_id INT NOT NULL,
  Quantity INT,
  Dosage VARCHAR(200),
  PRIMARY KEY (Consultation_id, Medic_id),
  FOREIGN KEY (Consultation_id) REFERENCES Consultation(Consultation_id),
  FOREIGN KEY (Medic_id) REFERENCES Pharmaceuticals(Medic_id)
);

-- Create application roles (idempotent)
CREATE ROLE IF NOT EXISTS receptionist_role;
CREATE ROLE IF NOT EXISTS doctor_role;
CREATE ROLE IF NOT EXISTS pharmacist_role;
CREATE ROLE IF NOT EXISTS billing_role;
CREATE ROLE IF NOT EXISTS admin_role;

-- Procedure: return patients for the calling medical staff (doctors call this)
DELIMITER $$
DROP PROCEDURE IF EXISTS MHMS.sp_get_my_patients$$
CREATE DEFINER = CURRENT_USER PROCEDURE MHMS.sp_get_my_patients()
SQL SECURITY DEFINER
BEGIN
  DECLARE uname VARCHAR(100);
  SET uname = SUBSTRING_INDEX(CURRENT_USER(),'@',1);

  SELECT DISTINCT p.*
  FROM Patient p
  JOIN Consultation c ON p.Pat_id = c.Pat_id
  JOIN clinic_staff s ON c.medical_staff_id = s.staff_id
  WHERE s.username = uname;
END$$
DELIMITER ;

-- Allow doctors to execute the procedure (they do not get blanket SELECT on Patient)
GRANT EXECUTE ON PROCEDURE MHMS.sp_get_my_patients TO doctor_role;

-- Procedure: receptionist registers staff and creates DB user (DEFINER must have CREATE USER privilege)
DELIMITER $$
DROP PROCEDURE IF EXISTS MHMS.sp_register_staff$$
CREATE DEFINER = CURRENT_USER PROCEDURE MHMS.sp_register_staff(
  IN in_username VARCHAR(100),
  IN in_password VARCHAR(255),
  IN in_name VARCHAR(200),
  IN in_role VARCHAR(20),
  IN in_designation VARCHAR(100)
)
SQL SECURITY DEFINER
BEGIN
  -- create DB user (use QUOTE to escape literals)
  SET @create_stmt = CONCAT('CREATE USER IF NOT EXISTS ', QUOTE(in_username), '@', QUOTE('%'), ' IDENTIFIED BY ', QUOTE(in_password));
  PREPARE stmt FROM @create_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

  -- grant application role to the DB user
  SET @grant_stmt = CONCAT('GRANT ', in_role, '_role TO ', QUOTE(in_username), '@', QUOTE('%'));
  PREPARE gstmt FROM @grant_stmt; EXECUTE gstmt; DEALLOCATE PREPARE gstmt;

  -- set default role for that DB user
  SET @setdef_stmt = CONCAT('SET DEFAULT ROLE ', in_role, '_role TO ', QUOTE(in_username), '@', QUOTE('%'));
  PREPARE dstmt FROM @setdef_stmt; EXECUTE dstmt; DEALLOCATE PREPARE dstmt;

  -- insert into application table (store password for demo only)
  INSERT INTO MHMS.clinic_staff (username, staff_name, role, designation, db_password)
    VALUES (in_username, in_name, in_role, in_designation, in_password);
END$$
DELIMITER ;

-- Allow receptionists to call the register procedure
GRANT EXECUTE ON PROCEDURE MHMS.sp_register_staff TO receptionist_role;

-- Usage examples (run as admin/root)
-- Create an admin DB user for the application (run as root)
-- CREATE USER 'mhms_admin'@'%' IDENTIFIED BY 'StrongAdminPassword!';
-- GRANT ALL PRIVILEGES ON MHMS.* TO 'mhms_admin'@'%';

-- Example: create a doctor user manually (run as admin):
-- CREATE USER 'dr_smith'@'%' IDENTIFIED BY 'dr_smith_pass';
-- GRANT doctor_role TO 'dr_smith'@'%';
-- SET DEFAULT ROLE doctor_role TO 'dr_smith'@'%';

-- Example: receptionist registers new staff (when using an admin-definer for the procedure):
-- CALL MHMS.sp_register_staff('nurse_jane', 'pwd123', 'Jane Doe', 'receptionist', 'Front Desk');

-- Example: doctor logs in to the DB (dr_smith) and runs:
-- CALL MHMS.sp_get_my_patients();

-- Additional notes:
-- - In production, store DB credentials encrypted and use TLS connections.
-- - Prefer application-level authentication tokens rather than passing DB credentials around.
-- - For stricter enforcement consider MySQL Enterprise features or a proxy that maps app users to DB users.
