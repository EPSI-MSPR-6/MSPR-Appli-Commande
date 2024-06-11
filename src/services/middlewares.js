// src/services/middlewares.js
const idRegex = /^[a-zA-Z0-9\s'-]+$/;
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

const checkApiKey = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    if (apiKey && apiKey === process.env.API_KEY) {
        next();
    } else {
        res.status(403).json({ message: 'Forbidden: Invalid API Key' });
    }
};

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

    req.body.status = "En attente de confirmation";
    next();
};

module.exports = { checkApiKey, validateOrder };
