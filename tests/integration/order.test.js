const request = require('supertest');
const express = require('express');
const customersRouter = require('../../src/routes/orders.js');
const db = require('../../src/firebase.js');
const { setupFirebaseTestEnv, teardownFirebaseTestEnv } = require('../firebaseTestEnv.js');

const app = express();
app.use(express.json());
app.use('/orders', customersRouter);

beforeAll(async () => {
    await setupFirebaseTestEnv();
});

afterAll(async () => {
    await teardownFirebaseTestEnv();
});

describe('Orders API', () => {
    let orderId;

    test('Create a new order', async () => {
        const response = await request(app)
            .post('/orders')
            .send({ name: 'Test', email: 'jesuis.untest@exemple.com' });

        expect(response.status).toBe(201);
        expect(response.text).toMatch(/Commande créée avec son ID : /);

        // Extrait l'ID de la Commande pour les futurs tests
        orderId = response.text.split('Commande créé avec son ID : ')[1];
    });

    test('Get all orders', async () => {
        const response = await request(app).get('/orders');
        expect(response.status).toBe(200);
        expect(response.body).toBeInstanceOf(Array);
        expect(response.body.length).toBeGreaterThan(0);
    });

    test('Get order by ID', async () => {
        const response = await request(app).get(`/orders/${orderId}`);
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('id', orderId);
    });

    test('Update an order', async () => {
        const response = await request(app)
            .put(`/orders/${orderId}`)
            .send({ name: 'Test 2', email: 'jesuis.untest2@exemple.com' });

        expect(response.status).toBe(200);
        expect(response.text).toBe('Commande mis à jour');
    });

    test('Delete an order', async () => {
        const response = await request(app).delete(`/orders/${orderId}`);
        expect(response.status).toBe(200);
        expect(response.text).toBe('Commande supprimé');
    });

    // Tests Erreurs 404
    test('Erreur_404_GetOrders', async () => {
        const response = await request(app).get('/orders/test');
        expect(response.status).toBe(404);
        expect(response.text).toBe('Commande non trouvée');
    });

    test('Erreur_404_UpdateOrder', async () => {
        const response = await request(app)
            .put('/orders/test')
            .send({ name: 'ValeurTest' });

        expect(response.status).toBe(404);
        expect(response.text).toMatch(/Commande non trouvée/);
    });

    test('Erreur_404_DeleteOrder', async () => {
        const response = await request(app).delete('/orders/test');
        expect(response.status).toBe(404);
        expect(response.text).toMatch(/Commande non trouvée/);
    });

    // Tests Erreurs 500 à venir
});