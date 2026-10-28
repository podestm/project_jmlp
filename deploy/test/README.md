# Test preprodtest.jmlp.cz na produkčním serveru + týdenní záloha

Test běží na stejném serveru jako jmlp.cz, ale úplně odděleně: vlastní compose
projekt `jmlp-test`, kontejnery `jmlp-test-*`, síť, svazky, porty a `.env`.
Sdílí jen hostitelský nginx a certbot.

| | Produkce | Test |
| --- | --- | --- |
| Doména | jmlp.cz | preprodtest.jmlp.cz (za heslem) |
| Adresář / větev | /opt/jmlp, `main` | /opt/jmlp-test, `dev` |
| Compose | docker-compose.server.yml | docker-compose.test.yml |
| Porty (localhost) | 8080, 3307 | 8081, 3308 |
| Limity | žádné | DB 512 MB, backend 320 MB, frontend 64 MB, CPU 0,75 |
| SLČR | ano | vypnuto |

Kopie prod -> test každé 2 hodiny (`deploy/test/sync-prod-to-test.sh`):
DB + nahrané dokumenty, pak restart testovacího backendu (migrace větve dev).
Vše, co se v testu změní, se při další kopii přepíše.
Pozastavení: `touch /opt/jmlp-test/.sync-paused`, obnovení: `rm` téhož souboru.

## Jednorázové nastavení (kroky se `sudo` dělá Michal)

1. **DNS u Forpsi:** A `preprodtest` -> `178.105.133.222` (TTL 300).
2. **Swap 2 GB** (chrání produkci před nedostatkem paměti):
   ```bash
   sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
   sudo mkswap /swapfile && sudo swapon /swapfile
   echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
   echo 'vm.swappiness=10' | sudo tee /etc/sysctl.d/99-swappiness.conf && sudo sysctl --system
   ```
3. **Checkout a .env testu:**
   ```bash
   sudo mkdir -p /opt/jmlp-test && sudo chown podm12:podm12 /opt/jmlp-test
   git clone -b dev https://github.com/podestm/jmlp_web_v1.git /opt/jmlp-test
   cp /opt/jmlp-test/deploy/test/env.test.example /opt/jmlp-test/.env
   chmod 600 /opt/jmlp-test/.env   # a vyplnit NOVÉ hodnoty
   ```
4. **Build a start testu** (ne v den závodu, build frontendu bere hodně RAM):
   ```bash
   cd /opt/jmlp-test
   docker builder prune -f          # uvolní ~3 GB build cache
   nice -n 15 docker compose -f docker-compose.test.yml build
   docker compose -f docker-compose.test.yml up -d
   ```
5. **První kopie ručně, pak timer:**
   ```bash
   sudo /opt/jmlp-test/deploy/test/sync-prod-to-test.sh
   sudo cp /opt/jmlp-test/deploy/test/jmlp-test-sync.{service,timer} /etc/systemd/system/
   sudo systemctl daemon-reload && sudo systemctl enable --now jmlp-test-sync.timer
   ```
6. **Nginx + heslo + certifikát:**
   ```bash
   sudo apt install -y apache2-utils
   sudo htpasswd -c /etc/nginx/.htpasswd-preprodtest jmlp
   sudo cp /opt/jmlp-test/deploy/test/nginx-preprodtest.jmlp.cz.conf /etc/nginx/sites-available/preprodtest.jmlp.cz.conf
   sudo ln -s /etc/nginx/sites-available/preprodtest.jmlp.cz.conf /etc/nginx/sites-enabled/
   sudo nginx -t && sudo systemctl reload nginx
   sudo certbot --nginx -d preprodtest.jmlp.cz
   ```
7. **Týdenní záloha do Google Drive** (`deploy/backup/`):
   ```bash
   sudo apt install -y rclone
   sudo mkdir -p /opt/jmlp-backup
   sudo cp /opt/jmlp-test/deploy/backup/jmlp-backup.sh /opt/jmlp-backup/
   # rclone remote "gdrive": zkopírovat ~/.config/rclone/rclone.conf z podm12.com
   # (tam už remote gdrive je), nebo: sudo rclone config --config /opt/jmlp-backup/rclone.conf
   sudo chmod 600 /opt/jmlp-backup/rclone.conf
   sudo /opt/jmlp-backup/jmlp-backup.sh          # první záloha ručně
   sudo cp /opt/jmlp-test/deploy/backup/jmlp-backup.{service,timer} /etc/systemd/system/
   sudo systemctl daemon-reload && sudo systemctl enable --now jmlp-backup.timer
   ```
   Výsledek: `project_jmlp_cz/backup/jmlp-db-YYYY-MM-DD.sql.gz` (4 poslední)
   a `project_jmlp_cz/backup/files/` (jedna aktuální kopie dokumentů).

## Nasazení nové verze testu

```bash
cd /opt/jmlp-test && git pull
nice -n 15 docker compose -f docker-compose.test.yml build
docker compose -f docker-compose.test.yml up -d
```

## Kontrola

```bash
free -h; docker stats --no-stream
systemctl list-timers 'jmlp-*'
journalctl -u jmlp-test-sync -n 30
journalctl -u jmlp-backup -n 30
```
