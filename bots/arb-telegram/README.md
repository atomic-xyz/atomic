# ATOMIC arbitrage watcher for Telegram

A private bot. Every 15 seconds it reads the public snapshot, finds pool pairs whose quoted gap is close to paying, simulates them through the live AtomicArb contract at several sizes, and messages you only when the simulated result is positive after pool fees, price impact and the ATOMIC fee. It never shows a gap that cannot be taken. Nothing is sent on chain.

Commands: `/scan [SYM]`, `/route SYM`, `/status`, `/min <usd>`, `/sizes 50,250,1000`, `/watch on|off`.

## Run it on your machine (PowerShell)

```
cd C:\Projects\Zoom\atomic\bots\arb-telegram
npm install
Copy-Item .env.example .env
# open .env and paste the token from @BotFather
node --env-file=.env bot.mjs
```

Send `/start` to the bot. The first chat that does so becomes the owner; put the id it replies with into `ALLOWED_CHAT_IDS` so a restart keeps it.

Dry run without Telegram, one scan printed to the terminal:

```
$env:DRY="1"; node bot.mjs
```

## Run it on Railway

Deploy this folder as its own service (`railway up` from inside it) and set the same variables on the service.
