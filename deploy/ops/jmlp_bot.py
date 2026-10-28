#!/usr/bin/env python3
"""JMLP Discord bot - stav serveru jmlp.cz, logy, záloha, kopie do testu, restart.

Běží na produkčním serveru jako služba jmlp-bot (root kvůli dockeru a
systemctl). Nastavení v /opt/jmlp-ops/.env (viz env.ops.example).

Kdokoli na Discord serveru: /status, /health, /logs, /stream
Jen admini (DISCORD_ADMIN_USER_IDS): /backup, /sync, /restart
Restart produkce navíc chce potvrzení slovem ANO.

Bot nepotřebuje žádné heslo k databázi.
"""
import asyncio
import logging
import os
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

import discord
from discord import app_commands
from dotenv import load_dotenv

OPS = Path('/opt/jmlp-ops')
load_dotenv(OPS / '.env')

TOKEN = os.getenv('DISCORD_BOT_TOKEN')
ADMINS = {x.strip() for x in os.getenv('DISCORD_ADMIN_USER_IDS', '').split(',') if x.strip()}
LOG_DIR = OPS / 'logs'
SYNC_PAUSE_FLAG = Path('/opt/jmlp-test/.sync-paused')

ENVS = {
    'prod': {'label': 'Produkce jmlp.cz', 'prefix': 'jmlp-', 'health': 'http://127.0.0.1:8080/health'},
    'test': {'label': 'Test preprodtest.jmlp.cz', 'prefix': 'jmlp-test-', 'health': 'http://127.0.0.1:8081/health'},
}
SERVICES = ('db', 'backend', 'frontend')

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s',
                    handlers=[logging.StreamHandler(sys.stdout)])
log = logging.getLogger('jmlp-bot')

if not TOKEN:
    log.error('DISCORD_BOT_TOKEN není nastaven v %s/.env', OPS)
    sys.exit(1)
if not ADMINS:
    log.warning('DISCORD_ADMIN_USER_IDS není nastaven - /backup, /sync a /restart nebudou fungovat nikomu')

client = discord.Client(intents=discord.Intents.default())
tree = app_commands.CommandTree(client)
streams: dict[int, asyncio.Task] = {}


# ---------------------------------------------------------------- pomocné

def run(cmd: list[str], timeout: int = 30) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)


async def arun(cmd: list[str], timeout: int = 30) -> subprocess.CompletedProcess:
    return await asyncio.to_thread(run, cmd, timeout)


def container(env: str, service: str) -> str:
    return ENVS[env]['prefix'] + service


def is_admin(interaction: discord.Interaction) -> bool:
    return str(interaction.user.id) in ADMINS


async def deny(interaction: discord.Interaction) -> None:
    await interaction.response.send_message('❌ Tenhle příkaz smí spouštět jen správce.', ephemeral=True)


def containers_state(env: str) -> list[str]:
    out = run(['docker', 'ps', '-a', '--format', '{{.Names}}\t{{.Status}}']).stdout
    states = dict(line.split('\t', 1) for line in out.splitlines() if '\t' in line)
    lines = []
    for s in SERVICES:
        name = container(env, s)
        st = states.get(name, 'neexistuje')
        icon = '✅' if 'healthy' in st and 'unhealthy' not in st else ('🟡' if st.startswith('Up') else '❌')
        lines.append(f'{icon} `{name}` {st}')
    return lines


def http_ok(url: str) -> bool:
    return run(['curl', '-s', '-o', '/dev/null', '-w', '%{http_code}', '--max-time', '5', url]).stdout == '200'


def timer_line(unit: str) -> str:
    r = run(['systemctl', 'show', unit, '--property=ActiveState,NextElapseUSecRealtime,LastTriggerUSec'])
    props = dict(line.split('=', 1) for line in r.stdout.splitlines() if '=' in line)
    icon = '✅' if props.get('ActiveState') == 'active' else '❌'
    return f"{icon} `{unit}` další: {props.get('NextElapseUSecRealtime') or '-'}"


