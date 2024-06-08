const request = require('supertest');
const express = require('express');
const ordersRouter = require('../../src/routes/orders.js');
const db = require('../../src/firebase.js');
const { setupFirebaseTestEnv, teardownFirebaseTestEnv } = require('../firebaseTestEnv.js');

const app = express();
app.use(express.json());
app.use('/orders', ordersRouter);

beforeAll(async () => {
    await setupFirebaseTestEnv();
});

afterAll(async () => {
    await teardownFirebaseTestEnv();
});

describe('Orders API', () => {
    let orderId;

    test('Create a new order', async () => {
        const newOrder = {
            date: '2024-06-08',
            id_produit: 'prod123',
            id_client: 'client123',
            quantity: 2,
            price: 29.99
        };

        const response = await request(app)
            .post('/orders')
            .send(newOrder);

        expect(response.status).toBe(201);
        expect(response.text).toMatch(/Commande créée avec son ID : /);

        // Extrait l'ID de la Commande pour les futurs tests
        orderId = response.text.split('Commande créée avec son ID : ')[1];
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

    test('Update an order status', async () => {
        const response = await request(app)
            .put(`/orders/${orderId}`)
            .send({ status: 'Livré' });

        expect(response.status).toBe(200);
        expect(response.text).toBe('Statut de la commande mis à jour');
    });

    test('Delete an order', async () => {
        const response = await request(app).delete(`/orders/${orderId}`);
        expect(response.status).toBe(200);
        expect(response.text).toBe('Commande supprimée');
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
            .send({ status: 'ValeurTest' });

        expect(response.status).toBe(404);
        expect(response.text).toMatch(/Commande non trouvée/);
    });

    test('Erreur_404_DeleteOrder', async () => {
        const response = await request(app).delete('/orders/test');
        expect(response.status).toBe(404);
        expect(response.text).toMatch(/Commande non trouvée/);
    });

    // Tests Erreurs 400
    test('Erreur_400_CreateOrder_Request', async () => {
        const invalidOrder = {
            id_produit: 'prod123',
            id_client: 'client123',
            quantity: 2,
            price: 29.99
        }; // Missing 'date'

        const response = await request(app)
            .post('/orders')
            .send(invalidOrder);

        expect(response.status).toBe(400);
        expect(response.text).toBe('Tous les champs date, id_produit, id_client, quantity et price sont obligatoires.');
    });

    test('Erreur_400_CreateOrder_Type', async () => {
        const invalidOrder = {
            date: '2024-06-08',
            id_produit: 'prod123',
            id_client: 'client123',
            quantity: 'deux', 
            price: 29.99
        };

        const response = await request(app)
            .post('/orders')
            .send(invalidOrder);

        expect(response.status).toBe(400);
        expect(response.text).toBe('Les types de champs sont incorrects.');
    });
    test('Erreur_400_UpdateOrder', async () => {
        const response = await request(app)
            .put(`/orders/${orderId}`)
            .send({ name: 'Test 2' });

        expect(response.status).toBe(400);
        expect(response.text).toBe('Seul le champ status peut être mis à jour.');
    });

    // Tests Erreurs 500
    describe('Erreur 500', () => {
        test('Erreur_500_GetOrders', async () => {
            db.collection = function() { throw new Error() }
            const response = await request(app).get('/orders');
            expect(response.status).toBe(500);
            expect(response.text).toMatch(/Erreur lors de la récupération des commandes : /);
        });

        test('Erreur_500_GetOrderByID', async () => {
            db.collection = function() { throw new Error() }
            const response = await request(app).get(`/orders/test`);
            expect(response.status).toBe(500);
            expect(response.text).toMatch(/Erreur lors de la récupération de la commande par ID : /);
        });

        test('Erreur_500_CreateOrder', async () => {
            db.collection = function() { throw new Error() }
            const response = await request(app)
                .post('/orders')
                .send({
                    date: '2024-06-08',
                    id_produit: 'prod123',
                    id_client: 'client123',
                    quantity: 2,
                    price: 29.99
                });

            expect(response.status).toBe(500);
            expect(response.text).toMatch(/Erreur lors de la création de la commande : /);
        });

        test('Erreur_500_UpdateOrder', async () => {
            db.collection = function() { throw new Error() }
            const response = await request(app)
                .put('/orders/test')
                .send({ status: 'ValeurTest' });

            expect(response.status).toBe(500);
            expect(response.text).toMatch(/Erreur lors de la mise à jour de la commande : /);
        });

        test('Erreur_500_DeleteOrder', async () => {
            db.collection = function() { throw new Error() }
            const response = await request(app).delete('/orders/test');
            expect(response.status).toBe(500);
            expect(response.text).toMatch(/Erreur lors de la suppression de la commande : /);
        });
    });
});
