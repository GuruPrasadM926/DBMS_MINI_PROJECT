(function () {
  const form = document.getElementById('loginForm');
  const panel = document.getElementById('resultPanel');

  if (!form || !panel) return;

  function escapeHtml(value) {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function renderList(items, renderItem) {
    if (!items || !items.length) return '<p class="muted">No records found.</p>';
    return '<div class="list-grid">' + items.map(renderItem).join('') + '</div>';
  }

  function renderKeyValueList(obj) {
    if (!obj) return '';
    return Object.entries(obj)
      .map(function (_ref) {
        const key = _ref[0];
        const value = _ref[1];
        const displayValue = Array.isArray(value) || typeof value === 'object' ? JSON.stringify(value) : value;
        return '<div class="kv"><span>' + escapeHtml(key) + '</span><strong>' + escapeHtml(displayValue) + '</strong></div>';
      })
      .join('');
  }

  function renderDetails(data) {
    const details = data.details || {};
    let html =
      '<div class="result-head">' +
      '<div>' +
      '<div class="eyebrow">Logged in</div>' +
      '<h2>' + escapeHtml(data.staff_name) + '</h2>' +
      '<p class="muted">Role: ' + escapeHtml(data.role) + ' | ID: ' + escapeHtml(data.staff_id) + '</p>' +
      '<p class="muted">Designation: ' + escapeHtml(data.designation || 'N/A') + '</p>' +
      '</div>' +
      '<div class="badge">' + escapeHtml(data.role) + '</div>' +
      '</div>' +
      '<div class="section">' +
      '<h3>Staff Record</h3>' +
      '<div class="kv-grid">' +
      renderKeyValueList(details.staffRecord || data) +
      '</div>' +
      '</div>';

    if (details.permissions) {
      html +=
        '<div class="section"><h3>Permissions</h3><div class="chips">' +
        details.permissions.map(function (p) {
          return '<span class="chip">' + escapeHtml(p) + '</span>';
        }).join('') +
        '</div></div>';
    }

    if (details.patients) {
      const patientSectionTitle = data.role === 'billing' ? 'Patient Directory' : 'Assigned Patients';
      html +=
        '<div class="section"><h3>' + escapeHtml(patientSectionTitle) + '</h3>' +
        renderList(details.patients, function (p) {
          return '<article class="mini-card"><strong>' + escapeHtml(p.Pat_name) + '</strong><span>ID ' + escapeHtml(p.Pat_id) + '</span><span>' + escapeHtml(p.Gender || 'Unknown') + ' · Age ' + escapeHtml(p.Age ?? 'N/A') + '</span></article>';
        }) +
        '</div>';
    }

    if (details.staffList) {
      html +=
        '<div class="section"><h3>Staff Directory</h3>' +
        renderList(details.staffList, function (s) {
          return '<article class="mini-card"><strong>' + escapeHtml(s.staff_name) + '</strong><span>ID ' + escapeHtml(s.staff_id) + ' · ' + escapeHtml(s.role) + '</span><span>Designation: ' + escapeHtml(s.designation || 'N/A') + '</span><span>Username: ' + escapeHtml(s.username) + '</span></article>';
        }) +
        '</div>';
    }

    if (details.consultations) {
      const consultationSectionTitle = data.role === 'billing' ? 'Consultation Lookup' : 'Consultations';
      html +=
        '<div class="section"><h3>' + escapeHtml(consultationSectionTitle) + '</h3>' +
        renderList(details.consultations, function (c) {
          return '<article class="mini-card"><strong>Consultation #' + escapeHtml(c.Consultation_id) + '</strong><span>Patient: ' + escapeHtml(c.Pat_name) + '</span><span>' + escapeHtml(c.Consultation_date || '') + '</span></article>';
        }) +
        '</div>';
    }

    if (details.appointments) {
      html +=
        '<div class="section"><h3>Appointments</h3>' +
        renderList(details.appointments, function (a) {
          return '<article class="mini-card"><strong>' + escapeHtml(a.Pat_name) + '</strong><span>Appointment #' + escapeHtml(a.Appointment_id) + '</span><span>' + escapeHtml(a.Appointment_date || '') + '</span><span>Status: ' + escapeHtml(a.Status || 'N/A') + '</span><span>Age: ' + escapeHtml(a.Age || 'N/A') + ' | Gender: ' + escapeHtml(a.Gender || 'N/A') + '</span><span>Phone: ' + escapeHtml(a.Phone || 'N/A') + '</span><span>Address: ' + escapeHtml(a.Address || 'N/A') + '</span><span>Blood Type: ' + escapeHtml(a.Blood_type || 'N/A') + '</span></article>';
        }) +
        '</div>';
    }

    if (details.prescriptions) {
      html +=
        '<div class="section"><h3>Prescriptions</h3>' +
        renderList(details.prescriptions, function (p) {
          return '<article class="mini-card"><strong>' + escapeHtml(p.Med_name) + '</strong><span>Consultation #' + escapeHtml(p.Consultation_id) + '</span><span>Qty: ' + escapeHtml(p.Quantity || 'N/A') + '</span></article>';
        }) +
        '</div>';
    }

    if (details.recentPatients) {
      html +=
        '<div class="section"><h3>Recent Patients</h3>' +
        renderList(details.recentPatients, function (p) {
          return '<article class="mini-card"><strong>' + escapeHtml(p.Pat_name) + '</strong><span>Patient ID: ' + escapeHtml(p.Pat_id || 'N/A') + '</span><span>Phone: ' + escapeHtml(p.Phone || 'N/A') + '</span></article>';
        }) +
        '</div>';
    }

    if (details.medications) {
      html +=
        '<div class="section"><h3>Medications</h3>' +
        renderList(details.medications, function (m) {
          return '<article class="mini-card"><strong>' + escapeHtml(m.Med_name) + '</strong><span>Medicine ID ' + escapeHtml(m.Medic_id) + '</span><span>Price: ' + escapeHtml(m.Price) + '</span></article>';
        }) +
        '</div>';
    }

    if (details.bills) {
      html +=
        '<div class="section"><h3>Bills</h3>' +
        renderList(details.bills, function (b) {
          return '<article class="mini-card"><strong>Bill #' + escapeHtml(b.Bill_id) + '</strong><span>Patient: ' + escapeHtml(b.Pat_name) + ' (ID ' + escapeHtml(b.Pat_id) + ')</span><span>Date: ' + escapeHtml(b.Bill_date || 'N/A') + '</span><span>Total: ' + escapeHtml(b.Total_charges || 0) + ' | Net: ' + escapeHtml(b.Net_amount || 0) + '</span><span>Status: ' + escapeHtml(b.Status || 'N/A') + '</span></article>';
        }) +
        '</div>';
    }

    if (details.billItems) {
      html +=
        '<div class="section"><h3>Bill Items</h3>' +
        renderList(details.billItems, function (i) {
          return '<article class="mini-card"><strong>Item #' + escapeHtml(i.Item_id) + ' (Bill #' + escapeHtml(i.Bill_id) + ')</strong><span>Medicine: ' + escapeHtml(i.Med_name || 'N/A') + '</span><span>Description: ' + escapeHtml(i.Description || 'N/A') + '</span><span>Qty: ' + escapeHtml(i.Quantity || 0) + ' | Unit: ' + escapeHtml(i.Unit_price || 0) + ' | Amount: ' + escapeHtml(i.Amount || 0) + '</span></article>';
        }) +
        '</div>';
    }

    if (details.dashboard) {
      html += '<div class="section"><h3>Dashboard Summary</h3><div class="kv-grid">' + renderKeyValueList(details.dashboard) + '</div></div>';
    }

    if (data.role === 'receptionist') {
      html +=
        '<div class="section"><h3>Reception Actions</h3>' +
        '<div class="action-grid">' +
        '<form class="mini-form" data-action="add-patient">' +
        '<h4>Add Patient</h4>' +
        '<input name="Pat_name" placeholder="Patient name" required />' +
        '<input name="Age" type="number" placeholder="Age" />' +
        '<input name="Gender" placeholder="Gender" />' +
        '<input name="Phone" placeholder="Phone" />' +
        '<input name="Address" placeholder="Address" />' +
        '<input name="Blood_type" placeholder="Blood type" />' +
        '<button class="btn" type="submit">Save Patient</button>' +
        '</form>' +
        '<form class="mini-form" data-action="book-appointment">' +
        '<h4>Book Appointment</h4>' +
        '<input name="Pat_id" type="number" placeholder="Patient ID" required />' +
        '<input name="doctor_staff_id" type="number" placeholder="Doctor staff ID" required />' +
        '<input name="Appointment_date" type="datetime-local" required />' +
        '<input name="Purpose" placeholder="Purpose" />' +
        '<textarea name="Notes" placeholder="Notes"></textarea>' +
        '<button class="btn" type="submit">Book Appointment</button>' +
        '</form>' +
        '<form class="mini-form" data-action="add-staff">' +
        '<h4>Add Staff</h4>' +
        '<input name="in_username" placeholder="Username" required />' +
        '<input name="in_password" type="password" placeholder="Password" required />' +
        '<input name="in_name" placeholder="Full name" required />' +
        '<label>Role<select name="in_role" class="role-select" required>' +
        '<option value="">Select role</option>' +
        '<option value="doctor">Doctor</option>' +
        '<option value="receptionist">Receptionist</option>' +
        '<option value="pharmacist">Pharmacist</option>' +
        '<option value="billing">Biller</option>' +
        '<option value="admin">Admin</option>' +
        '</select></label>' +
        '<label>Designation<select name="in_designation" class="designation-select" required></select></label>' +
        '<button class="btn" type="submit">Add Staff</button>' +
        '</form>' +
        '</div>' +
        '</div>';
    }

    if (data.role === 'doctor') {
      html +=
        '<div class="section"><h3>Doctor Actions</h3>' +
        '<div class="action-grid">' +
        '<form class="mini-form" data-action="complete-appointment">' +
        '<h4>Mark Appointment Complete</h4>' +
        '<input name="Appointment_id" type="number" placeholder="Appointment ID" required />' +
        '<textarea name="Notes" placeholder="Consultation notes"></textarea>' +
        '<button class="btn" type="submit">Complete Appointment</button>' +
        '</form>' +
        '<form class="mini-form" data-action="prescribe-medicine">' +
        '<h4>Prescribe Medicine</h4>' +
        '<input name="Consultation_id" type="number" placeholder="Consultation ID" required />' +
        '<input name="Medic_id" type="number" placeholder="Medicine ID" required />' +
        '<input name="Quantity" type="number" placeholder="Quantity" value="1" />' +
        '<input name="Dosage" placeholder="Dosage instructions" />' +
        '<button class="btn" type="submit">Save Prescription</button>' +
        '</form>' +
        '</div>' +
        '</div>';
    }

    if (data.role === 'pharmacist') {
      html +=
        '<div class="section"><h3>Pharmacist Actions</h3>' +
        '<div class="action-grid">' +
        '<form class="mini-form" data-action="lookup-prescriptions">' +
        '<h4>Lookup Prescriptions by Patient</h4>' +
        '<input name="Pat_id" type="number" placeholder="Patient ID" required />' +
        '<button class="btn" type="submit">Load Prescriptions</button>' +
        '</form>' +
        '</div>' +
        '</div>';
    }

    if (data.role === 'billing') {
      html +=
        '<div class="section"><h3>Billing Actions</h3>' +
        '<div class="action-grid">' +
        '<form class="mini-form" data-action="create-bill">' +
        '<h4>Create Bill</h4>' +
        '<input name="Pat_id" type="number" placeholder="Patient ID" required />' +
        '<input name="Consultation_id" type="number" placeholder="Consultation ID (optional)" />' +
        '<input name="Bill_date" type="datetime-local" />' +
        '<input name="Total_charges" type="number" step="0.01" placeholder="Total charges" />' +
        '<input name="Discount" type="number" step="0.01" placeholder="Discount" />' +
        '<input name="Net_amount" type="number" step="0.01" placeholder="Net amount" />' +
        '<input name="Status" placeholder="Status (Pending/Paid/Cancelled)" />' +
        '<button class="btn" type="submit">Create Bill</button>' +
        '</form>' +
        '<form class="mini-form" data-action="add-bill-item">' +
        '<h4>Add Bill Item</h4>' +
        '<input name="Bill_id" type="number" placeholder="Bill ID" required />' +
        '<input name="Medic_id" type="number" placeholder="Medicine ID (optional)" />' +
        '<input name="Description" placeholder="Description" />' +
        '<input name="Quantity" type="number" placeholder="Quantity" />' +
        '<input name="Unit_price" type="number" step="0.01" placeholder="Unit price" />' +
        '<input name="Amount" type="number" step="0.01" placeholder="Amount" />' +
        '<button class="btn" type="submit">Add Item</button>' +
        '</form>' +
        '<form class="mini-form" data-action="update-bill">' +
        '<h4>Update Bill</h4>' +
        '<input name="Bill_id" type="number" placeholder="Bill ID" required />' +
        '<input name="Total_charges" type="number" step="0.01" placeholder="Total charges" />' +
        '<input name="Discount" type="number" step="0.01" placeholder="Discount" />' +
        '<input name="Net_amount" type="number" step="0.01" placeholder="Net amount" />' +
        '<input name="Status" placeholder="Status (Pending/Paid/Cancelled)" />' +
        '<button class="btn" type="submit">Update Bill</button>' +
        '</form>' +
        '<form class="mini-form" data-action="lookup-bill">' +
        '<h4>Lookup Bill by ID</h4>' +
        '<input name="Bill_id" type="number" placeholder="Bill ID" required />' +
        '<button class="btn" type="submit">Load Bill</button>' +
        '</form>' +
        '</div>' +
        '</div>';
    }

    if (data.role === 'admin') {
      html +=
        '<div class="section"><h3>Admin Actions</h3>' +
        '<div class="action-grid">' +
        '<form class="mini-form" data-action="assign-work">' +
        '<h4>Assign Staff Work</h4>' +
        '<input name="staff_id" type="number" placeholder="Staff ID" required />' +
        '<label>Role<select name="role" class="role-select" required>' +
        '<option value="">Select role</option>' +
        '<option value="doctor">Doctor</option>' +
        '<option value="receptionist">Receptionist</option>' +
        '<option value="pharmacist">Pharmacist</option>' +
        '<option value="billing">Biller</option>' +
        '<option value="admin">Admin</option>' +
        '</select></label>' +
        '<label>Designation<select name="designation" class="designation-select" required></select></label>' +
        '<button class="btn" type="submit">Assign</button>' +
        '</form>' +
        '</div>' +
        '</div>';
    }

    panel.classList.remove('empty');
    panel.classList.remove('loading');
    panel.innerHTML = html;

    wireDesignationDropdowns(panel);
  }

  const designationOptions = {
    doctor: ['General Physician', 'Pediatrician', 'Surgeon', 'Cardiologist'],
    receptionist: ['Front Desk', 'Reception'],
    pharmacist: ['Pharmacy Desk', 'Dispensing'],
    billing: ['Biller', 'Accounts'],
    admin: ['Administrator']
  };

  function wireDesignationDropdowns(root) {
    root.querySelectorAll('.role-select').forEach(function (roleSelect) {
      const wrapper = roleSelect.closest('.mini-form') || root;
      const designationSelect = wrapper.querySelector('.designation-select');
      if (!designationSelect) return;

      function refreshDesignations() {
        const selectedRole = roleSelect.value;
        const options = designationOptions[selectedRole] || [];
        designationSelect.innerHTML = '<option value="">Select designation</option>' + options.map(function (option) {
          return '<option value="' + escapeHtml(option) + '">' + escapeHtml(option) + '</option>';
        }).join('');
        designationSelect.disabled = !selectedRole;
        designationSelect.value = '';
      }

      roleSelect.addEventListener('change', refreshDesignations);
      refreshDesignations();
    });
  }

  function renderLookupSection(title, bodyHtml) {
    const existing = panel.querySelector('.lookup-result');
    if (existing) existing.remove();
    panel.insertAdjacentHTML('beforeend', '<div class="section lookup-result"><h3>' + escapeHtml(title) + '</h3>' + bodyHtml + '</div>');
  }

  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    const formData = new FormData(form);
    const staffId = Number(formData.get('staffId'));
    panel.classList.add('loading');
    panel.innerHTML = '<p class="muted">Loading role details...</p>';

    try {
      const response = await fetch('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staffId: staffId })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Login failed');
      renderDetails(data);
    } catch (error) {
      panel.classList.remove('loading');
      panel.classList.add('empty');
      panel.innerHTML = '<div class="result-empty error"><h2>Login failed</h2><p>' + escapeHtml(error.message) + '</p></div>';
    }
  });

  panel.addEventListener('submit', async function (event) {
    const target = event.target;
    if (!target || !target.matches('.mini-form')) return;
    event.preventDefault();

    const action = target.getAttribute('data-action');
    const fields = new FormData(target);
    const activeStaffId = Number(form.querySelector('input[name="staffId"]').value);
    const body = {
      receptionistId: activeStaffId,
      billerId: activeStaffId,
      doctorId: activeStaffId,
      pharmacistId: activeStaffId,
      adminId: activeStaffId
    };

    fields.forEach(function (value, key) {
      body[key] = value;
    });

    try {
      let endpoint = '';
      let method = 'POST';
      if (action === 'add-patient') endpoint = '/patients';
      else if (action === 'book-appointment') endpoint = '/appointments';
      else if (action === 'add-staff') endpoint = '/register';
      else if (action === 'complete-appointment') endpoint = '/appointments/' + encodeURIComponent(body.Appointment_id) + '/complete', method = 'PATCH';
      else if (action === 'prescribe-medicine') endpoint = '/prescriptions';
      else if (action === 'lookup-prescriptions') {
        endpoint = '/pharmacist/prescriptions?pharmacistId=' + encodeURIComponent(activeStaffId) + '&Pat_id=' + encodeURIComponent(body.Pat_id);
        method = 'GET';
      }
      else if (action === 'create-bill') endpoint = '/bills';
      else if (action === 'add-bill-item') endpoint = '/bill-items';
      else if (action === 'update-bill') {
        endpoint = '/bills/' + encodeURIComponent(body.Bill_id);
        method = 'PATCH';
      }
      else if (action === 'lookup-bill') {
        endpoint = '/bills/' + encodeURIComponent(body.Bill_id) + '/details?billerId=' + encodeURIComponent(activeStaffId);
        method = 'GET';
      }
      else if (action === 'assign-work') {
        endpoint = '/staffs/' + encodeURIComponent(body.staff_id) + '/assignment';
        method = 'PATCH';
      }
      else return;

      if (action === 'update-bill' || action === 'lookup-bill' || action === 'lookup-prescriptions' || action === 'complete-appointment') delete body.Bill_id;
      if (action === 'lookup-bill') delete body.staff_id;
      if (action === 'lookup-prescriptions') delete body.staff_id;
      if (action === 'complete-appointment') delete body.staff_id;

      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: method === 'GET' ? undefined : JSON.stringify(body)
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Request failed');

      if (action === 'lookup-prescriptions') {
        renderLookupSection(
          'Prescription Lookup',
          '<div class="kv-grid">' +
          '<div class="kv"><span>Patient</span><strong>' + escapeHtml(result.patient.Pat_name) + ' (ID ' + escapeHtml(result.patient.Pat_id) + ')</strong></div>' +
          '<div class="kv"><span>Total Medicine Cost</span><strong>' + escapeHtml(result.totalMedicineCost) + '</strong></div>' +
          '</div>' +
          renderList(result.prescriptions, function (p) {
            return '<article class="mini-card"><strong>' + escapeHtml(p.Med_name) + '</strong><span>Consultation #' + escapeHtml(p.Consultation_id) + '</span><span>Qty: ' + escapeHtml(p.Quantity) + ' | Dosage: ' + escapeHtml(p.Dosage || 'N/A') + '</span><span>Line Total: ' + escapeHtml(p.lineTotal || 0) + '</span></article>';
          })
        );
      } else if (action === 'lookup-bill') {
        renderLookupSection(
          'Bill Lookup',
          '<div class="kv-grid">' +
          '<div class="kv"><span>Bill ID</span><strong>' + escapeHtml(result.bill.Bill_id) + '</strong></div>' +
          '<div class="kv"><span>Patient</span><strong>' + escapeHtml(result.bill.Pat_name) + ' (ID ' + escapeHtml(result.bill.Pat_id) + ')</strong></div>' +
          '<div class="kv"><span>Total Charges</span><strong>' + escapeHtml(result.bill.Total_charges || 0) + '</strong></div>' +
          '<div class="kv"><span>Net Amount</span><strong>' + escapeHtml(result.bill.Net_amount || 0) + '</strong></div>' +
          '<div class="kv"><span>Item Total</span><strong>' + escapeHtml(result.itemTotal || 0) + '</strong></div>' +
          '<div class="kv"><span>Status</span><strong>' + escapeHtml(result.bill.Status || 'N/A') + '</strong></div>' +
          '</div>' +
          renderList(result.items, function (i) {
            return '<article class="mini-card"><strong>' + escapeHtml(i.Med_name || i.Description || 'Bill Item') + '</strong><span>Qty: ' + escapeHtml(i.Quantity || 0) + '</span><span>Unit: ' + escapeHtml(i.Unit_price || 0) + ' | Amount: ' + escapeHtml(i.Amount || 0) + '</span></article>';
          })
        );
      } else {
        panel.insertAdjacentHTML('afterbegin', '<div class="toast success">Saved successfully</div>');
        form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      }
    } catch (error) {
      panel.insertAdjacentHTML('afterbegin', '<div class="toast error">' + escapeHtml(error.message) + '</div>');
    }
  });
})();