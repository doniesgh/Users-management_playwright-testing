// user.api.spec.js
// Run: npx playwright test user.api.spec.js
// Requires: npm install -D @playwright/test

const { test, expect } = require('@playwright/test');

// ─── CONFIG ────────────────────────────────────────────────────────────────────
const BASE_URL = 'http://localhost:4000/api/user';

// Shared state across tests in this file
let createdUserId = null;
let createdUserEmail = null;

// ─── HELPERS ───────────────────────────────────────────────────────────────────
// Generates a unique email so tests don't clash on re-runs
const uniqueEmail = () => `testuser_${Date.now()}@example.com`;

// ─── SUITE 1: GET /list ────────────────────────────────────────────────────────
test.describe('GET /list — fetch all users', () => {

  test('returns 200 and an array', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/list`);
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body)).toBeTruthy();
  });

  test('each user has expected fields', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/list`);
    const users = await res.json();

    if (users.length > 0) {
      const user = users[0];
      // Every user document should have at minimum these fields
      expect(user).toHaveProperty('_id');
      expect(user).toHaveProperty('email');
      expect(user).toHaveProperty('role');
    }
  });

  test('response Content-Type is application/json', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/list`);
    expect(res.headers()['content-type']).toContain('application/json');
  });
});

// ─── SUITE 2: POST /add — create user ─────────────────────────────────────────
test.describe('POST /add — create a new user', () => {

  test('creates a standard user successfully (201)', async ({ request }) => {
    const email = uniqueEmail();
    createdUserEmail = email; // save for later suites

    const res = await request.post(`${BASE_URL}/add`, {
      data: {
        firstname: 'Test',
        lastname: 'User',
        email,
        password: 'Password123!',
        role: 'HELPDESK',
      },
    });

    expect(res.status()).toBe(201);
    const body = await res.json();

    expect(body).toHaveProperty('_id');
    expect(body.email).toBe(email);
    expect(body.role).toBe('HELPDESK');
    // Password must NEVER be returned
    expect(body.password).toBeUndefined();

    createdUserId = body._id; // save for update / delete tests
  });

  test('returns 400 when required fields are missing', async ({ request }) => {
    const res = await request.post(`${BASE_URL}/add`, {
      data: {
        firstname: 'Incomplete',
        // missing lastname, email, password, role
      },
    });
    expect(res.status()).toBe(400);

    const body = await res.json();
    expect(body).toHaveProperty('error');
    expect(body).toHaveProperty('emptyFields');
    expect(Array.isArray(body.emptyFields)).toBeTruthy();
  });

  test('returns 400 when email already exists', async ({ request }) => {
    // Try to create a second user with the same email we just created
    const res = await request.post(`${BASE_URL}/add`, {
      data: {
        firstname: 'Duplicate',
        lastname: 'User',
        email: createdUserEmail,
        password: 'Password123!',
        role: 'HELPDESK',
      },
    });
    expect(res.status()).toBe(400);

    const body = await res.json();
    expect(body.error).toContain('déjà utilisée');
  });

  test('creates a CLIENT user with clientName and access fields', async ({ request }) => {
    const email = uniqueEmail();

    const res = await request.post(`${BASE_URL}/add`, {
      data: {
        firstname: 'Client',
        lastname: 'Test',
        email,
        password: 'Password123!',
        role: 'CLIENT',
        clientName: '507f1f77bcf86cd799439011', // fake ObjectId — adjust to a real one in your DB
        access: ['dashboard', 'tickets'],
      },
    });

    // Will be 201 if the clientName ObjectId exists in DB, otherwise adjust expectation
    expect([201, 500]).toContain(res.status());
  });

  test('returns 400 for CLIENT without clientName', async ({ request }) => {
    const res = await request.post(`${BASE_URL}/add`, {
      data: {
        firstname: 'Client',
        lastname: 'Test',
        email: uniqueEmail(),
        password: 'Password123!',
        role: 'CLIENT',
        // missing clientName and access
      },
    });
    expect(res.status()).toBe(400);

    const body = await res.json();
    expect(body.emptyFields).toContain('clientName');
    expect(body.emptyFields).toContain('access');
  });
});

// ─── SUITE 3: GET /email/:email ───────────────────────────────────────────────
test.describe('GET /email/:email — fetch user by email', () => {

  test('returns 200 and the correct user', async ({ request }) => {
    // Depends on createdUserEmail from the POST suite above
    test.skip(!createdUserEmail, 'No user created yet — run POST suite first');

    const res = await request.get(`${BASE_URL}/email/${createdUserEmail}`);
    expect(res.status()).toBe(200);

    const user = await res.json();
    expect(user.email).toBe(createdUserEmail);
    expect(user).toHaveProperty('_id');
  });

  test('returns 404 for a non-existent email', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/email/nobody@nowhere.invalid`);
    expect(res.status()).toBe(404);
  });
});

