#!/usr/bin/env python3
"""
JMLP Časomíra Simulator pro Windows 11
=======================================
Simuluje sériový provoz na virtuálním COM portu pro testování časomíry.

Vyžaduje:
  1. ELTIMA Virtual Serial Port (nebo jiný virtual COM driver)
     - Vytvořit pár: COM7 <-> NULL_COM7 (nebo COM7 <-> COM8)
  2. Python 3.x + pyserial:
     pip install pyserial

Použití:
  python simulator.py                       # interaktivní režim na NULL_COM7
  python simulator.py --port COM8           # jiný port
  python simulator.py --auto                # automatický režim (posílá samo)
  python simulator.py --auto --interval 3   # automatický, každé 3 sekundy

Formát zpráv (stejný jako skutečná časomíra):
  TIME;DRES;MM:SS.hh   - čas závodníka
  DNS;DRES              - did not start
  DNF;DRES              - did not finish
  DSQ;DRES              - diskvalifikace
"""

import argparse
import random
import sys
import time

try:
    import serial
except ImportError:
    print("=" * 50)
    print("CHYBA: Chybí knihovna pyserial!")
    print("Nainstaluj ji příkazem:")
    print("  pip install pyserial")
    print("=" * 50)
    sys.exit(1)


def generate_time():
    """Generuje náhodný čas ve formátu MM:SS.hh"""
    minutes = random.randint(0, 2)
    seconds = random.randint(0, 59)
    hundredths = random.randint(0, 99)
    return f"{minutes:02d}:{seconds:02d}.{hundredths:02d}"


def send_event(ser, event_str):
    """Odešle událost na sériový port"""
    line = f"{event_str}\n".encode("utf-8")
    ser.write(line)
    print(f"  >>> Odesláno: {event_str}")


def auto_mode(ser, interval, racers):
    """Automatický režim - posílá náhodné události"""
    racer_list = list(range(1, racers + 1))
    print(f"\n--- Automatický režim ({interval}s interval, závodníci 1-{racers}) ---")
    print("    Ctrl+C pro zastavení\n")

    event_num = 0
    while True:
        event_num += 1
        racer = random.choice(racer_list)
        event_type = random.choices(
            ["TIME", "TIME", "TIME", "TIME", "DNS", "DNF", "DSQ"],
            weights=[60, 60, 60, 60, 5, 10, 5],
        )[0]

        if event_type == "TIME":
            event_str = f"TIME;{racer};{generate_time()}"
        else:
            event_str = f"{event_type};{racer}"

        print(f"[{event_num}]", end="")
        send_event(ser, event_str)
        time.sleep(interval)


def interactive_mode(ser):
    """Interaktivní režim - uživatel zadává příkazy"""
    print("\n" + "=" * 55)
    print("  JMLP Časomíra Simulator - Interaktivní režim")
    print("=" * 55)
    print()
    print("Příkazy:")
    print("  t DRES [ČAS]   - TIME (čas). Např: t 10 01:23.45")
    print("                   bez času = náhodný čas")
    print("  dns DRES       - Did Not Start")
    print("  dnf DRES       - Did Not Finish")
    print("  dsq DRES       - Diskvalifikace")
    print("  r TEXT         - odeslat surový text (raw)")
    print("  burst N        - odeslat N náhodných TIME událostí rychle")
    print("  q              - ukončit")
    print()
    print("Příklady:")
    print("  t 10 01:23.45  -> TIME;10;01:23.45")
    print("  t 10           -> TIME;10;00:42.17  (náhodný čas)")
    print("  dns 5          -> DNS;5")
    print("  burst 10       -> 10 náhodných časů")
    print("-" * 55)

    while True:
        try:
            cmd = input("\n> ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nUkončuji...")
            break

        if not cmd:
            continue

        parts = cmd.split()
        action = parts[0].lower()

        if action == "q":
            print("Ukončuji...")
            break

        elif action == "t":
            if len(parts) < 2:
                print("  Chybí číslo závodníka! Použití: t DRES [ČAS]")
                continue
            racer = parts[1]
            time_val = parts[2] if len(parts) >= 3 else generate_time()
            send_event(ser, f"TIME;{racer};{time_val}")

        elif action in ("dns", "dnf", "dsq"):
            if len(parts) < 2:
                print(f"  Chybí číslo závodníka! Použití: {action} DRES")
                continue
            racer = parts[1]
            send_event(ser, f"{action.upper()};{racer}")

        elif action == "r":
            raw = " ".join(parts[1:])
            send_event(ser, raw)

        elif action == "burst":
            count = int(parts[1]) if len(parts) >= 2 else 5
            print(f"  Odesílám {count} náhodných časů...")
            for i in range(count):
                racer = random.randint(1, 30)
                send_event(ser, f"TIME;{racer};{generate_time()}")
                time.sleep(0.3)
            print(f"  Burst hotový ({count} událostí)")

        else:
            print(f"  Neznámý příkaz: {action}")
            print("  Použij: t, dns, dnf, dsq, r, burst, q")


def main():
    parser = argparse.ArgumentParser(
        description="JMLP Časomíra Simulator pro Windows",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Příklady:
  python simulator.py                        # interaktivní, NULL_COM7
  python simulator.py --port COM8            # interaktivní, COM8  
  python simulator.py --auto                 # automatický, 2s interval
  python simulator.py --auto --interval 5    # automatický, 5s interval
  python simulator.py --auto --racers 20     # 20 závodníků
        """,
    )
    parser.add_argument(
        "--port",
        default="NULL_COM7",
        help="Sériový port pro odesílání (default: NULL_COM7)",
    )
    parser.add_argument(
        "--baud", type=int, default=9600, help="Baud rate (default: 9600)"
    )
    parser.add_argument(
        "--auto", action="store_true", help="Automatický režim (náhodné události)"
    )
    parser.add_argument(
        "--interval",
        type=float,
        default=2.0,
        help="Interval mezi událostmi v auto režimu (default: 2s)",
    )
    parser.add_argument(
        "--racers",
        type=int,
        default=15,
        help="Počet závodníků v auto režimu (default: 15)",
    )
    args = parser.parse_args()

    print(f"Připojuji se na {args.port} @ {args.baud} baud...")

    try:
        ser = serial.Serial(args.port, args.baud, timeout=1)
    except serial.SerialException as e:
        print(f"\nCHYBA: Nelze otevřít port {args.port}!")
        print(f"Detail: {e}")
        print()
        print("Zkontroluj:")
        print("  1. Je ELTIMA Virtual Serial Port spuštěný?")
        print("  2. Existuje pár COM7 <-> NULL_COM7?")
        print(f"  3. Není port {args.port} používán jiným programem?")
        print()
        print("Dostupné porty:")
        try:
            from serial.tools import list_ports
            ports = list(list_ports.comports())
            if ports:
                for p in ports:
                    print(f"  - {p.device}: {p.description}")
            else:
                print("  (žádné porty nenalezeny)")
        except Exception:
            print("  (nelze zjistit)")
        sys.exit(1)

    print(f"Připojeno na {args.port}!")

    try:
        if args.auto:
            auto_mode(ser, args.interval, args.racers)
        else:
            interactive_mode(ser)
    except KeyboardInterrupt:
        print("\nUkončuji...")
    finally:
        ser.close()
        print("Port uzavřen.")


if __name__ == "__main__":
    main()
