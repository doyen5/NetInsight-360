# 🌐 NetInsight 360 - Plateforme de Supervision Réseau

**Supervisez. Analysez. Optimisez.**

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/your-username/netinsight360)
[![PHP](https://img.shields.io/badge/PHP-8.0%2B-777BB4.svg)](https://php.net)
[![MySQL](https://img.shields.io/badge/MySQL-5.7%2B-4479A1.svg)](https://mysql.com)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

---

## 📋 Table des matières

1. [Présentation du projet](#-présentation-du-projet)
2. Architecture technique(#-architecture-technique)
3. Prérequis(#-prérequis)
4. Installation(#-installation)
5. Configuration(#-configuration)
6. Structure du projet(#-structure-du-projet)
7. Base de données(#-base-de-données)
8. API Endpoints(#-api-endpoints)
9. Scripts et automatisations(#-scripts-et-automatisations)
10. Sécurité(#-sécurité)
11. Dépannage(#-dépannage)
12. Contribuer(#-contribuer)
13. Licence(#-licence)

---

## 🎯 Présentation du projet

**NetInsight 360** est une plateforme complète de supervision et d'analyse des réseaux télécoms, spécialement conçue pour les opérateurs africains. Elle permet de visualiser en temps réel les performances des infrastructures réseau (RAN et CORE) sur 5 pays : Côte d'Ivoire, Niger, Bénin, Togo et Centrafrique.

### ✨ Fonctionnalités principales

| Module | Description |
|---------------------|
| **Dashboard** | Vue d'ensemble des KPIs, carte interactive, top/pires sites |
| **KPIs RAN** | Supervision détaillée des réseaux 2G, 3G et 4G (RNA, CSSR, TCH Drop, etc.) |
| **KPIs CORE** | Surveillance du cœur réseau (Packet Loss, Latence, Jitter, Débit) |
| **Cartographie** | Visualisation géographique des sites avec filtres avancés |
| **Alertes** | Gestion des alertes critiques et avertissements |
| **Gestion Utilisateurs** | CRUD complet avec rôles (ADMIN, FO_NPM, FO_CORE_RAN, CUSTOMER) |
| **Rapports** | Génération de rapports WhatsApp, PowerPoint, Excel, PDF |
| **Prédictions** | Tendances sur 5 jours et prévisions basées sur l'historique |

### 👥 Rôles et permissions

| Rôle | Description | Accès |
|-------------------|------- |
| **ADMIN** | Administrateur | Accès complet à toutes les fonctionnalités |
| **FO_NPM** | Agent Superviseur | Dashboard, KPIs RAN, KPIs CORE, Cartographie, Alertes |
| **FO_CORE_RAN** | Agent Partageur | Dashboard, KPIs RAN, Cartographie, Alertes |
| **CUSTOMER** | Agent Visualiseur | Dashboard uniquement (lecture seule) |

---

🏗 Architecture technique
┌─────────────────────────────────────────────────────────────────────────────┐
│ FRONTEND (HTML/CSS/JS) │
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ │
│ │ dashboard │ │ kpis-ran │ │ kpis-core │ │ alerts │ │
│ │ .html │ │ .html │ │ .html │ │ .html │ │
│ └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘ │
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────────────────────────────┐ │
│ │ users │ │ map-view │ │ assets: Bootstrap, Leaflet, Chart.js│ │
│ │ .html │ │ .html │ │ │ │
│ └─────────────┘ └─────────────┘ └─────────────────────────────────────┘ │
└────────────────────────────────────┬────────────────────────────────────────┘
│ AJAX / Fetch (JSON)
▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ BACKEND (PHP 8.0+) │
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │ API RESTful │ │
│ │ /api/auth/ /api/sites/ /api/kpis/ /api/alerts/ │
│ │ /api/users/ /api/reports/│ /api/map/ │ /api/filters/* │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │ Controllers (MVC) │ │
│ │ AuthController │ SiteController │ KpiController │ AlertController │ │
│ │ UserController │ ReportController│ MapController │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │ Models (PDO) │ │
│ │ User │ Site │ Kpi │ Alert │ Report │ Token │ ImportLog │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────┬────────────────────────────────────────┘
│
┌────────────────────────────────────┼────────────────────────────────────────┐
│ ▼ │
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │ BASE DE DONNÉES (MySQL 5.7+) │ │
│ │ netinsight360 │ │
│ │ ┌─────────────────────────────────────────────────────────────────┐│ │
│ │ │ 20 tables: users, sites, kpis_ran, kpis_core, kpi_history, ││ │
│ │ │ alerts, reports, audit_logs, predictions, etc. ││ │
│ │ └─────────────────────────────────────────────────────────────────┘│ │
│ └─────────────────────────────────────────────────────────────────────┘ │
│ │
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │ BASE DISTANTE (NetPulseAI_NetworkInsight) │ │
│ │ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ │ │
│ │ │ ran_2g_kpis │ │ ran_3g_kpis │ │ ran_4g_kpis │ │ │
│ │ └─────────────┘ └─────────────┘ └─────────────┘ │ │
│ └─────────────────────────────────────────────────────────────────────┘ │

### 📦 Technologies utilisées

| Catégorie | Technologies |
|-------------------------|
| **Frontend** | HTML5, CSS3, JavaScript (ES6), Bootstrap 5, Leaflet, Chart.js |
| **Backend** | PHP 8.0+, PDO, MVC, REST API |
| **Base de données** | MySQL 5.7+, MariaDB 10.3+ |
| **Sécurité** | Password hashing (bcrypt/Argon2), Prepared statements, CSRF tokens, JWT |
| **Cache** | Redis / Memcached (optionnel) |
| **Queue** | RabbitMQ / Beanstalkd (optionnel pour envois email) |

---

## ⚙️ Prérequis

### Serveur

- **PHP** : Version 8.0 ou supérieure
- **Extensions PHP**  
  - `pdo_mysql` (connexion base de données)
  - `openssl` (cryptage)
  - `json` (manipulation JSON)
  - `curl` (requêtes HTTP)
  - `mbstring` (encodage)
  - `gd` (génération d'images - optionnel)
- **MySQL** : Version 5.7 ou supérieure / MariaDB 10.3+
- **Apache** : Version 2.4+ ou **Nginx** : Version 1.18+
- **Composer** : Gestion des dépendances PHP
- **Node.js** : (optionnel, pour assets frontend)

### Environnement de développement

- **XAMPP** / **WAMP** / **MAMP** pour développement local
- **Visual Studio Code** avec extensions :
  - PHP Intelephense
  - ESLint
  - Prettier
  - Live Server
