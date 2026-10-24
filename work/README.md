# work/ — hand-over material for agent batches

Nothing in this folder is published or read by the pipeline. It keeps what the agent rounds of October 2026 used, so a new environment can continue without the old scratch folder (`.work/`, which is gitignored).

To use it, copy it into place: `mkdir -p .work && cp -r work/briefs/*.md work/tools/*.mjs .work/ && cp -r work/jobs .work/jobs`.

- `briefs/`: the instructions given to each kind of agent job.
  - `BRIEF.md`: quality bar, sources, tools and network rules. Every job reads it.
  - `VERIFY.md`: how an independent reviewer checks a batch.
  - `ROUND4.md`: lessons learned and where logos were found.
  - `LOGOFIX.md`: replacing placeholder logos.
  - `INSTITUTIONS.md` and `INDIA-BRANDS.md`: institution and brand records.
- `tools/`
  - `merge.mjs`: merges the outputs of job folders (`.work/out/<job>/`) into the repository. Run `node .work/merge.mjs` for a dry run; `--write` applies the changes, and `SKIP_JOBS=a,b` skips those folders. Run `apply-aliases`, `sync`, `render-png`, `sync`, `build-api` and `npm test` afterwards.
  - `wm-download.mjs`: a single-threaded Wikimedia Commons downloader that honours `retry-after`. It reads its queue from `.work/wm-queue/*.tsv`.
  - `pdfvec.py`: copies the vector paths inside a rectangle of a PDF page into an SVG, without redrawing anything. Run it as `python3 -I pdfvec.py PDF PAGE x0 y0 x1 y1 OUT.svg`; it needs `pymupdf`.
- `jobs/`: the job lists that were not finished; see TODO.md, section 0.
  - `india-hd-5`…`8`: Indian companies that need an official HD logo.
  - `india-officers-3`/`4`: CEO and chair for Indian companies ranked about 1,000–2,000.
- `unreviewed/`: drafts from jobs stopped before review. They are **not verified and not in the catalogue**. Each one must be reviewed under `briefs/VERIFY.md` before it is used.
  - `hd/`: 107 HD logo files.
  - `india-hd-*-logos.json`: source records for some of those files.
  - `india-officers-3-profiles.json`: officers for part of ranks 1,000–1,500.
