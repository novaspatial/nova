import type { StaticImageData } from 'next/image'

import imageJamieKuse from '@/images/team/jamie-kuse.jpg'
import imageWillHowie from '@/images/team/will-howie.jpg'
import imageMikeSouthworth from '@/images/team/mike-southworth.jpg'
import imageDanielByrne from '@/images/team/daniel-byrne.jpg'
import imageDougFury from '@/images/team/doug-fury.jpg'
import imageGabrielMacdonald from '@/images/team/gabriel-macdonald.jpg'

export type TeamMember = {
  slug: string
  name: string
  role: string
  bio: string
  image: { src: StaticImageData }
}

export const TEAM_MEMBERS = [
  {
    slug: 'jamie-kuse',
    name: 'Jamie Kuse',
    role: 'Rap/R&B, Pop, Electronic',
    image: { src: imageJamieKuse },
    bio: 'With credits on over a billion streams, Juno award winning engineer Jamie Kuse specializes in a radio ready, modern sound with big bass and hard hitting drums.',
  },
  {
    slug: 'will-howie',
    name: 'Will Howie',
    role: 'Classical, Jazz, New Music',
    image: { src: imageWillHowie },
    bio: 'Will holds a PhD in Sound Recording from McGill University and was a postdoctoral research fellow at Tokyo University of the Arts. He is a recognized innovator in composition, recording, and mixing techniques for 3D immersive audio.',
  },
  {
    slug: 'mike-southworth',
    name: 'Mike Southworth',
    role: 'Post-Production Supervisor',
    image: { src: imageMikeSouthworth },
    bio: 'Mike is an award-winning post-production supervisor and engineer with over 20 years of experience. His work has earned an EMMY and awards from the Junos, Applied Arts, and WCMAs.',
  },
  {
    slug: 'daniel-byrne',
    name: 'Daniel Byrne',
    role: 'Pop, Folk, Rock',
    image: { src: imageDanielByrne },
    bio: "Daniel combines a deep academic background with commercial music industry and audio post expertise, stemming from studies at Queen's University, electroacoustics at Simon Fraser University, and audio engineering at The Trebas Institute.",
  },
  {
    slug: 'doug-fury',
    name: 'Doug Fury',
    role: 'Rock, Pop',
    image: { src: imageDougFury },
    bio: "Doug's 20+ years of experience with award-winning rock acts, combined with his background as a musician and songwriter, allows him to keep musical integrity in a mix.",
  },
  {
    slug: 'gabriel-macdonald',
    name: 'Gabriel Macdonald',
    role: 'Assistant Engineer',
    image: { src: imageGabrielMacdonald },
    bio: 'Gabriel studied Audio Production and Film Composition at Selkirk College and is a graduate of the Canadian College of Performing Arts.',
  },
] as const satisfies readonly TeamMember[]

export function getAuthor(slug: string): TeamMember | undefined {
  return TEAM_MEMBERS.find((m) => m.slug === slug)
}