def last_backup() -> str:
    logs = sorted(LOG_DIR.glob('backup_*.log'), key=lambda p: p.stat().st_mtime, reverse=True)
    if not logs:
        return 'zatím žádná'
    latest = logs[0]
    when = datetime.fromtimestamp(latest.stat().st_mtime, tz=timezone.utc)
    text = latest.read_text(encoding='utf-8', errors='replace')
    icon = '✅' if 'Hotovo.' in text else '❌'
    return f'{icon} {discord.utils.format_dt(when, "R")} (`{latest.name}`)'


def memory_line() -> str:
    out = run(['free', '-m']).stdout.splitlines()
    mem = out[1].split()
    swap = out[2].split() if len(out) > 2 else ['', '0', '0']
    disk = run(['df', '-h', '--output=used,size,pcent', '/']).stdout.splitlines()[-1].split()
    return f'RAM {mem[2]}/{mem[1]} MB, volné {mem[6]} MB · swap {swap[2]}/{swap[1]} MB · disk {disk[0]}/{disk[1]} ({disk[2]})'


async def send_text(interaction: discord.Interaction, title: str, content: str, filename: str) -> None:
    content = content.strip() or '(prázdné)'
    if len(content) > 1900:
        path = Path('/tmp') / filename
        path.write_text(content, encoding='utf-8')
        await interaction.followup.send(f'**{title}**', file=discord.File(path, filename=filename))
        path.unlink(missing_ok=True)
    else:
        await interaction.followup.send(f'**{title}**\n```\n{content}\n```')


# ---------------------------------------------------------------- příkazy pro všechny

@tree.command(name='status', description='Stav produkce a testu, časovače, poslední záloha, paměť')
async def status_cmd(interaction: discord.Interaction):
    await interaction.response.defer(thinking=True)
    embed = discord.Embed(title='📊 JMLP - stav', color=discord.Color.blue())
    for env, cfg in ENVS.items():
        embed.add_field(name=cfg['label'], value='\n'.join(containers_state(env)), inline=False)
    paused = ' ⏸️ kopie do testu POZASTAVENA' if SYNC_PAUSE_FLAG.exists() else ''
    embed.add_field(name='⏰ Časovače',
                    value=f"{timer_line('jmlp-test-sync.timer')}{paused}\n{timer_line('jmlp-backup.timer')}", inline=False)
    embed.add_field(name='💾 Poslední záloha', value=last_backup(), inline=False)
    embed.add_field(name='🖥️ Server', value=memory_line(), inline=False)
    await interaction.followup.send(embed=embed)


@tree.command(name='health', description='Kontrola webů, kontejnerů, databází a služeb')
async def health_cmd(interaction: discord.Interaction):
    await interaction.response.defer(thinking=True)
    ok = True
    embed = discord.Embed(title='🏥 JMLP - health check')
    for env, cfg in ENVS.items():
        web = http_ok(cfg['health'])
        db = run(['docker', 'exec', container(env, 'db'), 'mysqladmin', 'ping', '--silent']).returncode == 0
        lines = containers_state(env)
        ok &= web and (env == 'test' or db) and all(l.startswith('✅') for l in lines)
        lines.append(f"{'✅' if web else '❌'} web /health")
        lines.append(f"{'✅' if db else '❌'} MySQL ping")
        embed.add_field(name=cfg['label'], value='\n'.join(lines), inline=False)
    services = []
    for unit in ('docker', 'nginx', 'jmlp-bot'):
        active = run(['systemctl', 'is-active', unit]).stdout.strip() == 'active'
        ok &= active
        services.append(f"{'✅' if active else '❌'} `{unit}`")
    embed.add_field(name='⚙️ Služby', value='\n'.join(services), inline=False)
    embed.add_field(name='🖥️ Server', value=memory_line(), inline=False)
    embed.color = discord.Color.green() if ok else discord.Color.orange()
    embed.set_footer(text='✅ Vše v pořádku' if ok else '⚠️ Něco vyžaduje pozornost')
    await interaction.followup.send(embed=embed)


