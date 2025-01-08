import Chat from '@/components/Chat';

export const runtime = "edge";

export default function Home() {
  return (
    <main className="min-h-screen p-4">
      <Chat />
    </main>
  );
}
