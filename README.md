# MCP Server: Fiscalité Française (France Tax Services)

Un serveur MCP (Model Context Protocol) complet pour accéder aux services et données fiscales françaises. 

Ce serveur permet aux modèles d'IA (comme Claude) d'effectuer des recherches sur les paramètres fiscaux, de simuler l'impôt sur le revenu et de consulter des données d'entreprises.

## Fonctionnalités

### 1. Recherche de paramètres fiscaux (`search_tax_parameters`)
Recherchez dans l'immense base de données d'**OpenFisca** les paramètres du système socio-fiscal français.
- Tranches d'impôt sur le revenu (barèmes)
- Montant du SMIC, plafonds de la sécurité sociale
- Montants des aides (Prime d'activité, APL, RSA, etc.)

### 2. Simulation d'impôt sur le revenu (`simulate_income_tax`)
Calculez une estimation de l'impôt sur le revenu (IR) pour un foyer simple (individu seul) pour une année donnée.
- Utilise le moteur de calcul officiel OpenFisca.

### 3. Informations Entreprises (`get_company_tax_info`)
Récupérez les informations administratives et fiscales publiques d'une entreprise via son numéro **SIREN**.
- Utilise l'API Recherche Entreprises (Gouvernement Français).

## Installation

### Prérequis
- [Node.js](https://nodejs.org/) (v18+)
- npm

### Installation locale

```bash
git clone https://github.com/your-username/mcp-fiscalite-fr.git
cd mcp-fiscalite-fr
npm install
npm run build
```

## Configuration MCP

Pour utiliser ce serveur dans Claude Desktop, ajoutez ceci à votre fichier `claude_desktop_config.json` :

```json
{
  "mcpServers": {
    "mcp-fiscalite-fr": {
      "command": "node",
      "args": ["/chemin/vers/mcp-fiscalite/build/index.js"]
    }
  }
}
```

## Technologies Utilisées
- **OpenFisca** : Le moteur de règles "Rules-as-Code" pour la fiscalité française.
- **Model Context Protocol (MCP)** : Standard pour l'interopérabilité des outils IA.
- **TypeScript** : Pour une implémentation robuste.
- **Zod** : Validation stricte des schémas d'entrée.

## Licence
ISC - Libre d'utilisation et de modification.

---
*Note: Ce projet est un outil de simulation et d'information. Les résultats ne constituent pas des conseils fiscaux officiels.*
