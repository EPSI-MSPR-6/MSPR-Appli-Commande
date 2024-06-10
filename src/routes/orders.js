const express = require('express');
const router = express.Router();
const db = require('../firebase');
const { checkApiKey, validateOrder } = require('../services/middlewares');

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
        res.status(201).send('Commande créée avec son ID : ' + docRef.id);
    } catch (error) {
        res.status(500).send('Erreur lors de la création de la commande : ' + error.message);
    }
});

// Mise à jour du statut d'une commande
router.put('/:id', checkApiKey, async (req, res) => {
    try {
        const { status } = req.body;
        if (!status) {
            return res.status(400).send('Seul le champ status peut être mis à jour.');
        }
        const OrderDoc = await db.collection('orders').doc(req.params.id).get();
        if (!OrderDoc.exists) {
            res.status(404).send('Commande non trouvée');
        } else {
            await db.collection('orders').doc(req.params.id).update({ status });
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

module.exports = router;
