import { Mismatch } from "./mismatch";

export default function Home() {
  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: 32 }}>
      <h1>hydration-lens — Next.js demo</h1>
      <p>
        The paragraph below is seeded to mismatch between server and client render (a{" "}
        <code>typeof window !== &apos;undefined&apos;</code> check inside a Client Component, with
        no <code>useEffect</code> guard). Open the console to see React&apos;s warning, and the
        hydration-lens badge in the bottom-right corner to see it caught and located.
      </p>
      <Mismatch />
    </main>
  );
}