LOG_SOURCES = [
    app_commands.Choice(name='prod backend', value='prod:backend'),
    app_commands.Choice(name='prod frontend', value='prod:frontend'),
    app_commands.Choice(name='prod db', value='prod:db'),
    app_commands.Choice(name='test backend', value='test:backend'),
    app_commands.Choice(name='test frontend', value='test:frontend'),
    app_commands.Choice(name='test db', value='test:db'),
    app_commands.Choice(name='záloha (poslední log)', value='backup'),
    app_commands.Choice(name='kopie do testu', value='sync'),
]


@tree.command(name='logs', description='Posledních N řádků logu')
@app_commands.describe(source='Odkud', lines='Počet řádků (10-300)')
@app_commands.choices(source=LOG_SOURCES)
async def logs_cmd(interaction: discord.Interaction, source: app_commands.Choice[str], lines: int = 50):
    await interaction.response.defer(thinking=True)
    lines = max(10, min(lines, 300))
    if source.value == 'backup':
        logs = sorted(LOG_DIR.glob('backup_*.log'), key=lambda p: p.stat().st_mtime)
        content = '\n'.join(logs[-1].read_text(errors='replace').splitlines()[-lines:]) if logs else 'zatím žádný log'
    elif source.value == 'sync':
        content = (await arun(['journalctl', '-u', 'jmlp-test-sync', '-n', str(lines), '--no-pager'])).stdout
    else:
        env, svc = source.value.split(':')
        r = await arun(['docker', 'logs', '--tail', str(lines), container(env, svc)])
        content = r.stdout + r.stderr
    await send_text(interaction, f'📜 {source.name}', content, f"{source.value.replace(':', '_')}.txt")


async def stream_task(channel, name: str):
    proc = await asyncio.create_subprocess_exec('docker', 'logs', '-f', '--tail', '0', name,
                                                stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.STDOUT)
    buf: list[str] = []
    try:
        while True:
            try:
                line = await asyncio.wait_for(proc.stdout.readline(), timeout=5)
                if not line:
                    break
                if text := line.decode('utf-8', 'replace').rstrip():
                    buf.append(text)
                if len(buf) < 15:
                    continue
            except asyncio.TimeoutError:
                pass
            if buf:
                await channel.send(f'```\n{chr(10).join(buf)[-1900:]}\n```')
                buf.clear()
    finally:
        proc.terminate()


STREAM_SOURCES = [c for c in LOG_SOURCES if ':' in c.value]


@tree.command(name='stream', description='Živé logy kontejneru do tohoto kanálu (start/stop)')
@app_commands.choices(action=[app_commands.Choice(name='start', value='start'),
                              app_commands.Choice(name='stop', value='stop')],
                      source=STREAM_SOURCES)
async def stream_cmd(interaction: discord.Interaction, action: app_commands.Choice[str],
                     source: app_commands.Choice[str] | None = None):
    cid = interaction.channel_id
    running = cid in streams and not streams[cid].done()
    if action.value == 'stop':
        if running:
            streams.pop(cid).cancel()
            await interaction.response.send_message('🛑 Stream zastaven.')
        else:
            await interaction.response.send_message('V tomhle kanálu žádný stream neběží.', ephemeral=True)
        return
    if not source:
        await interaction.response.send_message('Vyber zdroj.', ephemeral=True)
        return
    if running:
        await interaction.response.send_message('Tady už stream běží, nejdřív ho zastav.', ephemeral=True)
        return
    env, svc = source.value.split(':')
    streams[cid] = asyncio.create_task(stream_task(interaction.channel, container(env, svc)))
    await interaction.response.send_message(f'📡 Streamuju `{container(env, svc)}`. Zastavení: `/stream stop`')


