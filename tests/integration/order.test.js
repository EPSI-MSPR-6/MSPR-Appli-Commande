const request = require('supertest');
const express = require('express');
const ordersRouter = require('../../src/routes/orders.js');
const db = require('../../src/firebase.js');
const { setupFirebaseTestEnv, teardownFirebaseTestEnv } = require('../firebaseTestEnv.js');


const ApiKey = process.env.API_KEY;

const app = express();
app.use(express.json());
app.use('/orders', ordersRouter);

beforeAll(async () => {
    await setupFirebaseTestEnv();
});

afterAll(async () => {
    await teardownFirebaseTestEnv();
});

const getOrdersWithApiKey = async (apiKey = ApiKey) => {
    return await request(app)
        .get('/orders')
        .set('x-api-key', apiKey);
};

const createOrder = async (orderData) => {
    return await request(app)
        .post('/orders')
        .send(orderData);
};

const updateOrder = async (id, orderData) => {
    return await request(app)
        .put(`/orders/${id}`)
        .set('x-api-key', ApiKey)
        .send(orderData);
};

const deleteOrder = async (id) => {
    return await request(app)
        .delete(`/orders/${id}`)
        .set('x-api-key', ApiKey);
};

describe('Orders API', () => {
    let orderId;
    
    test('Création Commande', async () => {
        const newOrder = {
            date: '2024-06-08',
            id_produit: 'prod123',
            id_client: 'client123',
            quantity: 2,
            price: 29.99
        };
        const response = await createOrder(newOrder);

        expect(response.status).toBe(201);
        expect(response.text).toMatch(/Commande créée avec son ID : /);

        // Extrait l'ID de la Commande pour les futurs tests
        orderId = response.text.split('Commande créée avec son ID : ')[1];
    });

    test('Récupération des commandes', async () => {
        const response = await getOrdersWithApiKey();
        expect(response.status).toBe(200);
        expect(response.body).toBeInstanceOf(Array);
        expect(response.body.length).toBeGreaterThan(0);
    });

    test('Récupération Commande via ID Commande', async () => {
        const response = await request(app).get(`/orders/${orderId}`);
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('id', orderId);
    });

    test('Mis à jour Commande', async () => {
        const response = await updateOrder(orderId, { status: 'Livrée' });
        expect(response.status).toBe(200);
        expect(response.text).toBe('Statut de la commande mis à jour');
    });

    test('Suppression Commande', async () => {
        const response = await deleteOrder(orderId);
        expect(response.status).toBe(200);
        expect(response.text).toBe('Commande supprimée');
    });
});

describe('Tests403', () => {
    test('Erreur_403_GetOrders', async () => {
        const invalidApiKey = 'invalid-api-key';
        const response = await getOrdersWithApiKey(invalidApiKey);
        expect(response.status).toBe(403);
        expect(response.body).toHaveProperty('message', 'Forbidden: Invalid API Key');
    });
});

describe('Tests404', () => {
    const invalidOrderId = 'test';

    test('Erreur_404_GetOrderByID', async () => {
        const response = await request(app).get(`/orders/${invalidOrderId}`);
        expect(response.status).toBe(404);
        expect(response.text).toBe('Commande non trouvée');
    });

    test('Erreur_404_UpdateOrder', async () => {
        const response = await updateOrder(invalidOrderId, { status: 'Livrée' });
        expect(response.status).toBe(404);
        expect(response.text).toMatch(/Commande non trouvée/);
    });

    test('Erreur_404_DeleteOrder', async () => {
        const response = await deleteOrder(invalidOrderId);
        expect(response.status).toBe(404);
        expect(response.text).toMatch(/Commande non trouvée/);
    });
});

// Middleware pour les tests d'erreurs 400
const testCreateOrderError = async (invalidOrder, expectedError) => {
    const response = await createOrder(invalidOrder);
    expect(response.status).toBe(400);
    expect(response.text).toBe(expectedError);
};

