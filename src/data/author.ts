export type Author = {
  name: string
  bio: string
  avatar: string
  twitter?: string
  url?: string
}

// TODO: when a second author appears, convert this into an `authors`
// content collection and switch the blog schema's `author` field to
// `reference('authors')`.
export const AUTHORS: Record<string, Author> = {
  'Deji Dipeolu': {
    name: 'Deji Dipeolu',
    bio: 'Learner, Reader, Writer, Founder and Idea Compounder.',
    avatar: '/authors/deji.png',
    twitter: '@surfcapp',
    url: 'https://dejidipe.com',
  },
}
