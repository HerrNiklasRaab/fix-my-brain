export default function About() {
  return (
    <div className="min-h-screen bg-white text-black">
      <div className="mx-auto max-w-4xl px-6 py-16">
        <div className="mb-8 inline-block border-4 border-black px-4 py-1">
          <span className="text-xs font-black uppercase tracking-[0.3em]">Profile</span>
        </div>
        <h1 className="mb-6 text-5xl font-black uppercase tracking-tight">About Me</h1>
        <div className="border-t-2 border-black pt-6">
          <p className="text-lg leading-8 text-neutral-700">
            The person behind the broadcast. More details coming soon.
          </p>
        </div>
      </div>
    </div>
  );
}