# ---------------------------------------------------------------- jen pro správce

@tree.command(name='backup', description='Spustí zálohu produkce do Google Drive hned')
async def backup_cmd(interaction: discord.Interaction):
    if not is_admin(interaction):
        return await deny(interaction)
    await interaction.response.defer(thinking=True)
    r = await arun(['systemctl', 'start', 'jmlp-backup.service'], timeout=900)
    ok = r.returncode == 0
    await interaction.followup.send(
        f"{'✅ Záloha hotová' if ok else '❌ Záloha selhala'} (spustil {interaction.user.mention}). "
        f"Podrobnosti přijdou webhookem, nebo `/logs záloha`.")


@tree.command(name='sync', description='Kopie produkce do testu: teď / pozastavit / obnovit')
@app_commands.choices(action=[app_commands.Choice(name='spustit teď', value='now'),
                              app_commands.Choice(name='pozastavit', value='pause'),
                              app_commands.Choice(name='obnovit', value='resume')])
async def sync_cmd(interaction: discord.Interaction, action: app_commands.Choice[str]):
    if not is_admin(interaction):
        return await deny(interaction)
    if action.value == 'pause':
        SYNC_PAUSE_FLAG.touch()
        return await interaction.response.send_message('⏸️ Kopie do testu pozastavena. Test teď nikdo nepřepíše.')
    if action.value == 'resume':
        SYNC_PAUSE_FLAG.unlink(missing_ok=True)
        return await interaction.response.send_message('▶️ Kopie do testu obnovena (další podle časovače).')
    if SYNC_PAUSE_FLAG.exists():
        return await interaction.response.send_message('Kopie je pozastavená, nejdřív `/sync obnovit`.', ephemeral=True)
    await interaction.response.defer(thinking=True)
    r = await arun(['systemctl', 'start', 'jmlp-test-sync.service'], timeout=900)
    await interaction.followup.send('✅ Test má čerstvou kopii produkce.' if r.returncode == 0
                                    else '❌ Kopie selhala, viz `/logs kopie do testu`.')


@tree.command(name='restart', description='Restart kontejnerů produkce nebo testu')
@app_commands.describe(potvrzeni='U produkce napiš ANO')
@app_commands.choices(env=[app_commands.Choice(name='test', value='test'),
                           app_commands.Choice(name='produkce', value='prod')],
                      service=[app_commands.Choice(name=s, value=s) for s in (*SERVICES, 'vše')])
async def restart_cmd(interaction: discord.Interaction, env: app_commands.Choice[str],
                      service: app_commands.Choice[str], potvrzeni: str = ''):
    if not is_admin(interaction):
        return await deny(interaction)
    if env.value == 'prod' and potvrzeni.strip().upper() != 'ANO':
        return await interaction.response.send_message(
            '⚠️ Restart produkce na chvíli shodí jmlp.cz. Pro potvrzení zopakuj příkaz s `potvrzeni: ANO`.',
            ephemeral=True)
    await interaction.response.defer(thinking=True)
    names = [container(env.value, s) for s in (SERVICES if service.value == 'vše' else (service.value,))]
    r = await arun(['docker', 'restart', *names], timeout=120)
    await asyncio.sleep(10)
    state = '\n'.join(l for l in containers_state(env.value) if any(n in l for n in names))
    head = '✅ Restartováno' if r.returncode == 0 else f'❌ Restart selhal: {r.stderr.strip()[:500]}'
    await interaction.followup.send(f'{head} ({interaction.user.mention})\n{state}')


@client.event
async def on_ready():
    log.info('Připojeno jako %s', client.user)
    for guild in client.guilds:
        tree.copy_global_to(guild=guild)
        synced = await tree.sync(guild=guild)
        log.info('Server %s: %d příkazů', guild.name, len(synced))


if __name__ == '__main__':
    client.run(TOKEN, log_handler=None)
