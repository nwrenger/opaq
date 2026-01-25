# short

Shorten and obfuscate URLs into compact, opaque links. Everything happens in your browser for instant, private, and secure results. Built with `Svelte` and `Skeleton`.

## Highlights

- **Private by design**: Links are transformed inside the browser and never leave the page.
- **Opaque but friendly**: Output is short enough to share anywhere without revealing the destination.
- **Instant redirect**: `/s` links decode themselves and jump to the original page right away.
- **Installable PWA**: Add it to your home screen and keep using it even if you’re offline.
- **Clipboard ready**: Copy buttons use a reusable action so they work consistently on desktop and mobile.
- **Static hosting**: The whole app prerenders, so any static host can serve it.

## How it works

### Encoding (creating short links)

1. **Prepare the link**: Inputs are trimmed and given a protocol (https://) if they’re missing one.
2. **Pack the text**: Common URL fragments (domains, query keys, path pieces) are swapped with tiny markers and the rest of the text is left as-is. This keeps the link readable to the app but shorter overall.
3. **Compress and encode**: The packed link is run through Brotli compression and then converted to URL-safe Base64. A short prefix (`~`, `!`, or `.`) is attached to indicate which packing strategy produced the best result.
4. **Share**: The finished string becomes the query key for `/s?ENCODED`, giving you a compact link you can paste anywhere.

### Decoding (visiting short links)

1. **Read the payload**: grabs the first key from the query string; that key is the encoded payload.
2. **Reverse the prefix**: Based on the prefix, the app knows whether to simply unpack tokens or to both decompress and unpack.
3. **Open the destination**: Once the original URL is restored, the page navigates to the decoded url without any server involvement.

If you want to inspect the exact steps, check `src/lib/brotli.ts` and `src/lib/base64.ts`.

## Project structure

```
src/
├─ lib/               # Encoding helpers, clipboard action, shared UI
├─ routes/
│  ├─ +page.svelte    # Main shortening UI
│  ├─ s/+page.svelte  # Redirector that decodes and navigates
│  ├─ +layout.svelte  # Layout wrapper
│  └─ layout.css      # Skeleton/Tailwind theme overrides
└─ app.html           # Base document + theme + meta tags
```

## Getting started

```bash
# install dependencies with Bun
bun install

# start the dev server
bun run dev
```

The app runs on `http://localhost:5173`. When you’re ready to ship:

```bash
bun run build   # prerender to build/
bun run preview # serve the production build locally
```

## Contributing & Issues

Although **clash** is out of **beta**, I still welcome:

- Bug reports
- Feature requests
- Pull requests

Please open issues or PRs on [GitHub](https://github.com/nwrenger/short/issues).

## License

This project is licensed under the **MIT License**. See [LICENSE](./LICENSE) for details.
