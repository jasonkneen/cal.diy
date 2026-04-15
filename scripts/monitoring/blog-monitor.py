#!/usr/bin/env python3
"""
Cal.diy: Cal.com Blog Monitor
Scrapes cal.com/blog for new posts and detects feature announcements.
Outputs a markdown report of new/relevant posts.
"""

import json
import re
import ssl
import sys
from datetime import datetime, timezone, timedelta
from urllib.request import urlopen, Request
from urllib.error import URLError
from html.parser import HTMLParser

# Create an SSL context that works on macOS and CI
try:
    import certifi
    SSL_CTX = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    SSL_CTX = ssl.create_default_context()
    SSL_CTX.check_hostname = False
    SSL_CTX.verify_mode = ssl.CERT_NONE

BLOG_URL = "https://cal.com/blog"
CHANGELOG_URL = "https://cal.com/changelog"
FEATURE_KEYWORDS = [
    "feature", "launch", "new", "introducing", "release", "update",
    "workflow", "routing", "team", "organization", "enterprise",
    "insight", "analytics", "sso", "saml", "api", "integration",
    "embed", "webhook", "automation", "ai", "phone", "instant",
    "booking", "calendar", "schedule", "video", "recording",
    "transcription", "payment", "stripe", "round robin",
    "attribute", "segment", "permission", "audit", "impersonation",
    "open source", "self-host", "docker", "deploy", "cal.diy",
]


class BlogPostParser(HTMLParser):
    """Extract blog post titles, URLs, dates, and descriptions from cal.com/blog"""

    def __init__(self):
        super().__init__()
        self.posts = []
        self.in_article = False
        self.in_title = False
        self.in_date = False
        self.in_description = False
        self.current_post = {}
        self.current_data = ""
        self.tag_stack = []

    def handle_starttag(self, tag, attrs):
        attrs_dict = dict(attrs)
        self.tag_stack.append(tag)

        if tag == "article" or (tag == "a" and "blog" in attrs_dict.get("href", "")):
            if tag == "a" and "/blog/" in attrs_dict.get("href", ""):
                href = attrs_dict["href"]
                if not href.startswith("http"):
                    href = f"https://cal.com{href}"
                self.current_post["url"] = href

        if tag in ("h1", "h2", "h3") and attrs_dict.get("class", ""):
            self.in_title = True
            self.current_data = ""

        if tag == "time":
            self.in_date = True
            self.current_data = ""
            if "datetime" in attrs_dict:
                self.current_post["date"] = attrs_dict["datetime"]

    def handle_endtag(self, tag):
        if self.tag_stack:
            self.tag_stack.pop()

        if self.in_title and tag in ("h1", "h2", "h3"):
            self.in_title = False
            title = self.current_data.strip()
            if title and len(title) > 5:
                self.current_post["title"] = title

        if self.in_date and tag == "time":
            self.in_date = False
            if "date" not in self.current_post:
                self.current_post["date"] = self.current_data.strip()

        # Save post when we have enough data
        if self.current_post.get("title") and self.current_post.get("url"):
            if self.current_post not in self.posts:
                self.posts.append(self.current_post.copy())
            self.current_post = {}

    def handle_data(self, data):
        if self.in_title or self.in_date:
            self.current_data += data


def fetch_page(url: str) -> str:
    """Fetch a web page and return its HTML content."""
    req = Request(url, headers={"User-Agent": "Cal.diy-Agent-S/1.0"})
    try:
        with urlopen(req, timeout=30, context=SSL_CTX) as resp:
            return resp.read().decode("utf-8", errors="replace")
    except URLError as e:
        print(f"Error fetching {url}: {e}", file=sys.stderr)
        return ""


def score_post(title: str, description: str = "") -> tuple[int, list[str]]:
    """Score a blog post by feature relevance. Returns (score, matched_keywords)."""
    text = f"{title} {description}".lower()
    matched = [kw for kw in FEATURE_KEYWORDS if kw in text]
    return len(matched), matched


def main():
    print("# Cal.diy: Cal.com Blog Monitor Report")
    print(f"# Generated: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}")
    print()

    # Fetch blog page
    html = fetch_page(BLOG_URL)
    if not html:
        print("ERROR: Could not fetch blog page")
        sys.exit(1)

    parser = BlogPostParser()
    parser.feed(html)

    posts = parser.posts
    if not posts:
        # Fallback: try to extract links with simple regex
        links = re.findall(r'href="(/blog/[^"]+)"[^>]*>([^<]+)', html)
        for href, title in links:
            url = f"https://cal.com{href}" if not href.startswith("http") else href
            posts.append({"url": url, "title": title.strip(), "date": ""})

    if not posts:
        print("No blog posts found. The page structure may have changed.")
        print(f"Manual check needed: {BLOG_URL}")
        sys.exit(0)

    print(f"Found {len(posts)} blog posts\n")

    # Score and sort by relevance
    scored_posts = []
    for post in posts:
        score, keywords = score_post(post.get("title", ""), post.get("description", ""))
        post["score"] = score
        post["keywords"] = keywords
        scored_posts.append(post)

    scored_posts.sort(key=lambda p: p["score"], reverse=True)

    # Report high-relevance posts
    high_relevance = [p for p in scored_posts if p["score"] >= 2]
    medium_relevance = [p for p in scored_posts if p["score"] == 1]

    if high_relevance:
        print("## 🔴 HIGH RELEVANCE (likely new features)")
        for post in high_relevance:
            print(f"- **{post.get('title', 'Unknown')}**")
            print(f"  URL: {post.get('url', 'N/A')}")
            print(f"  Date: {post.get('date', 'Unknown')}")
            print(f"  Keywords: {', '.join(post.get('keywords', []))}")
            print(f"  Score: {post['score']}")
            print()

    if medium_relevance:
        print("## 🟡 MEDIUM RELEVANCE")
        for post in medium_relevance:
            print(f"- {post.get('title', 'Unknown')}")
            print(f"  URL: {post.get('url', 'N/A')}")
            print()

    # All posts for reference
    print("## 📋 All Posts Found")
    for post in scored_posts:
        marker = "🔴" if post["score"] >= 2 else "🟡" if post["score"] == 1 else "⚪"
        print(f"{marker} {post.get('title', 'Unknown')} ({post.get('date', '?')})")

    # Output machine-readable JSON for downstream processing
    print("\n---")
    print("<!-- MACHINE_READABLE_DATA")
    print(json.dumps(scored_posts, indent=2, default=str))
    print("-->")


if __name__ == "__main__":
    main()
