const express = require('express');
const router = express.Router();
const db = require('../firebase');

// REGEX pour valider les champs
const idRegex = /^[a-zA-Z0-9\s'-]+$/;
const dateRegex = /^\d{4}-\d{2}-\d{2}$/; 

// Middleware pour valider les champs de la commande
const validateOrder = (req, res, next) => {
    const { date, id_produit, id_client, quantity, price } = req.body;

    if (!date || !id_produit || !id_client || !quantity || !price) {
        return res.status(400).send('Tous les champs date, id_produit, id_client, quantity et price sont obligatoires.');
    }

    if (!dateRegex.test(date)) {
        return res.status(400).send('Le champ date doit être une date valide au format YYYY-MM-DD.');
    }
    if (!idRegex.test(id_produit) || !idRegex.test(id_client)) {
        return res.status(400).send('Les champs id_produit et id_client doivent contenir uniquement des lettres et des chiffres.');
    }
    if (typeof quantity !== 'number' || quantity <= 0) {
        return res.status(400).send('Le champ quantity doit être un nombre positif.');
    }
    if (typeof price !== 'number' || price <= 0) {
        return res.status(400).send('Le champ price doit être un nombre positif.');
    }

    req.body.status = "En cours";
    next();
};

// Récupération de la liste de commandes 
router.get('/', async (req, res) => {
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
router.put('/:id', async (req, res) => {
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
router.delete('/:id', async (req, res) => {
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
