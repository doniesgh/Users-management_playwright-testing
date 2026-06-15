import { test, expect } from '@playwright/test';

test('APi get Request', async ({ request }) => {
    const response = await request.get('http://localhost:8000/api/user/list')

    expect(response.status()).toBe(200)
    const text = await response.text();
    expect(text).toContain('Donia')
    console.log(await response.json());


})
test('Get helpdesk list', async ({ request }) => {
    const response = await request.get('http://localhost:8000/api/user/techlist');

    expect(response.status()).toBe(200);

    const data = await response.json();
    console.log(data);

    // Assert only 1 user is returned
    expect(data).toHaveLength(1);
});
test('APi delete user successfully ', async ({ request }) => {
    const response = await request.delete('http://localhost:8000/api/user/67500a0a0232cf64724dba14')
    expect(response.status()).toBe(200)
    console.log(await response.json())
})
// test('APi delete user not found ', async ({ request }) => {
//     const response = await request.delete('http://localhost:8000/api/user/6564b2f669a0f0354b8465fc')
//     expect(response.status()).toBe(400)
//     console.log(await response.json())
// })
test('Update user data', async ({ request }) => {
    const response = await request.patch('http://localhost:8000/api/user/67500a0a0232cf64724dba14', {
        data: {
            "firstname": "sabsouba"
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





