# Smaller Hours

## Add a Study post

1. Copy `content/posts/_template.md` and rename it using the article URL, for example `a-study-in-wood.md`.
2. Put the article images in `images/`.
3. Edit the short details block and the Overview, Gallery, Quote, and Article sections.
4. Keep `status: draft` while writing. Change it to `status: published` when ready.
5. Run `npm run build:posts` from this folder.

The build refreshes `study.html` and creates the individual article page automatically. Thumbnail dimensions, article metadata, navigation, typography, and image layouts remain consistent for every post.

### Writing images

Use this format on its own line:

```markdown
![A useful description of the image](images/your-image.jpg)
```

Images under Gallery use the editorial two-column layout. Images placed under Article become full-width editorial breaks between text sections.

## Add Inspiration images

1. Put portrait images in `images/inspiration/portrait/` and landscape images in `images/inspiration/landscape/`.
2. Open `content/inspiration.md`.
3. Add each image under Portrait or Landscape using the image format shown in that file.
4. Run `npm run build:inspiration`, or run `npm run build` to refresh both Study and Inspiration.

Portrait frames use a 3:4 width-to-height ratio. Landscape frames use a 3:2 width-to-height ratio. Images are automatically cropped to those consistent dimensions.