describe('Tests400', () => {
    test('Erreur_400_CreateOrder_MissParams', async () => {
        const invalidOrder = {
            id_produit: 'prod123',
            id_client: 'client123',
            quantity: 2,
            price: 29.99
        }; // Date Manquante

        await testCreateOrderError(invalidOrder, 'Tous les champs date, id_produit, id_client, quantity et price sont obligatoires.');
    });

    test('Erreur_400_CreateOrder_InvalidQuantity', async () => {
        const invalidOrder = {
            date: '2024-06-09',
            id_produit: 'key456',
            id_client: 'client456',
            quantity: 'trois',
            price: 49.99
        };

        await testCreateOrderError(invalidOrder, 'Le champ quantity doit être un nombre positif.');
    });

    test('Erreur_400_CreateOrder_InvalidPrice', async () => {
        const invalidOrder = {
            date: '2024-07-10',
            id_produit: 'laptop157',
            id_client: 'a1b2c3d4e5',
            quantity: 10,
            price: 'neuf euros quatre-vingt-dix neuf'
        };

        await testCreateOrderError(invalidOrder, 'Le champ price doit être un nombre positif.');
    });

    test('Erreur_400_CreateOrder_InvalidDate', async () => {
        const invalidOrder = {
            date: '06-06-2024',
            id_produit: 'mouse789',
            id_client: 'client789',
            quantity: 10,
            price: 9.99
        };

        await testCreateOrderError(invalidOrder, 'Le champ date doit être une date valide au format YYYY-MM-DD.');
    });

    test('Erreur_400_CreateOrder_InvalidIdProduit', async () => {
        const invalidOrder = {
            date: '2024-06-10',
            id_produit: '<script>alert("XSS")</script>',
            id_client: 'client1011',
            quantity: 20,
            price: 49.99
        };

        await testCreateOrderError(invalidOrder, 'Les champs id_produit et id_client doivent contenir uniquement des lettres et des chiffres.');
    });

    test('Erreur_400_CreateOrder_InvalidIdClient', async () => {
        const invalidOrder = {
            date: '2024-06-12',
            id_produit: 'cpu753',
            id_client: 'client1011; DROP TABLE users;',
            quantity: 4,
            price: 19.99
        };

        await testCreateOrderError(invalidOrder, 'Les champs id_produit et id_client doivent contenir uniquement des lettres et des chiffres.');
    });

    test('Erreur_400_UpdateOrder_InvalidParams', async () => {
        const response = await updateOrder('test', { price: 500.00 });

        expect(response.status).toBe(400);
        expect(response.text).toBe('Seul le champ status peut être mis à jour.');
    });
});

describe('Tests500', () => {
    beforeEach(() => {
        db.collection = jest.fn(() => {
            throw new Error();
        });
    });

    test('Erreur_500_CreateOrder', async () => {
        const response = await createOrder({
            date: '2024-06-08',
            id_produit: 'prod123',
            id_client: 'client123',
            quantity: 2,
            price: 29.99
        });

        expect(response.status).toBe(500);
        expect(response.text).toMatch(/Erreur lors de la création de la commande : /);
    });
    
    test('Erreur_500_GetOrders', async () => {
        const response = await getOrdersWithApiKey();
        expect(response.status).toBe(500);
        expect(response.text).toMatch(/Erreur lors de la récupération des commandes : /);
    });

    test('Erreur_500_GetOrderByID', async () => {
        const response = await request(app).get(`/orders/test`);
        expect(response.status).toBe(500);
        expect(response.text).toMatch(/Erreur lors de la récupération de la commande par ID : /);
    });

    test('Erreur_500_UpdateOrder', async () => {
        const response = await updateOrder('test', { status: 'Livrée' });
        expect(response.status).toBe(500);
        expect(response.text).toMatch(/Erreur lors de la mise à jour de la commande : /);
    });

    test('Erreur_500_DeleteOrder', async () => {
        const response = await deleteOrder('test');
        expect(response.status).toBe(500);
        expect(response.text).toMatch(/Erreur lors de la suppression de la commande : /);
    });
});
