#!/usr/bin/env python3
"""Download invoice PDFs from Gmail (IMAP) and upload them to Google Drive (rclone).

Config is read from /opt/invoice-fetcher/invoices.env (see invoices.env.example).
Runs once per invocation; schedule it with the systemd timer.
"""
import email
import email.utils
import imaplib
import json
import os
import re
import subprocess
import sys
from datetime import datetime
from email.header import decode_header, make_header
from pathlib import Path

BASE = Path(os.environ.get("INVOICES_HOME", "/opt/invoice-fetcher"))
STATE_FILE = BASE / "state.json"
OUT_DIR = BASE / "invoices"

# sender address (lowercase) -> supplier name used in the file name
SENDERS = {
    "noreply.billing@hetzner.com": "Hetzner",
}
# whole domains (any sender from them)
SENDER_DOMAINS = {
    "forpsi.com": "Forpsi",
}


def load_env():
    env_file = BASE / "invoices.env"
    if env_file.exists():
        for line in env_file.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip('"'))


def supplier_for(addr):
    addr = addr.lower()
    if addr in SENDERS:
        return SENDERS[addr]
    domain = addr.rsplit("@", 1)[-1]
    for d, name in SENDER_DOMAINS.items():
        if domain == d or domain.endswith("." + d):
            return name
    return None


# (type label, keywords in subject, lowercase, without diacritics); first match wins
DOC_TYPES = [
    ("upominka", ["upominka", "upozorneni", "reminder", "pripominka", "neuhrazen", "nezaplacen"]),
    ("zaplaceno", ["zaplacen", "uhrazen", "prijeti platby", "payment received", "payment confirmation"]),
    ("proforma", ["proforma", "zalohov", "vyzva k platbe", "vyzva k uhrade"]),
    ("faktura", ["faktura", "invoice", "danovy doklad", "rechnung"]),
]
SKIP_TYPES = {"upominka"}


def strip_accents(text):
    import unicodedata
    return "".join(c for c in unicodedata.normalize("NFKD", text) if not unicodedata.combining(c))


def doc_type(subject, supplier):
    s = strip_accents(subject).lower()
    for label, words in DOC_TYPES:
        if any(w in s for w in words):
            return label
    return "faktura" if supplier == "Hetzner" else "doklad"


def safe(name):
    name = re.sub(r"[^\w.\-]+", "_", name, flags=re.UNICODE).strip("._")
    return name or "faktura.pdf"


def decode(value):
    return str(make_header(decode_header(value or "")))


def main():
    load_env()
    user = os.environ["GMAIL_USER"]
    password = os.environ["GMAIL_APP_PASSWORD"]
    remote = os.environ.get("RCLONE_REMOTE", "gdrive:invoices")
    since = os.environ.get("SINCE", "01-Jan-2026")

    state = json.loads(STATE_FILE.read_text()) if STATE_FILE.exists() else {"done": []}
    done = set(state["done"])
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    imap = imaplib.IMAP4_SSL("imap.gmail.com")
    imap.login(user, password)
    imap.select('"[Gmail]/All Mail"', readonly=True)

    queries = [f'(FROM "{a}" SINCE {since})' for a in SENDERS]
    queries += [f'(FROM "{d}" SINCE {since})' for d in SENDER_DOMAINS]
    uids = set()
    for q in queries:
        typ, data = imap.uid("SEARCH", None, q)
        if typ == "OK":
            uids.update(data[0].split())

    new_files = []
    for uid in sorted(uids, key=int):
        typ, data = imap.uid("FETCH", uid, "(RFC822)")
        if typ != "OK" or not data or not data[0]:
            continue
        msg = email.message_from_bytes(data[0][1])
        msg_id = msg.get("Message-ID", f"uid-{uid.decode()}").strip()
        if msg_id in done:
            continue
        _, addr = email.utils.parseaddr(msg.get("From", ""))
        supplier = supplier_for(addr)
        if not supplier:
            continue
        subject = decode(msg.get("Subject"))
        kind = doc_type(subject, supplier)
        if kind in SKIP_TYPES:
            print(f"skip {kind}: {subject}")
            done.add(msg_id)
            continue
        try:
            date = email.utils.parsedate_to_datetime(msg["Date"]).strftime("%Y-%m-%d")
        except Exception:
            date = datetime.now().strftime("%Y-%m-%d")

        for part in msg.walk():
            fname = part.get_filename()
            ctype = part.get_content_type()
            if not (ctype == "application/pdf" or (fname and fname.lower().endswith(".pdf"))):
                continue
            fname = safe(decode(fname) if fname else "faktura.pdf")
            if not fname.lower().endswith(".pdf"):
                fname += ".pdf"
            # drop "Supplier_" / "YYYY-MM-DD_" prefix already present in the attachment name
            fname = re.sub(rf"^({re.escape(supplier)}_)?(\d{{4}}-\d{{2}}-\d{{2}}_)?", "", fname, flags=re.I)
            target = OUT_DIR / f"{supplier}_{kind}_{date}_{fname}"
            payload = part.get_payload(decode=True)
            if payload:
                target.write_bytes(payload)
                new_files.append(target)
                print(f"saved {target.name}  ({subject})")
        done.add(msg_id)

    imap.logout()

    if new_files:
        # copy never deletes anything on Drive; existing identical files are skipped
        subprocess.run(["rclone", "copy", str(OUT_DIR), remote], check=True)
        print(f"uploaded {len(new_files)} file(s) to {remote}")
    else:
        print("no new invoices")

    state["done"] = sorted(done)
    STATE_FILE.write_text(json.dumps(state, indent=1))


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)
