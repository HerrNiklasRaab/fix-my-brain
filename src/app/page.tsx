export default function Home() {
  return (
    <div className="min-h-screen bg-white text-black">
      {/* Breaking News Banner */}
      <div className="border-b-4 border-black bg-white py-16 text-center">
        <div className="mx-auto max-w-4xl px-6">
          {/* Breaking News Badge */}
          <div className="mb-8 inline-block border-4 border-black px-6 py-2">
            <span className="animate-flash text-sm font-black uppercase tracking-[0.3em]">
              Breaking News
            </span>
          </div>

          {/* Main Headline */}
          <h1 className="mb-6 text-6xl font-black uppercase leading-none tracking-tight md:text-8xl">
            FIX MY BRAIN
          </h1>

          {/* Chyron-style sub-headline */}
          <div className="mx-auto max-w-2xl border-t-4 border-b-4 border-black py-4">
            <p className="text-lg font-bold uppercase tracking-widest md:text-xl">
              Live coverage of one person&apos;s journey to understand their own mind
            </p>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="mx-auto max-w-4xl px-6 py-16">
        <div className="grid gap-12 md:grid-cols-2">
          {/* Column 1 */}
          <div className="border-t-2 border-black pt-6">
            <h2 className="mb-4 text-2xl font-black uppercase">The Story</h2>
            <p className="leading-7 text-neutral-700">
              Welcome to FIX MY BRAIN — a raw, unfiltered look into the process
              of understanding and improving one&apos;s own mental landscape.
              Follow along as developments unfold in real time.
            </p>
          </div>

          {/* Column 2 */}
          <div className="border-t-2 border-black pt-6">
            <h2 className="mb-4 text-2xl font-black uppercase">Latest Update</h2>
            <p className="leading-7 text-neutral-700">
              Broadcasting live. Stay tuned for updates on condition,
              breakthroughs, setbacks, and everything in between. This is
              a developing story.
            </p>
          </div>
        </div>

        {/* Divider */}
        <div className="my-16 border-t-4 border-black" />

        {/* Bottom section */}
        <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-[0.4em] text-neutral-500">
            This broadcast is ongoing — check back for continuous coverage
          </p>
        </div>
      </div>
    </div>
  );
}
