# JMLP Časomíra Simulator pro Windows 11

Simuluje sériový provoz na virtuálním COM portu, aby šlo testovat zápis časů v prohlížeči.

## Požadavky

1. **Python 3.x** — https://www.python.org/downloads/
2. **ELTIMA Virtual Serial Port** (už máš) — vytvořit pár `COM7 ↔ NULL_COM7`

## Spuštění

Stačí dvojklik na **`spustit.bat`** — nainstaluje pyserial a nabídne režim.

Nebo ručně:

```
pip install pyserial

# Interaktivní — ručně zadáváš časy
python simulator.py

# Automatický — náhodné časy každé 2 sekundy
python simulator.py --auto

# Automatický, rychlejší, víc závodníků
python simulator.py --auto --interval 1 --racers 25
```

## Interaktivní příkazy

| Příkaz | Příklad | Výsledek |
|--------|---------|----------|
| `t DRES [ČAS]` | `t 10 01:23.45` | `TIME;10;01:23.45` |
| `t DRES` | `t 10` | `TIME;10;00:42.17` (náhodný) |
| `dns DRES` | `dns 5` | `DNS;5` |
| `dnf DRES` | `dnf 13` | `DNF;13` |
| `dsq DRES` | `dsq 11` | `DSQ;11` |
| `burst N` | `burst 10` | 10 náhodných časů rychle za sebou |
| `q` | | ukončit |

## Jak to funguje

```
simulator.py → píše na NULL_COM7
                    ↕ (virtuální pár)
prohlížeč    → čte z COM7
```

Prohlížeč (Web Serial API) se připojí na COM7, simulator posílá data na NULL_COM7. Virtuální driver je propojí.
