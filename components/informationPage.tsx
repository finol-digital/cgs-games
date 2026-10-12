import type { ReactNode } from 'react';
import Footer from '@/components/footer';

interface InformationPageProps {
  title: string;
  children: ReactNode;
}

/** Keeps public information and its complete footer in the shared page flow. */
export default function InformationPage({ title, children }: InformationPageProps) {
  return (
    <div className="flex flex-1 flex-col">
      <main className="main-content mx-auto max-w-3xl px-4 pb-6 [&_h2]:my-4 [&_h2]:text-2xl [&_h2]:font-bold [&_p]:my-3 [&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded [&_pre]:bg-slate-800 [&_pre]:p-4 [&_ul]:list-disc [&_ul]:pl-6">
        <h1 className="my-4 text-center text-4xl font-bold">{title}</h1>
        {children}
      </main>
      <Footer />
    </div>
  );
}
