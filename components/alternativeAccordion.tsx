'use client';

import AutoUpdateUrl from '@/components/autoUpdateUrl';
import Game from '@/lib/game';
import Link from 'next/link';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/accordion';

export default function AlternativeAccordion({ game, cgsgg }: { game: Game; cgsgg: string }) {
  return (
    <Accordion type="single" collapsible>
      <AccordionItem value="item-1">
        <AccordionTrigger>Use Steam</AccordionTrigger>
        <AccordionContent className="flex flex-col gap-4 text-balance">
          <h4 className="text-xl font-semibold">1. Install CGS</h4>
          <iframe
            src="https://store.steampowered.com/widget/1742850/"
            width="646"
            height="190"
          ></iframe>
          <h4 className="text-xl font-semibold">2. Import {game.name}</h4>
          <AutoUpdateUrl url={game.autoUpdateUrl} />
          <ol className="list-decimal list-inside ml-4">
            <li>Copy the above AutoUpdateUrl</li>
            <li>Use Steam to launch CGS and go to the Main Menu</li>
            <li>Open the Games Management Menu by tapping on the card in the center</li>
            <li>Click the Import button and select &quot;Download from Web&quot;</li>
            <li>Paste the AutoUpdateUrl and Submit Download</li>
          </ol>
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="item-2">
        <AccordionTrigger>Use Web Browser</AccordionTrigger>
        <AccordionContent className="flex flex-col gap-4 text-balance">
          <p>
            You can also play {game.name} in your browser at{' '}
            <Link href={`${cgsgg}`} target="_blank">
              cgs.gg
            </Link>
          </p>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
