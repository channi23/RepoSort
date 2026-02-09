"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";

export default function EnterRepoPage() {
  const [repoUrl, setRepoUrl] = useState("");
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoUrl.trim()) return;

    try {
      // 1. Create Project
      const createRes = await fetch("http://localhost:3000/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoUrl: repoUrl.trim() }),
      });

      if (!createRes.ok) throw new Error("Failed to create project");
      const { ProjectId } = await createRes.json();

      // 2. Trigger Ingestion (Fire and Forget)
      await fetch(`http://localhost:3000/projects/${ProjectId}/ingest`, {
        method: "POST",
      });

      // 3. Redirect to Graph Page
      router.push(`/repos/${ProjectId}`);
    } catch (err) {
      console.error(err);
      alert("Failed to process repository. Please check usage or backend logs.");
    }
  };

  return (
    <main className="min-h-screen bg-neutral-950 flex flex-col">
      <Navbar />
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <h2 className="mt-6 text-3xl font-bold tracking-tight text-white font-epilogue">
              Analyze your Repository
            </h2>
            <p className="mt-2 text-sm text-gray-400">
              Enter your GitHub repository URL to start visualizing.
            </p>
          </div>
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div className="rounded-md shadow-sm -space-y-px">
              <div>
                <label htmlFor="repo-url" className="sr-only">
                  Repository URL
                </label>
                <input
                  id="repo-url"
                  name="repoUrl"
                  type="url"
                  required
                  className="relative block w-full rounded-md border-0 bg-neutral-900 py-3 px-4 text-white ring-1 ring-inset ring-white/10 placeholder:text-gray-500 focus:z-10 focus:ring-2 focus:ring-inset focus:ring-red-500 sm:text-sm sm:leading-6 outline-none"
                  placeholder="https://github.com/username/repo"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                className="group relative flex w-full justify-center rounded-md bg-red-500 px-3 py-3 text-sm font-semibold text-white hover:bg-red-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 transition-colors duration-200"
              >
                Start Sorting
              </button>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}
