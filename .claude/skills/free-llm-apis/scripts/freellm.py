#!/usr/bin/env python3
"""Ask a free LLM API, falling back across providers. Stdlib only.

  freellm.py list                      providers, key status, key links
  freellm.py ask "prompt" [-p NAME]    first working provider (or only NAME)
  freellm.py check                     one-line test of every usable provider

Keys come from environment variables (see .env.example). A .env file in the
current directory or next to this skill is loaded if present. Never commit keys.
"""
import argparse, json, os, sys, urllib.request, urllib.error

HERE = os.path.dirname(os.path.abspath(__file__))
PROVIDERS = json.load(open(os.path.join(HERE, "providers.json")))


def load_env():
    for d in (os.getcwd(), os.path.dirname(HERE)):
        f = os.path.join(d, ".env")
        if os.path.isfile(f):
            for line in open(f):
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    os.environ.setdefault(k.strip(), v.strip().strip('"\''))


def usable(p):
    if p["envVar"] and os.environ.get(p["envVar"]):
        return True
    return bool(p.get("keyless"))


def call(p, prompt, model=None, timeout=60):
    base = p["baseUrl"].format(**os.environ) if "{" in p["baseUrl"] else p["baseUrl"]
    body = json.dumps({"model": model or p["models"][0],
                       "messages": [{"role": "user", "content": prompt}],
                       "max_tokens": 400}).encode()
    h = {"Content-Type": "application/json", "User-Agent": "freellm/1.0"}
    key = os.environ.get(p["envVar"] or "")
    if key:
        h["Authorization"] = "Bearer " + key
    req = urllib.request.Request(base.rstrip("/") + "/chat/completions", body, h)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.load(r)["choices"][0]["message"]["content"]


def main():
    load_env()
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("list")
    sub.add_parser("check")
    a = sub.add_parser("ask")
    a.add_argument("prompt")
    a.add_argument("-p", "--provider")
    a.add_argument("-m", "--model")
    args = ap.parse_args()

    if args.cmd == "list":
        for p in PROVIDERS:
            st = "ready" if usable(p) else "no key"
            print(f"{p['name']:<24} {st:<7} {p['envVar'] or '-':<20} {p['keyUrl']}")
        return
    todo = [p for p in PROVIDERS if usable(p)
            and (args.cmd == "check" or not args.provider
                 or args.provider.lower() in p["name"].lower())]
    if not todo:
        sys.exit("No usable provider. Run `list`, get a key, and set it (see .env.example).")
    for p in todo:
        try:
            out = call(p, "Say hello in one sentence." if args.cmd == "check" else args.prompt,
                       getattr(args, "model", None))
            print(f"[{p['name']}] " + (out.strip()[:120] if args.cmd == "check" else ""))
            if args.cmd == "ask":
                print(out)
                return
        except Exception as e:
            code = e.code if isinstance(e, urllib.error.HTTPError) else type(e).__name__
            print(f"[{p['name']}] failed: {code}", file=sys.stderr)
    if args.cmd == "ask":
        sys.exit("All providers failed.")


if __name__ == "__main__":
    main()
