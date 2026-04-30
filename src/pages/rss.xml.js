import rss from '@astrojs/rss'
import { getCollection } from 'astro:content'
import { isPublished, sortByDateDesc } from '../utils/blog'

export async function GET(context) {
  const posts = (await getCollection('blog', isPublished)).sort(sortByDateDesc)
  return rss({
    title: 'Surfc — Founder notes',
    description:
      "Founder notes, demos, and product writing from the team building Surfc — a personal index of the great ideas you've read.",
    site: context.site ?? 'https://surfc.app',
    items: posts.map((post) => {
      const slug = post.id.replace(/\.(md|mdx)$/, '')
      return {
        title: post.data.title,
        description: post.data.description,
        pubDate: post.data.pubDate,
        link: `/blog/${slug}/`,
        author: post.data.author,
        categories: post.data.tags,
      }
    }),
    customData: '<language>en-gb</language>',
  })
}
