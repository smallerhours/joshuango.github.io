# Smaller Hours

Smaller Hours is an image-first photography portfolio. The existing Markdown publishing system remains the source of truth: each file in `content/posts/` represents one photographic project, and the build step updates the home gallery, Work index, and individual project page together.

## Add a photography project

1. Duplicate a Markdown file in `content/posts/`.
2. Replace the title, slug, project number, category, credits, hero image, and image descriptions.
3. Put additional photographs under `## Gallery` using normal Markdown image syntax.
4. Keep `## Overview` to one short paragraph; it is the only project description shown.
5. Run `npm run build:posts`.

The first published project by date becomes the full-screen home image. Its additional photographs and the remaining projects populate the home gallery automatically. Original longer notes can stay in Markdown without appearing on the image-led project page.

### Adding images

Use this format on its own line:

```markdown
![A useful description of the image](images/your-image.jpg)
```

Images under Gallery form the alternating visual sequence. Images under Article are also included, allowing older Markdown files to keep working. Portrait and landscape photographs preserve their natural proportions.

While editing, run `npm run dev:posts` once. Every save refreshes the homepage, Work index, and project pages. When a project Markdown file is committed to `main`, the GitHub workflow rebuilds and publishes the portfolio automatically.
