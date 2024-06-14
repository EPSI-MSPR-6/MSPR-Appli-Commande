# API Commande NodeJS

## Description
Répositoire git d'une des trois API indépendantes (Orders) permettant de gérer les commandes.

## Prérequis

- Node.js (version 14 ou supérieure)
- npm (version 6 ou supérieure)

## Installation

1. Clonez ce dépôt :

   ```bash
   git clone https://github.com/EPSI-MSPR-6/MSPR-Appli-Commande.git
   cd MSPR-Appli-Commande
   ```

2. Installez les dépendances :

   ```bash
   npm install
   ```

3. Créez un fichier `.env` et `.env.test` à la racine du projet et ajoutez les variables d'environnement communiquées

4. Démarrez le serveur :

   ```bash
   npm start
   ```
L'API sera accessible à l'adresse `http://localhost:8080` (ou modifiez le port utilisé dans index.js s'il est déjà utilisé).

5. Démarrez les tests grâce à jest :

   ```bash
   npm test
   ```

## Objectif de l'API

L'objectif de cette API est de gérer les informations des commandes, y compris la création, la lecture, la mise à jour et la suppression des données des commandes.

## Endpoints de l'API

| Méthode | Endpoint                  | Description                                 |
|---------|---------------------------|---------------------------------------------|
| POST    | /orders                   | Crée une nouvelle commande                  |
| GET     | /orders                   | Récupère une liste de commandes             |
| GET     | /orders/{id}              | Récupère une commande par son identifiant   |
| PUT     | /orders/{id}              | Met à jour une commande                     |
| DELETE  | /orders/{id}              | Supprime une commande                       |
| POST    | /orders/pubsub            | Lecture PubSub + Fonctions                  |

## Body Autorisé par requête POST/PUT

1. Requête /orders (POST)
```json
{
    "date": "",
    "id_produit": "",
    "id_client": "",
    "quantity": 
}
// Tous les champs sont obligatoires
```

2. Requête /customers/{id} (PUT)
```json
{
    "status": "",
    "price": 
}
// Tous les champs sont obligatoires
```