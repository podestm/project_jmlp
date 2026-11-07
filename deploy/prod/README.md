# Nasazení produkce (jmlp.cz)

```
lokální vývoj ─► push do dev ─► CI ─► test preprodtest (deploy/test) ─► kontrola v prohlížeči
                                                                              │
produkce ◄─ deploy-main.sh ◄─ SSH ◄─ úloha deploy ◄─ CI ◄─ merge PR dev → main
```

Nasazení spouští **sloučení pull requestu dev → main**, nic dalšího se neschvaluje. Na `main` proběhne
CI (`frontend`, `backend`, `harness`) a když projde, úloha `deploy` v `.github/workflows/ci.yml` přes
SSH zavolá na serveru `deploy/prod/ssh-deploy.sh`, který spustí `deploy-main.sh <commit>`. Klíč, který
má GitHub, nic jiného neumí (vynucený příkaz v `authorized_keys`). Kdo by chtěl před nasazením ještě
tlačítko *Approve*, přidá v GitHub Environment `production` *Required reviewers*.

`deploy-main.sh` nasadí commit jen když je špičkou `origin/main`, prošlo na něm CI, není víkend
(závody) a dřív neselhal. Před nasazením zazálohuje DB (`/var/lib/jmlp-deploy/backups`, posledních
10) a označí běžící image `jmlp-{backend,frontend}:pred-<commit>`. Po nasazení až 3 minuty kontroluje
`/health` a healthcheck obou kontejnerů; když neprojde, vrátí předchozí image i kód, commit zapíše do
`/var/lib/jmlp-deploy/failed` a skončí chybou (úloha v GitHubu zčervená, log je tam). **Databázi
nevrací** – pokud nová verze spustila migraci, obnova je ruční ze zálohy uvedené v logu.

Agenti tyto skripty nespouštějí ani neinstalují (guard v `.claude/hooks/`); nastavuje je člověk.

## Zapnutí (jednou)

1. **GitHub → Settings → Environments → New environment `production`** (bez dalšího nastavení).
2. **Slouč PR dev → main.** Úloha `deploy` napoprvé selže (ještě nemá klíč) – to je v pořádku.
3. **První nasazení ručně** (produkce ještě nemá `deploy/prod`, přijde až s ním). Jako root na serveru:
   ```
   install -d -o podm12 -m 700 /var/lib/jmlp-deploy
   sudo -u podm12 REPO=/opt/jmlp /opt/jmlp-test/deploy/prod/deploy-main.sh
   ```
   O víkendu nejdřív `touch /opt/jmlp/.deploy-allow-weekend` (po nasazení smazat). `podm12` musí
   vlastnit `/opt/jmlp` a být ve skupině `docker`.
4. **Klíč pro GitHub** (na serveru, jako `podm12`):
   ```
   ssh-keygen -t ed25519 -N "" -C github-deploy -f ~/jmlp-deploy
   echo "command=\"/opt/jmlp/deploy/prod/ssh-deploy.sh\",restrict $(cat ~/jmlp-deploy.pub)" >> ~/.ssh/authorized_keys
   ```
   `restrict` vypne terminál i přesměrování portů; klíč umí jen `deploy <commit>`.
5. **Secrets v environmentu `production`** (*Environment secrets*, ne repozitáře):
   | Secret | Hodnota |
   |---|---|
   | `PROD_SSH_KEY` | obsah `~/jmlp-deploy` (soukromý klíč); pak `rm ~/jmlp-deploy` |
   | `PROD_SSH_HOST` | `jmlp.cz` |
   | `PROD_SSH_USER` | `podm12` |
   | `PROD_SSH_KNOWN_HOSTS` | výstup `ssh-keyscan -t ed25519 jmlp.cz` (spusť na svém počítači) |
6. **V GitHubu u selhané úlohy `deploy` z kroku 2 dej *Re-run*.** Zjistí, že produkce už je na tom
   commitu, a skončí zeleně – tím je ověřené, že spojení funguje. Další sloučení už nasadí samo.

## Ovládání

| Co | Jak |
|---|---|
| Ruční nasazení | `sudo -u podm12 /opt/jmlp/deploy/prod/deploy-main.sh` |
| Zablokovat nasazení | `touch /opt/jmlp/.deploy-paused` (zrušit: `rm`) |
| Povolit nasazení o víkendu | `touch /opt/jmlp/.deploy-allow-weekend` (po nasazení smazat) |
| Znovu zkusit selhaný commit | `rm /var/lib/jmlp-deploy/failed`, pak *Re-run* úlohy `deploy` v GitHubu |
| Ruční návrat | `docker tag jmlp-backend:pred-<commit> jmlp-backend:latest` (totéž `jmlp-frontend`), `git -C /opt/jmlp reset --hard <commit>`, pak `up -d --no-build backend frontend` se souborem `docker-compose.server.yml` |
| Odebrat GitHubu přístup | smazat řádek `github-deploy` z `~podm12/.ssh/authorized_keys` |
