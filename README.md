# Smaller Hours

## Add a Study post

1. Copy `content/posts/_template.md` and rename it using the article URL, for example `a-study-in-wood.md`.
2. Put the article images in `images/`.
3. Edit the short details block and the Overview, Gallery, Quote, and Article sections.
4. Keep `status: draft` while writing. Change it to `status: published` when ready.
5. Run `npm run build:posts` from this folder.

The build refreshes `study.html` and creates the individual article page automatically. Thumbnail dimensions, article metadata, navigation, typography, and image layouts remain consistent for every post.

The homepage is refreshed at the same time. The newest published post becomes the large opening feature. Older posts follow below in reverse chronological order using the repeating layout: one landscape card, then two portrait cards.

### Writing images

Use this format on its own line:

```markdown
![A useful description of the image](images/your-image.jpg)
```

Images under Gallery use the editorial two-column layout. Images placed under Article become full-width editorial breaks between text sections.

## Add Inspiration images

For the first use only, install the image preparation tool with `python3 -m pip install -r requirements.txt`.

1. Put original portrait images in `images/inspiration/uploads/portrait/` and original landscape images in `images/inspiration/uploads/landscape/`.
2. Name each file with the caption you want, for example `weathered-oak-chair.jpg`.
3. Run `npm run build:inspiration`, or run `npm run build` to refresh both Study and Inspiration.
4. If needed, refine the automatically generated description in `content/inspiration.md`.

The build automatically rotates, center-crops, resizes, strips unnecessary metadata, converts to WebP, and compresses every image below 950 KB. Portrait outputs are up to 1500 × 2000 pixels (3:4). Landscape outputs are up to 2400 × 1600 pixels (3:2). Those dimensions preserve crisp detail on common 2× high-density screens without sending full camera-resolution files.

The original uploads stay in the ignored `uploads` folders as local source files. Only the optimized WebP images are published. JPEG, PNG, WebP, TIFF, and TIF uploads are supported.
