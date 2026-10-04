# Security Policy

## Reporting a problem

Please do not open a public issue for a security problem. Write to [contact@mrchartist.com](mailto:contact@mrchartist.com) with a short description and the file or URL concerned. We will reply as soon as we can.

## What counts

- A logo file that contains a script, an external link or any active content.
- A workflow or script that could run untrusted code or leak a secret.

Logo SVGs are expected to be plain vector art. `npm run quality` checks that they are well-formed; if you use logos inline in a page, keep serving them from `<img>` tags or sanitise them first.
