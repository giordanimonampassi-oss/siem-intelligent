# Smart SIEM — Frontend CTU

Interface React du projet Smart SIEM (UCAC/ULC-ICAM) — simulation CTU.

## Démarrage

```bash
cd smart-siem
npm install
npm run dev
```

Ouvrir http://localhost:5173

## Comptes de démonstration (5 utilisateurs)

| Utilisateur | Email | Rôle | Mot de passe | MFA |
|-------------|-------|------|--------------|-----|
| Chloe O'Brian | chloe.obrian@ctu.gov | Analyste | ctu2026 | 123456 |
| Bill Buchanan | bill.buchanan@ctu.gov | Lecteur | ctu2026 | 123456 |
| Jack Bauer | jack.bauer@ctu.gov | Analyste | ctu2026 | 123456 |
| Tony Almeida | tony.almeida@ctu.gov | Analyste | ctu2026 | 123456 |
| Aaron Pierce | aaron.pierce@ctu.gov | Administrateur | ctu2026 | 123456 |

## Pages (10)

1. Connexion + MFA
2. Dashboard principal
3. Alertes & incidents (master-detail)
4. Recherche forensique + Timeline
5. Crisis Room (plein écran, refresh 5s)
6. Vue RSSI (KPIs, conformité)
7. Profil UEBA
8. Règles de corrélation
9. Administration RBAC (admin only → 403)
10. Rapports & exports

## RBAC

- **Lecteur** (Bill) → Vue RSSI par défaut, pas de logs bruts ni forensique
- **Analyste** → Investigation, alertes, UEBA, règles
- **Administrateur** (Aaron) → Tous les droits + gestion utilisateurs

## Stack

- React 18 + Vite
- React Router
- Recharts
- Lucide React
