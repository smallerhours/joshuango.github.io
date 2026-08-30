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
