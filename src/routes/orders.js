const express = require('express');
const router = express.Router();
const db = require('../firebase');
const { checkApiKey, validateOrder } = require('../services/middlewares');
const { publishMessage } = require('../services/pubsub.js');

// Récupération de la liste de commandes
router.get('/', checkApiKey, async (req, res) => {
    try {
        const ordersSnapshot = await db.collection('orders').get();
        const orders = ordersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.status(200).json(orders);
    } catch (error) {
        res.status(500).send('Erreur lors de la récupération des commandes : ' + error.message);
    }
});

// Récupération d'une commande via son ID
router.get('/:id', async (req, res) => {
    try {
        const ordersDoc = await db.collection('orders').doc(req.params.id).get();
        if (!ordersDoc.exists) {
            res.status(404).send('Commande non trouvée');
        } else {
            res.status(200).json({ id: ordersDoc.id, ...ordersDoc.data() });
        }
    } catch (error) {
        res.status(500).send('Erreur lors de la récupération de la commande par ID : ' + error.message);
    }
});

// Création d'une commande
router.post('/', validateOrder, async (req, res) => {
    try {
        const newOrder = req.body;
        const docRef = await db.collection('orders').add(newOrder);

        // Publier un message Pub/Sub après la création de la commande
        await publishMessage('order-actions', {
            action: 'CREATE_ORDER',
            orderId: docRef.id,
            quantity: newOrder.quantity,
            productId: newOrder.id_produit,
            message: 'Create order'
        });

        res.status(201).send('Commande créée avec son ID : ' + docRef.id);
    } catch (error) {
        res.status(500).send('Erreur lors de la création de la commande : ' + error.message);
    }
});

// Mise à jour du statut d'une commande
router.put('/:id', checkApiKey, async (req, res) => {
    try {
        const { status, price } = req.body;
        if (status === undefined && price === undefined) {
            return res.status(400).send('Seuls les champs status et price peuvent être mis à jour.');
        }
        const OrderDoc = await db.collection('orders').doc(req.params.id).get();
        if (!OrderDoc.exists) {
            res.status(404).send('Commande non trouvée');
        } else {
            await db.collection('orders').doc(req.params.id).update({ status, price });
            res.status(200).send('Statut de la commande mis à jour');
        }
    } catch (error) {
        res.status(500).send('Erreur lors de la mise à jour de la commande : ' + error.message);
    }
});

// Suppression d'une commande via son ID
router.delete('/:id', checkApiKey, async (req, res) => {
    try {
        const OrderDoc = await db.collection('orders').doc(req.params.id).get();
        if (!OrderDoc.exists) {
            res.status(404).send('Commande non trouvée');
        } else {
            await db.collection('orders').doc(req.params.id).delete();
            res.status(200).send('Commande supprimée');
        }
    } catch (error) {
        res.status(500).send('Erreur lors de la suppression de la commande : ' + error.message);
    }
});

// Endpoint Pub/Sub
router.post('/pubsub', async (req, res) => {
    const message = req.body.message;

    if (!message || !message.data) {
        return res.status(400).send('Format de message non valide');
    }

    const data = Buffer.from(message.data, 'base64').toString();
    const parsedData = JSON.parse(data);

    if (parsedData.action === 'DELETE_CLIENT') {
        const clientId = parsedData.clientId;
        await deleteOrdersForClient(clientId, res);
    } else if (parsedData.action === 'ORDER_CONFIRMATION') {
        const { orderId, price, status } = parsedData;
        await updateOrderStatus(orderId, price, status, res);
    } else {
        res.status(400).send('Action non reconnue');
    }
});

async function deleteOrdersForClient(clientId, res) {
    try {
        const ordersSnapshot = await db.collection('orders').where('id_client', '==', clientId).get();
        const batch = db.batch();

        ordersSnapshot.forEach(doc => {
            batch.delete(doc.ref);
        });

        await batch.commit();
        res.status(200).send(`Les commandes du client ${clientId} ont été supprimées`);
    } catch (error) {
        res.status(500).send(`Erreur lors de la suppression des commandes du client ${clientId}`);
    }
}

async function updateOrderStatus(orderId, price, status, res) {
    try {
        const orderRef = db.collection('orders').doc(orderId);
        const orderDoc = await orderRef.get();
        if (!orderDoc.exists) {
            res.status(404).send(`Commande non trouvée pour l'ID ${orderId}`);
            return;
        }
        const updates = {};
        if (price !== undefined) {
            updates.price = price;
        }else{
            updates.price = 0   
        }
        updates.status = status;
        
        await orderRef.update(updates);
        res.status(200).send(`Statut et prix de la commande ${orderId} mis à jour`);
    } catch (error) {
        res.status(500).send(`Erreur lors de la mise à jour de la commande ${orderId}`);
    }
}

module.exports = router;
