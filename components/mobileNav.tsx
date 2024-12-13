"use client";

import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import Link from "next/link";

export default function MobileNav() {
  return (
    <div className="md:hidden">
      <Sheet>
        <SheetTrigger className="h-12">
          <Menu className="h-6" />
        </SheetTrigger>
        <SheetContent side="left">
          <nav>
            <Link href="/" className="flex items-center ml-4">
              <img
                className="right-12"
                // img instead of next/Image
                src="/cgs.png"
                height="48"
                alt="[CGS]"
                //priority={true}
              />
              CGS Games
            </Link>
            <div className="flex flex-col gap-3 lg:gap-4 mt-6">
              <Link href="/browse">Browse</Link>
              <Link href="/upload">Upload</Link>
            </div>
          </nav>
        </SheetContent>
      </Sheet>
    </div>
  );
}
