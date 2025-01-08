export const runtime = "edge";

export default function NotFound() {
  return (
    <div className="h-screen flex flex-col items-center justify-center bg-deep-blue text-white">
      <img 
        src="/favicon.ico" 
        alt="404 Nyan Cat"
        className="mb-8"
      />
      <h1 className="text-4xl font-bold mb-2">404</h1>
      <h2 className="text-xl opacity-75">This page could not be found.</h2>
    </div>
  );
}
