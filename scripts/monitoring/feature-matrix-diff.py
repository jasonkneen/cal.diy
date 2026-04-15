#!/usr/bin/env python3
"""
Cal.diy: Feature Matrix Diff
Scrapes cal.com/pricing and compares against our tracked feature matrix.
Outputs a diff report showing new features, changed tiers, and parity score.
"""

import json
import re
import sys
from datetime import datetime
from urllib.request import urlopen, Request
from urllib.error import URLError

PRICING_URL = "https://cal.com/pricing"

# Our current known feature matrix (from the parity report)
# This gets updated by the script when new features are detected
KNOWN_FEATURES = {
    # Features we HAVE in cal.diy
    "have": [
        "Unlimited event types",
        "Unlimited calendars",
        "Unlimited meetings",
        "100+ integrations",
        "Cal Video",
        "Customizable booking links",
        "Recurring events",
        "Buffer times",
        "Minimum notice",
        "Calendar sync",
        "Email notifications",
        "Embeddable widgets",
        "API v2",
        "Webhooks",
        "Payment collection (Stripe, PayPal, HitPay, BTCPay)",
        "Custom availability",
        "Out of Office",
        "Form builder",
        "Bot detection (Turnstile)",
        "Feature flags",
        "Web push notifications",
    ],
    # Features we're MISSING (removed in the closed-source split)
    "missing": [
        "Teams",
        "Round-robin scheduling",
        "Collective scheduling",
        "Routing forms",
        "Workflows / Automations",
        "Insights / Analytics dashboard",
        "Organizations / Multi-tenant",
        "SSO / SAML",
        "Instant booking",
        "AI Phone agent",
        "Attributes & Segments",
        "PBAC (Permission-based access control)",
        "Delegation credentials",
        "Booking audit trail",
        "Admin impersonation",
    ],
    # Features we ADDED beyond cal.com
    "bonus": [
        "One-click Docker deployment",
        "Pre-built multi-arch Docker images",
        "Full MIT license (no AGPL restrictions)",
        "Zero telemetry by default",
        "All features free (no tier gating)",
    ],
}


def fetch_page(url: str) -> str:
    req = Request(url, headers={"User-Agent": "Cal.diy-Agent-S/1.0"})
    try:
        with urlopen(req, timeout=30) as resp:
            return resp.read().decode("utf-8", errors="replace")
    except URLError as e:
        print(f"Error fetching {url}: {e}", file=sys.stderr)
        return ""


def extract_features_from_html(html: str) -> dict:
    """Extract feature lists from the pricing page HTML."""
    features = {
        "individual": [],
        "team": [],
        "organization": [],
        "enterprise": [],
    }

    # Extract text content, stripping HTML tags
    text = re.sub(r'<[^>]+>', '\n', html)
    text = re.sub(r'\n{3,}', '\n\n', text)

    # Look for feature-like patterns
    feature_pattern = re.compile(r'(?:✓|✔|check|included|yes)\s*([A-Z][^.\n]{5,60})', re.IGNORECASE)
    for match in feature_pattern.finditer(text):
        feature = match.group(1).strip()
        features.setdefault("all", []).append(feature)

    return features


def main():
    print("# Cal.diy: Feature Matrix Diff Report")
    print(f"# Generated: {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}")
    print()

    # Calculate parity score
    total_cloud = len(KNOWN_FEATURES["have"]) + len(KNOWN_FEATURES["missing"])
    have_count = len(KNOWN_FEATURES["have"])
    parity_pct = (have_count / total_cloud * 100) if total_cloud > 0 else 0

    print(f"## Parity Score: {parity_pct:.0f}%")
    print(f"- Features we have: {have_count}")
    print(f"- Features missing: {len(KNOWN_FEATURES['missing'])}")
    print(f"- Bonus features (beyond cal.com): {len(KNOWN_FEATURES['bonus'])}")
    print()

    print("## ✅ Features We Have")
    for f in KNOWN_FEATURES["have"]:
        print(f"  ✅ {f}")
    print()

    print("## ❌ Features Missing (from cal.com cloud)")
    for f in KNOWN_FEATURES["missing"]:
        print(f"  ❌ {f}")
    print()

    print("## 🌟 Bonus Features (we have, they don't)")
    for f in KNOWN_FEATURES["bonus"]:
        print(f"  🌟 {f}")
    print()

    # Try to fetch current pricing page for comparison
    html = fetch_page(PRICING_URL)
    if html:
        print("## 🔍 Pricing Page Scan")
        extracted = extract_features_from_html(html)
        all_features = extracted.get("all", [])
        if all_features:
            # Check for features we don't know about
            known_all = set(f.lower() for f in KNOWN_FEATURES["have"] + KNOWN_FEATURES["missing"])
            new_features = []
            for f in all_features:
                if not any(known in f.lower() or f.lower() in known for known in known_all):
                    new_features.append(f)

            if new_features:
                print("### ⚠️ Potentially NEW features detected on pricing page:")
                for f in new_features[:20]:  # Limit to 20
                    print(f"  ⚠️  {f}")
            else:
                print("No new features detected on pricing page.")
        else:
            print("Could not extract features from pricing page (structure may have changed).")
            print(f"Manual check needed: {PRICING_URL}")
    else:
        print("Could not fetch pricing page.")

    # Output JSON summary
    print("\n---")
    summary = {
        "date": datetime.utcnow().isoformat(),
        "parity_pct": round(parity_pct, 1),
        "have_count": have_count,
        "missing_count": len(KNOWN_FEATURES["missing"]),
        "bonus_count": len(KNOWN_FEATURES["bonus"]),
        "missing": KNOWN_FEATURES["missing"],
    }
    print("<!-- MACHINE_READABLE_DATA")
    print(json.dumps(summary, indent=2))
    print("-->")


if __name__ == "__main__":
    main()
