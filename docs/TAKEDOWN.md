# Takedown and correction requests

This page says how a rights holder, or anyone with a correction, can ask for a logo or a fact to be removed or changed, what happens next, and keeps a public log. It states process, not legal conclusions. For where the logos come from, see [README.md](../README.md#logo-provenance-and-rights) and [DATA-SOURCES.md](../DATA-SOURCES.md).

## Who can ask

- The owner of a trademark or logo, or someone acting for them, who wants a logo removed or replaced with the current official design.
- Anyone who finds a wrong logo, a wrong fact (name, officer, website) or a logo that shows another company.

## How to ask

1. **Preferred:** open an issue with the [Logo removal request](https://github.com/MrChartist/global-stock-logos/issues/new?template=removal-request.yml) template. It is public, so it creates a record.
2. **If you do not want a public issue:** write to the contact in [SECURITY.md](../SECURITY.md). A dedicated takedown address has not been set up yet; the repository owner is to set one and replace this line.

## What to include

- The ticker and market (for example `IN:TCS`), or the brand or institution name, and the URL of the file (`logos/<market>/<TICKER>.svg` or the CDN link).
- Who you are and how you are connected to the logo owner (employee, agent, counsel). A company e-mail address or a link from the owner's own site helps us check quickly.
- What you want: removal, or replacement with the official file (attach it or link to the owner's press kit).
- If you claim the logo is yours, the trademark or copyright registration or the page that shows ownership, if you have it.
- For a wrong fact: the correct value and a source URL.

## What happens

| Step | What we do | Target |
| :--- | :--- | :--- |
| Acknowledge | Reply in the issue or by e-mail, and label it `takedown`. | within 2 working days (proposed) |
| Check | Confirm the requester is the owner or acts for them, and find every file that carries the logo (`logos/`, `logos-hd/`, `png/`, `brands/`, `institutions/`, and `api/` entries). | within 7 days (proposed) |
| Act | Remove the file, or replace it with an official logo. Where a company keeps a ticker but has no logo, the API serves a generated initials badge (`isPlaceholder: true`). Run `npm run sync && npm run api`. Merge to `main`. | within 7 days of the request (proposed) |
| Confirm | Tell the requester, and add a row to the log below. | same day as the change |

**Target response time: 7 days from the request to the change on `main`.** This is a proposal. The owner has to confirm or change it, and it is not a commitment until they do.

Things to know:

- jsDelivr caches files. A removed file can stay available at a pinned URL (a commit or tag) and in the CDN cache for some time. Purging the cache is done through jsDelivr (<https://www.jsdelivr.com/tools/purge>); anyone who hosts the files themselves has to remove them on their side.
- Git history keeps old files. A request to remove a logo from history as well is considered separately.
- If we cannot tell who owns a logo or whether the requester is the owner, we say so in the issue and ask for more.
- Removed logos are not added back unless the owner agrees or the file comes from one of the allowed sources in [CLAUDE.md](../CLAUDE.md) (the owner's own site, an official document, Wikimedia Commons).

## Log

Every request is added here when it is closed. Leave out personal contact details.

| Date received | Date closed | Ticker / brand | Requester (organisation) | Request | Outcome | Issue or commit |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| | | | | | | |
