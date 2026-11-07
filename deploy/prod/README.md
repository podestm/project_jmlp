# Automatické nasazení produkce (jmlp.cz)

```
lokální vývoj ─► push do dev ─► CI ─► test preprodtest (deploy/test) ─► kontrola v prohlížeči
                                                                              │
         produkce ◄─ auto-deploy-main.sh ◄─ CI na main ◄─ merge ◄─ CI ◄─ PR dev → main
```

`auto-deploy-main.sh` (spouští ho `jmlp-prod-deploy.timer` každých 5 minut) nasadí nový commit z
`origin/main`, jen když na něm na GitHubu prošlo CI (`frontend`, `backend`, `harness`), není víkend
(závody) a commit dřív neselhal. Před nasazením zazálohuje DB (`/var/lib/jmlp-deploy/backups`,
posledních 10) a označí běžící image `jmlp-{backend,frontend}:pred-<commit>`. Po nasazení až 3 minuty
kontroluje `/health` a healthcheck obou kontejnerů; když neprojde, vrátí předchozí image i kód,
commit zapíše do `/var/lib/jmlp-deploy/failed` a ohlásí to na Discord. **Databázi nevrací** – pokud
nová verze spustila migraci, obnova je ruční ze zálohy uvedené v hlášení.

Agenti tyto soubory nespouštějí ani neinstalují (guard v `.claude/hooks/`); zapíná je člověk.

## Zapnutí (jednou, jako root)

1. `git -C /opt/jmlp status` musí být čisté a `main` na GitHubu musí na produkci navazovat.
2. Ověř vlastníka `/opt/jmlp` (`stat -c %U /opt/jmlp`) a podle něj uprav `User=` v `jmlp-prod-deploy.service`.
3. První nasazení spusť ručně a sleduj ho. Produkce skript ještě nemá (přijde až s tímto nasazením),
   proto se spustí z testovací kopie, která je na `dev`:
   ```
   sudo install -d -o podm12 -m 700 /var/lib/jmlp-deploy
   sudo -u podm12 REPO=/opt/jmlp /opt/jmlp-test/deploy/prod/auto-deploy-main.sh
   ```
   (O víkendu nejdřív `touch /opt/jmlp/.deploy-allow-weekend`.)
4. Pak nainstaluj jednotky z produkce:
   ```
   sudo cp /opt/jmlp/deploy/prod/jmlp-prod-deploy.service /opt/jmlp/deploy/prod/jmlp-prod-deploy.timer /etc/systemd/system/
   sudo systemctl daemon-reload
   ```
5. Zapni časovač: `sudo systemctl enable --now jmlp-prod-deploy.timer`.

## Ovládání

| Co | Jak |
|---|---|
| Pozastavit | `touch /opt/jmlp/.deploy-paused` (zrušit: `rm`) |
| Povolit nasazení o víkendu | `touch /opt/jmlp/.deploy-allow-weekend` (po nasazení smazat) |
| Znovu zkusit selhaný commit | `sudo rm /var/lib/jmlp-deploy/failed` |
| Log | `journalctl -u jmlp-prod-deploy` |
| Ruční návrat | `docker tag jmlp-backend:pred-<commit> jmlp-backend:latest` (totéž `jmlp-frontend`), `git -C /opt/jmlp reset --hard <commit>`, pak `up -d --no-build backend frontend` se souborem `docker-compose.server.yml` |
