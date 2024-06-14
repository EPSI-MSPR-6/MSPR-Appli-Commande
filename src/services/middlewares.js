const idRegex = /^[a-zA-Z0-9\s'-]+$/;
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
const create_allowedFields = ['date', 'id_produit', 'id_client', 'quantity'];
const update_allowedFields = ['status', 'price'];

// Vérification API key en header
const checkApiKey = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    if (apiKey && apiKey === process.env.API_KEY) {
        next();
    } else {
        res.status(403).json({ message: 'Forbidden: Invalid API Key' });
    }
};

// Vérification unputs entrants Création Commande
const validateOrder = (req, res, next) => {
    const { date, id_produit, id_client, quantity, price } = req.body;

    const unwantedFields = Object.keys(req.body).filter(key => !create_allowedFields.includes(key));
    if (unwantedFields.length > 0) {
        return res.status(400).send(`Les champs suivants ne sont pas autorisés : ${unwantedFields.join(', ')}`);
    }

    if (!date || !id_produit || !id_client || !quantity) {
        return res.status(400).send('Tous les champs date, id_produit, id_client, quantity sont obligatoires.');
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
    req.body.status = "En attente de confirmation";
    next();
};

// Vérification inputs entrants mis à jour Commande
const validateUpdateOrder = (req, res, next) => {
    const { id, status, price } = req.body;

    if (id && id !== req.params.id) {
        return res.status(400).send("L'ID de la commande ne peut pas être modifié.");
    }
    
    const unwantedFields = Object.keys(req.body).filter(key => !update_allowedFields.includes(key));
    if (unwantedFields.length > 0) {
        return res.status(400).send(`Les champs suivants ne sont pas autorisés pour la mise à jour : ${unwantedFields.join(', ')}`);
    }

    if (status === undefined && price === undefined) {
        return res.status(400).send('Seuls les champs status et price peuvent être mis à jour.');
    }
    
    next();
};
module.exports = { checkApiKey, validateOrder, validateUpdateOrder };
