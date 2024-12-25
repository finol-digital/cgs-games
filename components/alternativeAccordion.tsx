"use client";

import AutoUpdateUrl from "@/components/autoUpdateUrl";
import Game from "@/lib/game";
import { Accordion, AccordionItem } from "@nextui-org/accordion";
import Link from "next/link";

export default function AlternativeAccordion({
  game,
  cgsgg,
}: {
  game: Game;
  cgsgg: string;
}) {
  return (
    <Accordion>
      <AccordionItem key="1" aria-label="Use Steam" title="Use Steam">
        <h4>1. Install CGS</h4>
        <iframe
          src="https://store.steampowered.com/widget/1742850/"
          width="646"
          height="190"
        ></iframe>
        <h4>2. Import {game.name}</h4>
        <AutoUpdateUrl url={game.autoUpdateUrl} />
        <ol>
          <li>Copy the above AutoUpdateUrl</li>
          <li>Use Steam to launch CGS and go to the Main Menu</li>
          <li>
            Open the Games Management Menu by tapping on the card in the center
          </li>
          <li>
            Click the Import button and select &quot;Download from Web&quot;
          </li>
          <li>Paste the AutoUpdateUrl and Submit Download</li>
        </ol>
      </AccordionItem>
      <AccordionItem
        key="1"
        aria-label="Use Web Browser"
        title="Use Web Browser"
      >
        You may try limited functionality at{" "}
        <Link href={`${cgsgg}`}>{cgsgg}</Link>
      </AccordionItem>
    </Accordion>
  );
}
