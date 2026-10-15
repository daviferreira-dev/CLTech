import { JobsList } from "./JobsList";

export default function JobsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-12">
      <h1 className="text-2xl font-semibold">Vagas abertas</h1>
      <JobsList />
    </div>
  );
}
