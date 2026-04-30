import type { CollectionEntry } from 'astro:content'

type BlogEntry = CollectionEntry<'blog'>

export function isPublished(entry: BlogEntry): boolean {
  return import.meta.env.PROD ? !entry.data.draft : true
}

export function sortByDateDesc(a: BlogEntry, b: BlogEntry): number {
  return b.data.pubDate.valueOf() - a.data.pubDate.valueOf()
}

export const PAGE_SIZE = 5
