# Joshua Ngo — Publishing

The homepage remains separately curated. Building articles does not change `index.html`.

## Create an article

Copy `content/posts/_template.md` to a new Markdown file in the same folder. Set a unique slug, title, date, category, excerpt, hero image, and image description. Set `topics` to comma-separated collection names, for example `Architecture, Seoul`. Set `type` to `article`, `page`, or `project`.

- `article`: a story with an introduction, full text, photographs, and optional quote.
- `page`: the same flexible layout, available at its own URL but excluded from story collections and related stories.
- `project`: retains the alternating project photograph sequence, with full text also available.

Write introductory paragraphs under `## Overview`. Write the full story under `## Article`, placing images between paragraphs wherever they belong. Add an optional pull quote under `## Quote`. `## Gallery` adds a photo essay after the story. Use blank lines between paragraphs and images. Plain paragraphs and external Markdown links are supported; section headings are reserved for these named sections.

```markdown
![Describe the photograph](images/your-photo.jpg "Optional visible caption")
```

Captions are optional. Without one, gallery and story photographs use the photography credit. Image descriptions remain accessibility text, separate from captions. Set `author` for the byline and `photography` for image credits.

Keep `status: draft` while working. Change to `published` and run `npm run build:posts` to generate the article, Work index, `topics.html`, and a collection page for each topic. The existing GitHub workflow builds committed content. Use `npm run dev:posts` to rebuild on saves locally.

Topic names link to their generated collections below each article's byline. Related stories share a topic. Standalone pages need to be linked from another page or shared by URL. Slugs `index`, `study`, `personal`, `about`, `topics`, and those beginning with `topic-` are reserved.
