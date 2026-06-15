import { test, expect } from '@playwright/test';

test('APi get Request', async ({ request }) => {
    const response = await request.get('http://localhost:8000/api/user/list')

    expect(response.status()).toBe(200)
    const text = await response.text();
    expect(text).toContain('test')
    console.log(await response.json());
    const data = await response.json();

    expect(Array.isArray(data)).toBeTruthy();
    expect(data.length).toBeGreaterThan(0);


})
test('Get helpdesk list', async ({ request }) => {
    const response = await request.get('http://localhost:8000/api/user/techlist');

    expect(response.status()).toBe(200);

    const data = await response.json();
    console.log(data);

    // Assert only 1 user is returned
    expect(Array.isArray(data)).toBeTruthy();
});
test('APi delete user successfully ', async ({ request }) => {
    const response = await request.delete('http://localhost:8000/api/user/67ece430ab12130c7a2765fb')
    expect(response.status()).toBe(200)
    console.log(await response.json())
})
test('APi delete user not found ', async ({ request }) => {
    const response = await request.delete('http://localhost:8000/api/user/6564b2f669a0f0354b8465fc')
    expect(response.status()).toBe(400)
    console.log(await response.json())
})
test('Update user data', async ({ request }) => {
    const response = await request.patch('http://localhost:8000/api/user/6728a20d658392636ed94798', {
        data: {
            "firstname": "donia"
        }

    })
    expect(response.status()).toBe(200)
    const text = await response.text();
    console.log(await response.json())
})
test('APi Post Request', async ({ request }) => {
    const response = await request.post('http://localhost:8000/api/user/add', {
        data: {
            firstname: "test",
            lastname: "leader",
            email: "test@gmail.com",
            password: "test123",
            role: "MANAGER"
        }
    });

    const body = await response.text();
    console.log('STATUS:', response.status());
    console.log('BODY:', body);
    expect(response.status()).toBe(200);
});





