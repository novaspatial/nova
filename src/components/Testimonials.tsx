import { Container } from '@/components/Container'
import { FadeIn } from '@/components/FadeIn'
import { SectionIntro } from '@/components/SectionIntro'

const testimonials = [
  {
    body: 'Amet amet eget scelerisque tellus sit neque faucibus non eleifend. Integer eu praesent at a. Ornare arcu gravida natoque erat et cursus tortor consequat at. Vulputate gravida sociis enim nullam ultricies habitant malesuada lorem ac. Tincidunt urna dui pellentesque sagittis.',
    author: {
      name: 'Judith Black',
      role: 'CEO of Tuple',
      imageUrl:
        'https://images.unsplash.com/photo-1494790108377-be9c29b29330?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80',
    },
  },
  {
    body: 'Excepteur veniam labore ullamco eiusmod. Pariatur consequat proident duis dolore nulla veniam reprehenderit nisi officia voluptate incididunt exercitation exercitation elit. Nostrud veniam sint dolor nisi ullamco.',
    author: {
      name: 'Joseph Rodriguez',
      role: 'CEO of Reform',
      imageUrl:
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80',
    },
  },
]

export function Testimonials() {
  return (
    <div className="mt-24 mb-24 sm:mt-40 sm:mb-40 xl:mt-56 xl:mb-56 3xl:mt-72 3xl:mb-72">
      <SectionIntro
        eyebrow="Testimonials"
        title="We have worked with thousands of amazing people"
      />

      <Container className="mt-10 sm:mt-16">
        <FadeIn>
          <div className="mx-auto grid max-w-2xl grid-cols-1 lg:mx-0 lg:max-w-none lg:grid-cols-2">
            {testimonials.map((testimonial, idx) => (
              <div
                key={testimonial.author.name}
                className={
                  idx === 0
                    ? 'flex flex-col pb-6 sm:pb-16 lg:pr-8 lg:pb-0 xl:pr-20'
                    : 'flex flex-col border-t border-white/10 pt-6 sm:pt-16 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-8 xl:pl-20'
                }
              >
                <figure className="mt-6 sm:mt-10 flex flex-auto flex-col justify-between">
                  <blockquote className="text-xs sm:text-lg/8 3xl:text-xl/9 text-white">
                    <p>{`"${testimonial.body}"`}</p>
                  </blockquote>
                  <figcaption className="mt-6 sm:mt-10 flex items-center gap-x-4 sm:gap-x-6">
                    <img
                      alt=""
                      src={testimonial.author.imageUrl}
                      className="size-10 sm:size-14 3xl:size-16 rounded-full bg-white/10"
                    />
                    <div className="text-xs sm:text-base 3xl:text-lg">
                      <div className="font-semibold text-white">
                        {testimonial.author.name}
                      </div>
                      <div className="mt-0.5 sm:mt-1 text-neutral-400">
                        {testimonial.author.role}
                      </div>
                    </div>
                  </figcaption>
                </figure>
              </div>
            ))}
          </div>
        </FadeIn>
      </Container>
    </div>
  )
}
