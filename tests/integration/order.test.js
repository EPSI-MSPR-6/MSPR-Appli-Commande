const request = require('supertest');
const express = require('express');
const ordersRouter = require('../../src/routes/orders.js');
const db = require('../../src/firebase.js');
const { setupFirebaseTestEnv, teardownFirebaseTestEnv } = require('../firebaseTestEnv.js');

const ApiKey = process.env.API_KEY;

const app = express();
app.use(express.json());
app.use('/orders', ordersRouter);

jest.mock('../../src/services/pubsub.js', () => ({
    publishMessage: jest.fn()
}));

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
        const response = await updateOrder(orderId, { status: 'Livrée', price: 100 });
        expect(response.status).toBe(200);
        expect(response.text).toBe('Statut de la commande mis à jour');
    });

    test('Suppression Commande', async () => {
        const response = await deleteOrder(orderId);
        expect(response.status).toBe(200);
        expect(response.text).toBe('Commande supprimée');
    });
});

describe('Tests Pub/Sub', () => {
    test('Pub/Sub - DELETE_CLIENT - Succès', async () => {
        const newOrder = {
            date: '2024-06-08',
            id_produit: 'prod123',
            id_client: 'clientToDelete',
            quantity: 2,
        };
        await createOrder(newOrder);

        const message = {
            message: {
                data: Buffer.from(JSON.stringify({
                    action: 'DELETE_CLIENT',
                    clientId: 'clientToDelete'
                })).toString('base64')
            }
        };

        const response = await request(app)
            .post('/orders/pubsub')
            .send(message);
        expect(response.status).toBe(200);
        expect(response.text).toBe('Les commandes du client clientToDelete ont été supprimées');
    });

    test('Pub/Sub - ORDER_CONFIRMATION - Succès ( undefined price)', async () => {
        const newOrder = {
            date: '2024-06-08',
            id_produit: 'prod123',
            id_client: 'client123',
            quantity: 2,
        };
        const createResponse = await createOrder(newOrder);
        const orderId = createResponse.text.split('Commande créée avec son ID : ')[1];

        const message = {
            message: {
                data: Buffer.from(JSON.stringify({
                    action: 'ORDER_CONFIRMATION',
                    orderId: orderId,
                    price : undefined,
                    status: 'Confirmée'
                })).toString('base64')
            }
        };

        const response = await request(app)
            .post('/orders/pubsub')
            .send(message);
        expect(response.status).toBe(200);
        expect(response.text).toBe(`Statut et prix de la commande ${orderId} mis à jour`);
    });

    test('Pub/Sub - ORDER_CONFIRMATION - Succès ( defined price)', async () => {
        const newOrder = {
            date: '2024-06-15',
            id_produit: 'coffee753',
            id_client: 'client147',
            quantity: 5,
        };
        const createResponse = await createOrder(newOrder);
        const orderId = createResponse.text.split('Commande créée avec son ID : ')[1];

        const message = {
            message: {
                data: Buffer.from(JSON.stringify({
                    action: 'ORDER_CONFIRMATION',
                    orderId: orderId,
                    price : 40,
                    status: 'Confirmée'
                })).toString('base64')
            }
        };

        const response = await request(app)
            .post('/orders/pubsub')
            .send(message);
        expect(response.status).toBe(200);
        expect(response.text).toBe(`Statut et prix de la commande ${orderId} mis à jour`);
    });

    test('Pub/Sub - Action Inconnue', async () => {
        const message = {
            message: {
                data: Buffer.from(JSON.stringify({
                    action: 'UNKNOWN_ACTION'
                })).toString('base64')
            }
        };

        const response = await request(app)
            .post('/orders/pubsub')
            .send(message);
        expect(response.status).toBe(400);
        expect(response.text).toBe('Action non reconnue');
    });

    test('Pub/Sub - Echec ( Format non valide )', async () => {
        const message = {
            message: {}
        };

        const response = await request(app)
            .post('/orders/pubsub')
            .send(message);
        expect(response.status).toBe(400);
        expect(response.text).toBe('Format de message non valide');
    });

    test('Pub/Sub - DELETE_CLIENT - Echec ( Test 500 )', async () => {
        const message = {
            message: {
                data: Buffer.from(JSON.stringify({
                    action: 'DELETE_CLIENT',
                    clientId: 'nonExistentClient'
                })).toString('base64')
            }
        };

        jest.spyOn(db, 'collection').mockImplementationOnce(() => {
            return {
                where: jest.fn().mockReturnThis(),
                get: jest.fn().mockRejectedValue(new Error('Test error'))
            };
        });

        const response = await request(app)
            .post('/orders/pubsub')
            .send(message);
        expect(response.status).toBe(500);
        expect(response.text).toBe('Erreur lors de la suppression des commandes du client nonExistentClient');
    });

    test('Pub/Sub - ORDER_CONFIRMATION - Echec ( Order doesn\'t existe)', async () => {
        const message = {
            message: {
                data: Buffer.from(JSON.stringify({
                    action: 'ORDER_CONFIRMATION',
                    orderId: 'nonExistentOrder',
                    price : 10,
                    status: 'Confirmée'
                })).toString('base64')
            }
        };

        const response = await request(app)
            .post('/orders/pubsub')
            .send(message);
        expect(response.status).toBe(404);
        expect(response.text).toBe(`Commande non trouvée pour l'ID nonExistentOrder`);
    });

    test('Pub/Sub - ORDER_CONFIRMATION - Echec ( Test 500 ) ', async () => {
        const newOrder = {
            date: '2024-06-08',
            id_produit: 'coffee578',
            id_client: 'client869',
            quantity: 4,
        };
        const createResponse = await createOrder(newOrder);
        const orderId = createResponse.text.split('Commande créée avec son ID : ')[1];

        const message = {
            message: {
                data: Buffer.from(JSON.stringify({
                    action: 'ORDER_CONFIRMATION',
                    orderId: orderId,
                    price : 25,
                    status: 'Confirmée'
                })).toString('base64')
            }
        };

        jest.spyOn(db, 'collection').mockImplementationOnce(() => {
            return {
                doc: jest.fn().mockReturnThis(),
                get: jest.fn().mockRejectedValue(new Error('Test error'))
            };
        });

        const response = await request(app)
            .post('/orders/pubsub')
            .send(message);
        expect(response.status).toBe(500);
        expect(response.text).toBe(`Erreur lors de la mise à jour de la commande ${orderId}`);
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
        }; // Date Manquante

        await testCreateOrderError(invalidOrder, 'Tous les champs date, id_produit, id_client, quantity sont obligatoires.');
    });

    test('Erreur_400_CreateOrder_PriceParams', async () => {
        const invalidOrderWithPrice = {
            date: '2024-06-10',
            id_produit: 'cappu593',
            id_client: 'client121',
            quantity: 5,
            price: 100
        };

        await testCreateOrderError(invalidOrderWithPrice, 'Le champ price ne doit pas être envoyé.');
    });

    test('Erreur_400_CreateOrder_InvalidQuantity', async () => {
        const invalidOrder = {
            date: '2024-06-11',
            id_produit: 'latte751',
            id_client: 'client753',
            quantity: 'trois',
        };

        await testCreateOrderError(invalidOrder, 'Le champ quantity doit être un nombre positif.');
    });

    test('Erreur_400_CreateOrder_InvalidDate', async () => {
        const invalidOrder = {
            date: '06-06-2024',
            id_produit: 'mouse789',
            id_client: 'client789',
            quantity: 10,
        };

        await testCreateOrderError(invalidOrder, 'Le champ date doit être une date valide au format YYYY-MM-DD.');
    });

    test('Erreur_400_CreateOrder_InvalidIdProduit', async () => {
        const invalidOrder = {
            date: '2024-06-10',
            id_produit: '<script>alert("XSS")</script>',
            id_client: 'client1011',
            quantity: 20,
        };

        await testCreateOrderError(invalidOrder, 'Les champs id_produit et id_client doivent contenir uniquement des lettres et des chiffres.');
    });

    test('Erreur_400_CreateOrder_InvalidIdClient', async () => {
        const invalidOrder = {
            date: '2024-06-12',
            id_produit: 'cpu753',
            id_client: 'client1011; DROP TABLE users;',
            quantity: 4,
        };

        await testCreateOrderError(invalidOrder, 'Les champs id_produit et id_client doivent contenir uniquement des lettres et des chiffres.');
    });

    test('Erreur_400_UpdateOrder_InvalidParams', async () => {
        const response = await updateOrder('test', { id_produit: 12345679 });

        expect(response.status).toBe(400);
        expect(response.text).toBe('Seuls les champs status et price peuvent être mis à jour.');
    });
});

describe('Tests500', () => {
    beforeEach(() => {
        jest.spyOn(db, 'collection').mockImplementation(() => {
            throw new Error('Test error');
        });
    });

    test('Erreur_500_CreateOrder', async () => {
        const response = await createOrder({
            date: '2024-06-08',
            id_produit: 'prod123',
            id_client: 'client123',
            quantity: 2,
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
