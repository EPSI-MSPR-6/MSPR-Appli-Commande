const express = require('express');
const bodyParser = require('body-parser');
require('dotenv').config();
const app = express();
const port = 8080;
const ordersRoute = require('./routes/orders.js');

app.use(bodyParser.json());
app.use('/orders', ordersRoute);

app.get('/', (req, res) => {
  res.send('Bienvenue sur l\'API Commandes');
});

app.listen(port, () => {
  console.log(`L'API Commandes est executée à partir du port ${port}`);
});