import { JobDetail } from "./JobDetail";

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <JobDetail jobId={id} />
    </div>
  );
}