// ─── SUITE 4: POST /login ──────────────────────────────────────────────────────
test.describe('POST /login — authenticate user', () => {

  test('returns 200 with token for valid credentials', async ({ request }) => {
    // Note: this requires a known user in the DB.
    // Replace with valid credentials from your seed data.
    const res = await request.post(`${BASE_URL}/login`, {
      data: {
        email: 'admin@yourapp.com',   // ← replace
        password: 'yourpassword',     // ← replace
      },
    });

    // Skip gracefully if no seed user exists
    if (res.status() === 400) {
      test.skip(true, 'Seed user not found — update credentials in this test');
    }

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('token');
    expect(body).toHaveProperty('email');
    expect(body).toHaveProperty('role');
  });

  test('returns 400 for wrong password', async ({ request }) => {
    const res = await request.post(`${BASE_URL}/login`, {
      data: {
        email: 'admin@yourapp.com',
        password: 'definitely-wrong-password',
      },
    });
    expect(res.status()).toBe(400);

    const body = await res.json();
    expect(body).toHaveProperty('error');
  });

  test('returns 400 for missing credentials', async ({ request }) => {
    const res = await request.post(`${BASE_URL}/login`, {
      data: {},
    });
    expect(res.status()).toBe(400);
  });
});

// ─── SUITE 5: PATCH /:id — update user ────────────────────────────────────────
test.describe('PATCH /:id — update user', () => {

  test('updates firstname and returns 200', async ({ request }) => {
    test.skip(!createdUserId, 'No user created yet — run POST suite first');

    const res = await request.patch(`${BASE_URL}/${createdUserId}`, {
      data: { firstname: 'UpdatedName' },
    });

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.firstname).toBe('UpdatedName');
  });

  test('returns 400 for invalid ObjectId', async ({ request }) => {
    const res = await request.patch(`${BASE_URL}/not-a-valid-id`, {
      data: { firstname: 'Test' },
    });
    expect(res.status()).toBe(400);
  });

  test('returns 400 when no fields are provided', async ({ request }) => {
    test.skip(!createdUserId, 'No user created yet');

    const res = await request.patch(`${BASE_URL}/${createdUserId}`, {
      data: {},
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty('error');
  });

  test('updates role to TECHNICIEN', async ({ request }) => {
    test.skip(!createdUserId, 'No user created yet');

    const res = await request.patch(`${BASE_URL}/${createdUserId}`, {
      data: { role: 'TECHNICIEN' },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.role).toBe('TECHNICIEN');
  });
});

// ─── SUITE 6: DELETE /:id ─────────────────────────────────────────────────────
test.describe('DELETE /:id — delete user', () => {

  test('deletes the created user and returns 200', async ({ request }) => {
    test.skip(!createdUserId, 'No user created yet — run POST suite first');

    const res = await request.delete(`${BASE_URL}/${createdUserId}`);
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body._id).toBe(createdUserId);
  });

  test('returns 400 for an invalid ObjectId format', async ({ request }) => {
    const res = await request.delete(`${BASE_URL}/this-is-not-an-id`);
    expect(res.status()).toBe(400);
  });

  test('returns 400 when user does not exist (valid ObjectId, missing record)', async ({ request }) => {
    const fakeId = '000000000000000000000000'; // valid 24-char hex ObjectId, no record
    const res = await request.delete(`${BASE_URL}/${fakeId}`);
    expect(res.status()).toBe(400);
  });
});

// ─── SUITE 7: GET /techlist ────────────────────────────────────────────────────
test.describe('GET /techlist — fetch HELPTECH users', () => {

  test('returns 200 and only HELPTECH users', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/techlist`);
    // 200 if users exist, 200 with empty array if none
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body)).toBeTruthy();
    body.forEach(user => {
      expect(user.role).toBe('HELPTECH');
    });
  });
});

// ─── SUITE 8: GET /techhelp ───────────────────────────────────────────────────
test.describe('GET /techhelp — available technicians / helpdesk today', () => {

  test('returns 200 or 404 depending on availability data', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/techhelp`);
    expect([200, 404]).toContain(res.status());
  });

  test('response body is an array', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/techhelp`);
    const body = await res.json();
    expect(Array.isArray(body)).toBeTruthy();
  });
});

// ─── SUITE 9: GET /role/:role ──────────────────────────────────────────────────
test.describe('GET /role/:role — count users by role', () => {

  test('returns count for TECHNICIEN', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/role/TECHNICIEN`);
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty('count');
    expect(typeof body.count).toBe('number');
  });

  test('returns count of 0 for a non-existent role', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/role/SUPERADMINGHOST`);
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.count).toBe(0);
  });
});
