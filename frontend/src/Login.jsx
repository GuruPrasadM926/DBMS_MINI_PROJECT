import React, { useState } from 'react';

export default function Login() {
  const [staffId, setStaffId] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setResult(null);
    try {
      const resp = await fetch('http://localhost:4000/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staffId: parseInt(staffId, 10) })
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'login failed');
      setResult(data);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div style={{ maxWidth: 600, margin: '2rem auto', fontFamily: 'sans-serif' }}>
      <h2>MHMS Login (demo)</h2>
      <form onSubmit={submit}>
        <label>Staff ID (numeric)</label>
        <br />
        <input value={staffId} onChange={e => setStaffId(e.target.value)} />
        <br />
        <button type="submit">Login</button>
      </form>

      {error && <div style={{ color: 'red' }}>{error}</div>}

      {result && (
        <div style={{ marginTop: 20 }}>
          <strong>Role:</strong> {result.role} <br />
          <strong>Name:</strong> {result.staff_name} <br />
          {result.patients && (
            <div>
              <h3>My Patients</h3>
              <ul>
                {result.patients.map(p => (
                  <li key={p.Pat_id}>{p.Pat_name} (ID {p.Pat_id})</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
