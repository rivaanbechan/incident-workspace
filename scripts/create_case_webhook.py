#!/usr/bin/env python3

import json
import sys

import requests


WEBHOOK_URL = "https://incident.local/api/webhooks/cases"
WEBHOOK_SECRET = "dev-case-webhook-secret"

payload = {
    "title": "Suspicious identity activity in production",
    "summary": "Generated from a Python webhook client.",
    "severity": "high",
    "owner": "admin@incident.local",
    "source": {
        "system": "splunk",
        "externalId": "python-example-001",
    },
    "entities": [
        {
            "id": "alice@example.com",
            "kind": "identity",
            "label": "alice@example.com",
        },
        {
            "id": "10.20.30.40",
            "kind": "ip",
            "label": "10.20.30.40",
        },
    ],
}


def main() -> int:
    response = requests.post(
        WEBHOOK_URL,
        headers={
            "Authorization": f"Bearer {WEBHOOK_SECRET}",
            "Content-Type": "application/json",
        },
        json=payload,
        timeout=15,
        verify=False,
    )

    print(f"Status: {response.status_code}")

    try:
        body = response.json()
    except ValueError:
        print(response.text)
        return 1

    print(json.dumps(body, indent=2))
    return 0 if response.ok else 1


if __name__ == "__main__":
    sys.exit(main())
