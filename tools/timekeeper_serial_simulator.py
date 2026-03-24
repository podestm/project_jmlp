#!/usr/bin/env python3
"""Simple serial event simulator for Timekeeper bridge.

Usage:
  py -m pip install pyserial
  py tools/timekeeper_serial_simulator.py --serial-port COM6 --baud 9600
"""

from __future__ import annotations

import argparse
import time

import serial  # type: ignore


def main() -> None:
    parser = argparse.ArgumentParser(description="Timekeeper serial simulator")
    parser.add_argument("--serial-port", required=True, help="Serial port (e.g. COM6)")
    parser.add_argument("--baud", type=int, default=9600, help="Baud rate")
    parser.add_argument("--delay", type=float, default=1.5, help="Delay between events")
    args = parser.parse_args()

    events = [
        "TIME;10;00:52.41",
        "TIME;10;00:52.41",  # duplicate for dedup test
        "TIME;10;00:51.90",
        "TIME;11;00:56.07",
        "DSQ;11",
        "DNS;12",
        "DNF;13",
    ]

    with serial.Serial(args.serial_port, args.baud, timeout=1) as ser:
        print(f"[sim] sending to {args.serial_port} @ {args.baud}")
        while True:
            for event in events:
                line = f"{event}\n".encode("utf-8")
                ser.write(line)
                print(f"[sim] {event}")
                time.sleep(args.delay)


if __name__ == "__main__":
    main()
