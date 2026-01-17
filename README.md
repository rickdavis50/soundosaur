# Soundosaur

A single-page audio toy built with Vite, React, TypeScript, and Tailwind.

## Assets
Place the PNGs in `public/assets` as follows:

- `public/assets/body.png`
- `public/assets/tentacles/t01.png` through `public/assets/tentacles/t06.png`
- `public/assets/tentacles_active/t01.png` through `public/assets/tentacles_active/t06.png`

If any files are missing, the app shows a centered message and renders fallback layers so you can still test interactions.

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Tuning Tentacle Origins
Use the Debug toggle in the top-right to display bounding boxes and origin points. Edit the origin percentages in `src/components/Stage.tsx` to fine-tune alignment.
